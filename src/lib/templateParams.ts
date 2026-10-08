/**
 * Variáveis de template ({{nome}}, {{1}}, {{data}}...) e de onde vem o valor
 * de cada uma num disparo. Usado pela tela (assistente de campanha) e pelo
 * servidor (criação e disparo) — sem dependências, para dar para testar.
 *
 * A Meta recebe os valores POR POSIÇÃO ({{1}}, {{2}}...). Templates criados na
 * Domu guardam o texto com nomes ({{nome}}, {{data}}) e foram enviados à Meta
 * numerando na ordem da primeira aparição — a mesma ordem usada aqui.
 */

export type ParamSource = 'contact_name' | 'company_name' | 'fixed';

export type TemplateParam = {
  source: ParamSource;
  /** Só para source = 'fixed'. */
  value?: string;
};

export const PARAM_SOURCE_LABELS: Record<ParamSource, string> = {
  contact_name: 'Nome do contato',
  company_name: 'Nome da sua empresa',
  fixed: 'Texto fixo (igual para todos)',
};

/** Limite de texto por variável (a Meta aceita mais, mas mensagem longa vira spam). */
export const MAX_PARAM_LENGTH = 300;

const VAR_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;
const CONTACT_NAME_KEYS = new Set(['nome', 'name', 'cliente', 'primeiro_nome', 'contato']);
const COMPANY_NAME_KEYS = new Set(['empresa', 'loja', 'negocio', 'negócio']);

/** Variáveis na ordem em que a Meta espera os valores. */
export function extractTemplateVariables(bodyText: string | null | undefined): string[] {
  const seen: string[] = [];
  for (const match of String(bodyText || '').matchAll(VAR_REGEX)) {
    const name = match[1].trim();
    if (name && !seen.includes(name)) seen.push(name);
  }
  // Template no formato da Meta ({{1}}, {{2}}): a ordem é a numérica.
  if (seen.length > 0 && seen.every((v) => /^\d+$/.test(v))) {
    return [...seen].sort((a, b) => Number(a) - Number(b));
  }
  return seen;
}

/** Sugestão inicial de origem para cada variável. */
export function defaultParamFor(variable: string, index: number): TemplateParam {
  const key = variable.trim().toLowerCase();
  if (CONTACT_NAME_KEYS.has(key)) return { source: 'contact_name' };
  if (COMPANY_NAME_KEYS.has(key)) return { source: 'company_name' };
  // Convenção dos templates da Meta: "Olá {{1}}" — a primeira é o nome.
  if (key === '1' && index === 0) return { source: 'contact_name' };
  return { source: 'fixed', value: '' };
}

export function defaultParams(variables: string[]): TemplateParam[] {
  return variables.map((v, i) => defaultParamFor(v, i));
}

/** Rótulo amigável da variável para a tela. */
export function variableLabel(variable: string): string {
  return /^\d+$/.test(variable) ? `Variável {{${variable}}}` : `{{${variable}}}`;
}

/**
 * Confere os valores antes de criar a campanha. Regras da Meta para
 * parâmetro de texto: não pode ser vazio, nem ter quebra de linha/tab, nem
 * mais de 4 espaços seguidos.
 */
export function validateTemplateParams(
  variables: string[],
  params: unknown
): { ok: true; params: TemplateParam[] } | { ok: false; error: string } {
  if (variables.length === 0) return { ok: true, params: [] };
  if (!Array.isArray(params) || params.length !== variables.length) {
    return { ok: false, error: 'Preencha o valor de todas as variáveis do template.' };
  }

  const clean: TemplateParam[] = [];
  for (let i = 0; i < variables.length; i += 1) {
    const raw = params[i] as Partial<TemplateParam> | null;
    const label = variableLabel(variables[i]);
    if (!raw || !['contact_name', 'company_name', 'fixed'].includes(String(raw.source))) {
      return { ok: false, error: `Escolha de onde vem o valor de ${label}.` };
    }
    if (raw.source !== 'fixed') {
      clean.push({ source: raw.source as ParamSource });
      continue;
    }
    const value = String(raw.value ?? '').trim();
    if (!value) return { ok: false, error: `Preencha o texto de ${label}.` };
    if (/[\n\r\t]/.test(value)) {
      return { ok: false, error: `${label} não pode ter quebra de linha (regra da Meta).` };
    }
    if (/ {5,}/.test(value)) {
      return { ok: false, error: `${label} não pode ter mais de 4 espaços seguidos (regra da Meta).` };
    }
    if (value.length > MAX_PARAM_LENGTH) {
      return { ok: false, error: `${label} pode ter no máximo ${MAX_PARAM_LENGTH} caracteres.` };
    }
    clean.push({ source: 'fixed', value });
  }
  return { ok: true, params: clean };
}

function cleanName(value: string | null | undefined, fallback: string): string {
  const text = String(value || '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/ {5,}/g, ' ')
    .trim();
  if (!text || text === 'Contato Importado') return fallback;
  return text.slice(0, MAX_PARAM_LENGTH);
}

/** Valor final de cada variável para um contato. */
export function resolveParamValues(
  params: TemplateParam[],
  ctx: { contactName?: string | null; companyName?: string | null }
): string[] {
  return params.map((p) => {
    if (p.source === 'contact_name') return cleanName(ctx.contactName, 'Cliente');
    if (p.source === 'company_name') return cleanName(ctx.companyName, 'nossa equipe');
    return String(p.value || '');
  });
}

/** Componente "body" no formato da Cloud API (ou undefined se não há variáveis). */
export function buildBodyComponent(
  params: TemplateParam[],
  ctx: { contactName?: string | null; companyName?: string | null }
): { type: 'body'; parameters: { type: 'text'; text: string }[] }[] | undefined {
  if (params.length === 0) return undefined;
  return [
    {
      type: 'body',
      parameters: resolveParamValues(params, ctx).map((text) => ({ type: 'text', text })),
    },
  ];
}

/** Texto final para o preview (substitui cada variável pelo valor). */
export function renderWithParams(
  bodyText: string,
  variables: string[],
  values: string[]
): string {
  let out = String(bodyText || '');
  variables.forEach((v, i) => {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g'), values[i] || `{{${v}}}`);
  });
  return out;
}
