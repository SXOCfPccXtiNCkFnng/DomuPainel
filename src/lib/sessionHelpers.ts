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
  // Subscription ACTIVE = finished plan step
  if (subscription?.status === 'ACTIVE') return true;
  // Tenant ACTIVE = onboarding completed (register creates TRIAL)
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
