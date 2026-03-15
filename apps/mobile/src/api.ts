import { supabase } from './supabaseClient';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  console.warn('[api] Missing EXPO_PUBLIC_API_BASE_URL — API calls will fail.');
}

/**
 * Authenticated API request with automatic token refresh and 401 handling.
 */
export async function apiRequest<T>(path: string, options: { method?: string; body?: any } = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error('API não configurada (EXPO_PUBLIC_API_BASE_URL ausente).');

  // Use getSession which auto-refreshes if token is expired (requires AsyncStorage)
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Sessão expirada: ${sessionError.message}`);

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
    // Handle 401 — token expired or revoked
    if (res.status === 401) {
      // Try refreshing the session once
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      // Retry the request with the new token
      const { data: newSession } = await supabase.auth.getSession();
      const newToken = newSession.session?.access_token;
      const retryRes = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (retryRes.ok) return retryRes.json() as Promise<T>;
      // If retry also fails, fall through to error handling with retryRes
      return handleErrorResponse(retryRes);
    }

    return handleErrorResponse(res);
  }

  return res.json() as Promise<T>;
}

async function handleErrorResponse(res: Response): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const err = await res.json().catch(() => null);

    if (err?.error === 'wallet_negative_balance') {
      throw new Error(`Seu saldo est\u00e1 negativo (${err.balance}). Quite o saldo para continuar.`);
    }
    if (err?.error === 'seller_not_enabled_for_b2c') {
      throw new Error('Este fornecedor n\u00e3o est\u00e1 habilitado para B2C (CPF).');
    }
    if (err?.error === 'below_min_order') {
      throw new Error('Pedido abaixo do m\u00ednimo do fornecedor.');
    }
    if (err?.error === 'missing_delivery_address') {
      throw new Error('Informe o endere\u00e7o de entrega.');
    }
    if (err?.error) {
      throw new Error(String(err.error));
    }
  }

  // Don't try res.text() if we already consumed the body with res.json()
  throw new Error(`Erro HTTP ${res.status}`);
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
