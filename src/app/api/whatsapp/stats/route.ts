import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { resolveMetaCredentials } from '@/lib/metaClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { searchParams } = new URL(req.url);
    let messagingLimitTier = 'TIER_1K';
    let qualityRating = 'GREEN';
    let displayPhoneNumber = '';
    let isConnected = false;

    try {
      const creds = await resolveMetaCredentials(tenantId);
      const phoneNumberId = searchParams.get('phoneNumberId') || creds.phoneNumberId;

      const metaRes = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=messaging_limit_tier,quality_rating,display_phone_number,verified_name`,
        {
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
          },
        }
      );

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        messagingLimitTier = metaData.messaging_limit_tier || 'TIER_1K';
        qualityRating = metaData.quality_rating || 'GREEN';
        displayPhoneNumber = metaData.display_phone_number || '';
        isConnected = true;
      }
    } catch (metaErr) {
      console.warn('[Meta API Stats] fallback defaults:', metaErr);
    }

    let numericLimit = 1000;
    let formattedTierLabel = 'Tier 1 (1.000 msgs/24h)';

    switch (messagingLimitTier) {
      case 'TIER_250':
        numericLimit = 250;
        formattedTierLabel = 'Tier Inicial (250 msgs/24h)';
        break;
      case 'TIER_1K':
        numericLimit = 1000;
        formattedTierLabel = 'Tier 1 (1.000 msgs/24h)';
        break;
      case 'TIER_10K':
        numericLimit = 10000;
        formattedTierLabel = 'Tier 2 (10.000 msgs/24h)';
        break;
      case 'TIER_100K':
        numericLimit = 100000;
        formattedTierLabel = 'Tier 3 (100.000 msgs/24h)';
        break;
      case 'UNLIMITED':
        numericLimit = 9999999;
        formattedTierLabel = 'Tier Ilimitado (Meta API)';
        break;
      default:
        numericLimit = 1000;
        formattedTierLabel = 'Tier 1 (1.000 msgs/24h)';
    }

    let formattedQuality = 'VERDE (Excelente)';
    if (qualityRating === 'YELLOW') formattedQuality = 'AMARELO (Atenção)';
    if (qualityRating === 'RED') formattedQuality = 'VERMELHO (Risco de Bloqueio)';

    return NextResponse.json({
      success: true,
      stats: {
        messagingLimitTier,
        numericLimit,
        formattedTierLabel,
        qualityRating,
        formattedQuality,
        displayPhoneNumber,
        isConnected,
      },
    });
  } catch (error: any) {
    console.error('[WhatsApp Stats API Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
