import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isPasswordStrong, hashPassword } from '@/lib/authHelpers';
import { clearSessionCookie } from '@/lib/requireAuth';
import { checkRateLimit, clientIpFromRequest } from '@/lib/rateLimit';
import {
  validateEmail,
  validateFullName,
  validateCompanyName,
  validatePhoneBR,
} from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIpFromRequest(req);
    const ipLimit = checkRateLimit(`register:ip:${ip}`, 8, 60 * 60 * 1000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Muitos cadastros deste IP. Aguarde e tente novamente.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSec || 60) },
        }
      );
    }

    const body = await req.json();
    const { name, email, password, companyName, whatsapp } = body;

    const nameCheck = validateFullName(name);
    if (!nameCheck.ok) {
      return NextResponse.json({ success: false, error: nameCheck.error }, { status: 400 });
    }

    const companyCheck = validateCompanyName(companyName);
    if (!companyCheck.ok) {
      return NextResponse.json({ success: false, error: companyCheck.error }, { status: 400 });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return NextResponse.json({ success: false, error: emailCheck.error }, { status: 400 });
    }

    const phoneCheck = validatePhoneBR(whatsapp || '');
    if (!phoneCheck.ok) {
      return NextResponse.json({ success: false, error: phoneCheck.error }, { status: 400 });
    }

    const passwordCheck = isPasswordStrong(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, error: passwordCheck.reason },
        { status: 400 }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este e-mail já está cadastrado no Portal Domu Tech. Faça login ou recupere a senha.',
        },
        { status: 400 }
      );
    }

    const slug =
      companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Math.floor(1000 + Math.random() * 9000);

    const { data: newTenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: companyName,
        slug,
        segment: 'imobiliario',
        whatsapp_number: whatsapp || '',
        status: 'TRIAL',
      })
      .select()
      .single();

    if (tenantError) {
      console.error('[Register Tenant Error]', tenantError);
      throw new Error('Falha ao registrar dados da empresa no banco de dados.');
    }

    const passwordHash = await hashPassword(password);

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        tenant_id: newTenant.id,
        name,
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'ADMIN',
        phone: whatsapp || '',
      })
      .select()
      .single();

    if (userError) {
      console.error('[Register User Error]', userError);
      throw new Error('Falha ao registrar usuário no banco de dados.');
    }

    // Sem login automático: limpa cookie antigo e manda o usuário autenticar no /login.
    const res = NextResponse.json({
      success: true,
      message: 'Conta criada com sucesso!',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: 'ADMIN',
        tenantId: newTenant.id,
        companyName: newTenant.name,
        isOnboarded: false,
      },
    });
    clearSessionCookie(res);
    return res;
  } catch (error: any) {
    console.error('[Register API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao processar cadastro.' },
      { status: 500 }
    );
  }
}
