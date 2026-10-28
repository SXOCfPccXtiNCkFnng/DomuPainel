import { NextRequest, NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/errors';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { createMetaMessageTemplate, fetchMetaMessageTemplates } from '@/lib/metaClient';
import { GLOBAL_SYSTEM_TEMPLATES } from '@/lib/globalTemplates';
import { fetchOwnMediaImage } from '@/lib/templateImages';
import { FOLLOW_UP_TEMPLATE_PREFIX } from '@/lib/followUpRules';
import { REMINDER_TEMPLATE_PREFIX } from '@/lib/appointmentReminderRules';
import { VISIT_REMINDER_TEMPLATE_PREFIX } from '@/lib/visitReminderRules';
import { scheduleSegmentTemplates, segmentTemplateDefs } from '@/lib/segmentTemplates';

export const dynamic = 'force-dynamic';

function mapMetaStatus(raw?: string): 'APPROVED' | 'PENDING' | 'REJECTED' {
  const s = String(raw || 'PENDING').toUpperCase();
  if (s === 'APPROVED' || s === 'ACTIVE') return 'APPROVED';
  if (s === 'REJECTED' || s === 'DISABLED') return 'REJECTED';
  return 'PENDING';
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
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

    // Conta que ainda não recebeu os modelos do ramo (contas antigas): cria uma vez,
    // depois da resposta. Só roda de fato com WhatsApp conectado e assinatura ativa.
    // (select('*'): sem a migration 20261028_segment_templates a coluna não existe e nada é agendado.)
    const { data: tenantRow } = await supabaseAdmin.from('tenants').select('*').eq('id', tenantId).maybeSingle();
    if (tenantRow && 'templates_provisioned_at' in tenantRow && !tenantRow.templates_provisioned_at) {
      scheduleSegmentTemplates(tenantId);
    }
    const segmentNames = new Set(segmentTemplateDefs(tenantRow?.segment).map((d) => d.name));

    let customTemplates: any[] = [];
    const { data, error } = await supabaseAdmin
      .from('hsm_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const genericNames = new Set(GLOBAL_SYSTEM_TEMPLATES.map((g) => g.name.toLowerCase()));

    if (!error && data) {
      // Mensagens do follow-up automático são gerenciadas na tela de Follow-up.
      // Os modelos de lembrete aparecem, marcados (não servem para campanha).
      customTemplates = data.filter((t) => !t.name.startsWith(FOLLOW_UP_TEMPLATE_PREFIX)).map((t) => {
        const isGeneric = genericNames.has(t.name.toLowerCase());
        const isReminder = t.name.startsWith(REMINDER_TEMPLATE_PREFIX);
        return {
          ...t,
          is_global: isGeneric,
          is_generic: isGeneric,
          // Criado sozinho pela Domu para o ramo da conta.
          is_domu: isReminder || segmentNames.has(t.name),
          system_use: isReminder
            ? t.name.startsWith(VISIT_REMINDER_TEMPLATE_PREFIX)
              ? 'Lembrete de visita automático'
              : 'Lembrete de agendamento automático'
            : null,
        };
      });
    }

    return NextResponse.json({ success: true, templates: customTemplates });
  } catch (error: any) {
    return internalErrorResponse('api.templates.get', error);
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

    // Modelo com imagem: a imagem enviada pelo painel vai de exemplo para a Meta aprovar.
    let headerImage: { data: Buffer; mimeType: string } | undefined;
    if (headerType === 'IMAGE') {
      const image = await fetchOwnMediaImage(String(headerContent || ''));
      if (!image.ok) return NextResponse.json({ success: false, error: image.error }, { status: 400 });
      headerImage = { data: image.data, mimeType: image.mimeType };
    }

    const metaResult = await createMetaMessageTemplate({
      tenantId,
      name: formattedName,
      category: metaCategory,
      language: language || 'pt_BR',
      bodyText: String(bodyText),
      headerType: headerType === 'IMAGE' ? 'IMAGE' : 'NONE',
      headerImage,
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
    return internalErrorResponse('api.templates.post', error);
  }
}
