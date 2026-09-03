export const BILLING_PAY_PATH = '/assinatura?pay=1';

function canDispatch(status?: string | null): boolean {
  return status === 'ACTIVE' || status === 'TRIAL';
}

export async function redirectIfDispatchBlocked(): Promise<boolean> {
  try {
    const res = await fetch('/api/subscription');
    const json = await res.json();
    const status = json?.subscription?.status as string | undefined;
    if (canDispatch(status)) return false;
    window.location.assign(BILLING_PAY_PATH);
    return true;
  } catch {
    return false;
  }
}
