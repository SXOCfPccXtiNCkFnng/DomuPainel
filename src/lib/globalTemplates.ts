import { supabaseAdmin } from '@/lib/supabaseServer';

export interface GlobalTemplateDef {
  id: string;
  name: string;
  category: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'SUGGESTED';
  is_global: boolean;
  meta_template_id: string;
  header_type: string;
  header_content?: string;
  body_text: string;
  variables: string[];
}

export const GLOBAL_SYSTEM_TEMPLATES: GlobalTemplateDef[] = [
  {
    id: 'meta-tpl-hello-world',
    name: 'hello_world',
    category: 'UTILITY',
    language: 'en_US',
    status: 'APPROVED',
    is_global: true,
    meta_template_id: 'hello_world',
    header_type: 'NONE',
    body_text:
      'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.',
    variables: [],
  },
  {
    id: 'meta-tpl-novidades-oportunidades',
    name: 'novidades_oportunidades',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    meta_template_id: '',
    header_type: 'IMAGE',
    header_content: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80',
    body_text:
      'Olá {{nome}}! Temos novidades e oportunidades selecionadas especialmente para você. Gostaria de receber nossa seleção exclusiva com as melhores opções da semana?',
    variables: ['nome'],
  },
  {
    id: 'meta-tpl-agendamento-atendimento',
    name: 'agendamento_atendimento',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}! Confirmamos seu interesse em nossos serviços. Qual seria o melhor dia e horário para agendarmos uma conversa rápida sobre o que você procura?',
    variables: ['nome'],
  },
  {
    id: 'meta-tpl-contato-consultor',
    name: 'contato_consultor',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{nome}}! Sou consultor da nossa equipe e gostaria de saber se você ainda está em busca de opções no mercado ou se precisa de apoio hoje.',
    variables: ['nome'],
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
 * Se o template for um dos modelos padrão do Domu (ex: hello_world) ou passado por nome,
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
      .select('id, name, language')
      .eq('id', templateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing?.id) {
      if (existing.name?.toLowerCase() === 'hello_world' && existing.language !== 'en_US') {
        await supabaseAdmin
          .from('hsm_templates')
          .update({ language: 'en_US', status: 'APPROVED' })
          .eq('id', existing.id);
      }
      return existing.id;
    }
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
    .select('id, language')
    .eq('tenant_id', tenantId)
    .eq('name', targetName)
    .limit(1)
    .maybeSingle();

  if (byName?.id && isUuid(byName.id)) {
    if (targetName.toLowerCase() === 'hello_world' && byName.language !== 'en_US') {
      await supabaseAdmin
        .from('hsm_templates')
        .update({ language: 'en_US', status: 'APPROVED' })
        .eq('id', byName.id);
    }
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
        language: globalTpl.language || (globalTpl.name === 'hello_world' ? 'en_US' : 'pt_BR'),
        status: globalTpl.status === 'APPROVED' ? 'APPROVED' : 'SUGGESTED',
        meta_template_id: globalTpl.meta_template_id || null,
        header_type: globalTpl.header_type || 'NONE',
        header_content: globalTpl.header_content || null,
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
