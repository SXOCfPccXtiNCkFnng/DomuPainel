import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { hashPassword } from '@/lib/authHelpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const inputPasswordHash = hashPassword(password);

    // Query user in Supabase
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, tenants(*)')
      .eq('email', cleanEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'E-mail ou senha incorretos. Verifique suas credenciais.' },
        { status: 401 }
      );
    }

    // Verify Password Hash
    if (user.password_hash !== inputPasswordHash) {
      return NextResponse.json(
        { success: false, error: 'E-mail ou senha incorretos. Verifique suas credenciais.' },
        { status: 401 }
      );
    }

    // Update last_login_at in Supabase
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Autenticado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        companyName: user.tenants?.name || 'DOMU Tech Empresa'
      }
    });

  } catch (error: any) {
    console.error('[Login API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao processar login.' },
      { status: 500 }
    );
  }
}
