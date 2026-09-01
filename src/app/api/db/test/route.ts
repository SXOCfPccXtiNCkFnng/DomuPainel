import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    // Attempt to query tenants table
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
