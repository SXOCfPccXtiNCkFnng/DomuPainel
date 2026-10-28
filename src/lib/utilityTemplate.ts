/**
 * Modelos de mensagem (template UTILITY) que a Domu cria sozinha na Meta para
 * cada conta — lembretes de agendamento e de visita. Fora da janela de 24h da
 * conversa, só modelo aprovado pode ser enviado.
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { createMetaMessageTemplate, fetchMetaTemplateStatus } from '@/lib/metaClient';

export type TemplateState = { ok: true; name: string; language: string } | { ok: false; reason: string };

export type UtilityTemplateSpec = {
  /** Nome na Meta: prefixo + carimbo (o prefixo esconde o modelo da lista do cliente). */
  prefix: string;
  body: string;
  variables: string[];
  /** Onde a conta guarda o id do modelo; null = ainda não criou; 'missing' = migration pendente. */
  loadId: () => Promise<string | null | 'missing'>;
  saveId: (templateId: string) => Promise<void>;
  /** Para as mensagens de log/erro ("do lembrete", "do lembrete de visita"). */
  label: string;
};

export async function ensureUtilityTemplate(tenantId: string, spec: UtilityTemplateSpec): Promise<TemplateState> {
  const currentId = await spec.loadId();
  if (currentId === 'missing') return { ok: false, reason: `Modelo ${spec.label} ainda não ativado no banco (migration pendente).` };

  if (currentId) {
    const { data: tpl } = await supabaseAdmin
      .from('hsm_templates')
      .select('id, name, language, status, meta_template_id')
      .eq('id', currentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (tpl) {
      let status = tpl.status;
      if (status === 'PENDING' && tpl.meta_template_id) {
        const meta = await fetchMetaTemplateStatus(tenantId, tpl.meta_template_id);
        if (meta.ok && meta.status !== 'PENDING') {
          status = meta.status;
          await supabaseAdmin
            .from('hsm_templates')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', tpl.id)
            .eq('tenant_id', tenantId);
          if (status === 'REJECTED') logger.warn('reminders.template_rejected', { tenantId, template: spec.prefix, reason: meta.reason });
        }
      }
      if (status === 'APPROVED') return { ok: true, name: tpl.name, language: tpl.language || 'pt_BR' };
      if (status === 'PENDING') return { ok: false, reason: `Modelo ${spec.label} em análise na Meta.` };
      return { ok: false, reason: `A Meta reprovou o modelo ${spec.label}.` };
    }
  }

  const name = `${spec.prefix}${Date.now().toString(36)}`;
  const meta = await createMetaMessageTemplate({ tenantId, name, category: 'UTILITY', language: 'pt_BR', bodyText: spec.body });
  if (!meta.success) {
    logger.warn('reminders.template_create_failed', { tenantId, template: spec.prefix, message: meta.error });
    return { ok: false, reason: `Não foi possível criar o modelo ${spec.label} na Meta: ${meta.error || 'erro desconhecido'}.` };
  }

  const status = String(meta.status || 'PENDING').toUpperCase();
  const finalStatus = status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING';
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('hsm_templates')
    .insert({
      tenant_id: tenantId,
      name,
      category: 'UTILITY',
      language: 'pt_BR',
      status: finalStatus,
      meta_template_id: meta.metaTemplateId || null,
      header_type: 'NONE',
      body_text: spec.body,
      variables: meta.variables || spec.variables,
    })
    .select('id')
    .single();
  if (insertError || !inserted) throw insertError || new Error(`Falha ao salvar o modelo ${spec.label}.`);
  await spec.saveId(inserted.id);

  logger.info('reminders.template_created', { tenantId, template: spec.prefix, status: finalStatus });
  if (finalStatus === 'APPROVED') return { ok: true, name, language: 'pt_BR' };
  return { ok: false, reason: `Modelo ${spec.label} em análise na Meta.` };
}
