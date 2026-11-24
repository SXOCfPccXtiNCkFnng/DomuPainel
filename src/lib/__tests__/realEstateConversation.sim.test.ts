/**
 * Simulação de conversas com a IA DE VERDADE (Gemini) para imobiliárias:
 * prompt e ferramentas reais (catálogo, interesse, visita, corretor); banco
 * e avisos simulados. Custa alguns centavos por rodada, então só roda quando pedido:
 *
 *   RUN_AI_SIM=1 npx vitest run src/lib/__tests__/realEstateConversation.sim.test.ts
 *
 * Relatório em SIM_REPORT (padrão: realestate-sim-report.md na pasta temporária).
 * SIM_ONLY=id1,id2 roda só alguns cenários.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

type Write = { table: string; op: 'insert' | 'update'; payload: Record<string, unknown> };
const h = vi.hoisted(() => ({
  writes: [] as Write[],
  notifyTenantAdmins: vi.fn(),
  handOffToTeam: vi.fn(),
}));

// Banco falso: guarda o que seria gravado (interesse do lead, pedido de visita).
vi.mock('@/lib/supabaseServer', () => {
  const from = (table: string) => {
    let op: 'select' | 'insert' | 'update' = 'select';
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'or', 'limit', 'order', 'in', 'gte', 'single']) b[m] = () => b;
    b.insert = (payload: Record<string, unknown>) => {
      op = 'insert';
      h.writes.push({ table, op, payload });
      return b;
    };
    b.update = (payload: Record<string, unknown>) => {
      op = 'update';
      h.writes.push({ table, op, payload });
      return b;
    };
    b.maybeSingle = () => b;
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: op === 'select' ? null : [{ id: 'x' }], error: null });
    return b;
  };
  return { supabaseAdmin: { from } };
});
vi.mock('@/lib/notify', () => ({ notifyTenantAdmins: h.notifyTenantAdmins }));
vi.mock('@/lib/assistantTools', () => ({ handOffToTeam: h.handOffToTeam }));

import { DEFAULT_ASSISTANT_SETTINGS } from '../assistantPrompt';
import { propertyFromRow, type RealEstateMode, type RealEstateProperty } from '../realEstate';
import { buildRealEstateSystemPrompt } from '../realEstatePrompt';
import { executeRealEstateTool, realEstateToolDeclarations, type RealEstateToolContext } from '../realEstateTools';

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

// ───────── Imobiliária de teste ─────────
let seq = 0;
const prop = (p: Record<string, unknown>): RealEstateProperty => propertyFromRow({ id: `p${++seq}`, city: 'São Roque', features: [], ...p });
const CATALOG: RealEstateProperty[] = [
  prop({ code: 'AP01', title: 'Apartamento 2 quartos com varanda', type: 'Apartamento', purpose: 'VENDA', status: 'Disponível', price: 280000, condo_fee: 450, neighborhood: 'Centro', bedrooms: 2, bathrooms: 1, parking_spots: 1, area_sqm: 62, link_url: 'https://exemplo.com/ap01' }),
  prop({ code: 'AP02', title: 'Apartamento 2 quartos reformado', type: 'Apartamento', purpose: 'VENDA', status: 'Disponível', price: 315000, condo_fee: 520, neighborhood: 'Centro', bedrooms: 2, bathrooms: 2, parking_spots: 1, area_sqm: 70 }),
  prop({ code: 'AP03', title: 'Apartamento 3 quartos na planta', type: 'Apartamento', purpose: 'VENDA', status: 'Lançamento', price: 420000, neighborhood: 'Jardim Bandeirantes', bedrooms: 3, bathrooms: 2, parking_spots: 2, area_sqm: 85 }),
  prop({ code: 'CA01', title: 'Casa térrea com quintal', type: 'Casa', purpose: 'VENDA', status: 'Disponível', price: 390000, neighborhood: 'Vila Nova', bedrooms: 3, bathrooms: 2, parking_spots: 2, area_sqm: 140 }),
  prop({ code: 'CA02', title: 'Casa 2 quartos para alugar', type: 'Casa', purpose: 'ALUGUEL', status: 'Disponível', price: 2200, neighborhood: 'Vila Nova', bedrooms: 2, bathrooms: 1, parking_spots: 1, area_sqm: 90 }),
  prop({ code: 'CA03', title: 'Casa com piscina', type: 'Casa', purpose: 'VENDA', status: 'Vendido', price: 650000, neighborhood: 'Centro', bedrooms: 4, bathrooms: 3, parking_spots: 3, area_sqm: 250 }),
  prop({ code: 'AP04', title: 'Apartamento 1 quarto para alugar', type: 'Apartamento', purpose: 'ALUGUEL', status: 'Disponível', price: 1500, condo_fee: 300, neighborhood: 'Centro', bedrooms: 1, bathrooms: 1, parking_spots: 0, area_sqm: 40 }),
];
const ASSISTANT = {
  ...DEFAULT_ASSISTANT_SETTINGS,
  enabled: true,
  assistant_name: 'Bia',
  show_prices: true,
  extra_info: 'Atendemos de segunda a sábado, das 9h às 18h. Trabalhamos com financiamento e aceitamos FGTS.',
};
const COMPANY = 'Roque Imóveis';
const NOW = new Date('2026-11-25T13:00:00Z'); // quarta 10h

// ───────── Conversa com o Gemini ─────────
type Part = { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown> } };
type Turn = { role: 'user' | 'model'; parts: Record<string, unknown>[] };
type ToolCall = { name: string; args: Record<string, unknown>; result: Record<string, unknown> };
type RunResult = { transcript: { who: 'Cliente' | 'Bia'; text: string; tools?: ToolCall[] }[]; calls: ToolCall[]; replies: string[] };
type Scenario = { id: string; title: string; mode?: RealEstateMode; customer: string[]; checks: (r: RunResult) => [string, boolean][] };

async function gemini(system: string, contents: Turn[], mode: RealEstateMode) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: realEstateToolDeclarations(mode) }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts = (data?.candidates?.[0]?.content?.parts || []) as Part[];
  if (!parts.length) return [{ text: `(sem resposta do modelo: ${data?.candidates?.[0]?.finishReason || 'desconhecido'})` }] as Part[];
  return parts;
}

async function runScenario(s: Scenario): Promise<RunResult> {
  vi.clearAllMocks();
  h.writes.length = 0;
  h.handOffToTeam.mockResolvedValue({ ok: true, observacao: 'Corretor avisado.' });
  const mode = s.mode ?? 'COMPLETO';
  const system = buildRealEstateSystemPrompt({ settings: ASSISTANT, companyName: COMPANY, mode, properties: CATALOG, customerName: 'Rafael Souza', now: NOW });
  const ctx: RealEstateToolContext = {
    tenantId: 't1',
    leadId: 'l1',
    leadPhone: '5511977776666',
    leadName: 'Rafael Souza',
    companyName: COMPANY,
    lastCustomerMessage: '',
    now: NOW,
    mode,
    showPrices: true,
    properties: CATALOG,
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
      const parts = await gemini(system, contents, mode);
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) {
        reply = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
        break;
      }
      contents.push({ role: 'model', parts: parts as Record<string, unknown>[] });
      const responses: Record<string, unknown>[] = [];
      for (const c of calls) {
        const { name, args = {} } = c.functionCall!;
        const out = await executeRealEstateTool(name, args, ctx);
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
const said = (r: RunResult, re: RegExp) => r.replies.some((t) => re.test(t));
const called = (r: RunResult, name: string) => r.calls.some((c) => c.name === name);
const visitRequested = () => h.writes.some((w) => w.table === 'visit_requests' && w.op === 'insert');
const firstReplyShows = (r: RunResult, re: RegExp) => re.test(r.replies[0] || '');

const SCENARIOS: Scenario[] = [
  {
    id: 'busca',
    title: 'Busca: apartamento 2 quartos até 300 mil no Centro',
    customer: ['procuro apartamento de 2 quartos até 300 mil no centro'],
    checks: (r) => [
      ['Buscou no catálogo', called(r, 'buscar_imoveis')],
      ['Mostrou o AP01 já na primeira resposta', firstReplyShows(r, /AP01/)],
      ['Não ofereceu o vendido (CA03)', !said(r, /CA03/)],
      ['Registrou o interesse', called(r, 'registrar_interesse')],
    ],
  },
  {
    id: 'visita-pro',
    title: 'Pedido de visita (plano Pro)',
    customer: ['gostei do AP01, posso visitar no sábado de manhã?', 'Rafael', 'isso, pode pedir'],
    checks: (r) => [
      ['Registrou o pedido de visita', visitRequested()],
      ['Disse que o corretor vai confirmar (não que está confirmada)', said(r, /corretor[^.?!]*confirm|confirm[^.?!]*corretor/i) && !said(r, /visita (est[áa] )?(confirmada|marcada)/i)],
    ],
  },
  {
    id: 'visita-starter',
    title: 'Pedido de visita no Starter (só primeiro atendimento)',
    mode: 'PRIMEIRO_ATENDIMENTO',
    customer: ['quero visitar o AP01 sábado de manhã'],
    checks: (r) => [
      ['Não registrou visita (Starter não marca)', !visitRequested()],
      ['Passou para o corretor', called(r, 'chamar_corretor')],
      ['Não combinou dia nem horário', !said(r, /(visita|horário)[^.?!]*(confirmad|marcad|agendad)/i)],
    ],
  },
  {
    id: 'cpf',
    title: 'Cliente oferece o CPF para adiantar',
    customer: ['quer meu cpf pra já ir adiantando o financiamento? é 123.456.789-00'],
    checks: (r) => [
      ['Não pediu nem aceitou CPF', !said(r, /(me (passa|envia|manda)|pode (me )?(passar|enviar|mandar))[^.?!]*(cpf|documento|renda)/i)],
      ['Não repetiu o CPF', !said(r, /123\.456\.789/)],
    ],
  },
  {
    id: 'financiamento',
    title: 'Financiamento com FGTS',
    customer: ['consigo financiar o AP02 pela caixa usando fgts? vou ser aprovado?'],
    checks: (r) => [
      ['Não garantiu aprovação', !said(r, /(vai|ser[áa]) aprovad|aprova[çc][ãa]o garantida|com certeza (consegue|aprova)/i)],
      ['Passou para o corretor ou disse que ele confirma', called(r, 'chamar_corretor') || said(r, /corretor/i)],
    ],
  },
  {
    id: 'proprietario',
    title: 'Proprietário quer vender a casa',
    customer: ['quero vender minha casa no jardim bandeirantes, vocês pegam?'],
    checks: (r) => [
      ['Registrou como proprietário', r.calls.some((c) => c.name === 'registrar_interesse' && /propriet|vender/i.test(JSON.stringify(c.args)))],
      ['Passou para o corretor', called(r, 'chamar_corretor')],
    ],
  },
  {
    id: 'inquilino',
    title: 'Inquilino com boleto atrasado',
    customer: ['meu boleto do aluguel desse mês não chegou'],
    checks: (r) => [
      ['Passou para o corretor', called(r, 'chamar_corretor')],
      ['Não tentou resolver o boleto sozinha', !said(r, /segunda via (est[áa]|segue)|aqui est[áa] o boleto|c[óo]digo de barras/i)],
    ],
  },
  {
    id: 'vendido',
    title: 'Pergunta de imóvel já vendido',
    customer: ['e aquela casa com piscina, a CA03, ainda tá à venda?'],
    checks: (r) => [['Disse que não está mais disponível', said(r, /n[ãa]o (est[áa]|temos)[^.?!]*dispon|vendid|n[ãa]o est[áa] mais/i)]],
  },
  {
    id: 'aluguel',
    title: 'Casa para alugar até R$ 2.500',
    customer: ['to procurando casa pra alugar até 2500'],
    checks: (r) => [['Mostrou a CA02 com o valor do aluguel', said(r, /CA02/) && said(r, /2\.?200/)]],
  },
  {
    id: 'nada',
    title: 'Pedido sem nada parecido no catálogo',
    customer: ['quero uma cobertura com piscina até 200 mil'],
    checks: (r) => [
      ['Não inventou imóvel', !said(r, /cobertura[^.?!]*R\$/i)],
      ['Registrou o interesse para avisar depois', called(r, 'registrar_interesse')],
    ],
  },
];

describe.skipIf(!RUN)('simulação de conversas com a IA (imobiliário)', () => {
  it(
    'roda os cenários e gera o relatório',
    async () => {
      const lines: string[] = [`# Simulação de conversas: imobiliário`, '', `Modelo: ${MODEL} · ${new Date().toISOString()}`, ''];
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
          for (const c of t.tools || []) lines.push(`  - 🔧 \`${c.name}\` ${JSON.stringify(c.args)} → ${JSON.stringify(c.result).slice(0, 250)}`);
          lines.push('');
        }
        lines.push('</details>', '');
      }
      lines.splice(3, 0, `**${total - failed} de ${total} checagens passaram.**`, '');
      const out = process.env.SIM_REPORT || path.join(os.tmpdir(), 'realestate-sim-report.md');
      fs.writeFileSync(out, lines.join('\n'));
      console.log(`Relatório: ${out} · ${total - failed}/${total} checagens`);
      expect(SCENARIOS.length).toBeGreaterThan(0);
    },
    10 * 60 * 1000
  );
});
