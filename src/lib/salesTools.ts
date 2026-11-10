/**
 * Ferramentas da atendente de vendas da Domu: avisar o Alan de um cliente
 * decidido (a IA continua) ou passar a conversa para ele (a IA para por 12h).
 */
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { formatPhoneBR } from '@/lib/validators';
import { HUMAN_PAUSE_MS } from '@/lib/assistantRules';
import { handOffToTeam, type HandoffContext } from '@/lib/assistantTools';
import { notifySalesOwner } from '@/lib/salesAgent';

type ToolResult = Record<string, unknown>;
const STRING = 'STRING';

export const SALES_INTEREST_TOOL = 'avisar_interesse';
export const SALES_HANDOFF_TOOL = 'chamar_alan';

export function salesToolDeclarations(): unknown[] {
  return [
    {
      name: SALES_INTEREST_TOOL,
      description:
        'Avisa o Alan que esta pessoa está decidida ou quase (quer assinar, pediu o link, vai criar a conta, quer testar com o cupom). Você continua a conversa normalmente depois.',
      parameters: {
        type: 'OBJECT',
        properties: {
          resumo: {
            type: STRING,
            description: 'Resumo curto: ramo e nome do negócio, o que a pessoa quer e o plano que combina (ex.: "barbearia do João, quer o Starter, vai criar a conta hoje").',
          },
        },
        required: ['resumo'],
      },
    },
    {
      name: SALES_HANDOFF_TOOL,
      description:
        'Passa a conversa para o Alan: pedido para falar com uma pessoa, pergunta que você não sabe responder com certeza, plano personalizado, parceria, reunião ou reclamação. Depois disso você para de responder esta conversa.',
      parameters: {
        type: 'OBJECT',
        properties: {
          motivo: { type: STRING, description: 'O que a pessoa precisa, em português (se for uma pergunta, escreva a pergunta).' },
          resumo: { type: STRING, description: 'O que você já sabe do negócio dela (ramo, nome, interesse), se souber.' },
        },
        required: ['motivo'],
      },
    },
  ];
}

const text = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Já avisou o interesse deste contato nas últimas 12h: não repete o aviso. */
async function interestAlreadySent(ctx: HandoffContext): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('assistant_runs')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('lead_id', ctx.leadId)
    .contains('tools', [SALES_INTEREST_TOOL])
    .gte('created_at', new Date(ctx.now.getTime() - HUMAN_PAUSE_MS).toISOString())
    .limit(1);
  return Boolean(data?.length);
}

async function avisarInteresse(args: Record<string, unknown>, ctx: HandoffContext): Promise<ToolResult> {
  const summary = text(args.resumo, 400);
  if (summary.length < 3) return { ok: false, erro: 'Escreva um resumo curto do que a pessoa quer.' };
  if (await interestAlreadySent(ctx)) return { ok: true, observacao: 'O Alan já foi avisado. Siga ajudando no cadastro.' };

  const phone = formatPhoneBR(ctx.leadPhone) || ctx.leadPhone;
  await notifySalesOwner({
    title: 'Cliente quente na conversa de vendas',
    text: `${ctx.leadName} (${phone}) está decidido: ${summary}. Última mensagem: "${text(ctx.lastCustomerMessage, 200)}"`,
  });
  logger.info('sales.interest_alert', { tenantId: ctx.tenantId, leadId: ctx.leadId });
  return { ok: true, observacao: 'Alan avisado. Continue ajudando a pessoa a criar a conta.' };
}

async function chamarAlan(args: Record<string, unknown>, ctx: HandoffContext): Promise<ToolResult> {
  const reason = text(args.motivo, 300) || 'Pediu para falar com uma pessoa';
  const summary = text(args.resumo, 300);
  const phone = formatPhoneBR(ctx.leadPhone) || ctx.leadPhone;
  // Pausa a IA nesta conversa por 12h e avisa no painel e por e-mail.
  const result = await handOffToTeam(ctx, reason, '/atendimento');
  await notifySalesOwner({
    title: `${ctx.leadName} precisa de você`,
    text: `${ctx.leadName} (${phone}) precisa de você: ${reason}.${summary ? ` Sobre o negócio: ${summary}.` : ''} A atendente parou de responder essa conversa por 12 horas.`,
  });
  return { ...result, observacao: 'Alan avisado. Diga em uma frase que ele vai responder por aqui e não faça mais perguntas.' };
}

export async function executeSalesTool(name: string, args: Record<string, unknown>, ctx: HandoffContext): Promise<ToolResult> {
  switch (name) {
    case SALES_INTEREST_TOOL:
      return avisarInteresse(args, ctx);
    case SALES_HANDOFF_TOOL:
      return chamarAlan(args, ctx);
    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}
