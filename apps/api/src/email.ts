import nodemailer from 'nodemailer';
import { env } from './config';

type OrderEmailPayload = {
  to: string;
  sellerName: string;
  orderId: string;

  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;

  deliveryDate: string | null;
  deliveryNotes?: string | null;
  deliveryAddress?: any;

  total: string;
  items: Array<{ name: string; variant: string | null; quantity: string; unit: string; unitPrice: string }>;
};

function safeJson(v: any): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export async function sendOrderEmail(payload: OrderEmailPayload) {
  // If SMTP not configured, just log (dev-friendly)
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.log('[EMAIL:DEV] Would send order email:', safeJson(payload));
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  const lines = payload.items
    .map((i) => `- ${i.name}${i.variant ? ` (${i.variant})` : ''}: ${i.quantity} ${i.unit} • ${i.unitPrice}`)
    .join('\n');

  const text = `
Novo pedido pago ✅

Fornecedor: ${payload.sellerName}
Pedido: ${payload.orderId}

Cliente: ${payload.buyerName ?? '-'}
E-mail cliente: ${payload.buyerEmail ?? '-'}
Telefone cliente: ${payload.buyerPhone ?? '-'}

Entrega: ${payload.deliveryDate ?? '-'}
Obs: ${payload.deliveryNotes ?? '-'}

Endereço:
${payload.deliveryAddress ? safeJson(payload.deliveryAddress) : '-'}

Itens:
${lines}

Total: ${payload.total}

---
LotePro
`.trim();

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: `Novo pedido - LotePro (${payload.orderId.slice(0, 8)}...)`,
    text,
  });
}
