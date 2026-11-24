/**
 * Simulação de conversas com a IA DE VERDADE (Gemini) para o lava rápido
 * (carro obrigatório, 2 carros ao mesmo tempo): prompt e ferramentas reais da agenda; agenda e avisos
 * simulados em memória. Custa alguns centavos por rodada, então só roda quando pedido:
 *
 *   RUN_AI_SIM=1 npx vitest run src/lib/__tests__/carwashConversation.sim.test.ts
 *
 * Relatório em SIM_REPORT (padrão: carwash-sim-report.md na pasta temporária).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

type Row = {
  id: string;
  lead_id: string | null;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  vehicle: string | null;
};

const h = vi.hoisted(() => ({
  store: [] as Row[],
  now: new Date(),
  createAppointment: vi.fn(),
  loadBusyRanges: vi.fn(),
  notifyTenantAdmins: vi.fn(),
}));

vi.mock('@/lib/schedulingServer', () => ({ createAppointment: h.createAppointment, loadBusyRanges: h.loadBusyRanges }));
vi.mock('@/lib/notify', () => ({ notifyTenantAdmins: h.notifyTenantAdmins }));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ ok: true })), appBaseUrl: () => 'https://painel.test' }));
// Banco falso: só o que as ferramentas da agenda usam (ver e cancelar agendamentos do cliente).
vi.mock('@/lib/supabaseServer', () => {
  const from = (table: string) => {
    const st: { op: 'select' | 'update'; filters: Record<string, unknown>; patch: Record<string, unknown> | null } = {
      op: 'select',
      filters: {},
      patch: null,
    };
    const run = () => {
      if (table !== 'appointments') return { data: [], error: null };
      const mine = h.store.filter((a) => a.lead_id === 'l1' && a.status === 'CONFIRMED' && new Date(a.starts_at) > h.now);
      if (st.op === 'select') {
        const at = st.filters.starts_at ? new Date(String(st.filters.starts_at)).getTime() : null;
        return { data: at == null ? mine : mine.filter((x) => new Date(x.starts_at).getTime() === at), error: null };
      }
      const row = mine.find((a) => a.id === st.filters.id);
      if (!row) return { data: [], error: null };
      Object.assign(row, st.patch);
      return { data: [row], error: null };
    };
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'or', 'gte', 'lt', 'gt', 'order', 'limit', 'in', 'maybeSingle']) b[m] = () => b;
    b.update = (patch: Record<string, unknown>) => {
      st.op = 'update';
      st.patch = patch;
      return b;
    };
    b.eq = (k: string, v: unknown) => {
      st.filters[k] = v;
      return b;
    };
    b.then = (resolve: (v: unknown) => unknown) => resolve(run());
    return b;
  };
  return { supabaseAdmin: { from } };
});

import { buildAssistantSystemPrompt, DEFAULT_ASSISTANT_SETTINGS } from '../assistantPrompt';
import { assistantToolDeclarations, executeAssistantTool, type AssistantToolContext } from '../assistantTools';
import {
  availableSlots,
  brtDateKey,
  brtMinutesOfDay,
  DEFAULT_SCHEDULING_SETTINGS,
  formatMinutes,
  type ServiceItem,
} from '../scheduling';

// ───────── Chave da IA (do .env.local, sem imprimir) ─────────
function envKey(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, '../../../.env.local'), 'utf8');
    const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : undefined;
  } catch {
    return undefined;
  }
}
const API_KEY = envKey('GEMINI_API_KEY');
const MODEL = envKey('GEMINI_ASSISTANT_MODEL') || 'gemini-3.8-flash';
const RUN = process.env.RUN_AI_SIM === '1' && Boolean(API_KEY);

// ───────── Salão de teste ─────────
const svc = (id: string, name: string, duration_minutes: number, price: number): ServiceItem => ({
  id,
  name,
  description: null,
  duration_minutes,
  price,
  active: true,
});
const SERVICES: ServiceItem[] = [
  svc('s1', 'Lavagem simples', 40, 40),
  svc('s2', 'Lavagem completa', 60, 70),
  svc('s3', 'Lavagem completa SUV/caminhonete', 75, 90),
  svc('s4', 'Polimento', 180, 250),
  svc('s5', 'Higienização interna', 120, 180),
];
// Segunda a sexta 8h–18h, sábado 8h–13h, domingo fechado; dois carros ao mesmo tempo.
const SCHEDULING = { ...DEFAULT_SCHEDULING_SETTINGS, capacity: 2 };
const ASSISTANT = {
  ...DEFAULT_ASSISTANT_SETTINGS,
  enabled: true,
  assistant_name: 'Bia',
  show_prices: true,
  payment_methods: ['PIX', 'Cartão de débito', 'Cartão de crédito', 'Dinheiro'],
  address: 'Av. Tiradentes, 900 - Centro',
};
const COMPANY = 'Lava Rápido Brilho';

// Quarta-feira, 25/11/2026, 10h em Brasília.
const NOW = new Date('2026-11-25T13:00:00Z');
const at = (dateKey: string, hhmm: string) => new Date(`${dateKey}T${hhmm}:00-03:00`).toISOString();

function seed(rows: Partial<Row>[]) {
  h.store.length = 0;
  rows.forEach((r, i) =>
    h.store.push({
      id: `a${i + 1}`,
      lead_id: null,
      customer_name: 'Outro cliente',
      customer_phone: '5511900000000',
      service_name: 'Corte masculino',
      starts_at: r.starts_at!,
      ends_at: r.ends_at!,
      status: 'CONFIRMED',
      vehicle: null,
      ...r,
    })
  );
}

// Quinta 15h: um carro (ainda cabe outro).
const ONE_AT_15 = [{ starts_at: at('2026-11-26', '15:00'), ends_at: at('2026-11-26', '16:00'), vehicle: 'Gol branco' }];
// Quinta 15h: dois carros (lotado).
const FULL_AT_15 = [...ONE_AT_15, { starts_at: at('2026-11-26', '15:00'), ends_at: at('2026-11-26', '16:00'), vehicle: 'HB20 preto' }];
const BASE = FULL_AT_15;
// O cliente da conversa já tem lavagem na sexta às 10h.
const WITH_MINE = [
  ...BASE,
  { id: 'mine', lead_id: 'l1', customer_name: 'Rafael Souza', customer_phone: '5511977776666', service_name: 'Lavagem completa', vehicle: 'Onix prata', starts_at: at('2026-11-27', '10:00'), ends_at: at('2026-11-27', '11:00') },
];

// ───────── Conversa com o Gemini (mesmo desenho do assistantRunner) ─────────
type Part = { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown> } };
type Turn = { role: 'user' | 'model'; parts: Record<string, unknown>[] };
type ToolCall = { name: string; args: Record<string, unknown>; result: Record<string, unknown> };
type RunResult = { transcript: { who: 'Cliente' | 'Bia'; text: string; tools?: ToolCall[] }[]; calls: ToolCall[]; replies: string[] };
type Scenario = {
  id: string;
  title: string;
  customer: string[];
  seed: Partial<Row>[];
  checks: (r: RunResult) => [string, boolean][];
  /** Variações da loja neste cenário (outra empresa, serviços, preços escondidos...). */
  company?: string;
  services?: ServiceItem[];
  assistant?: Partial<typeof ASSISTANT>;
};

async function gemini(system: string, contents: Turn[]) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: assistantToolDeclarations('automotivo') }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = (data?.candidates?.[0]?.content?.parts || []) as Part[];
  if (!parts.length) {
    const why = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'desconhecido';
    return [{ text: `(sem resposta do modelo: ${why})` }] as Part[];
  }
  return parts;
}

function installAgenda(services: ServiceItem[]) {
  h.now = NOW;
  h.loadBusyRanges.mockImplementation(async () =>
    h.store.filter((a) => a.status === 'CONFIRMED').map((a) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) }))
  );
  // Igual ao sistema: só marca horário livre dentro do horário de funcionamento.
  h.createAppointment.mockImplementation(async (_tenant: string, input: Record<string, unknown>) => {
    const service = services.find((x) => x.id === input.serviceId)!;
    const start = new Date(String(input.startsAt));
    const dateKey = brtDateKey(start);
    const busy = h.store.filter((a) => a.status === 'CONFIRMED').map((a) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) }));
    const free = availableSlots({ dateKey, durationMinutes: service.duration_minutes, settings: SCHEDULING, busy, now: NOW });
    if (!free.some((d) => d.getTime() === start.getTime())) return { ok: false, error: 'Esse horário não está livre.' };
    const row: Row = {
      id: `new${h.store.length + 1}`,
      lead_id: 'l1',
      customer_name: String(input.customerName),
      customer_phone: String(input.customerPhone),
      service_name: service.name,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + service.duration_minutes * 60_000).toISOString(),
      status: 'CONFIRMED',
      vehicle: input.vehicle ? String(input.vehicle) : null,
    };
    h.store.push(row);
    return { ok: true, appointment: row };
  });
}

async function runScenario(s: Scenario): Promise<RunResult> {
  vi.clearAllMocks();
  seed(s.seed);
  const services = s.services ?? SERVICES;
  const company = s.company ?? COMPANY;
  installAgenda(services);
  const system = buildAssistantSystemPrompt({
    settings: { ...ASSISTANT, ...s.assistant },
    companyName: company,
    services,
    scheduling: SCHEDULING,
    now: NOW,
    customerName: 'Rafael Souza',
    vertical: 'automotivo',
  });
  const ctx: AssistantToolContext = {
    tenantId: 't1',
    leadId: 'l1',
    leadPhone: '5511977776666',
    leadName: 'Rafael Souza',
    companyName: company,
    lastCustomerMessage: '',
    services,
    scheduling: SCHEDULING,
    now: NOW,
  };
  const history: Turn[] = [];
  const result: RunResult = { transcript: [], calls: [], replies: [] };
  for (const msg of s.customer) {
    ctx.lastCustomerMessage = msg;
    history.push({ role: 'user', parts: [{ text: msg }] });
    result.transcript.push({ who: 'Cliente', text: msg });
    const contents: Turn[] = [...history];
    const turnCalls: ToolCall[] = [];
    let reply = '';
    for (let round = 0; round < 6; round++) {
      const parts = await gemini(system, contents);
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) {
        reply = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
        break;
      }
      contents.push({ role: 'model', parts: parts as Record<string, unknown>[] });
      const responses: Record<string, unknown>[] = [];
      for (const c of calls) {
        const { name, args = {} } = c.functionCall!;
        const out = await executeAssistantTool(name, args, ctx);
        turnCalls.push({ name, args, result: out });
        responses.push({ functionResponse: { name, response: { result: out } } });
      }
      contents.push({ role: 'user', parts: responses });
    }
    result.calls.push(...turnCalls);
    result.replies.push(reply);
    result.transcript.push({ who: 'Bia', text: reply || '(sem resposta)', tools: turnCalls });
    history.push({ role: 'model', parts: [{ text: reply || '...' }] });
  }
  return result;
}

// ───────── Cenários ─────────
const booked = () => h.store.filter((a) => a.id.startsWith('new') && a.status === 'CONFIRMED');
const bookedAt = (dateKey: string, hhmm: string) =>
  booked().some((a) => brtDateKey(new Date(a.starts_at)) === dateKey && formatMinutes(brtMinutesOfDay(new Date(a.starts_at))) === hhmm);
const said = (r: RunResult, re: RegExp) => r.replies.some((t) => re.test(t));
const consultedBeforeBooking = (r: RunResult) => {
  const i = r.calls.findIndex((c) => c.name === 'consultar_horarios_livres');
  const j = r.calls.findIndex((c) => c.name === 'agendar' && c.result.ok);
  return j === -1 || (i !== -1 && i < j);
};

const SCENARIOS: Scenario[] = [
  {
    id: 'agendar',
    title: 'Agendar lavagem completa (pergunta o carro)',
    seed: BASE,
    customer: ['quero lavar o carro amanhã às 14h, lavagem completa', 'é um onix prata', 'pode confirmar'],
    checks: (r) => [
      ['Marcou 1 lavagem', booked().length === 1],
      ['Lavagem completa na quinta às 14:00', booked()[0]?.service_name === 'Lavagem completa' && bookedAt('2026-11-26', '14:00')],
      ['Registrou o carro', /onix/i.test(String(booked()[0]?.vehicle || ''))],
      ['Consultou a agenda antes de marcar', consultedBeforeBooking(r)],
    ],
  },
  {
    id: 'cabe-mais-um',
    title: 'Já tem um carro às 15h, mas cabem dois',
    seed: ONE_AT_15,
    customer: ['lavagem simples amanhã às 15h, é um gol branco, pode marcar', 'pode confirmar'],
    checks: () => [['Marcou às 15:00 (cabem dois carros)', bookedAt('2026-11-26', '15:00')]],
  },
  {
    id: 'lotado',
    title: 'Dois carros às 15h: lotado',
    seed: FULL_AT_15,
    customer: ['quero uma lavagem completa amanhã às 15h, é um civic'],
    checks: (r) => [
      ['Não marcou às 15h (lotado)', !bookedAt('2026-11-26', '15:00')],
      ['Ofereceu outro horário', r.calls.some((x) => x.name === 'consultar_horarios_livres') && said(r, /\b(1[0-7]|0?[89])(:[0-5]0|h)/)],
    ],
  },
  {
    id: 'suv',
    title: 'Preço para caminhonete (SUV)',
    seed: BASE,
    customer: ['quanto fica a lavagem completa numa hilux?'],
    checks: (r) => [['Passou o preço de SUV (R$ 90), não o de carro', said(r, /90/) && !said(r, /R\$\s?70\b(?![^.?!]*SUV)/)]],
  },
  {
    id: 'hoje',
    title: '"Dá pra lavar hoje?"',
    seed: BASE,
    customer: ['da pra lavar hoje? lavagem simples'],
    checks: (r) => [
      ['Consultou a agenda de hoje', r.calls.some((x) => x.name === 'consultar_horarios_livres' && x.args.data === '2026-11-25')],
      ['Ofereceu horário a partir das 11h', said(r, /\b(1[1-7])(:[0-5]0|h)/)],
    ],
  },
  {
    id: 'sem-carro',
    title: 'Cliente quer marcar sem dizer o carro',
    seed: BASE,
    customer: ['marca uma lavagem simples amanhã às 9h, depois te falo o carro'],
    checks: (r) => [
      ['Não marcou sem o carro', booked().every((x) => Boolean(x.vehicle))],
      ['Pediu o carro', said(r, /carro|ve[íi]culo|modelo/i)],
    ],
  },
  {
    id: 'cancelar',
    title: 'Cancelar a lavagem de sexta',
    seed: WITH_MINE,
    customer: ['preciso cancelar minha lavagem de sexta', 'sim, pode cancelar'],
    checks: () => [['Cancelou a lavagem do cliente', h.store.find((x) => x.id === 'mine')?.status === 'CANCELLED']],
  },
  {
    id: 'garantia',
    title: 'Pergunta que não está nos dados (garantia se chover)',
    seed: BASE,
    customer: ['se chover depois vocês lavam de novo de graça?'],
    checks: (r) => [
      ['Não prometeu lavar de novo de graça', !said(r, /(sim|lavamos)[^.?!]*(de novo|novamente)[^.?!]*(gr[áa]tis|de gra[çc]a|sem custo)/i)],
      ['Avisou mesmo a equipe (não só prometeu)', r.calls.some((x) => x.name === 'perguntar_equipe' || x.name === 'chamar_equipe')],
      ['Não pausou a atendente por uma dúvida simples', !r.calls.some((x) => x.name === 'chamar_equipe')],
    ],
  },
];

describe.skipIf(!RUN)('simulação de conversas com a IA (lava rápido)', () => {
  it(
    'roda os cenários e gera o relatório',
    async () => {
      const lines: string[] = [`# Simulação de conversas: lava rápido`, '', `Modelo: ${MODEL} · ${new Date().toISOString()}`, ''];
      let failed = 0;
      let total = 0;
      const only = process.env.SIM_ONLY?.split(',');
      for (const s of SCENARIOS.filter((x) => !only || only.includes(x.id))) {
        let r: RunResult;
        try {
          r = await runScenario(s);
        } catch (err) {
          lines.push(`## ❌ ${s.title}`, '', `Erro ao rodar: ${err instanceof Error ? err.message : String(err)}`, '');
          failed++;
          total++;
          continue;
        }
        const checks = s.checks(r);
        total += checks.length;
        failed += checks.filter(([, pass]) => !pass).length;
        lines.push(`## ${checks.every(([, p]) => p) ? '✅' : '❌'} ${s.title}`, '');
        for (const [label, pass] of checks) lines.push(`- ${pass ? '✅' : '❌'} ${label}`);
        lines.push('', '<details><summary>Conversa</summary>', '');
        for (const t of r.transcript) {
          lines.push(`**${t.who}:** ${t.text.replace(/\n/g, '  \n')}`);
          for (const c of t.tools || []) lines.push(`  - 🔧 \`${c.name}\` ${JSON.stringify(c.args)} → ${JSON.stringify(c.result).slice(0, 300)}`);
          lines.push('');
        }
        lines.push('</details>', '');
      }
      lines.splice(3, 0, `**${total - failed} de ${total} checagens passaram.**`, '');
      const out = process.env.SIM_REPORT || path.join(os.tmpdir(), 'carwash-sim-report.md');
      fs.writeFileSync(out, lines.join('\n'));
      console.log(`Relatório: ${out} · ${total - failed}/${total} checagens`);
      expect(SCENARIOS.length).toBeGreaterThan(0);
    },
    10 * 60 * 1000
  );
});
