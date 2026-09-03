import { TenantSegment } from '@/types';
import { syncSessionToActiveStorage } from '@/lib/authStorage';

export interface SessionData {
  isOnboarded: boolean;
  segment: TenantSegment;
  companyName: string;
  tenantId: string;
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
  });
}
