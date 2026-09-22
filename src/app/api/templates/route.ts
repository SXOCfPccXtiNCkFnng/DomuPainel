import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { createMetaMessageTemplate, fetchMetaMessageTemplates } from '@/lib/metaClient';
import { GLOBAL_SYSTEM_TEMPLATES, seedGenericTemplatesForTenant } from '@/lib/globalTemplates';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(req.url);
    const shouldSync = searchParams.get('sync') === 'true';

    if (shouldSync) {
      try {
        const metaRes = await fetchMetaMessageTemplates(tenantId);
        if (metaRes.success && Array.isArray(metaRes.templates)) {
          for (const metaTpl of metaRes.templates) {
            // Ignora modelos de teste internos/sandbox da Meta
            if (metaTpl.name?.startsWith('jaspers_') || metaTpl.name === 'hello_world') {
              continue;
            }
            const bodyComp = metaTpl.components?.find((c: any) => c.type === 'BODY');
            const headerComp = metaTpl.components?.find((c: any) => c.type === 'HEADER');
            const formattedStatus = mapMetaStatus(metaTpl.status);
            const templateLang =
              metaTpl.language || (metaTpl.name === 'hello_world' ? 'en_US' : 'pt_BR');

            const { data: existing } = await supabaseAdmin
              .from('hsm_templates')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('name', metaTpl.name)
              .maybeSingle();

            if (existing) {
              await supabaseAdmin
                .from('hsm_templates')
                .update({
                  status: formattedStatus,
                  meta_template_id: metaTpl.id,
                  category: metaTpl.category || 'MARKETING',
                  language: templateLang,
                  body_text: bodyComp?.text || '',
                  header_type: headerComp?.format || 'NONE',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            } else {
              await supabaseAdmin.from('hsm_templates').insert({
                tenant_id: tenantId,
                name: metaTpl.name,
                status: formattedStatus,
                meta_template_id: metaTpl.id,
                category: metaTpl.category || 'MARKETING',
                language: templateLang,
                body_text: bodyComp?.text || '',
                header_type: headerComp?.format || 'NONE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (syncErr) {
        console.warn('[Templates Sync Warning]', syncErr);
      }
    }

    // Garante que o tenant tenha os 6 templates genéricos universais provisionados
    await seedGenericTemplatesForTenant(tenantId);

    let customTemplates: any[] = [];
    const { data, error } = await supabaseAdmin
      .from('hsm_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const genericNames = new Set(GLOBAL_SYSTEM_TEMPLATES.map((g) => g.name.toLowerCase()));

    if (!error && data) {
      customTemplates = data.map((t) => {
        const isGeneric = genericNames.has(t.name.toLowerCase());
        return {
          ...t,
          is_global: isGeneric,
          is_generic: isGeneric,
        };
      });
    }

    const customNames = new Set(customTemplates.map((t) => t.name.toLowerCase()));
    const unseededGlobals = GLOBAL_SYSTEM_TEMPLATES.filter(
      (g) => !customNames.has(g.name.toLowerCase())
    );

    return NextResponse.json({
      success: true,
      templates: [...customTemplates, ...unseededGlobals],
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
