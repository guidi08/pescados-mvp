import express from 'express';
import cors from 'cors';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { env, commissionBps, processingBps, cancelHoursBeforeCutoffFrozen } from './config';
import { requireAuth, AuthedRequest } from './auth';
import { supabaseService } from './supabase';
import { stripe } from './stripe';
import { formatBRL } from './utils';
import { sendOrderEmail } from './email';

const app = express();

/**
 * Stripe webhook needs raw body.
 */
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig || Array.isArray(sig)) return res.status(400).send('Missing stripe-signature header');

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as any;
      const orderId = pi.metadata?.order_id as string | undefined;
      const isWalletTopup = pi.metadata?.wallet_topup === 'true';
      if (isWalletTopup) {
        const buyerId = pi.metadata?.buyer_id as string | undefined;
        if (buyerId) await applyWalletTopup(buyerId, pi);
      } else if (orderId) {
        await markOrderPaidAndNotify(orderId, pi);
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as any;
      const orderId = pi.metadata?.order_id as string | undefined;
      if (orderId) {
        await supabaseService
          .from('orders')
          .update({ payment_status: 'failed', status: 'pending_payment' })
          .eq('id', orderId);
      }
    }

    if (event.type === 'payment_intent.canceled') {
      const pi = event.data.object as any;
      const orderId = pi.metadata?.order_id as string | undefined;
      if (orderId) {
        await supabaseService
          .from('orders')
          .update({ payment_status: 'canceled', status: 'canceled' })
          .eq('id', orderId);
      }
    }

    if (event.type === 'account.updated') {
      const acct = event.data.object as any;
      const acctId = acct.id as string;
      await supabaseService
        .from('sellers')
        .update({
          stripe_account_charges_enabled: Boolean(acct.charges_enabled),
          stripe_account_payouts_enabled: Boolean(acct.payouts_enabled),
        })
        .eq('stripe_account_id', acctId);
    }

    return res.json({ received: true });
  } catch (e) {
    console.error('Webhook handler error:', e);
    return res.status(500).json({ error: 'webhook_handler_error' });
  }
});

// JSON for the rest
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * ---------- Orders ----------
 */
const createOrderSchema = z.object({
  sellerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().positive(),
  })).min(1).max(50),
  deliveryAddress: z.any().optional(),
  deliveryNotes: z.string().max(1000).optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
});

app.post('/orders', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

  const buyerId = req.user!.id;
  const { sellerId, items, deliveryAddress, deliveryNotes, deliveryDate } = parsed.data;

  // buyer profile (to decide b2b/b2c)
  const { data: buyerProfile, error: buyerErr } = await supabaseService
    .from('profiles')
    .select('id, cnpj, cpf, full_name')
    .eq('id', buyerId)
    .single();

  if (buyerErr) return res.status(500).json({ error: 'buyer_profile_error' });

  const buyerChannel: 'b2b' | 'b2c' = buyerProfile?.cnpj ? 'b2b' : 'b2c';

  // seller
  const { data: seller, error: sellerError } = await supabaseService
    .from('sellers')
    .select('*')
    .eq('id', sellerId)
    .single();

  if (sellerError || !seller) return res.status(404).json({ error: 'seller_not_found' });
  if (!seller.active) return res.status(400).json({ error: 'seller_inactive' });

  if (buyerChannel === 'b2c' && !seller.b2c_enabled) {
    return res.status(400).json({ error: 'seller_not_enabled_for_b2c' });
  }

  // Fetch products and variants
  const productIds = Array.from(new Set(items.map(i => i.productId)));
  const variantIds = Array.from(new Set(items.map(i => i.variantId).filter(Boolean) as string[]));

  const { data: products, error: prodErr } = await supabaseService
    .from('products')
    .select('*')
    .in('id', productIds);

  if (prodErr) return res.status(500).json({ error: 'products_fetch_error' });

  const productsById = new Map<string, any>((products ?? []).map(p => [p.id, p]));

  let variantsById = new Map<string, any>();
  if (variantIds.length) {
    const { data: variants, error: varErr } = await supabaseService
      .from('product_variants')
      .select('*')
      .in('id', variantIds);

    if (varErr) return res.status(500).json({ error: 'variants_fetch_error' });
    variantsById = new Map<string, any>((variants ?? []).map(v => [v.id, v]));
  }

  // Validate items & compute totals
  let subtotalCents = 0;
  let containsFresh = false;

  const orderItemsToInsert: any[] = [];

  for (const item of items) {
    const p = productsById.get(item.productId);
    if (!p) return res.status(400).json({ error: 'invalid_product', productId: item.productId });
    if (p.seller_id !== sellerId) return res.status(400).json({ error: 'product_wrong_seller', productId: item.productId });
    if (!p.active) return res.status(400).json({ error: 'product_inactive', productId: item.productId });

    const pricingMode = (p.pricing_mode as string) ?? 'per_unit';
    const unit = p.unit as string;

    let unitPriceCents = p.base_price_cents as number;
    let variantName: string | null = null;
    let minExpiryDateSnapshot: string | null = p.min_expiry_date ?? null;

    if (item.variantId) {
      const v = variantsById.get(item.variantId);
      if (!v) return res.status(400).json({ error: 'invalid_variant', variantId: item.variantId });
      if (v.product_id !== p.id) return res.status(400).json({ error: 'variant_wrong_product', variantId: item.variantId });
      if (!v.active) return res.status(400).json({ error: 'variant_inactive', variantId: item.variantId });
      unitPriceCents = v.price_cents as number;
      variantName = v.name as string;
      minExpiryDateSnapshot = v.min_expiry_date ?? minExpiryDateSnapshot;
    }

    let lineCents = 0;
    let estimatedTotalWeightKg: number | null = null;

    if (pricingMode === 'per_unit') {
      lineCents = Math.round(unitPriceCents * item.quantity);
    } else if (pricingMode === 'per_kg_box') {
      // quantity = boxes, price = per kg, use estimated_box_weight_kg
      const est = Number(p.estimated_box_weight_kg);
      if (!Number.isFinite(est) || est <= 0) {
        return res.status(400).json({ error: 'product_missing_estimated_box_weight', productId: p.id });
      }

      // ensure quantity is integer boxes
      if (!Number.isInteger(item.quantity)) {
        return res.status(400).json({ error: 'box_quantity_must_be_integer', productId: p.id });
      }

      estimatedTotalWeightKg = est * item.quantity;
      lineCents = Math.round(unitPriceCents * estimatedTotalWeightKg);
    } else {
      return res.status(400).json({ error: 'invalid_pricing_mode', productId: p.id });
    }

    subtotalCents += lineCents;

    if (p.fresh) containsFresh = true;

    orderItemsToInsert.push({
      product_id: p.id,
      variant_id: item.variantId ?? null,

      product_name_snapshot: p.name,
      variant_name_snapshot: variantName,
      unit_snapshot: unit,

      fresh_snapshot: Boolean(p.fresh),
      min_expiry_date_snapshot: minExpiryDateSnapshot,

      pricing_mode_snapshot: pricingMode,
      unit_price_cents_snapshot: unitPriceCents,
      quantity: item.quantity,

      estimated_total_weight_kg_snapshot: estimatedTotalWeightKg,
      actual_total_weight_kg: null,

      line_total_cents_snapshot: lineCents,
    });
  }

  if (subtotalCents < (seller.min_order_cents ?? 0)) {
    return res.status(400).json({ error: 'below_min_order', minOrder: seller.min_order_cents });
  }

  const shippingCents = Number(seller.shipping_fee_cents ?? 0);
  const totalCents = subtotalCents + shippingCents;

  // Fees
  const platformCommissionCents = Math.round((subtotalCents * commissionBps) / 10_000);
  const platformProcessingCents = Math.round((totalCents * processingBps) / 10_000);

  const platformFeeCents = platformCommissionCents + platformProcessingCents;

  const riskReserveBps = Number(seller.risk_reserve_bps ?? 0);
  const riskReserveCents = Math.round((subtotalCents * riskReserveBps) / 10_000);

  const sellerPayoutCents = Math.max(0, totalCents - platformFeeCents - riskReserveCents);

  // Delivery date based on cutoff
  const computedDeliveryDate = deliveryDate ?? computeDeliveryDate(seller.cutoff_time, seller.timezone);

  // Insert order
  const { data: order, error: orderErr } = await supabaseService
    .from('orders')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      buyer_channel: buyerChannel,

      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      currency: 'brl',

      platform_commission_cents: platformCommissionCents,
      platform_processing_cents: platformProcessingCents,
      platform_fee_cents: platformFeeCents,
      risk_reserve_cents: riskReserveCents,
      seller_payout_cents: sellerPayoutCents,

      contains_fresh: containsFresh,

      delivery_date: computedDeliveryDate,
      delivery_notes: deliveryNotes ?? null,
      delivery_address: deliveryAddress ?? null,

      status: 'pending_payment',
      payment_status: 'unpaid',
    })
    .select('*')
    .single();

  if (orderErr || !order) {
    console.error(orderErr);
    return res.status(500).json({ error: 'order_create_failed' });
  }

  // Insert order items
  const itemsWithOrder = orderItemsToInsert.map(i => ({ ...i, order_id: order.id }));
  const { error: oiErr } = await supabaseService.from('order_items').insert(itemsWithOrder);
  if (oiErr) {
    console.error(oiErr);
    // best-effort rollback
    await supabaseService.from('orders').delete().eq('id', order.id);
    return res.status(500).json({ error: 'order_items_create_failed' });
  }

  return res.json({
    orderId: order.id,
    subtotal: formatBRL(subtotalCents),
    shipping: formatBRL(shippingCents),
    total: formatBRL(totalCents),
    deliveryDate: computedDeliveryDate,
    buyerChannel,
  });
});

/**
 * ---------- Payments ----------
 */
const orderIdSchema = z.object({ orderId: z.string().uuid() });

app.post('/payments/stripe/payment-sheet', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = orderIdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  const buyerId = req.user!.id;
  const { orderId } = parsed.data;

  const order = await getOrderForBuyer(orderId, buyerId);
  if (!order) return res.status(404).json({ error: 'order_not_found' });
  if (order.status !== 'pending_payment') return res.status(400).json({ error: 'order_not_payable' });

  const seller = await getSellerForOrder(order.seller_id);
  if (!seller?.stripe_account_id) return res.status(400).json({ error: 'seller_not_ready_for_payouts' });

  const customerId = await ensureStripeCustomer(buyerId, req.user!.email ?? undefined);

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2024-06-20' }
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.total_cents,
    currency: 'brl',
    customer: customerId,
    payment_method_types: ['card'],
    metadata: {
      order_id: order.id,
      seller_id: order.seller_id,
      buyer_id: buyerId,
      buyer_channel: order.buyer_channel,
      platform_fee_cents: String(order.platform_fee_cents),
      risk_reserve_cents: String(order.risk_reserve_cents),
      seller_payout_cents: String(order.seller_payout_cents),
    },
    description: `Pedido ${order.id} - Pescados Marketplace`,
    application_fee_amount: order.platform_fee_cents,
    transfer_data: {
      destination: seller.stripe_account_id,
      amount: order.seller_payout_cents,
    },
  });

  await supabaseService
    .from('orders')
    .update({
      payment_provider: 'stripe',
      payment_method: 'card',
      payment_intent_id: paymentIntent.id,
      payment_status: 'processing',
    })
    .eq('id', order.id);

  return res.json({
    paymentIntentClientSecret: paymentIntent.client_secret,
    customerId,
    customerEphemeralKeySecret: ephemeralKey.secret,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  });
});

app.post('/payments/stripe/pix', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = orderIdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  const buyerId = req.user!.id;
  const { orderId } = parsed.data;

  const order = await getOrderForBuyer(orderId, buyerId);
  if (!order) return res.status(404).json({ error: 'order_not_found' });
  if (order.status !== 'pending_payment') return res.status(400).json({ error: 'order_not_payable' });

  const seller = await getSellerForOrder(order.seller_id);
  if (!seller?.stripe_account_id) return res.status(400).json({ error: 'seller_not_ready_for_payouts' });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.total_cents,
    currency: 'brl',
    payment_method_types: ['pix'],
    metadata: {
      order_id: order.id,
      seller_id: order.seller_id,
      buyer_id: buyerId,
      buyer_channel: order.buyer_channel,
      platform_fee_cents: String(order.platform_fee_cents),
      risk_reserve_cents: String(order.risk_reserve_cents),
      seller_payout_cents: String(order.seller_payout_cents),
    },
    description: `Pedido ${order.id} - Pescados Marketplace (Pix)`,
    receipt_email: req.user!.email ?? undefined,
    payment_method_options: {
      pix: {
        expires_after_seconds: 3600,
      },
    } as any,
    application_fee_amount: order.platform_fee_cents,
    transfer_data: {
      destination: seller.stripe_account_id,
      amount: order.seller_payout_cents,
    },
  });

  await supabaseService
    .from('orders')
    .update({
      payment_provider: 'stripe',
      payment_method: 'pix',
      payment_intent_id: paymentIntent.id,
      payment_status: 'processing',
    })
    .eq('id', order.id);

  const pix = (paymentIntent.next_action as any)?.pix_display_qr_code ?? null;

  return res.json({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    pix: pix ? {
      data: pix.data,
      expiresAt: pix.expires_at,
      hostedInstructionsUrl: pix.hosted_instructions_url,
      imageUrlPng: pix.image_url_png,
      imageUrlSvg: pix.image_url_svg,
    } : null,
    subtotal: formatBRL(order.subtotal_cents),
    shipping: formatBRL(order.shipping_cents),
    total: formatBRL(order.total_cents),
  });
});

/**
 * ---------- Seller: Stripe Connect onboarding link ----------
 * Called from the seller portal to let the seller complete KYC and set bank details.
 */
const sellerOnboardingSchema = z.object({ sellerId: z.string().uuid() });

app.post('/sellers/stripe/onboarding-link', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = sellerOnboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });

  const { sellerId } = parsed.data;
  const userId = req.user!.id;

  // Ensure user belongs to this seller (or admin)
  const { data: profile } = await supabaseService.from('profiles').select('role, seller_id').eq('id', userId).single();
  const isAdmin = profile?.role === 'admin';
  if (!isAdmin && profile?.seller_id !== sellerId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { data: seller } = await supabaseService.from('sellers').select('*').eq('id', sellerId).single();
  if (!seller) return res.status(404).json({ error: 'seller_not_found' });

  let stripeAccountId = seller.stripe_account_id as string | null;

  if (!stripeAccountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      country: 'BR',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_type: 'company',
      metadata: { seller_id: sellerId },
    });
    stripeAccountId = acct.id;
    await supabaseService.from('sellers').update({ stripe_account_id: stripeAccountId }).eq('id', sellerId);
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${env.ADMIN_BASE_URL}/dashboard`,
    return_url: `${env.ADMIN_BASE_URL}/dashboard`,
    type: 'account_onboarding',
  });

  return res.json({ url: accountLink.url, stripeAccountId });
});

/**
 * ---------- Buyer cancel (frozen only, up to X hours before cut-off) ----------
 */
app.post('/orders/:orderId/cancel', requireAuth, async (req: AuthedRequest, res) => {
  const orderId = req.params.orderId;
  const buyerId = req.user!.id;

  const order = await getOrderForBuyer(orderId, buyerId);
  if (!order) return res.status(404).json({ error: 'order_not_found' });

  if (order.status === 'canceled') return res.json({ ok: true, status: 'canceled' });
  if (order.contains_fresh) return res.status(400).json({ error: 'fresh_items_no_cancellation' });

  // cancellation window: until (cutoff of day before delivery) - X hours
  const seller = await getSellerForOrder(order.seller_id);
  if (!seller) return res.status(404).json({ error: 'seller_not_found' });

  const cancelDeadline = computeCancelDeadline(order.delivery_date, seller.cutoff_time, seller.timezone, cancelHoursBeforeCutoffFrozen);
  const now = DateTime.now().setZone(seller.timezone);
  if (now > cancelDeadline) {
    return res.status(400).json({ error: 'cancellation_window_closed', deadline: cancelDeadline.toISO() });
  }

  // If already paid, refund
  if (order.payment_provider === 'stripe' && order.payment_intent_id && order.payment_status === 'succeeded') {
    try {
      await stripe.refunds.create({
        payment_intent: order.payment_intent_id,
        // important for Connect destination charges:
        reverse_transfer: true,
        refund_application_fee: true,
      } as any);
    } catch (e) {
      console.error('Refund error:', e);
      return res.status(500).json({ error: 'refund_failed' });
    }
  }

  await supabaseService.from('orders').update({
    status: 'canceled',
    payment_status: order.payment_status === 'succeeded' ? 'refunded' : 'canceled',
  }).eq('id', order.id);

  return res.json({ ok: true, status: 'canceled' });
});

/**
 * ---------- Seller updates actual weights (variable weight box) -> wallet adjustment ----------
 * This endpoint is called from the seller portal (not direct DB update).
 */
const updateWeightsSchema = z.object({
  items: z.array(z.object({
    orderItemId: z.string().uuid(),
    actualTotalWeightKg: z.number().positive(),
  })).min(1).max(50),
});

app.post('/orders/:orderId/weights', requireAuth, async (req: AuthedRequest, res) => {
  const orderId = req.params.orderId;
  const parsed = updateWeightsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

  const userId = req.user!.id;

  // Seller permission check: user must belong to seller for this order (or admin)
  const { data: profile } = await supabaseService.from('profiles').select('role, seller_id').eq('id', userId).single();
  const isAdmin = profile?.role === 'admin';

  const { data: order } = await supabaseService.from('orders').select('*').eq('id', orderId).single();
  if (!order) return res.status(404).json({ error: 'order_not_found' });

  if (!isAdmin && profile?.seller_id !== order.seller_id) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { data: orderItems } = await supabaseService.from('order_items').select('*').eq('order_id', orderId);
  const itemsById = new Map<string, any>((orderItems ?? []).map(i => [i.id, i]));

  let totalDeltaCents = 0;

  for (const upd of parsed.data.items) {
    const oi = itemsById.get(upd.orderItemId);
    if (!oi) return res.status(400).json({ error: 'order_item_not_found', orderItemId: upd.orderItemId });

    if (oi.pricing_mode_snapshot !== 'per_kg_box') {
      return res.status(400).json({ error: 'order_item_not_variable_weight', orderItemId: upd.orderItemId });
    }

    const estimated = Number(oi.estimated_total_weight_kg_snapshot ?? 0);
    const actual = Number(upd.actualTotalWeightKg);

    if (!Number.isFinite(estimated) || estimated <= 0) {
      return res.status(400).json({ error: 'missing_estimated_weight', orderItemId: upd.orderItemId });
    }

    const unitPriceCentsPerKg = Number(oi.unit_price_cents_snapshot);
    const deltaKg = actual - estimated;
    const deltaCents = Math.round(deltaKg * unitPriceCentsPerKg);

    // update item actual weight
    await supabaseService.from('order_items').update({ actual_total_weight_kg: actual }).eq('id', oi.id);

    totalDeltaCents += deltaCents;
  }

  // Apply wallet adjustment (only for B2B, by design)
  if (order.buyer_channel !== 'b2b') {
    return res.json({ ok: true, note: 'Order is B2C; wallet adjustment skipped.', deltaCents: totalDeltaCents });
  }

  // deltaCents > 0 means buyer owes more (debit wallet), so transaction amount is -deltaCents
  const walletAmountCents = totalDeltaCents > 0 ? -totalDeltaCents : Math.abs(totalDeltaCents);

  await ensureBuyerWallet(order.buyer_id);

  // insert wallet transaction
  await supabaseService.from('wallet_transactions').insert({
    buyer_id: order.buyer_id,
    order_id: order.id,
    amount_cents: walletAmountCents,
    kind: 'weight_adjustment',
    note: totalDeltaCents > 0
      ? `Ajuste por peso real maior que o estimado (+${formatBRL(totalDeltaCents)})`
      : `Ajuste por peso real menor que o estimado (${formatBRL(totalDeltaCents)})`,
    metadata: { delta_cents: totalDeltaCents },
  });

  // update wallet balance
  const { data: wallet } = await supabaseService.from('buyer_wallets').select('*').eq('buyer_id', order.buyer_id).single();
  const newBalance = Number(wallet?.balance_cents ?? 0) + walletAmountCents;
  await supabaseService.from('buyer_wallets').update({ balance_cents: newBalance }).eq('buyer_id', order.buyer_id);

  return res.json({
    ok: true,
    deltaCents: totalDeltaCents,
    walletTransactionCents: walletAmountCents,
    newBalanceCents: newBalance,
    newBalance: formatBRL(newBalance),
  });
});

/**
 * ---------- Jobs: release rolling reserve ----------
 * Call this endpoint from a cron (Render Cron, GitHub Actions, etc).
 * Protect it with an env var (JOB_SECRET) and pass header: x-job-secret.
 */
const jobSecret = process.env.JOB_SECRET;

app.post('/jobs/release-reserves', async (req, res) => {
  if (!jobSecret) return res.status(400).json({ error: 'JOB_SECRET_not_configured' });

  const provided = req.headers['x-job-secret'];
  if (!provided || Array.isArray(provided) || provided !== jobSecret) return res.status(401).json({ error: 'unauthorized' });

  const now = new Date().toISOString();
  const { data: reserves, error } = await supabaseService
    .from('seller_reserves')
    .select('*')
    .eq('status', 'held')
    .lte('release_at', now)
    .limit(200);

  if (error) return res.status(500).json({ error: 'fetch_reserves_failed' });

  let released = 0;
  for (const r of reserves ?? []) {
    try {
      // find seller stripe account
      const { data: seller } = await supabaseService.from('sellers').select('stripe_account_id').eq('id', r.seller_id).single();
      if (!seller?.stripe_account_id) continue;

      const transfer = await stripe.transfers.create({
        amount: r.amount_cents,
        currency: 'brl',
        destination: seller.stripe_account_id,
        metadata: { reserve_id: r.id, order_id: r.order_id },
      });

      await supabaseService.from('seller_reserves').update({
        status: 'released',
        stripe_transfer_id: transfer.id,
        released_at: new Date().toISOString(),
      }).eq('id', r.id);

      released += 1;
    } catch (e) {
      console.error('Reserve release error:', e);
      // continue
    }
  }

  return res.json({ ok: true, released, checked: reserves?.length ?? 0 });
});

/**
 * ---------- helpers ----------
 */
async function getOrderForBuyer(orderId: string, buyerId: string): Promise<any | null> {
  const { data, error } = await supabaseService
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('buyer_id', buyerId)
    .single();

  if (error) return null;
  return data;
}

async function getSellerForOrder(sellerId: string): Promise<any | null> {
  const { data, error } = await supabaseService.from('sellers').select('*').eq('id', sellerId).single();
  if (error) return null;
  return data;
}

function computeDeliveryDate(cutoffTime: string, timezone: string): string {
  // cutoffTime from Postgres "time" comes as "HH:MM:SS"
  const now = DateTime.now().setZone(timezone);
  const [hh, mm] = cutoffTime.split(':').map((v: string) => Number(v));
  const cutoff = now.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });

  const delivery = now <= cutoff ? now.plus({ days: 1 }) : now.plus({ days: 2 });
  return delivery.toISODate()!;
}

function computeCancelDeadline(deliveryDateISO: string | null, cutoffTime: string, timezone: string, hoursBefore: number): DateTime {
  const deliveryDate = deliveryDateISO ? DateTime.fromISO(deliveryDateISO, { zone: timezone }) : DateTime.now().setZone(timezone).plus({ days: 1 });
  const prepDay = deliveryDate.minus({ days: 1 });

  const [hh, mm] = cutoffTime.split(':').map((v: string) => Number(v));
  const cutoffDateTime = prepDay.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });

  return cutoffDateTime.minus({ hours: hoursBefore });
}

async function ensureStripeCustomer(buyerId: string, email?: string): Promise<string> {
  const { data: profile, error: profErr } = await supabaseService
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', buyerId)
    .single();

  let stripeCustomerId: string | null = null;

  if (!profErr && profile?.stripe_customer_id) {
    stripeCustomerId = profile.stripe_customer_id;
  }

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: buyerId },
    });
    stripeCustomerId = customer.id;

    await supabaseService
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', buyerId);
  }

  return stripeCustomerId;
}

async function ensureBuyerWallet(buyerId: string): Promise<void> {
  const { data, error } = await supabaseService.from('buyer_wallets').select('buyer_id').eq('buyer_id', buyerId).single();
  if (!data || error) {
    await supabaseService.from('buyer_wallets').upsert({ buyer_id: buyerId, balance_cents: 0, currency: 'brl' });
  }
}

async function applyWalletTopup(buyerId: string, paymentIntent: any): Promise<void> {
  const amountCents = Number(paymentIntent.amount ?? 0);
  if (!amountCents || amountCents <= 0) return;

  await ensureBuyerWallet(buyerId);

  // Add transaction if not already present (idempotency)
  const piId = paymentIntent.id as string;
  const { data: existing } = await supabaseService
    .from('wallet_transactions')
    .select('id')
    .eq('kind', 'topup')
    .contains('metadata', { payment_intent_id: piId } as any);

  if (existing && existing.length) return;

  await supabaseService.from('wallet_transactions').insert({
    buyer_id: buyerId,
    amount_cents: amountCents,
    kind: 'topup',
    note: 'Recarga de saldo',
    metadata: { payment_intent_id: piId },
  });

  const { data: wallet } = await supabaseService.from('buyer_wallets').select('*').eq('buyer_id', buyerId).single();
  const newBalance = Number(wallet?.balance_cents ?? 0) + amountCents;
  await supabaseService.from('buyer_wallets').update({ balance_cents: newBalance }).eq('buyer_id', buyerId);
}

async function markOrderPaidAndNotify(orderId: string, paymentIntent: any): Promise<void> {
  const chargeId = paymentIntent.latest_charge ?? (paymentIntent.charges?.data?.[0]?.id ?? null);

  const { data: order, error } = await supabaseService
    .from('orders')
    .update({
      status: 'paid',
      payment_status: 'succeeded',
      payment_intent_id: paymentIntent.id,
      charge_id: chargeId,
      paid_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*')
    .single();

  if (error || !order) {
    console.error('Failed updating order as paid:', error);
    return;
  }

  // Create rolling reserve ledger row (if any) - release after seller.risk_reserve_days
  try {
    const { data: seller } = await supabaseService
      .from('sellers')
      .select('risk_reserve_days')
      .eq('id', order.seller_id)
      .single();

    if (order.risk_reserve_cents && order.risk_reserve_cents > 0) {
      const releaseAt = DateTime.now().plus({ days: Number(seller?.risk_reserve_days ?? 60) }).toISO();

      // idempotency: one reserve per order
      const { data: existing } = await supabaseService
        .from('seller_reserves')
        .select('id')
        .eq('order_id', order.id)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabaseService.from('seller_reserves').insert({
          seller_id: order.seller_id,
          order_id: order.id,
          amount_cents: order.risk_reserve_cents,
          currency: order.currency,
          status: 'held',
          release_at: releaseAt,
        });
      }
    }
  } catch (e) {
    console.error('Failed creating reserve ledger:', e);
  }

  // Fetch seller + items + buyer profile
  const [{ data: seller }, { data: items }, { data: buyerProfile }] = await Promise.all([
    supabaseService.from('sellers').select('*').eq('id', order.seller_id).single(),
    supabaseService.from('order_items').select('*').eq('order_id', order.id),
    supabaseService.from('profiles').select('*').eq('id', order.buyer_id).single(),
  ]);

  if (!seller?.order_email) {
    console.warn('Seller order_email missing. Skipping email.');
    return;
  }

  const emailItems = (items ?? []).map((i: any) => ({
    name: i.product_name_snapshot,
    variant: i.variant_name_snapshot,
    quantity: String(i.quantity),
    unit: i.unit_snapshot,
    unitPrice: formatBRL(i.unit_price_cents_snapshot),
  }));

  await sendOrderEmail({
    to: seller.order_email,
    sellerName: seller.display_name,
    orderId: order.id,
    buyerName: buyerProfile?.full_name ?? null,
    buyerEmail: buyerProfile?.email ?? null,
    buyerPhone: buyerProfile?.phone ?? null,
    deliveryDate: order.delivery_date,
    deliveryNotes: order.delivery_notes,
    deliveryAddress: order.delivery_address,
    total: formatBRL(order.total_cents),
    items: emailItems,
  });
}

app.listen(Number(env.PORT), () => {
  console.log(`API listening on :${env.PORT}`);
});
