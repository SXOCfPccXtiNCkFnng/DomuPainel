import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getMetaAppSecret, getMetaVerifyToken, isProduction } from '@/lib/envSecrets';
import { isOptOutMessage } from '@/lib/metaClient';
import { logger } from '@/lib/logger';
import { recountCampaignLogs } from '@/lib/campaignDispatch';

export const dynamic = 'force-dynamic';

function normalizeStatus(raw: string): 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null {
  const s = (raw || '').toLowerCase();
  if (s === 'sent') return 'SENT';
  if (s === 'delivered') return 'DELIVERED';
  if (s === 'read') return 'READ';
  if (s === 'failed') return 'FAILED';
  return null;
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const received = signatureHeader.slice('sha256='.length);
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Incremento atômico (RPC da migration 20261008_campaign_counter_rpc). Ler e
 * gravar +1 aqui perdia contagem com vários webhooks chegando juntos. Se a
 * migration ainda não rodou, recalcula tudo a partir dos logs (sempre correto,
 * só mais caro).
 */
async function bumpCampaignCounter(
  campaignId: string,
  field: 'delivered_count' | 'read_count' | 'failed_count' | 'sent_count'
) {
  const { error } = await supabaseAdmin.rpc('increment_campaign_counter', {
    p_campaign_id: campaignId,
    p_field: field,
  });
  if (!error) return;

  logger.info('webhook.counter_rpc_fallback', { campaignId, message: error.message });
  const { data: camp } = await supabaseAdmin
    .from('campaigns')
    .select('tenant_id')
    .eq('id', campaignId)
    .maybeSingle();
  if (!camp) return;
  const counts = await recountCampaignLogs(campaignId, camp.tenant_id);
  await supabaseAdmin
    .from('campaigns')
    .update({
      sent_count: counts.sent + counts.delivered + counts.read,
      delivered_count: counts.delivered + counts.read,
      read_count: counts.read,
      failed_count: counts.failed,
    })
    .eq('id', campaignId);
}

async function handleStatusUpdate(status: any) {
  const wamid = status.id;
  const mapped = normalizeStatus(status.status);
  if (!wamid || !mapped) return;

  const { data: log } = await supabaseAdmin
    .from('campaign_logs')
    .select('id, campaign_id, status, delivered_at, read_at')
    .eq('wamid', wamid)
    .maybeSingle();

  if (!log) {
    logger.info('webhook.campaign_log_not_found', { wamid });
    return;
  }

  const prev = log.status;
  const patch: Record<string, unknown> = { status: mapped };
  const now = new Date().toISOString();

  if (mapped === 'SENT') patch.sent_at = now;
  if (mapped === 'DELIVERED') patch.delivered_at = now;
  if (mapped === 'READ') {
    patch.read_at = now;
    if (!log.delivered_at) patch.delivered_at = now;
  }
  if (mapped === 'FAILED') {
    patch.error_message = status.errors?.[0]?.title || status.errors?.[0]?.message || 'Falha Meta';
    patch.error_code = status.errors?.[0]?.code || null;
  }

  const rank: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 9 };
  if ((rank[mapped] || 0) < (rank[prev] || 0) && mapped !== 'FAILED') return;

  // Compare-and-set no status anterior: se a Meta reentregar o mesmo evento
  // em paralelo, só um processa e os contadores não contam em dobro.
  const { data: changed } = await supabaseAdmin
    .from('campaign_logs')
    .update(patch)
    .eq('id', log.id)
    .eq('status', prev)
    .select('id');
  if (!changed || changed.length === 0) return;

  if (mapped === 'DELIVERED' && prev !== 'DELIVERED' && prev !== 'READ') {
    await bumpCampaignCounter(log.campaign_id, 'delivered_count');
  }
  if (mapped === 'READ' && prev !== 'READ') {
    await bumpCampaignCounter(log.campaign_id, 'read_count');
    if (prev !== 'DELIVERED' && !log.delivered_at) {
      await bumpCampaignCounter(log.campaign_id, 'delivered_count');
    }
  }
  if (mapped === 'FAILED' && prev !== 'FAILED') {
    await bumpCampaignCounter(log.campaign_id, 'failed_count');
  }
}

async function resolveTenantIdFromMetadata(value: any): Promise<string | null> {
  const phoneNumberId = value?.metadata?.phone_number_id;
  if (phoneNumberId) {
    const { data: cred } = await supabaseAdmin
      .from('tenant_credentials')
      .select('tenant_id')
      .eq('phone_number_id', String(phoneNumberId))
      .maybeSingle();
    if (cred?.tenant_id) return cred.tenant_id;
  }

  // Busca pelo número "digitado" (tenants.whatsapp_number) só em dev, junto do
  // fallback de credenciais do env: em produção qualquer admin edita esse campo
  // sem verificação e capturaria mensagens recebidas de outro número.
  if (isProduction()) return null;

  const displayPhone = String(value?.metadata?.display_phone_number || '').replace(/\D/g, '');
  if (displayPhone) {
    const phones = [displayPhone];
    if (displayPhone.startsWith('55') && displayPhone.length > 11) phones.push(displayPhone.slice(2));
    else if (displayPhone.length <= 11) phones.push(`55${displayPhone}`);

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .in('whatsapp_number', phones)
      .limit(1)
      .maybeSingle();
    if (tenant?.id) return tenant.id;
  }

  return null;
}

async function handleInboundMessage(message: any, tenantId: string | null, metadataPhone?: string) {
  const from = String(message.from || '').replace(/\D/g, '');
  if (!from) return;

  if (!tenantId) {
    console.warn('[Webhook] Inbound sem tenant resolvido — ignorado', from, metadataPhone);
    return;
  }

  const bodyText =
    message.text?.body ||
    message.button?.text ||
    message.interactive?.button_reply?.title ||
    `[${message.type || 'media'}]`;

  const phones = [from];
  if (from.startsWith('55') && from.length > 11) phones.push(from.slice(2));
  else if (from.length <= 11) phones.push(`55${from}`);

  const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('id, tenant_id, status, opt_in')
      .eq('tenant_id', tenantId)
      .in('phone', phones)
      .limit(1);

  const lead = leads?.[0];
  if (!lead) {
    logger.info('webhook.lead_not_found', { from, tenantId });
    return;
  }

  // A Meta reentrega o webhook quando não recebe 200 a tempo: sem isso a
  // mesma mensagem aparecia duplicada no atendimento.
  if (message.id) {
    const { data: existing } = await supabaseAdmin
      .from('chat_messages')
      .select('id')
      .eq('wamid', message.id)
      .limit(1);
    if (existing && existing.length > 0) return;
  }

  await supabaseAdmin.from('chat_messages').insert({
    tenant_id: lead.tenant_id,
    lead_id: lead.id,
    direction: 'INBOUND',
    sender_type: 'CUSTOMER',
    message_type: (message.type || 'TEXT').toUpperCase(),
    body: bodyText,
    wamid: message.id || null,
    status: 'DELIVERED',
  });

  const optedOut = isOptOutMessage(bodyText);
  const nextStatus =
    lead.status === 'NOVO' || lead.status === 'QUALIFIED'
      ? 'EM_ATENDIMENTO'
      : lead.status;

  const leadPatch: Record<string, unknown> = {
    status: nextStatus,
    last_contact_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (optedOut) {
    leadPatch.opt_in = false;
    leadPatch.opt_in_updated_at = new Date().toISOString();
  }

  await supabaseAdmin
    .from('leads')
    .update(leadPatch)
    .eq('id', lead.id)
    .eq('tenant_id', tenantId);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 });
  }

  const envToken = getMetaVerifyToken();
  if (envToken && token === envToken) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { data: cred } = await supabaseAdmin
    .from('tenant_credentials')
    .select('id')
    .eq('verify_token', token)
    .limit(1)
    .maybeSingle();

  if (cred) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Webhook verification token mismatch' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const appSecret = getMetaAppSecret();
    const signature = req.headers.get('x-hub-signature-256');

    if (appSecret) {
      if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (isProduction()) {
      return NextResponse.json(
        { error: 'Webhook não configurado (META_APP_SECRET ausente).' },
        { status: 503 }
      );
    } else {
      console.warn('[Webhook] META_APP_SECRET ausente — aceitando POST sem assinatura (dev only)');
    }

    const body = JSON.parse(rawBody || '{}');
    const entries = body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }

        if (value.messages) {
          const tenantId = await resolveTenantIdFromMetadata(value);
          const metaPhone = value.metadata?.display_phone_number;
          for (const message of value.messages) {
            await handleInboundMessage(message, tenantId, metaPhone);
          }
        }
      }
    }

    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error: any) {
    console.error('[Meta Webhook Handler Error]', error);
    return NextResponse.json({ status: 'ERROR_HANDLED' }, { status: 200 });
  }
}
