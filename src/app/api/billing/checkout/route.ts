import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  computeSubscriptionPrice,
  findActiveCoupon,
  activateTenantSubscription,
} from '@/lib/billing';
import { getPlanMonthlyLimit } from '@/lib/planLimits';
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

    const price = computeSubscriptionPrice({ planTier, paymentMethod, coupon });

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

    // Persistir dados de onboarding (sem ativar plano ainda)
    if (body.companyName || body.segment || body.whatsappPhone) {
      await supabaseAdmin
        .from('tenants')
        .update({
          name: body.companyName || tenant?.name,
          segment: body.segment || tenant?.segment || 'imobiliario',
          whatsapp_number: body.whatsappPhone || tenant?.whatsapp_number || '',
          coexistence_status: body.connectionType ? 'CONNECTED' : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
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
      const { encryptedText, iv } = encryptData(body.accessToken);
      await supabaseAdmin.from('tenant_credentials').upsert(
        {
          tenant_id: tenantId,
          waba_id: body.wabaId,
          phone_number_id: body.phoneNumberId,
          encrypted_access_token: encryptedText,
          token_encryption_iv: iv,
          verify_token: body.verifyToken || generateSecureToken(16),
          app_id: body.appId || null,
          webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://painel.domutech.digital'}/api/whatsapp/webhook`,
          is_verified: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );
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

    // Cancel existing Asaas subscription before creating a new one
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('asaas_subscription_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existingSub?.asaas_subscription_id) {
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
