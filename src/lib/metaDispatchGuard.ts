import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPhoneNumberQuality, resolveMetaCredentials } from '@/lib/metaClient';

const TIER_LIMIT: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
};

export type DispatchGate =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

/** Trava o disparo nas regras que a Meta aplica de fato: conexão, qualidade vermelha e cota de 24h. */
export async function assertMetaDispatchAllowed(
  tenantId: string,
  batchSize: number,
  options?: {
    scheduled?: boolean;
    /** Campanha já criada sendo disparada: os logs ainda na fila dela não contam como "já usados". */
    excludeCampaignId?: string;
  }
): Promise<DispatchGate> {
  if (batchSize <= 0) {
    return { ok: false, error: 'Nenhum contato elegível para este disparo.' };
  }

  let creds;
  try {
    creds = await resolveMetaCredentials(tenantId);
  } catch {
    return {
      ok: false,
      error:
        'Conecte o WhatsApp em Configurações antes de disparar. Sem a API oficial a Meta não envia a campanha.',
    };
  }

  let quality;
  try {
    quality = await getPhoneNumberQuality(creds);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao consultar a Meta.';
    return { ok: false, error: `Não foi possível confirmar o número na Meta. ${message}` };
  }

  if (quality.qualityRating === 'RED') {
    return {
      ok: false,
      error:
        'A Meta classificou este número com qualidade baixa (vermelha). Campanhas ficam pausadas até a nota melhorar, para o número não ser restringido.',
    };
  }

  const tierLimit = quality.messagingLimitTier ? TIER_LIMIT[quality.messagingLimitTier] : undefined;
  if (tierLimit && !options?.scheduled) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('campaign_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .neq('status', 'FAILED');
    let ownQueued = 0;
    if (options?.excludeCampaignId) {
      // Os logs ainda não enviados desta campanha já estão em `count` e são o próprio batchSize.
      const { count: queued } = await supabaseAdmin
        .from('campaign_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('campaign_id', options.excludeCampaignId)
        .gte('created_at', since)
        .in('status', ['PENDING', 'SENDING']);
      ownQueued = queued || 0;
    }
    const used = Math.max(0, (count || 0) - ownQueued);
    const remaining = Math.max(0, tierLimit - used);
    if (batchSize > remaining) {
      return {
        ok: false,
        error:
          remaining === 0
            ? `Limite da Meta nas últimas 24 horas esgotado (${tierLimit.toLocaleString('pt-BR')} conversas iniciadas). Espere a cota renovar ou agende para depois.`
            : `A Meta ainda libera ${remaining.toLocaleString('pt-BR')} envios neste número nas próximas 24 horas. Você selecionou ${batchSize.toLocaleString('pt-BR')}. Reduza a lista.`,
      };
    }
  }

  if (quality.qualityRating === 'YELLOW') {
    return {
      ok: true,
      warning:
        'A qualidade deste número está média (amarela) na Meta. A campanha pode seguir, mas novas denúncias podem reduzir o limite.',
    };
  }

  return { ok: true };
}
