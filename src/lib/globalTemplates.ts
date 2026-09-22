import { supabaseAdmin } from '@/lib/supabaseServer';

export interface GlobalTemplateDef {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'SUGGESTED';
  is_global: boolean;
  is_generic: boolean;
  meta_template_id: string;
  header_type: string;
  header_content?: string;
  body_text: string;
  variables: string[];
  description?: string;
}

export const GLOBAL_SYSTEM_TEMPLATES: GlobalTemplateDef[] = [
  {
    id: 'meta-tpl-boas-vindas',
    name: 'boas_vindas_atendimento',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    is_generic: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{1}}! Seja muito bem-vindo(a). Agradecemos pelo seu contato com a nossa equipe. Como podemos te ajudar hoje?',
    variables: ['1'],
    description: 'Primeiro contato e boas-vindas para novos clientes.',
  },
  {
    id: 'meta-tpl-novidades-ofertas',
    name: 'aviso_novidades_ofertas',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    is_generic: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{1}}! Temos novidades e condições especiais selecionadas para você. Gostaria de receber nossas oportunidades desta semana?',
    variables: ['1'],
    description: 'Divulgação de novidades, lançamentos e condições especiais.',
  },
  {
    id: 'meta-tpl-confirmacao-agendamento',
    name: 'confirmacao_agendamento',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    is_generic: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{1}}! Confirmamos o seu agendamento para {{2}} às {{3}}. Caso precise reagendar ou tirar dúvidas, basta responder por aqui.',
    variables: ['1', '2', '3'],
    description: 'Confirmação de dia e horário de reuniões, consultas ou atendimentos.',
  },
  {
    id: 'meta-tpl-lembrete-compromisso',
    name: 'lembrete_compromisso',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    is_generic: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{1}}! Passando para lembrar do seu compromisso agendado para amanhã às {{2}}. Estamos à disposição caso precise de algo!',
    variables: ['1', '2'],
    description: 'Lembrete amigável para evitar faltas e esquecimentos.',
  },
  {
    id: 'meta-tpl-retorno-solicitacao',
    name: 'retorno_solicitacao',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    is_generic: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{1}}! Estamos dando continuidade à sua solicitação recente. Você ainda precisa de apoio ou gostaria de falar com um especialista?',
    variables: ['1'],
    description: 'Follow-up e reengajamento com clientes ou interessados.',
  },
  {
    id: 'meta-tpl-pesquisa-satisfacao',
    name: 'pesquisa_satisfacao_feedback',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'SUGGESTED',
    is_global: true,
    is_generic: true,
    meta_template_id: '',
    header_type: 'NONE',
    body_text:
      'Olá {{1}}! Sua opinião é essencial para nós. De 0 a 10, qual nota você daria para a sua experiência com o nosso atendimento recente?',
    variables: ['1'],
    description: 'Coleta de feedback e avaliação rápida pós-atendimento.',
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

/**
 * Cria automaticamente os 6 templates genéricos universais na tabela hsm_templates
 * para o tenant especificado, caso ele ainda não os possua.
 */
export async function seedGenericTemplatesForTenant(tenantId: string): Promise<void> {
  if (!tenantId || !isUuid(tenantId)) return;

  try {
    for (const tpl of GLOBAL_SYSTEM_TEMPLATES) {
      const { data: existing } = await supabaseAdmin
        .from('hsm_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', tpl.name)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from('hsm_templates').insert({
          tenant_id: tenantId,
          name: tpl.name,
          category: tpl.category,
          language: tpl.language || 'pt_BR',
          status: 'SUGGESTED',
          meta_template_id: null,
          header_type: tpl.header_type || 'NONE',
          header_content: tpl.header_content || null,
          body_text: tpl.body_text,
          variables: tpl.variables || ['1'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[seedGenericTemplatesForTenant] Erro ao criar templates genéricos:', err);
  }
}

