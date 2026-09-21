import { supabaseAdmin } from '@/lib/supabaseServer';

export interface GlobalTemplateDef {
  id: string;
  name: string;
  category: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  is_global: boolean;
  meta_template_id: string;
  header_type: string;
  body_text: string;
  variables: string[];
}

export const GLOBAL_SYSTEM_TEMPLATES: GlobalTemplateDef[] = [
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

export function isUuid(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    val.trim()
  );
}

/**
 * Garante que a campanha receba um UUID real e válido para template_id.
 * Se o template for um dos modelos padrão do Domu (ex: meta-lib-1) ou passado por nome,
 * busca ou cria o registro correspondente em public.hsm_templates para o tenant.
 */
export async function ensureTemplateIdForTenant(
  tenantId: string,
  templateId?: string | null,
  templateName?: string | null
): Promise<string | null> {
  // 1. Se já recebemos um UUID válido, verifica se existe no tenant
  if (templateId && isUuid(templateId)) {
    const { data: existing } = await supabaseAdmin
      .from('hsm_templates')
      .select('id')
      .eq('id', templateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing?.id) return existing.id;
  }

  // 2. Identifica se é um dos templates globais
  const globalTpl = GLOBAL_SYSTEM_TEMPLATES.find(
    (g) =>
      (templateId && g.id === templateId) ||
      (templateName && g.name.toLowerCase() === templateName.toLowerCase())
  );

  const targetName = templateName || globalTpl?.name;
  if (!targetName) return null;

  // 3. Procura no banco se esse tenant já tem um template com esse nome
  const { data: byName } = await supabaseAdmin
    .from('hsm_templates')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', targetName)
    .limit(1)
    .maybeSingle();

  if (byName?.id && isUuid(byName.id)) {
    return byName.id;
  }

  // 4. Se for um template padrão do sistema, cria o registro em hsm_templates para o tenant
  if (globalTpl) {
    const { data: created, error } = await supabaseAdmin
      .from('hsm_templates')
      .insert({
        tenant_id: tenantId,
        name: globalTpl.name,
        category: globalTpl.category,
        language: globalTpl.language,
        status: 'APPROVED',
        meta_template_id: globalTpl.meta_template_id || null,
        header_type: globalTpl.header_type || 'NONE',
        body_text: globalTpl.body_text,
        variables: globalTpl.variables || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!error && created?.id && isUuid(created.id)) {
      return created.id;
    }
  }

  return null;
}
