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
    let messagingLimitTier: string | null = null;
    let qualityRating: string | null = null;
    let displayPhoneNumber = '';
    let verifiedName = '';
    let phoneStatus = '';
    let isConnected = false;

    try {
      const creds = await resolveMetaCredentials(tenantId);
      const phoneNumberId = searchParams.get('phoneNumberId') || creds.phoneNumberId;

      const metaRes = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=messaging_limit_tier,quality_rating,display_phone_number,verified_name,status`,
        {
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
          },
        }
      );

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        messagingLimitTier = metaData.messaging_limit_tier || null;
        qualityRating = metaData.quality_rating || null;
        displayPhoneNumber = metaData.display_phone_number || '';
        verifiedName = metaData.verified_name || '';
        phoneStatus = metaData.status || '';
        isConnected = true;
      }
    } catch (metaErr) {
      console.warn('[Meta API Stats] sem credenciais reais ainda:', metaErr);
    }

    let numericLimit: number | null = null;
    let formattedTierLabel: string | null = null;

    if (isConnected && messagingLimitTier) {
      switch (messagingLimitTier) {
        case 'TIER_50':
          numericLimit = 50;
          formattedTierLabel = '50 msgs/24h';
          break;
        case 'TIER_250':
          numericLimit = 250;
          formattedTierLabel = '250 msgs/24h';
          break;
        case 'TIER_1K':
          numericLimit = 1000;
          formattedTierLabel = '1.000 msgs/24h';
          break;
        case 'TIER_10K':
          numericLimit = 10000;
          formattedTierLabel = '10.000 msgs/24h';
          break;
        case 'TIER_100K':
          numericLimit = 100000;
          formattedTierLabel = '100.000 msgs/24h';
          break;
        case 'TIER_UNLIMITED':
        case 'UNLIMITED':
          numericLimit = null;
          formattedTierLabel = 'Ilimitado';
          break;
        default:
          numericLimit = null;
          formattedTierLabel = `${messagingLimitTier}`;
      }
    }

    let formattedQuality: string | null = null;
    if (isConnected && qualityRating) {
      if (qualityRating === 'GREEN') formattedQuality = 'Alta (GREEN)';
      else if (qualityRating === 'YELLOW') formattedQuality = 'Média (YELLOW)';
      else if (qualityRating === 'RED') formattedQuality = 'Baixa (RED)';
      else formattedQuality = qualityRating;
    }

    return NextResponse.json({
      success: true,
      stats: {
        messagingLimitTier,
        numericLimit,
        formattedTierLabel,
        qualityRating,
        formattedQuality,
        displayPhoneNumber,
        verifiedName,
        phoneStatus,
        isConnected,
      },
    });
  } catch (error: any) {
    console.error('[WhatsApp Stats API Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
