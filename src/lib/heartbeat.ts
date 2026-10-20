import { supabaseAdmin } from '@/lib/supabaseServer';

/** O que o painel /interno acompanha e de quanto em quanto tempo deveria rodar. */
export const HEARTBEATS: { name: string; label: string; expectedEveryMin: number; fix: string }[] = [
  {
    name: 'cron.campaigns',
    label: 'Cron · campanhas agendadas',
    expectedEveryMin: 5,
    fix: 'No cron-job.org, confira o job de /api/campaigns/run-due (a cada 5 min, com o cabeçalho do CRON_SECRET).',
  },
  {
    name: 'cron.follow-up',
    label: 'Cron · follow-up automático',
    expectedEveryMin: 15,
    fix: 'No cron-job.org, confira o job de /api/follow-up/run-due (a cada 15 min, com o cabeçalho do CRON_SECRET).',
  },
  {
    name: 'cron.reminders',
    label: 'Cron · lembretes da agenda',
    expectedEveryMin: 5,
    fix: 'No cron-job.org, confira o job de /api/scheduling/reminders/run-due (a cada 5 min, com o cabeçalho do CRON_SECRET).',
  },
  {
    name: 'cron.expiry-check',
    label: 'Cron · aviso de vencimento',
    expectedEveryMin: 24 * 60,
    fix: 'No cron-job.org, confira o job de /api/billing/expiry-check (1 vez por dia).',
  },
  {
    name: 'cron.apply-price-changes',
    label: 'Cron · reajuste de preço',
    expectedEveryMin: 24 * 60,
    fix: 'No cron-job.org, confira o job de /api/billing/apply-price-changes (1 vez por dia).',
  },
  {
    name: 'webhook.meta',
    label: 'Webhook · Meta (WhatsApp)',
    expectedEveryMin: 0, // depende de haver mensagens; só informativo
    fix: 'Se mensagens não chegam: confira no app da Meta a URL do webhook e os campos messages/smb_message_echoes.',
  },
  {
    name: 'webhook.asaas',
    label: 'Webhook · Asaas (pagamentos)',
    expectedEveryMin: 0,
    fix: 'Se pagamentos não confirmam: confira a URL do webhook e o token no painel da Asaas.',
  },
];

/** Webhooks chegam muito: grava no máximo 1 vez por minuto por instância. */
const THROTTLE_MS = 60_000;
const lastWrite = new Map<string, number>();

/**
 * Registra que um cron/webhook rodou (e se deu certo). Nunca lança: o
 * batimento é só observação, não pode derrubar o processamento.
 */
export async function recordHeartbeat(
  name: string,
  outcome: { ok: boolean; result?: Record<string, unknown>; error?: string | null; throttle?: boolean }
): Promise<void> {
  try {
    const now = Date.now();
    if (outcome.throttle && outcome.ok && now - (lastWrite.get(name) || 0) < THROTTLE_MS) return;
    lastWrite.set(name, now);

    const nowIso = new Date(now).toISOString();
    const { data: current } = await supabaseAdmin
      .from('system_heartbeats')
      .select('run_count')
      .eq('name', name)
      .maybeSingle();

    await supabaseAdmin.from('system_heartbeats').upsert(
      {
        name,
        last_run_at: nowIso,
        ...(outcome.ok ? { last_ok_at: nowIso, last_error: null } : { last_error: String(outcome.error || 'Falhou').slice(0, 1000) }),
        last_result: outcome.result || {},
        run_count: Number(current?.run_count || 0) + 1,
      },
      { onConflict: 'name' }
    );
  } catch (err) {
    console.error('[heartbeat] falha ao registrar', name, err instanceof Error ? err.message : err);
  }
}

export type HeartbeatRow = {
  name: string;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  lastResult: Record<string, unknown>;
  runCount: number;
};

export async function loadHeartbeats(): Promise<HeartbeatRow[] | null> {
  const { data, error } = await supabaseAdmin
    .from('system_heartbeats')
    .select('name, last_run_at, last_ok_at, last_error, last_result, run_count');
  if (error) return null; // tabela ainda não migrada
  return (data || []).map((r: any) => ({
    name: r.name,
    lastRunAt: r.last_run_at,
    lastOkAt: r.last_ok_at,
    lastError: r.last_error,
    lastResult: r.last_result || {},
    runCount: Number(r.run_count || 0),
  }));
}
