import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/requireAuth';

function allowAdminDbRoute(req: NextRequest): boolean {
  // Desligado por padrão — exige DOMU_ADMIN_SECRET (mín. 16) + header x-domu-admin-secret
  const secret = process.env.DOMU_ADMIN_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = req.headers.get('x-domu-admin-secret');
  return Boolean(header && header === secret);
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if ('error' in auth) return auth.error;

    if (!allowAdminDbRoute(req)) {
      return NextResponse.json(
        { success: false, error: 'Teste de DB bloqueado. Defina DOMU_ADMIN_SECRET e envie x-domu-admin-secret.' },
        { status: 403 }
      );
    }

    // Never dump tenant rows in production
    if (process.env.NODE_ENV === 'production') {
      const { count, error } = await supabaseAdmin
        .from('tenants')
        .select('id', { count: 'exact', head: true });

      if (error) {
        return NextResponse.json({
          success: false,
          message: 'Supabase configurado! (Aguardando criação das tabelas no painel do Supabase com o arquivo schema.sql)',
          error: error.message
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Conexão com o Banco PostgreSQL do Supabase estabelecida com sucesso!',
        tenantsCount: count ?? 0,
        ok: true,
      });
    }

    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .limit(5);

    if (error) {
      return NextResponse.json({
        success: false,
        message: 'Supabase configurado! (Aguardando criação das tabelas no painel do Supabase com o arquivo schema.sql)',
        error: error.message
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conexão com o Banco PostgreSQL do Supabase estabelecida com sucesso!',
      tenantsCount: tenants?.length || 0,
      tenants
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
