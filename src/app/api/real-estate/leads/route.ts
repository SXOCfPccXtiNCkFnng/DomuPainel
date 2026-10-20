import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { isSchemaPendingError } from '@/lib/schedulingServer';
import { isLeadStage } from '@/lib/realEstate';
import { HUMAN_PAUSE_MS, HUMAN_SENDER_TYPES } from '@/lib/assistantRules';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATION_PENDING = 'Os leads do módulo imobiliário ainda não foram ativados no banco (migration 20261021_real_estate.sql).';
const CONTROL_PENDING = 'O controle da atendente por lead ainda não foi ativado no banco (migration 20261022_lead_assistant_control.sql).';

const BASE_COLUMNS =
  'id, name, phone, status, source, region, budget_max, interest_purpose, interest_property_type, bedrooms_min, ai_summary, last_contact_at, updated_at, assistant_paused_until, properties:interest_property_id(code, title)';
const CONTROL_COLUMNS = 'assistant_disabled, assistant_resumed_at';

/** Quem conversou ou já tem interesse registrado (contato importado que nunca falou fica só em Contatos). */
const ENGAGED_FILTER =
  'status.neq.NOVO,ai_summary.not.is.null,interest_purpose.not.is.null,interest_property_type.not.is.null,source.eq.WHATSAPP';

/**
 * Estado da atendente no contato:
 * - OFF: desligada pela página Leads;
 * - WITH_TEAM: com o corretor (passou a conversa ou a equipe respondeu há menos de 12h) até `backAt`;
 * - ACTIVE: a atendente responde.
 */
export type LeadAssistantState = 'OFF' | 'WITH_TEAM' | 'ACTIVE';

function assistantStateOf(
  lead: { assistant_disabled?: boolean | null; assistant_paused_until?: string | null; assistant_resumed_at?: string | null },
  lastHumanAt: string | undefined,
  now: number
): { state: LeadAssistantState; backAt: string | null } {
  if (lead.assistant_disabled) return { state: 'OFF', backAt: null };
  const resumedAt = lead.assistant_resumed_at ? new Date(lead.assistant_resumed_at).getTime() : 0;
  const candidates: number[] = [];
  if (lead.assistant_paused_until) candidates.push(new Date(lead.assistant_paused_until).getTime());
  if (lastHumanAt && new Date(lastHumanAt).getTime() > resumedAt) {
    candidates.push(new Date(lastHumanAt).getTime() + HUMAN_PAUSE_MS);
  }
  const backAt = Math.max(0, ...candidates);
  return backAt > now ? { state: 'WITH_TEAM', backAt: new Date(backAt).toISOString() } : { state: 'ACTIVE', backAt: null };
}

/** Leads do funil. ?stage=NOVO|EM_ATENDIMENTO|...&q=nome ou telefone */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const params = new URL(req.url).searchParams;
    const stage = params.get('stage');
    const q = (params.get('q') || '').replace(/[%,()*.]/g, ' ').trim().slice(0, 60);

    const run = (columns: string) => {
      let query = supabaseAdmin
        .from('leads')
        .select(columns)
        .eq('tenant_id', tenantId)
        .or(ENGAGED_FILTER)
        .order('updated_at', { ascending: false })
        .limit(300);
      if (isLeadStage(stage)) query = query.eq('status', stage);
      if (q) {
        const digits = q.replace(/\D/g, '');
        query = query.or(digits.length >= 4 ? `name.ilike.%${q}%,phone.ilike.%${digits}%` : `name.ilike.%${q}%`);
      }
      return query;
    };

    let { data, error } = await run(`${BASE_COLUMNS}, ${CONTROL_COLUMNS}`);
    let controlAvailable = true;
    if (error?.code === '42703') {
      controlAvailable = false;
      ({ data, error } = await run(BASE_COLUMNS));
    }
    if (error) {
      if (isSchemaPendingError(error)) {
        return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
      }
      throw error;
    }
    const rows = (data || []) as unknown as (Record<string, unknown> & {
      id: string;
      properties?: { code?: string; title?: string } | null;
    })[];

    // Última resposta da equipe nas últimas 12h (pausa a atendente no contato).
    const lastHuman = new Map<string, string>();
    if (rows.length) {
      const { data: human } = await supabaseAdmin
        .from('chat_messages')
        .select('lead_id, created_at')
        .eq('tenant_id', tenantId)
        .eq('direction', 'OUTBOUND')
        .in('sender_type', HUMAN_SENDER_TYPES)
        .in('lead_id', rows.map((r) => r.id))
        .gte('created_at', new Date(Date.now() - HUMAN_PAUSE_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);
      for (const h of human || []) if (h.lead_id && !lastHuman.has(h.lead_id)) lastHuman.set(h.lead_id, h.created_at);
    }

    const now = Date.now();
    const leads = rows.map((row) => {
      const { properties, assistant_disabled, assistant_resumed_at, ...lead } = row;
      const assistant = assistantStateOf(
        {
          assistant_disabled: assistant_disabled as boolean | null,
          assistant_paused_until: lead.assistant_paused_until as string | null,
          assistant_resumed_at: assistant_resumed_at as string | null,
        },
        lastHuman.get(row.id),
        now
      );
      return {
        ...lead,
        budget_max: lead.budget_max == null ? null : Number(lead.budget_max),
        interest_property: properties ? `${properties.code} · ${properties.title}` : null,
        assistant_state: assistant.state,
        assistant_back_at: assistant.backAt,
      };
    });
    return NextResponse.json({ success: true, leads, controlAvailable });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.leads.get', error);
  }
}

/**
 * Muda a etapa do funil ({ id, status }) ou controla a atendente no contato:
 * { id, assistant: 'resume' } → volta a responder já (ignora a pausa de 12h);
 * { id, assistant: 'disable' } → nunca responde este contato até devolver.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDispatcher(req);
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { id?: string; status?: unknown; assistant?: unknown };
    if (!UUID_RE.test(String(body.id || ''))) {
      return NextResponse.json({ success: false, error: 'Informe o lead.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    let patch: Record<string, unknown>;
    if (body.assistant === 'resume') {
      patch = { assistant_disabled: false, assistant_paused_until: null, assistant_resumed_at: nowIso };
    } else if (body.assistant === 'disable') {
      patch = { assistant_disabled: true };
    } else if (isLeadStage(body.status)) {
      patch = { status: body.status };
    } else {
      return NextResponse.json({ success: false, error: 'Nada para alterar.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ ...patch, updated_at: nowIso })
      .eq('id', body.id)
      .eq('tenant_id', auth.session.tenantId)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') {
        return NextResponse.json({ success: false, error: CONTROL_PENDING }, { status: 503 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ success: false, error: 'Lead não encontrado.' }, { status: 404 });

    if (body.assistant) {
      logger.info('leads.assistant_control', { tenantId: auth.session.tenantId, leadId: body.id, action: body.assistant });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return internalErrorResponse('api.real_estate.leads.patch', error);
  }
}
