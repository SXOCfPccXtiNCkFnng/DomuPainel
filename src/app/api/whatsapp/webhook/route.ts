import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/whatsapp/webhook
 * Handles Meta Developer Webhook Verification Handshake.
 * Meta calls this endpoint when configuring the webhook URL in Meta App Dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedVerifyToken = process.env.META_VERIFY_TOKEN || 'domu_tech_secret_webhook_verify_2026';

  if (mode === 'subscribe' && token === expectedVerifyToken) {
    console.log('[Meta Webhook Verified Successfully]');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  console.warn('[Meta Webhook Verification Failed]', { mode, token });
  return NextResponse.json(
    { error: 'Webhook verification token mismatch' },
    { status: 403 }
  );
}

/**
 * POST /api/whatsapp/webhook
 * Listens to real-time events from Meta WhatsApp Cloud API:
 * - Delivery status updates (sent, delivered, read, failed)
 * - Incoming customer replies in WhatsApp 1:1 chat
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('[Meta Webhook Event Received]:', JSON.stringify(body, null, 2));

    // Extract entries from Meta payload
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Handle incoming status receipts (sent, delivered, read, failed)
        if (value.statuses) {
          for (const status of value.statuses) {
            console.log(`[Message Status Update] Message ID: ${status.id} | Status: ${status.status} | Recipient: ${status.recipient_id}`);
            
            if (status.status === 'failed') {
              console.error('[Message Delivery Failure Details]:', status.errors);
            }
          }
        }

        // Handle incoming customer messages
        if (value.messages) {
          for (const message of value.messages) {
            console.log(`[Incoming Customer Message] From: ${message.from} | Type: ${message.type} | Content:`, message.text?.body || message);
          }
        }
      }
    }

    // Always return 200 OK to Meta immediately so Meta knows the webhook was received
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });

  } catch (error: any) {
    console.error('[Meta Webhook Handler Error]', error);
    // Still return 200 to prevent Meta from retrying indefinitely
    return NextResponse.json({ status: 'ERROR_HANDLED' }, { status: 200 });
  }
}
