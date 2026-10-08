import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  computeSubscriptionPrice,
  findActiveCoupon,
  activateTenantSubscription,
  isActiveSubscription,
  type SubscriptionRow,
} from '@/lib/billing';
import { getPlanMonthlyLimit, isPlanAllowedForSegment, normalizePlanTier } from '@/lib/planLimits';
import { isValidBusinessSegment } from '@/lib/segmentConfig';
import { verifyMetaPhoneOwnership } from '@/lib/metaClient';
import {
  asaasCreateCustomer,
  asaasCreateSubscription,
  asaasFetch,
  asaasFindCustomerByEmail,
  asaasGetPixQrCode,
  asaasListSubscriptionPayments,
  asaasUpdateCustomer,
  getAsaasApiKey,
  isBillingMockEnabled,
  todayPlusDaysIsoDate,
  AsaasApiError,
} from '@/lib/asaasClient';
import { encryptData } from '@/lib/crypto';
import { generateSecureToken } from '@/lib/email';
import { clientIpFromRequest } from '@/lib/rateLimit';
import { isValidBrazilianPhone, isValidCpfCnpjLength } from '@/lib/validators';
import { LEGAL_DOCS_VERSION } from '@/lib/legal';
import { getLivePlanPrice } from '@/lib/planPricing';

export const dynamic = 'force-dynamic';

/**
 * Cria (ou recria) assinatura Asaas + retorna PIX QR / invoiceUrl.
 * Também aplica dados de onboarding quando enviados.
 */
export async function POST(req: NextRequest) {
  let tenantForAlert: string | undefined;
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;
    const { tenantId, userId } = auth.session;
    tenantForAlert = tenantId;

    const body = await req.json();
    const planTier = body.planTier || body.selectedPlan || 'STARTER';
    const paymentMethod = (body.paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX') as
      | 'PIX'
      | 'CREDIT_CARD';
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode : '';
    const acceptedTerms = Boolean(body.acceptedTerms);

    // Onboarding escolhendo Somente Disparos: só Starter. (Upgrade feito depois,
    // pela tela Assinatura, não manda segment — e passa a conta para o modo
    // completo quando o pagamento confirmar.)
    if (body.segment && !isPlanAllowedForSegment(body.segment, planTier)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'O modo Somente Disparos é exclusivo do plano Starter. Para Pro ou Enterprise, escolha o modo completo.',
        },
        { status: 400 }
      );
    }

    if (body.businessSegment !== undefined && !isValidBusinessSegment(body.businessSegment)) {
      return NextResponse.json(
        { success: false, error: 'Selecione o ramo do seu negócio.' },
        { status: 400 }
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { success: false, error: 'Aceite os Termos de Uso para continuar.' },
        { status: 400 }
      );
    }

    if (body.whatsappPhone && !isValidBrazilianPhone(body.whatsappPhone)) {
      return NextResponse.json(
        { success: false, error: 'Informe um número de WhatsApp válido, com DDD (ex: 11 98765-4321).' },
        { status: 400 }
      );
    }

    if (body.cpfCnpj && !isValidCpfCnpjLength(body.cpfCnpj)) {
      return NextResponse.json(
        { success: false, error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' },
        { status: 400 }
      );
    }

    // Registro de consentimento (LGPD) — data, versão do documento e IP de quem aceitou.
    await supabaseAdmin
      .from('users')
      .update({
        terms_accepted_at: new Date().toISOString(),
        terms_version: LEGAL_DOCS_VERSION,
        terms_accepted_ip: clientIpFromRequest(req),
      })
      .eq('id', userId);

    let coupon = null;
    if (couponCode.trim()) {
      const found = await findActiveCoupon(couponCode, planTier);
      if (!found.ok) {
        return NextResponse.json({ success: false, error: found.error }, { status: 400 });
      }
      coupon = found.coupon;
    }

    const basePrice = await getLivePlanPrice(planTier);
    const price = computeSubscriptionPrice({ planTier, paymentMethod, coupon, basePrice });

    // select('*'): inclui as colunas da troca de plano pendente (se a migration rodou).
    const { data: existingSubRow } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const existingSub = existingSubRow as (SubscriptionRow & { status?: string | null }) | null;

    if (
      isActiveSubscription(existingSub) &&
      normalizePlanTier(existingSub?.plan_tier) === price.planTier
    ) {
      return NextResponse.json(
        { success: false, error: `Sua conta já está no plano ${price.planTier}.` },
        { status: 400 }
      );
    }

    // Cupom de cortesia (zera o preço) é uma vez por empresa: sem isso, a mesma
    // conta reaplicava o cupom a cada vencimento e nunca pagava.
    if (coupon && price.finalPrice <= 0.009) {
      const currentSub = existingSub;
      if (String(currentSub?.coupon_code || '').toUpperCase() === String(coupon.code || '').toUpperCase()) {
        return NextResponse.json(
          { success: false, error: 'Este cupom já foi usado por esta conta.' },
          { status: 400 }
        );
      }
    }

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name, whatsapp_number, segment, status')
      .eq('id', tenantId)
      .maybeSingle();

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone')
      .eq('id', userId)
      .maybeSingle();

    if (!user?.email) {
      return NextResponse.json(
        { success: false, error: 'Usuário sem e-mail. Faça login novamente.' },
        { status: 400 }
      );
    }

    // Persistir dados de onboarding (sem ativar plano ainda). O número do
    // WhatsApp NÃO é gravado aqui a partir do que foi digitado: com WhatsApp
    // conectado ele vem da Meta (abaixo / na conexão), senão divergiria do
    // número que realmente envia e o disparo ficaria bloqueado.
    if (body.companyName || body.segment) {
      await supabaseAdmin
        .from('tenants')
        .update({
          name: body.companyName || tenant?.name,
          segment: body.segment || tenant?.segment || 'imobiliario',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
    }

    // Ramo do negócio: vem explícito (Somente Disparos / upgrade) ou é o próprio
    // segmento de ramo escolhido no onboarding. Update separado: se a migration
    // de business_segment não rodou, só isso falha — o resto do checkout segue.
    const businessSegment = isValidBusinessSegment(body.businessSegment)
      ? body.businessSegment
      : isValidBusinessSegment(body.segment)
        ? body.segment
        : null;
    if (businessSegment) {
      const { error: bizError } = await supabaseAdmin
        .from('tenants')
        .update({ business_segment: businessSegment })
        .eq('id', tenantId);
      if (bizError) console.warn('[Checkout] business_segment não salvo:', bizError.message);
    }

    if (body.ownerName) {
      await supabaseAdmin
        .from('users')
        .update({
          name: body.ownerName,
          phone: body.whatsappPhone || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    if (
      body.connectionType === 'DIRECT_API' &&
      body.wabaId &&
      body.phoneNumberId &&
      body.accessToken
    ) {
      const ownership = await verifyMetaPhoneOwnership({
        tenantId,
        accessToken: String(body.accessToken).trim(),
        wabaId: String(body.wabaId).trim(),
        phoneNumberId: String(body.phoneNumberId).trim(),
      });
      if (!ownership.ok) {
        return NextResponse.json({ success: false, error: ownership.error }, { status: ownership.status });
      }

      const { encryptedText, iv } = encryptData(body.accessToken);

      // Reaproveita o verify_token já salvo (ex.: no passo 4 do onboarding) em vez de
      // gerar outro por cima — senão o token que o cliente configurou na Meta perde a validade.
      let checkoutVerifyToken = body.verifyToken || undefined;
      if (!checkoutVerifyToken) {
        const { data: existingCred } = await supabaseAdmin
          .from('tenant_credentials')
          .select('verify_token')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        checkoutVerifyToken = existingCred?.verify_token || generateSecureToken(16);
      }

      await supabaseAdmin.from('tenant_credentials').upsert(
        {
          tenant_id: tenantId,
          waba_id: body.wabaId,
          phone_number_id: body.phoneNumberId,
          encrypted_access_token: encryptedText,
          token_encryption_iv: iv,
          verify_token: checkoutVerifyToken,
          app_id: body.appId || null,
          webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.domutech.digital'}/api/whatsapp/webhook`,
          is_verified: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );

      await supabaseAdmin
        .from('tenants')
        .update({
          whatsapp_number: ownership.displayPhoneNumber,
          coexistence_status: 'CONNECTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
    } else if (body.whatsappPhone) {
      // Ainda sem WhatsApp conectado: guarda o número digitado só como contato.
      const { data: existingCred } = await supabaseAdmin
        .from('tenant_credentials')
        .select('phone_number_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!existingCred?.phone_number_id) {
        await supabaseAdmin
          .from('tenants')
          .update({ whatsapp_number: body.whatsappPhone, updated_at: new Date().toISOString() })
          .eq('id', tenantId);
      }
    }

    // Cupom 100% / valor zerado: libera sem passar no Asaas.
    if (price.finalPrice <= 0.009) {
      await activateTenantSubscription({
        tenantId,
        planTier: price.planTier,
        monthlyPrice: 0,
        paymentMethod,
        couponCode: price.couponCode,
        status: 'ACTIVE',
      });
      // Plano agora é cortesia: encerra as cobranças que existiam no Asaas
      // (a assinatura paga anterior e uma troca pendente), senão seguiriam cobrando.
      if (!isBillingMockEnabled()) {
        for (const oldId of [
          existingSub?.asaas_subscription_id,
          existingSub?.pending_asaas_subscription_id,
        ]) {
          if (!oldId) continue;
          try {
            await asaasFetch(`/subscriptions/${oldId}`, { method: 'DELETE' });
          } catch (cancelErr) {
            console.warn('[Checkout] Falha ao cancelar cobrança anterior (cortesia):', cancelErr);
          }
        }
      }
      return NextResponse.json({
        success: true,
        complimentary: true,
        message: 'Cupom aplicado: acesso liberado sem cobrança.',
        price,
        status: 'ACTIVE',
        isOnboarded: true,
      });
    }

    if (isBillingMockEnabled()) {
      await activateTenantSubscription({
        tenantId,
        planTier: price.planTier,
        monthlyPrice: price.finalPrice,
        paymentMethod,
        couponCode: price.couponCode,
        status: 'ACTIVE',
        asaasCustomerId: 'mock_cus',
        asaasSubscriptionId: 'mock_sub',
      });

      return NextResponse.json({
        success: true,
        mock: true,
        message: 'Billing mock: assinatura ativada (configure ASAAS_API_KEY para cobrança real).',
        price,
        status: 'ACTIVE',
        isOnboarded: true,
      });
    }

    const parsedAsaasKey = getAsaasApiKey();
    if (!parsedAsaasKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'ASAAS_API_KEY não configurada. Verifique o .env / variáveis do servidor e reinicie.',
        },
        { status: 500 }
      );
    }

    const cpfCnpjDigits = (body.cpfCnpj || '').replace(/\D/g, '');

    let customer = await asaasFindCustomerByEmail(user.email);
    if (!customer) {
      customer = await asaasCreateCustomer({
        name: body.companyName || body.ownerName || user.name || 'Cliente Domu',
        email: user.email,
        phone: body.whatsappPhone || user.phone || undefined,
        externalReference: tenantId,
        cpfCnpj: cpfCnpjDigits || undefined,
      });
    } else if (cpfCnpjDigits && !customer.cpfCnpj) {
      customer = await asaasUpdateCustomer(customer.id, { cpfCnpj: cpfCnpjDigits });
    }

    const isPlanChange = isActiveSubscription(existingSub);

    if (isPlanChange) {
      // TROCA DE PLANO com a assinatura ativa: a atual continua valendo (e
      // cobrando) até o novo pagamento cair. Só uma troca pendente por vez —
      // se já havia outra (ex.: pediu Pro, desistiu, agora quer Enterprise),
      // cancela aquela cobrança antes de criar a nova.
      const previousPending = (existingSub as SubscriptionRow).pending_asaas_subscription_id;
      if (previousPending) {
        try {
          await asaasFetch(`/subscriptions/${previousPending}`, { method: 'DELETE' });
        } catch (cancelErr) {
          console.warn('[Checkout] Falha ao cancelar troca pendente anterior:', cancelErr);
        }
      }
    } else if (existingSub?.asaas_subscription_id) {
      // Sem assinatura ativa (primeira contratação, vencida ou cancelada):
      // substitui a cobrança antiga pela nova.
      try {
        await asaasFetch(`/subscriptions/${existingSub.asaas_subscription_id}`, { method: 'DELETE' });
      } catch (cancelErr) {
        console.warn('[Checkout] Failed to cancel old Asaas subscription:', cancelErr);
      }
    }

    const subscription = await asaasCreateSubscription({
      customer: customer.id,
      billingType: paymentMethod,
      value: price.finalPrice,
      nextDueDate: todayPlusDaysIsoDate(0),
      description: `Domu Tech — Plano ${price.planTier} (mensal)`,
      externalReference: tenantId,
    });

    const payments = await asaasListSubscriptionPayments(subscription.id);
    const payment = payments[0];

    let pix: { encodedImage?: string; payload?: string; expirationDate?: string } | null = null;
    if (paymentMethod === 'PIX' && payment?.id) {
      try {
        pix = await asaasGetPixQrCode(payment.id);
      } catch {
        pix = null;
      }
    }

    if (isPlanChange) {
      // Guarda a troca como PENDENTE; status, plano e assinatura atuais não mudam.
      const { error: pendingError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          pending_plan_tier: price.planTier,
          pending_monthly_price_brl: price.finalPrice,
          pending_payment_method: paymentMethod,
          pending_coupon_code: price.couponCode,
          pending_asaas_subscription_id: subscription.id,
          pending_created_at: new Date().toISOString(),
          pending_payment_id: payment?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      if (pendingError) {
        // Migration da troca pendente não rodou: desfaz a cobrança nova para
        // não deixar o cliente com duas assinaturas, e não mexe na atual.
        try {
          await asaasFetch(`/subscriptions/${subscription.id}`, { method: 'DELETE' });
        } catch {
          /* registrado abaixo */
        }
        throw new Error(`Troca de plano indisponível (pendência não salva): ${pendingError.message}`);
      }

      return NextResponse.json({
        success: true,
        mock: false,
        price,
        status: 'PENDING_PAYMENT',
        planChange: true,
        asaas: {
          customerId: customer.id,
          subscriptionId: subscription.id,
          paymentId: payment?.id || null,
          invoiceUrl: payment?.invoiceUrl || null,
          pix,
        },
        isOnboarded: true,
        message:
          paymentMethod === 'PIX'
            ? `Pague o PIX para mudar para o plano ${price.planTier}. Seu plano atual continua ativo até lá.`
            : `Conclua o pagamento no link do Asaas para mudar para o plano ${price.planTier}. Seu plano atual continua ativo até lá.`,
      });
    }

    await supabaseAdmin.from('subscriptions').upsert(
      {
        tenant_id: tenantId,
        plan_tier: price.planTier,
        monthly_price_brl: price.finalPrice,
        monthly_message_limit: getPlanMonthlyLimit(price.planTier),
        status: 'PENDING_PAYMENT',
        payment_method: paymentMethod,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        coupon_code: price.couponCode,
        pending_payment_id: payment?.id || null,
        last_payment_status: payment?.status || 'PENDING',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    return NextResponse.json({
      success: true,
      mock: false,
      price,
      status: 'PENDING_PAYMENT',
      asaas: {
        customerId: customer.id,
        subscriptionId: subscription.id,
        paymentId: payment?.id || null,
        invoiceUrl: payment?.invoiceUrl || null,
        pix,
      },
      isOnboarded: false,
      message:
        paymentMethod === 'PIX'
          ? 'Pague o PIX para ativar sua assinatura.'
          : 'Conclua o pagamento no link do Asaas para ativar.',
    });
  } catch (error: unknown) {
    console.error('[Billing Checkout Error]', error);
    const { logOpsAlert } = await import('@/lib/opsAlert');
    await logOpsAlert({
      source: 'billing.checkout',
      message: error instanceof Error ? error.message : 'Erro no checkout Asaas.',
      tenantId: tenantForAlert,
    });
    const message =
      error instanceof AsaasApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Erro ao iniciar cobrança.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
