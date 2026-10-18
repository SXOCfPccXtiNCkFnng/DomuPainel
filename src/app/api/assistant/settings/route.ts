import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { assistantSettingsFromRow, validateAssistantSettings } from '@/lib/assistantPrompt';
import { isSchemaPendingError, SCHEDULING_MIGRATION_PENDING } from '@/lib/schedulingServer';

export const dynamic = 'force-dynamic';

const COLUMNS =
  'enabled, assistant_name, tone, use_emojis, show_prices, about, address, payment_methods, extra_info';

function migrationPending() {
  return NextResponse.json({ success: false, error: SCHEDULING_MIGRATION_PENDING }, { status: 503 });
}

/** Personalização do assistente de IA do WhatsApp. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const [settingsRes, tenantRes] = await Promise.all([
      supabaseAdmin.from('assistant_settings').select(COLUMNS).eq('tenant_id', tenantId).maybeSingle(),
      supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    ]);
    if (settingsRes.error) throw settingsRes.error;

    return NextResponse.json({
      success: true,
      settings: assistantSettingsFromRow(settingsRes.data as Record<string, unknown> | null),
      companyName: tenantRes.data?.name || '',
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
    const { error } = await supabaseAdmin.from('assistant_settings').upsert(
      {
        tenant_id: auth.session.tenantId,
        ...settings,
        assistant_name: settings.assistant_name || null,
        about: settings.about || null,
        address: settings.address || null,
        extra_info: settings.extra_info || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );
    if (error) throw error;

    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    if (isSchemaPendingError(error)) return migrationPending();
    return internalErrorResponse('api.assistant.settings.put', error);
  }
}
