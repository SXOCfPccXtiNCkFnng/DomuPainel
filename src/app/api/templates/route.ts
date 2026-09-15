import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { createMetaMessageTemplate } from '@/lib/metaClient';

export const dynamic = 'force-dynamic';

/**
 * Exemplos baseados na Biblioteca de modelos da Meta (utilidade).
 * São só referência visual no Domu — templates reais do cliente
 * são os criados via POST (enviados à WABA na Graph API).
 */
const GLOBAL_SYSTEM_TEMPLATES = [
  {
    id: 'meta-lib-1',
    name: 'finalizar_configuracao_conta',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'account_creation_confirmation_3',
    header_type: 'NONE',
    body_text:
      'Oi, {{nome}}! Sua nova conta foi criada com sucesso. Verifique seus dados para concluir o perfil.',
    variables: ['nome'],
  },
  {
    id: 'meta-lib-2',
    name: 'compromisso_cancelado',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'appointment_cancellation_1',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}. Seu compromisso com {{empresa}} em {{data}} às {{horario}} foi cancelado. Avise-nos se tiver alguma dúvida ou precisar reagendar.',
    variables: ['nome', 'empresa', 'data', 'horario'],
  },
  {
    id: 'meta-lib-3',
    name: 'confirmacao_agendamento',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'appointment_confirmation_1',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}! Seu agendamento foi confirmado para {{data}} às {{horario}}. Até lá!',
    variables: ['nome', 'data', 'horario'],
  },
];

function mapMetaStatus(raw?: string): 'APPROVED' | 'PENDING' | 'REJECTED' {
  const s = String(raw || 'PENDING').toUpperCase();
  if (s === 'APPROVED' || s === 'ACTIVE') return 'APPROVED';
  if (s === 'REJECTED' || s === 'DISABLED') return 'REJECTED';
  return 'PENDING';
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    let customTemplates: any[] = [];
    const { data, error } = await supabaseAdmin
      .from('hsm_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      customTemplates = data.map((t) => ({
        ...t,
        is_global: false,
      }));
    }

    return NextResponse.json({
      success: true,
      templates: [...customTemplates, ...GLOBAL_SYSTEM_TEMPLATES],
    });
  } catch (error: any) {
    console.error('[Templates API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const { name, category, headerType, headerContent, bodyText, language } = body;

    if (!name || !bodyText) {
      return NextResponse.json(
        { success: false, error: 'Nome e texto do template são obrigatórios.' },
        { status: 400 }
      );
    }

    const formattedName = String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_');

    const metaCategory =
      category === 'UTILITY' || category === 'AUTHENTICATION' ? category : 'MARKETING';

    const metaResult = await createMetaMessageTemplate({
      tenantId,
      name: formattedName,
      category: metaCategory,
      language: language || 'pt_BR',
      bodyText: String(bodyText),
      headerType: headerType === 'IMAGE' ? 'IMAGE' : 'NONE',
    });

    if (!metaResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: metaResult.error || 'Falha ao enviar o template para a Meta.',
        },
        { status: 502 }
      );
    }

    const variables =
      metaResult.variables ||
      Array.from(
        new Set(
          (String(bodyText).match(/\{\{([^}]+)\}\}/g) || []).map((m) =>
            m.replace(/[{}]/g, '').trim()
          )
        )
      );

    const { data: inserted, error } = await supabaseAdmin
      .from('hsm_templates')
      .insert({
        tenant_id: tenantId,
        name: formattedName,
        category: metaCategory,
        language: language || 'pt_BR',
        status: mapMetaStatus(metaResult.status),
        meta_template_id: metaResult.metaTemplateId || null,
        header_type: headerType || 'NONE',
        header_content: headerContent || null,
        body_text: bodyText,
        variables,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      template: {
        ...inserted,
        is_global: false,
      },
      warning: metaResult.warning || null,
      message: 'Template enviado para a Meta. Aguarde a análise.',
    });
  } catch (error: any) {
    console.error('[Templates API POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
