import { TenantSegment } from '@/types';
import { syncSessionToActiveStorage } from '@/lib/authStorage';

export interface SessionData {
  isOnboarded: boolean;
  segment: TenantSegment;
  companyName: string;
  tenantId: string;
  user?: { name?: string | null; email?: string | null } | null;
}

export function isTenantOnboarded(
  subscription: { status?: string } | null | undefined,
  tenant?: { status?: string } | null
): boolean {
  const subStatus = subscription?.status;
  // Ainda não pagou o plano do onboarding
  if (subStatus === 'PENDING_PAYMENT') return false;
  if (subStatus === 'ACTIVE' || subStatus === 'TRIAL') return true;
  // Já foi cliente: painel liberado; disparos bloqueados na API de campanhas
  if (subStatus === 'PAST_DUE' || subStatus === 'CANCELED') return true;
  if (tenant?.status === 'ACTIVE') return true;
  return false;
}

export function syncSessionToStorage(session: SessionData): void {
  syncSessionToActiveStorage({
    domu_is_onboarded: session.isOnboarded ? 'true' : 'false',
    domu_selected_segment: session.segment,
    domu_company_name: session.companyName,
    domu_tenant_id: session.tenantId,
    ...userIdentity(session),
  });
}

/** Nome/e-mail do cabeçalho: a sessão de aba (sessionStorage) não passa para uma aba nova. */
export function userIdentity(session: Pick<SessionData, 'user'>): Record<string, string> {
  const out: Record<string, string> = {};
  if (session.user?.name) out.domu_user_name = session.user.name;
  if (session.user?.email) out.domu_user_email = session.user.email;
  return out;
}
