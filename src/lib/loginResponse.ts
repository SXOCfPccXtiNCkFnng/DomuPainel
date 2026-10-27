import { supabaseAdmin } from '@/lib/supabaseServer';
import { isTenantOnboarded } from '@/lib/sessionHelpers';
import type { TenantSegment } from '@/types';

/** Dados que a tela de login guarda depois de entrar (senha, ou senha + código). */
export async function buildLoginUser(user: {
  id: string;
  name: string;
  email: string;
  role: string | null;
  tenant_id: string;
  tenants?: { name?: string | null; segment?: string | null } | null;
}) {
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('tenant_id', user.tenant_id)
    .maybeSingle();
  const tenant = user.tenants;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenant_id,
    companyName: tenant?.name || 'Domu Tech Empresa',
    segment: (tenant?.segment as TenantSegment) || 'geral',
    isOnboarded: isTenantOnboarded(subscription, tenant as Parameters<typeof isTenantOnboarded>[1]),
  };
}
