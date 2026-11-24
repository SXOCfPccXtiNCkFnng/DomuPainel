import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { internalErrorResponse } from '@/lib/errors';
import { checkRateLimitDurable } from '@/lib/rateLimitDurable';
import { runAssistantSimulation, type SimulationMessage } from '@/lib/assistantRunner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_MESSAGES = 30;
const MAX_TEXT = 1000;
/** Respostas de teste por hora, por conta (cada uma custa uma chamada de IA). */
const PER_HOUR = 60;

/**
 * Simulador da atendente: { messages: [{ from: 'cliente' | 'atendente', text }] }
 * → próxima resposta da atendente. Nada é gravado nem enviado pelo WhatsApp.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = (await req.json().catch(() => ({}))) as { messages?: unknown };
    const raw = Array.isArray(body.messages) ? body.messages : [];
    const messages: SimulationMessage[] = raw
      .slice(-MAX_MESSAGES)
      .map((m) => {
        const item = (m || {}) as Record<string, unknown>;
        return {
          from: item.from === 'atendente' ? ('atendente' as const) : ('cliente' as const),
          text: String(item.text ?? '').trim().slice(0, MAX_TEXT),
        };
      })
      .filter((m) => m.text);
    if (!messages.length || messages[messages.length - 1].from !== 'cliente') {
      return NextResponse.json({ success: false, error: 'Escreva uma mensagem como cliente.' }, { status: 400 });
    }

    const limit = await checkRateLimitDurable(`assistant-sim:${tenantId}`, PER_HOUR, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ success: false, error: 'Você testou bastante nesta hora. Tente de novo daqui a pouco.' }, { status: 429 });
    }

    const result = await runAssistantSimulation(tenantId, messages);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, bubbles: result.bubbles, actions: result.actions });
  } catch (error) {
    return internalErrorResponse('api.assistant.simulate', error);
  }
}
