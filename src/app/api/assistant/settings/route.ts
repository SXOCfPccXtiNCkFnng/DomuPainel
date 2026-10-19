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

/** Personalização do assistente de IA do WhatsApp. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const [settingsRes, tenantRes, quota] = await Promise.all([
      loadSettingsRow(tenantId),
      supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      loadAssistantQuota(tenantId).catch(() => null),
    ]);
    if (settingsRes.error) throw settingsRes.error;

    return NextResponse.json({
      success: true,
      settings: assistantSettingsFromRow(settingsRes.data as Record<string, unknown> | null),
      companyName: tenantRes.data?.name || '',
      quota: quota ? { planName: quota.planName, limit: quota.limit, used: quota.used } : null,
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
      const { count, error: countError } = await supabaseAdmin
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.session.tenantId)
        .eq('active', true);
      if (countError) throw countError;
      if (!count) {
        return NextResponse.json(
          { success: false, error: 'Cadastre pelo menos um serviço ativo antes de ligar a atendente.' },
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
