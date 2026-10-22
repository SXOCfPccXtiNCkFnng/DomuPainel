import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { brtDateKey } from '@/lib/scheduling';
import {
  isMonthKey,
  monthRange,
  summarizeFinance,
  validateFinanceEntry,
  type FinanceAppointment,
  type FinanceEntry,
} from '@/lib/finance';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATION_PENDING = 'O financeiro ainda não foi ativado no banco (migration 20261022_finance.sql).';
/** O PostgREST devolve no máximo 1000 linhas por consulta. */
const PAGE_SIZE = 1000;
const MAX_APPOINTMENTS = 20_000;

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function loadMonthAppointments(tenantId: string, start: Date, end: Date): Promise<FinanceAppointment[]> {
  const rows: FinanceAppointment[] = [];
  for (let from = 0; from < MAX_APPOINTMENTS; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('service_name, price, status, starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString())
      .order('starts_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (isMissingTable(error)) return rows; // conta sem agenda
      throw error;
    }
    rows.push(...((data || []) as FinanceAppointment[]));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows;
}

/** Resumo do mês (?month=AAAA-MM; padrão: mês atual em Brasília) + lançamentos. Só administrador. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const requested = new URL(req.url).searchParams.get('month');
    const now = new Date();
    const month = isMonthKey(requested) ? requested : brtDateKey(now).slice(0, 7);
    const range = monthRange(month);

    const [appointments, entriesRes] = await Promise.all([
      loadMonthAppointments(tenantId, range.start, range.end),
      supabaseAdmin
        .from('finance_entries')
        .select('id, kind, description, category, amount, occurred_on')
        .eq('tenant_id', tenantId)
        .gte('occurred_on', range.firstDay)
        .lte('occurred_on', range.lastDay)
        .order('occurred_on', { ascending: false })
        .limit(1000),
    ]);
    const entriesAvailable = !isMissingTable(entriesRes.error);
    if (entriesRes.error && entriesAvailable) throw entriesRes.error;
    const entries = ((entriesRes.data || []) as FinanceEntry[]).map((e) => ({ ...e, amount: Number(e.amount) }));

    return NextResponse.json({
      success: true,
      month,
      summary: summarizeFinance(appointments, entries, now),
      entries,
      entriesAvailable,
    });
  } catch (error: unknown) {
    return internalErrorResponse('api.finance.get', error);
  }
}

/** Lança um gasto ou entrada avulsa. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const parsed = validateFinanceEntry((await req.json().catch(() => ({}))) as Record<string, unknown>);
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('finance_entries')
      .insert({ tenant_id: auth.session.tenantId, created_by: auth.session.userId, ...parsed.entry })
      .select('id, kind, description, category, amount, occurred_on')
      .single();
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ success: false, error: MIGRATION_PENDING }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ success: true, entry: { ...data, amount: Number(data.amount) } });
  } catch (error: unknown) {
    return internalErrorResponse('api.finance.post', error);
  }
}

/** Apaga um lançamento (?id=). */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const id = new URL(req.url).searchParams.get('id') || '';
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Informe o lançamento.' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('finance_entries')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.session.tenantId)
      .select('id');
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ success: false, error: 'Lançamento não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return internalErrorResponse('api.finance.delete', error);
  }
}
