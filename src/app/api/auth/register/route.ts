import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isPasswordStrong, hashPassword } from '@/lib/authHelpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, companyName, whatsapp } = body;

    // 1. Basic Fields Validation
    if (!name || !email || !password || !companyName) {
      return NextResponse.json(
        { success: false, error: 'Por favor, preencha todos os campos obrigatórios.' },
        { status: 400 }
      );
    }

    // 2. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Por favor, insira um e-mail válido (ex: seu.email@empresa.com).' },
        { status: 400 }
      );
    }

    // 3. Password Strength Validation
    const passwordCheck = isPasswordStrong(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, error: passwordCheck.reason },
        { status: 400 }
      );
    }

    // 4. Check if Email Already Exists in Database
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Este e-mail já está cadastrado no Portal DOMU Tech. Faça login ou recupere a senha.' },
        { status: 400 }
      );
    }

    // 5. Create Tenant for Company in PostgreSQL Supabase
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
    
    const { data: newTenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: companyName,
        slug: slug,
        segment: 'imobiliario',
        whatsapp_number: whatsapp || '',
        status: 'TRIAL'
      })
      .select()
      .single();

    if (tenantError) {
      console.error('[Register Tenant Error]', tenantError);
      throw new Error('Falha ao registrar dados da empresa no banco de dados.');
    }

    // 6. Create User Admin in PostgreSQL Supabase
    const passwordHash = hashPassword(password);

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        tenant_id: newTenant.id,
        name,
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'ADMIN',
        phone: whatsapp || ''
      })
      .select()
      .single();

    if (userError) {
      console.error('[Register User Error]', userError);
      throw new Error('Falha ao registrar usuário no banco de dados.');
    }

    // 7. Create Default Trial Subscription
    await supabaseAdmin
      .from('subscriptions')
      .insert({
        tenant_id: newTenant.id,
        plan_tier: 'PRO',
        monthly_price_brl: 497.00,
        monthly_message_limit: 10000,
        status: 'TRIAL',
        payment_method: 'PIX'
      });

    return NextResponse.json({
      success: true,
      message: 'Conta criada com sucesso no banco de dados! Faça login para continuar.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        tenantId: newTenant.id,
        companyName: newTenant.name
      }
    });

  } catch (error: any) {
    console.error('[Register API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao processar cadastro.' },
      { status: 500 }
    );
  }
}
