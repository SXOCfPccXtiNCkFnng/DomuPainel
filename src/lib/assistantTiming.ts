/**
 * Constantes da atendente sem dependências de servidor (a tela do /interno
 * também usa). As regras ficam em assistantRules.ts.
 */

/** Alguém da equipe respondeu (celular ou painel) ou a IA chamou a equipe: ela fica quieta por esse tempo. */
export const HUMAN_PAUSE_MS = 12 * 60 * 60 * 1000;

export const ASSISTANT_SENDER_TYPE = 'BOT_AI';

/** Sem conversa por esse tempo, a próxima mensagem começa uma conversa nova (vale a abordagem de novo). */
export const APPROACH_SESSION_GAP_MS = 7 * 24 * 60 * 60 * 1000;
