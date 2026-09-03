/** Cliente HTTP Asaas (sandbox/produção). */

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

function asaasBaseUrl(): string {
  const env = (process.env.ASAAS_ENV || 'sandbox').toLowerCase();
  if (env === 'production' || env === 'prod') {
    return 'https://api.asaas.com/v3';
  }
  return 'https://api-sandbox.asaas.com/v3';
}

export function getAsaasApiKey(): string | null {
  const raw = process.env.ASAAS_API_KEY?.trim() || '';
  // dotenv geralmente remove aspas, mas em alguns casos elas ficam literalmente na string.
  // Remove qualquer aspas simples/dupla que porventura tenha sobrado.
  const key = raw.replace(/['"]/g, '').trim();
  return key.length > 10 ? key : null;
}

export function isBillingMockEnabled(): boolean {
  const enabled =
    process.env.BILLING_MOCK === '1' || process.env.BILLING_MOCK === 'true';
  if (!enabled) return false;
  // Nunca permitir mock em produção
  if (process.env.NODE_ENV === 'production') return false;
  return true;
}

export function getAsaasWebhookToken(): string | null {
  const t = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  return t && t.length >= 8 ? t : null;
}

export class AsaasApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function asaasFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const apiKey = getAsaasApiKey();
  if (!apiKey) {
    throw new AsaasApiError('ASAAS_API_KEY não configurada.', 500, null);
  }

  const url = `${asaasBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    access_token: apiKey,
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...init, headers, cache: 'no-store' });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const errMsg =
      typeof body === 'object' &&
      body &&
      Array.isArray((body as { errors?: { description?: string }[] }).errors) &&
      (body as { errors: { description?: string }[] }).errors[0]?.description
        ? (body as { errors: { description?: string }[] }).errors[0].description!
        : `Asaas HTTP ${res.status}`;
    throw new AsaasApiError(errMsg, res.status, body);
  }

  return body as T;
}

export type AsaasCustomer = { id: string; name?: string; email?: string; cpfCnpj?: string };

export async function asaasFindCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const data = await asaasFetch<{ data?: AsaasCustomer[] }>(
    `/customers?email=${encodeURIComponent(email)}&limit=1`
  );
  return data?.data?.[0] || null;
}

export async function asaasCreateCustomer(input: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj || undefined,
      phone: input.phone || undefined,
      mobilePhone: input.mobilePhone || input.phone || undefined,
      externalReference: input.externalReference,
      notificationDisabled: true,
    }),
  });
}

export async function asaasUpdateCustomer(
  customerId: string,
  input: { name?: string; cpfCnpj?: string; phone?: string; mobilePhone?: string }
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(`/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export type AsaasSubscription = {
  id: string;
  customer: string;
  value: number;
  billingType: string;
  status: string;
  description?: string;
  nextDueDate?: string;
  invoiceUrl?: string;
};

export async function asaasGetSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function asaasListCustomerSubscriptions(
  customerId: string
): Promise<AsaasSubscription[]> {
  const data = await asaasFetch<{ data?: AsaasSubscription[] }>(
    `/subscriptions?customer=${encodeURIComponent(customerId)}&limit=20`
  );
  return data?.data || [];
}

export async function asaasCancelSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

export async function asaasCreateSubscription(input: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  description: string;
  externalReference?: string;
  cycle?: 'MONTHLY';
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customer,
      billingType: input.billingType,
      value: Number(input.value.toFixed(2)),
      nextDueDate: input.nextDueDate,
      cycle: input.cycle || 'MONTHLY',
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export type AsaasPayment = {
  id: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  value?: number;
  billingType?: string;
  subscription?: string;
  externalReference?: string;
};

export async function asaasListSubscriptionPayments(
  subscriptionId: string
): Promise<AsaasPayment[]> {
  const data = await asaasFetch<{ data?: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments?limit=5`
  );
  return data?.data || [];
}

export type AsaasPixQr = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

export async function asaasGetPixQrCode(paymentId: string): Promise<AsaasPixQr> {
  return asaasFetch<AsaasPixQr>(`/payments/${paymentId}/pixQrCode`);
}

export async function asaasGetPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}`);
}

export function todayPlusDaysIsoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
