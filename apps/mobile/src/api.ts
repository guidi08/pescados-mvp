import { supabase } from './supabaseClient';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export async function apiRequest<T>(path: string, options: { method?: string; body?: any } = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => null);

      // Friendly messages for common API errors
      if (err?.error === 'wallet_negative_balance') {
        throw new Error(`Seu saldo está negativo (${err.balance}). Quite o saldo para continuar.`);
      }
      if (err?.error === 'seller_not_enabled_for_b2c') {
        throw new Error('Este fornecedor não está habilitado para B2C (CPF).');
      }
      if (err?.error === 'below_min_order') {
        throw new Error('Pedido abaixo do mínimo do fornecedor.');
      }
      if (err?.error) {
        throw new Error(String(err.error));
      }
    }

    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---- Convenience wrappers (MVP) ----

export type CreateOrderPayload = {
  sellerId: string;
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
  deliveryNotes?: string;
  deliveryAddress?: any;
  deliveryDate?: string; // YYYY-MM-DD
};

export function createOrder(payload: CreateOrderPayload) {
  return apiRequest<{
    orderId: string;
    subtotal: string;
    shipping: string;
    total: string;
    deliveryDate: string;
    buyerChannel: 'b2b' | 'b2c';
  }>(
    '/orders',
    { method: 'POST', body: payload }
  );
}

export function createPaymentSheet(orderId: string) {
  return apiRequest<{
    paymentIntentClientSecret: string;
    customerId: string;
    customerEphemeralKeySecret: string;
    publishableKey: string;
  }>(
    '/payments/stripe/payment-sheet',
    { method: 'POST', body: { orderId } }
  );
}

export function createPixPayment(orderId: string) {
  return apiRequest<{
    paymentIntentId: string;
    clientSecret: string;
    pix: any;
    subtotal: string;
    shipping: string;
    total: string;
  }>(
    '/payments/stripe/pix',
    { method: 'POST', body: { orderId } }
  );
}

export function cancelOrder(orderId: string) {
  return apiRequest<{ ok: boolean; status: string }>(`/orders/${orderId}/cancel`, { method: 'POST' });
}

export function getWalletMe() {
  return apiRequest<{ balanceCents: number; balance: string; currency: string; transactions: Array<any> }>(
    '/wallet/me'
  );
}

export function createWalletTopupPaymentSheet(amountCents: number) {
  return apiRequest<{
    paymentIntentClientSecret: string;
    customerId: string;
    customerEphemeralKeySecret: string;
    publishableKey: string;
  }>(
    '/wallet/topup/payment-sheet',
    { method: 'POST', body: { amountCents } }
  );
}

export function createWalletTopupPix(amountCents: number) {
  return apiRequest<{ paymentIntentId: string; clientSecret: string; pix: any; total: string }>(
    '/wallet/topup/pix',
    { method: 'POST', body: { amountCents } }
  );
}
