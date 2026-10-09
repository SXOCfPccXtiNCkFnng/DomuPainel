import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getMetaAppSecret, getMetaVerifyToken, isProduction } from '@/lib/envSecrets';
import { isOptOutMessage } from '@/lib/metaClient';
import { logger } from '@/lib/logger';
import { recountCampaignLogs } from '@/lib/campaignDispatch';
import { phoneLookupVariants, toStoredPhone } from '@/lib/phone';

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

const STATUS_RANK: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 9 };

/** Status de mensagem avulsa (chat_messages OUTBOUND). Nunca regride: READ não volta a DELIVERED. */
async function updateChatMessageStatus(
  wamid: string,
  mapped: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
  tenantId: string
) {
  const allowedPrev = Object.keys(STATUS_RANK).filter(
    (s) => mapped === 'FAILED' || STATUS_RANK[s] < STATUS_RANK[mapped]
  );
  const { data: changed } = await supabaseAdmin
    .from('chat_messages')
    .update({ status: mapped })
    .eq('tenant_id', tenantId)
    .eq('wamid', wamid)
    .eq('direction', 'OUTBOUND')
    .in('status', allowedPrev)
    .select('id');
  if (!changed || changed.length === 0) {
    logger.info('webhook.status_message_not_found', { wamid });
  }
}

async function handleStatusUpdate(status: any, tenantId: string | null) {
  const wamid = status.id;
  const mapped = normalizeStatus(status.status);
  if (!wamid || !mapped) return;
  // Status só vale para envios da conta dona do número que gerou o evento.
  if (!tenantId) {
    logger.info('webhook.status_without_tenant', { wamid });
    return;
  }

  const { data: log } = await supabaseAdmin
    .from('campaign_logs')
    .select('id, campaign_id, status, delivered_at, read_at')
    .eq('wamid', wamid)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!log) {
    // Não é de campanha: pode ser envio avulso, registrado no atendimento.
    await updateChatMessageStatus(wamid, mapped, tenantId);
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

  if ((STATUS_RANK[mapped] || 0) < (STATUS_RANK[prev] || 0) && mapped !== 'FAILED') return;

  // Compare-and-set no status anterior: se a Meta reentregar o mesmo evento
  // em paralelo, só um processa e os contadores não contam em dobro.
  const { data: changed } = await supabaseAdmin
    .from('campaign_logs')
    .update(patch)
    .eq('id', log.id)
    .eq('tenant_id', tenantId)
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

/**
 * Dono do evento = a conta cujo número CONECTADO na Meta (phone_number_id) é o
 * que a Meta informa no evento. Nada de procurar por número digitado. Se o
 * número não estiver ligado a exatamente UMA conta, o evento é descartado —
 * melhor perder um evento do que entregá-lo para a conta errada.
 */
async function resolveTenantIdFromMetadata(value: any): Promise<string | null> {
  const phoneNumberId = String(value?.metadata?.phone_number_id || '').trim();
  if (!phoneNumberId) return null;

  const { data: owners, error } = await supabaseAdmin
    .from('tenant_credentials')
    .select('tenant_id')
    .eq('phone_number_id', phoneNumberId)
    .limit(2);
  if (error || !owners || owners.length === 0) return null;
  if (owners.length > 1) {
    logger.error('webhook.phone_number_id_ambiguous', { phoneNumberId });
    return null;
  }
  return owners[0].tenant_id;
}

/**
 * Contato do próprio tenant para quem mandou a mensagem. Se o número ainda não
 * está nos contatos, cria — a pessoa mandou "oi", já vira contato sem
 * importação manual. O tenant vem só do phone_number_id (cada número conectado
 * pertence a uma única conta), então o contato nunca cai em outra conta.
 */
async function findOrCreateLead(tenantId: string, from: string, profileName: string | null) {
  const select = 'id, tenant_id, status, opt_in';

  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select(select)
    .eq('tenant_id', tenantId)
    .in('phone', phoneLookupVariants(from))
    .limit(1);
  if (leads?.[0]) return leads[0];

  // Grava o número como a Meta mandou: é o wa_id que recebe a resposta.
  // Upsert ignorando duplicado porque duas mensagens do mesmo número novo
  // podem chegar juntas — a segunda só lê o contato criado pela primeira.
  const phone = toStoredPhone(from);
  const { error } = await supabaseAdmin.from('leads').upsert(
    {
      tenant_id: tenantId,
      name: profileName?.trim().slice(0, 255) || 'Contato WhatsApp',
      phone,
      source: 'WHATSAPP',
    },
    { onConflict: 'tenant_id,phone', ignoreDuplicates: true }
  );
  if (error) {
    logger.error('webhook.lead_auto_create_failed', { tenantId, message: error.message });
    return null;
  }

  const { data: created } = await supabaseAdmin
    .from('leads')
    .select(select)
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .maybeSingle();
  if (created) logger.info('webhook.lead_auto_created', { tenantId, leadId: created.id });
  return created;
}

async function handleInboundMessage(
  message: any,
  tenantId: string | null,
  profileName: string | null,
  metadataPhone?: string
) {
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

  const lead = await findOrCreateLead(tenantId, from, profileName);
  if (!lead) return;

  // A Meta reentrega o webhook quando não recebe 200 a tempo. O índice único
  // (tenant_id, wamid) faz o banco recusar a cópia mesmo com as duas entregas
  // chegando juntas; se nada foi inserido, a mensagem já tinha sido processada.
  const row = {
    tenant_id: tenantId,
    lead_id: lead.id,
    direction: 'INBOUND',
    sender_type: 'CUSTOMER',
    message_type: (message.type || 'TEXT').toUpperCase(),
    body: bodyText,
    wamid: message.id || null,
    status: 'DELIVERED',
  };
  if (row.wamid) {
    const { data: inserted, error } = await supabaseAdmin
      .from('chat_messages')
      .upsert(row, { onConflict: 'tenant_id,wamid', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    if (!inserted || inserted.length === 0) return;
  } else {
    await supabaseAdmin.from('chat_messages').insert(row);
  }

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

        if (!value.statuses && !value.messages) continue;
        // Uma resolução por evento, só pelo número conectado (phone_number_id).
        const tenantId = await resolveTenantIdFromMetadata(value);

        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status, tenantId);
          }
        }

        if (value.messages) {
          const metaPhone = value.metadata?.display_phone_number;
          // Nome do perfil do WhatsApp de quem mandou (usado ao criar o contato).
          const profileNames = new Map<string, string>();
          for (const c of value.contacts || []) {
            const waId = String(c?.wa_id || '').replace(/\D/g, '');
            if (waId && c?.profile?.name) profileNames.set(waId, String(c.profile.name));
          }
          for (const message of value.messages) {
            const from = String(message.from || '').replace(/\D/g, '');
            await handleInboundMessage(message, tenantId, profileNames.get(from) || null, metaPhone);
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
