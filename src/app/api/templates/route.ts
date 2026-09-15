import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { createMetaMessageTemplate } from '@/lib/metaClient';

export const dynamic = 'force-dynamic';

// Templates prontos (biblioteca Domu + utilitários no estilo da Biblioteca Meta)
const GLOBAL_SYSTEM_TEMPLATES = [
  {
    id: 'meta-global-0',
    name: 'lancamento_exclusivo_com_imagem',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_000',
    header_type: 'IMAGE',
    header_content:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80',
    body_text:
      'Olá {{nome}}! Confira em primeira mão este lançamento exclusivo da nossa empresa. Gostaria de agendar uma apresentação?',
    variables: ['nome'],
  },
  {
    id: 'meta-global-1',
    name: 'aviso_oferta_promocional',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_001',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}! Temos uma oferta especial e imperdível para você hoje. Gostaria de saber mais detalhes?',
    variables: ['nome'],
  },
  {
    id: 'meta-global-2',
    name: 'lembrete_agendamento_atendimento',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_002',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}, passando para confirmar nosso atendimento agendado para {{horario}}. Podemos confirmar?',
    variables: ['nome', 'horario'],
  },
  {
    id: 'meta-global-3',
    name: 'notificacao_atualizacao_pedido',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_003',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}! Seu pedido/solicitação foi atualizado com sucesso. Acesse nossa plataforma para conferir.',
    variables: ['nome'],
  },
  {
    id: 'meta-global-4',
    name: 'finalizar_configuracao_conta',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_004',
    header_type: 'NONE',
    body_text:
      'Oi, {{nome}}! Sua nova conta foi criada com sucesso. Verifique seus dados para concluir o perfil e começar a usar a plataforma.',
    variables: ['nome'],
  },
  {
    id: 'meta-global-5',
    name: 'compromisso_cancelado',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_005',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}. Seu compromisso com {{empresa}} em {{data}} às {{horario}} foi cancelado. Avise-nos se tiver alguma dúvida ou precisar reagendar.',
    variables: ['nome', 'empresa', 'data', 'horario'],
  },
  {
    id: 'meta-global-6',
    name: 'confirmacao_agendamento',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_006',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}! Seu agendamento foi confirmado para {{data}} às {{horario}}. Até lá!',
    variables: ['nome', 'data', 'horario'],
  },
  {
    id: 'meta-global-7',
    name: 'lembrete_pagamento',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_007',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}, lembrando que o pagamento de {{valor}} vence em breve. Se já pagou, pode ignorar esta mensagem.',
    variables: ['nome', 'valor'],
  },
  {
    id: 'meta-global-8',
    name: 'boas_vindas_cliente',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'meta_hsm_008',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}! Seja bem-vindo(a) à {{empresa}}. Estamos felizes em ter você conosco. Como podemos ajudar?',
    variables: ['nome', 'empresa'],
  },
];

function mapMetaStatus(raw?: string): 'APPROVED' | 'PENDING' | 'REJECTED' {
  const s = String(raw || 'PENDING').toUpperCase();
  if (s === 'APPROVED' || s === 'ACTIVE') return 'APPROVED';
  if (s === 'REJECTED' || s === 'DISABLED') return 'REJECTED';
  return 'PENDING';
}

// GET: templates do tenant + biblioteca padrão Domu
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

// POST: cria template na Meta Cloud API e salva no Supabase
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
