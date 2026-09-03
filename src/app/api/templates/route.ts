import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

// System Global Templates (Shared with ALL Tenants across DOMU SaaS)
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
    header_content: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80',
    body_text: 'Olá {{nome}}! Confira em primeira mão este lançamento exclusivo da nossa empresa. Gostaria de agendar uma apresentação?',
    variables: ['nome']
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
    body_text: 'Olá {{nome}}! Temos uma oferta especial e imperdível para você hoje. Gostaria de saber mais detalhes?',
    variables: ['nome']
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
    body_text: 'Olá {{nome}}, passando para confirmar nosso atendimento agendado para {{horario}}. Podemos confirmar?',
    variables: ['nome', 'horario']
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
    body_text: 'Olá {{nome}}! Seu pedido/solicitação foi atualizado com sucesso. Acesse nosso portal para conferir.',
    variables: ['nome']
  }
];

// GET: Fetch Global Templates + Custom Tenant Account Templates from Supabase
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
      customTemplates = data.map(t => ({
        ...t,
        is_global: false
      }));
    }

    // Combine custom account templates first, followed by global system templates
    const combinedTemplates = [...customTemplates, ...GLOBAL_SYSTEM_TEMPLATES];

    return NextResponse.json({
      success: true,
      templates: combinedTemplates
    });

  } catch (error: any) {
    console.error('[Templates API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Submit a new Meta Cloud API Template to Supabase (Bound to Tenant Account)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const { name, category, headerType, headerContent, bodyText } = body;

    if (!name || !bodyText) {
      return NextResponse.json({ success: false, error: 'Nome e texto do template são obrigatórios.' }, { status: 400 });
    }

    const formattedName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    // Extract variables {{var}}
    const matches = bodyText.match(/\{\{([^}]+)\}\}/g) || [];
    const variables = Array.from(new Set(matches.map((m: string) => m.replace(/[{}]/g, '').trim())));

    const { data: inserted, error } = await supabaseAdmin
      .from('hsm_templates')
      .insert({
        tenant_id: tenantId,
        name: formattedName,
        category: category || 'MARKETING',
        language: 'pt_BR',
        status: 'APPROVED', // Simulated instant Meta Cloud API Approval
        header_type: headerType || 'NONE',
        header_content: headerContent || null,
        body_text: bodyText,
        variables: variables,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      template: {
        ...inserted,
        is_global: false
      }
    });

  } catch (error: any) {
    console.error('[Templates API POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
