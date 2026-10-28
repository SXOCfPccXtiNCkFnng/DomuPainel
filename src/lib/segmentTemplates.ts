/**
 * Modelos de mensagem do ramo, enviados sozinhos para a Meta assim que a
 * conta tem WhatsApp conectado e assinatura ativa: 2–3 de campanha + o de
 * lembrete do ramo (visita no imobiliário, agendamento nos ramos com agenda).
 * Só cria o que ainda não existe — pode rodar quantas vezes precisar.
 */
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { isSubscriptionAllowedToDispatch } from '@/lib/billing';
import { createMetaMessageTemplate, resolveMetaCredentials } from '@/lib/metaClient';
import { isRealEstateSegment } from '@/lib/segmentConfig';
import { schedulingVerticalOf } from '@/lib/schedulingVerticals';
import { ensureReminderTemplate } from '@/lib/appointmentReminders';
import { ensureVisitReminderTemplate } from '@/lib/visitReminders';
import { generateSampleImage } from '@/lib/templateImages';
import { getPlatformAdminEmails, isPlatformAdminEmail } from '@/lib/platformAdmin';

export type SegmentTemplateDef = {
  name: string;
  body: string;
  description: string;
  /** Modelo com imagem no topo: a campanha escolhe a foto; a Meta aprova com uma imagem de exemplo. */
  image?: boolean;
};

const OPT_OUT = 'Se não quiser mais receber mensagens, responda SAIR.';

const REAL_ESTATE: SegmentTemplateDef[] = [
  {
    name: 'lancamento_imovel',
    description: 'Divulgar um lançamento ou imóvel em destaque.',
    body: `Olá, {{nome}}! Aqui é da {{empresa}}.\n\nAcabou de sair um lançamento no {{bairro}}: {{descricao}}, a partir de {{valor}}.\n\nQuer receber as fotos e as condições? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
  {
    name: 'imovel_novo_perfil',
    description: 'Avisar quem procura algo parecido que entrou um imóvel novo.',
    body: `Oi, {{nome}}, tudo bem? Aqui é da {{empresa}}.\n\nEntrou um imóvel que combina com o que você procura: {{descricao}} no {{bairro}}, por {{valor}}.\n\nQuer que eu te mande as fotos?\n\n${OPT_OUT}`,
  },
  {
    name: 'conquista_cliente_imagem',
    image: true,
    description: 'Contar a história de um cliente que realizou o sonho do imóvel (com foto).',
    body: `Olá, {{nome}}! Essa é a história de {{nome_comprador}}: depois de tentar por muito tempo comprar o primeiro imóvel, aqui na {{empresa}} a conquista veio rápido. 🏡\n\nO próximo sonho realizado pode ser o seu. Quer conversar sobre o imóvel ideal para você? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
  {
    name: 'retomar_contato_imovel',
    description: 'Retomar a conversa com clientes que sumiram.',
    body: `Oi, {{nome}}! Aqui é da {{empresa}}.\n\nFaz um tempo que conversamos sobre imóveis. Você ainda está procurando para comprar ou alugar?\n\nMe conta o que você procura hoje que eu separo as melhores opções.\n\n${OPT_OUT}`,
  },
];

const AUTOMOTIVE: SegmentTemplateDef[] = [
  {
    name: 'promocao_lavagem',
    description: 'Divulgar uma promoção da semana.',
    body: `Olá, {{nome}}! Essa semana na {{empresa}}: {{promocao}}.\n\nQuer garantir seu horário? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
  {
    name: 'resultado_lavagem_imagem',
    image: true,
    description: 'Mostrar um resultado (antes e depois) com foto.',
    body: `Olá, {{nome}}! Olha o resultado que entregamos aqui na {{empresa}}: {{servico}}. ✨\n\nQuer deixar o seu carro assim também? Responda esta mensagem que a gente vê um horário para você.\n\n${OPT_OUT}`,
  },
  {
    name: 'retorno_cliente_lavagem',
    description: 'Chamar de volta quem não aparece há um tempo.',
    body: `Oi, {{nome}}! Faz um tempinho que seu carro não passa aqui na {{empresa}}.\n\nQue tal deixar ele brilhando de novo? Responda esta mensagem que a gente vê um horário para você.\n\n${OPT_OUT}`,
  },
];

const HEALTH_BEAUTY: SegmentTemplateDef[] = [
  {
    name: 'promocao_servico',
    description: 'Divulgar uma promoção ou novidade.',
    body: `Olá, {{nome}}! Novidade na {{empresa}}: {{promocao}}.\n\nQuer agendar? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
  {
    name: 'novidade_servico_imagem',
    image: true,
    description: 'Divulgar uma novidade ou resultado com foto.',
    body: `Olá, {{nome}}! Novidade aqui na {{empresa}}: {{novidade}}. ✨\n\nQuer agendar seu horário? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
  {
    name: 'retorno_cliente_horario',
    description: 'Chamar de volta quem não marca há um tempo.',
    body: `Oi, {{nome}}! Já faz um tempo desde o seu último horário na {{empresa}}.\n\nQuer marcar o próximo? Responda esta mensagem que a gente encontra um horário para você.\n\n${OPT_OUT}`,
  },
];

const GENERAL: SegmentTemplateDef[] = [
  {
    name: 'novidades_empresa',
    description: 'Divulgar uma novidade ou oferta.',
    body: `Olá, {{nome}}! Temos novidade na {{empresa}}: {{novidade}}.\n\nQuer saber mais? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
  {
    name: 'oferta_imagem',
    image: true,
    description: 'Divulgar uma oferta ou novidade com foto.',
    body: `Olá, {{nome}}! Confira a novidade da {{empresa}}: {{novidade}}.\n\nQuer saber mais? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
  {
    name: 'retomar_contato',
    description: 'Retomar a conversa com clientes que sumiram.',
    body: `Oi, {{nome}}! Aqui é da {{empresa}}. Faz um tempo que não conversamos.\n\nPodemos te ajudar com alguma coisa? É só responder esta mensagem.\n\n${OPT_OUT}`,
  },
];

export function segmentTemplateDefs(segment: string | null | undefined): SegmentTemplateDef[] {
  if (isRealEstateSegment(segment ?? null)) return REAL_ESTATE;
  const scheduling = schedulingVerticalOf(segment);
  if (scheduling === 'automotivo') return AUTOMOTIVE;
  if (scheduling === 'saude') return HEALTH_BEAUTY;
  return GENERAL;
}

async function isPlatformAdminTenant(tenantId: string): Promise<boolean> {
  const admins = getPlatformAdminEmails();
  if (admins.length === 0) return false;
  const { data } = await supabaseAdmin.from('users').select('email').eq('tenant_id', tenantId);
  return (data || []).some((u) => isPlatformAdminEmail(u.email));
}

export type ProvisionResult ={ ran: boolean; reason?: string; created: string[]; failed: string[] };

/**
 * Cria na Meta os modelos do ramo que a conta ainda não tem. Precisa de
 * WhatsApp conectado (com a conta do WhatsApp) e assinatura ativa ou em teste.
 */
export async function provisionSegmentTemplates(tenantId: string): Promise<ProvisionResult> {
  const result: ProvisionResult = { ran: false, created: [], failed: [] };

  const [{ data: tenant }, { data: sub }] = await Promise.all([
    supabaseAdmin.from('tenants').select('segment').eq('id', tenantId).maybeSingle(),
    supabaseAdmin.from('subscriptions').select('status').eq('tenant_id', tenantId).maybeSingle(),
  ]);
  if (!tenant) return { ...result, reason: 'Conta não encontrada.' };
  if (await isPlatformAdminTenant(tenantId)) {
    // Conta da própria Domu (e-mails do /interno): não recebe modelos automáticos.
    await supabaseAdmin.from('tenants').update({ templates_provisioned_at: new Date().toISOString() }).eq('id', tenantId);
    return { ...result, reason: 'Conta da Domu.' };
  }
  if (!isSubscriptionAllowedToDispatch(sub?.status)) return { ...result, reason: 'Assinatura ainda não ativa.' };

  try {
    const creds = await resolveMetaCredentials(tenantId);
    if (!creds.wabaId) return { ...result, reason: 'WhatsApp sem a conta da Meta (WABA) ainda.' };
  } catch {
    return { ...result, reason: 'WhatsApp ainda não conectado.' };
  }
  result.ran = true;

  const defs = segmentTemplateDefs(tenant.segment);
  const { data: existing } = await supabaseAdmin
    .from('hsm_templates')
    .select('id, name, status, meta_template_id')
    .eq('tenant_id', tenantId)
    .in('name', defs.map((d) => d.name));
  const byName = new Map((existing || []).map((t) => [t.name, t]));

  for (const def of defs) {
    const current = byName.get(def.name);
    // Já enviado para a Meta (em análise, aprovado ou reprovado): não mexe.
    if (current?.meta_template_id) continue;

    const meta = await createMetaMessageTemplate({
      tenantId,
      name: def.name,
      category: 'MARKETING',
      language: 'pt_BR',
      bodyText: def.body,
      ...(def.image
        ? { headerType: 'IMAGE' as const, headerImage: { data: generateSampleImage(), mimeType: 'image/png' } }
        : {}),
    });
    if (!meta.success) {
      logger.warn('templates.segment_provision_failed', { tenantId, template: def.name, message: meta.error });
      result.failed.push(def.name);
      continue;
    }
    const status = String(meta.status || 'PENDING').toUpperCase();
    const row = {
      status: status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING',
      meta_template_id: meta.metaTemplateId || null,
      body_text: def.body,
      variables: meta.variables || [],
      updated_at: new Date().toISOString(),
    };
    const { error } = current
      ? await supabaseAdmin.from('hsm_templates').update(row).eq('id', current.id).eq('tenant_id', tenantId)
      : await supabaseAdmin.from('hsm_templates').insert({
          tenant_id: tenantId,
          name: def.name,
          category: 'MARKETING',
          language: 'pt_BR',
          header_type: def.image ? 'IMAGE' : 'NONE',
          ...row,
        });
    if (error) {
      logger.warn('templates.segment_provision_save_failed', { tenantId, template: def.name, message: error.message });
      result.failed.push(def.name);
      continue;
    }
    result.created.push(def.name);
  }

  // Lembrete do ramo (fica pronto antes do primeiro cliente precisar).
  try {
    if (isRealEstateSegment(tenant.segment)) await ensureVisitReminderTemplate(tenantId);
    else if (schedulingVerticalOf(tenant.segment)) await ensureReminderTemplate(tenantId);
  } catch (err) {
    logger.warn('templates.segment_reminder_failed', { tenantId, message: err instanceof Error ? err.message : String(err) });
  }

  await supabaseAdmin.from('tenants').update({ templates_provisioned_at: new Date().toISOString() }).eq('id', tenantId);
  if (result.created.length) logger.info('templates.segment_provisioned', { tenantId, created: result.created.length });
  return result;
}

/**
 * Agenda a criação para depois da resposta (conectou o WhatsApp, pagou ou
 * mudou de ramo). Fora de uma requisição, roda direto em segundo plano.
 */
export function scheduleSegmentTemplates(tenantId: string): void {
  const run = () =>
    provisionSegmentTemplates(tenantId).catch((err) =>
      logger.warn('templates.segment_provision_error', { tenantId, message: err instanceof Error ? err.message : String(err) })
    );
  try {
    after(run);
  } catch {
    void run();
  }
}
