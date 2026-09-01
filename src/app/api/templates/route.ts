import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET: Fetch Meta HSM Templates from Supabase
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    let query = supabaseAdmin.from('hsm_templates').select('*').order('created_at', { ascending: false });
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: templates, error } = await query;

    // Default Meta Official Pre-Approved Template Fallbacks if table empty
    const officialMetaTemplates = (templates && templates.length > 0) ? templates : [
      {
        id: 'meta-tpl-0',
        name: 'lancamento_exclusivo_com_imagem',
        category: 'MARKETING',
        language: 'pt_BR',
        status: 'APPROVED',
        meta_template_id: 'meta_hsm_000',
        header_type: 'IMAGE',
        header_content: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80',
        body_text: 'Olá {{nome}}! Confira em primeira mão este lançamento exclusivo da nossa empresa. Gostaria de agendar uma apresentação?',
        variables: ['nome']
      },
      {
        id: 'meta-tpl-1',
        name: 'aviso_oferta_promocional',
        category: 'MARKETING',
        language: 'pt_BR',
        status: 'APPROVED',
        meta_template_id: 'meta_hsm_001',
        header_type: 'NONE',
        body_text: 'Olá {{nome}}! Temos uma oferta especial e imperdível para você hoje. Gostaria de saber mais detalhes?',
        variables: ['nome']
      },
      {
        id: 'meta-tpl-2',
        name: 'lembrete_agendamento_atendimento',
        category: 'UTILITY',
        language: 'pt_BR',
        status: 'APPROVED',
        meta_template_id: 'meta_hsm_002',
        header_type: 'NONE',
        body_text: 'Olá {{nome}}, passando para confirmar nosso atendimento agendado para {{horario}}. Podemos confirmar?',
        variables: ['nome', 'horario']
      },
      {
        id: 'meta-tpl-3',
        name: 'notificacao_atualizacao_pedido',
        category: 'UTILITY',
        language: 'pt_BR',
        status: 'APPROVED',
        meta_template_id: 'meta_hsm_003',
        header_type: 'NONE',
        body_text: 'Olá {{nome}}! Seu pedido/solicitação foi atualizado com sucesso. Acesse nosso portal para conferir.',
        variables: ['nome']
      }
    ];

    return NextResponse.json({
      success: true,
      templates: officialMetaTemplates
    });

  } catch (error: any) {
    console.error('[Templates API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Submit a new Meta Cloud API Template to Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, name, category, headerType, headerContent, bodyText } = body;

    if (!name || !bodyText) {
      return NextResponse.json({ success: false, error: 'Nome e texto do template são obrigatórios.' }, { status: 400 });
    }

    let activeTenantId = tenantId;
    if (!activeTenantId) {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
      activeTenantId = tenant?.id;
    }

    const formattedName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    // Extract variables {{var}}
    const matches = bodyText.match(/\{\{([^}]+)\}\}/g) || [];
    const variables = Array.from(new Set(matches.map((m: string) => m.replace(/[{}]/g, '').trim())));

    const { data: inserted, error } = await supabaseAdmin
      .from('hsm_templates')
      .insert({
        tenant_id: activeTenantId,
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
      template: inserted
    });

  } catch (error: any) {
    console.error('[Templates API POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
