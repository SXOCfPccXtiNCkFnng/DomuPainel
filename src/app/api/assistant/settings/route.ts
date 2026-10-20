import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import {
  assistantSettingsFromRow,
  COMPANY_NAME_MAX,
  sanitizeOwnerText,
  validateAssistantSettings,
} from '@/lib/assistantPrompt';
import { isSchemaPendingError, SCHEDULING_MIGRATION_PENDING } from '@/lib/schedulingServer';
import { loadAssistantQuota } from '@/lib/assistantQuota';
import { assistantVertical } from '@/lib/assistantRunner';
import { OFFERABLE_STATUSES, realEstateModeForPlan } from '@/lib/realEstate';

export const dynamic = 'force-dynamic';

const BASE_COLUMNS =
  'enabled, assistant_name, tone, use_emojis, show_prices, about, address, payment_methods, extra_info';
const COLUMNS = `${BASE_COLUMNS}, promo_text, promo_until, greeting`;
const PROMO_MIGRATION = '20261019_assistant_promo_greeting.sql';

function migrationPending() {
  return NextResponse.json({ success: false, error: SCHEDULING_MIGRATION_PENDING }, { status: 503 });
}

/** Colunas de promoção/boas-vindas ainda não criadas: a tela continua funcionando sem elas. */
async function loadSettingsRow(tenantId: string) {
  const res = await supabaseAdmin.from('assistant_settings').select(COLUMNS).eq('tenant_id', tenantId).maybeSingle();
  if (res.error?.code !== '42703') return { ...res, promoAvailable: true };
  const base = await supabaseAdmin.from('assistant_settings').select(BASE_COLUMNS).eq('tenant_id', tenantId).maybeSingle();
  return { ...base, promoAvailable: false };
}

/** O que a atendente precisa para funcionar: serviços ativos ou imóveis disponíveis. */
async function countReadyItems(tenantId: string, vertical: ReturnType<typeof assistantVertical>): Promise<number> {
  if (!vertical) return 0;
  const query =
    vertical === 'imobiliario'
      ? supabaseAdmin
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', OFFERABLE_STATUSES)
      : supabaseAdmin
          .from('services')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('active', true);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function loadPlanTier(tenantId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('subscriptions').select('plan_tier').eq('tenant_id', tenantId).maybeSingle();
  return data?.plan_tier ?? null;
}

/** Personalização do assistente de IA do WhatsApp. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const [settingsRes, tenantRes, quota] = await Promise.all([
      loadSettingsRow(tenantId),
      supabaseAdmin.from('tenants').select('name, segment').eq('id', tenantId).maybeSingle(),
      loadAssistantQuota(tenantId).catch(() => null),
    ]);
    if (settingsRes.error) throw settingsRes.error;

    const vertical = assistantVertical(tenantRes.data?.segment);
    const [readyCount, planTier] = await Promise.all([
      countReadyItems(tenantId, vertical),
      quota ? Promise.resolve(quota.planTier) : loadPlanTier(tenantId),
    ]);

    return NextResponse.json({
      success: true,
      settings: assistantSettingsFromRow(settingsRes.data as Record<string, unknown> | null),
      companyName: tenantRes.data?.name || '',
      quota: quota ? { planName: quota.planName, limit: quota.limit, used: quota.used } : null,
      vertical,
      // Imobiliário: Starter só abre a conversa; Pro/Enterprise conduz até a visita.
      mode: vertical === 'imobiliario' ? realEstateModeForPlan(planTier) : null,
      readyCount,
      promoAvailable: settingsRes.promoAvailable,
      aiAvailable: Boolean(process.env.GEMINI_API_KEY),
      canEdit: auth.session.role === 'ADMIN' || auth.session.role === 'SUPER_ADMIN',
    });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.assistant.settings.get', error);
  }
}

/** Salva a personalização (só administrador). */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validateAssistantSettings(body);
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const { settings } = parsed;

    let companyName: string | undefined;
    if (body.companyName !== undefined) {
      companyName = sanitizeOwnerText(body.companyName, COMPANY_NAME_MAX, { singleLine: true });
      if (companyName.length < 2) {
        return NextResponse.json({ success: false, error: 'Informe o nome da loja.' }, { status: 400 });
      }
    }

    if (settings.enabled) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('segment')
        .eq('id', auth.session.tenantId)
        .maybeSingle();
      const vertical = assistantVertical(tenant?.segment);
      if (!vertical) {
        return NextResponse.json(
          { success: false, error: 'A atendente ainda não está disponível para o seu ramo.' },
          { status: 400 }
        );
      }
      if (!(await countReadyItems(auth.session.tenantId, vertical))) {
        return NextResponse.json(
          {
            success: false,
            error:
              vertical === 'imobiliario'
                ? 'Cadastre pelo menos um imóvel disponível antes de ligar a atendente.'
                : 'Cadastre pelo menos um serviço ativo antes de ligar a atendente.',
          },
          { status: 400 }
        );
      }
    }
    const { promo_text, promo_until, greeting, ...base } = settings;
    const row = {
      tenant_id: auth.session.tenantId,
      ...base,
      assistant_name: settings.assistant_name || null,
      about: settings.about || null,
      address: settings.address || null,
      extra_info: settings.extra_info || null,
      updated_at: new Date().toISOString(),
    };
    const upsert = (values: Record<string, unknown>) =>
      supabaseAdmin.from('assistant_settings').upsert(values, { onConflict: 'tenant_id' });

    let { error } = await upsert({
      ...row,
      promo_text: promo_text || null,
      promo_until: promo_until || null,
      greeting: greeting || null,
    });
    if (error?.code === '42703' || error?.code === 'PGRST204') {
      if (promo_text || greeting) {
        return NextResponse.json(
          { success: false, error: `Promoção e boas-vindas ainda não foram ativadas no banco (migration ${PROMO_MIGRATION}).` },
          { status: 503 }
        );
      }
      ({ error } = await upsert(row));
    }
    if (error) throw error;

    if (companyName) {
      const { error: nameError } = await supabaseAdmin
        .from('tenants')
        .update({ name: companyName, updated_at: new Date().toISOString() })
        .eq('id', auth.session.tenantId);
      if (nameError) throw nameError;
    }

    return NextResponse.json({ success: true, settings, companyName });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.assistant.settings.put', error);
  }
}
