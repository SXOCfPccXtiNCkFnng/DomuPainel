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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    if (!allowAdminDbRoute(req)) {
      return NextResponse.json(
        { success: false, error: 'Seed bloqueado. Defina DOMU_ADMIN_SECRET e envie x-domu-admin-secret.' },
        { status: 403 }
      );
    }

    // 1. Create Default Tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .upsert({
        slug: 'domu-imoveis-demo',
        name: 'DOMU Imóveis & Consultoria',
        segment: 'imobiliario',
        whatsapp_number: '5511934430659',
        coexistence_status: 'CONNECTED',
        status: 'ACTIVE'
      }, { onConflict: 'slug' })
      .select()
      .single();

    if (tenantError) throw tenantError;

    const tenantId = tenant.id;

    // 2. Create Initial Properties
    const initialProperties = [
      {
        tenant_id: tenantId,
        code: 'DOM-101',
        title: 'Apartamento de Luxo no Jardins',
        type: 'Apartamento',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        price: 1850000.00,
        bedrooms: 3,
        bathrooms: 3,
        area_sqm: 142.00,
        image_url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        status: 'Disponível'
      },
      {
        tenant_id: tenantId,
        code: 'DOM-102',
        title: 'Casa Contemporânea em Alphaville',
        type: 'Casa',
        neighborhood: 'Alphaville',
        city: 'Barueri',
        price: 3400000.00,
        bedrooms: 4,
        bathrooms: 5,
        area_sqm: 380.00,
        image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
        status: 'Lançamento'
      },
      {
        tenant_id: tenantId,
        code: 'DOM-103',
        title: 'Cobertura Duplex Vila Nova Conceição',
        type: 'Cobertura',
        neighborhood: 'Vila Nova Conceição',
        city: 'São Paulo',
        price: 4900000.00,
        bedrooms: 4,
        bathrooms: 6,
        area_sqm: 290.00,
        image_url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
        status: 'Disponível'
      }
    ];

    await supabaseAdmin
      .from('properties')
      .upsert(initialProperties, { onConflict: 'tenant_id,code' });

    // 3. Create Initial Leads
    const initialLeads = [
      {
        tenant_id: tenantId,
        name: 'Lucas Silveira',
        phone: '5511988887777',
        email: 'lucas@gmail.com',
        interest_segment: 'imobiliario',
        interest_property_type: 'Apartamento',
        budget_max: 2000000.00,
        status: 'EM_ATENDIMENTO'
      },
      {
        tenant_id: tenantId,
        name: 'Mariana Costa',
        phone: '5511977776666',
        email: 'mariana@hotmail.com',
        interest_segment: 'imobiliario',
        interest_property_type: 'Casa',
        budget_max: 3500000.00,
        status: 'VISITA_AGENDADA'
      }
    ];

    await supabaseAdmin
      .from('leads')
      .upsert(initialLeads, { onConflict: 'tenant_id,phone' });

    return NextResponse.json({
      success: true,
      message: 'Banco de dados inicializado e dados de demonstração semeados com sucesso!',
      tenantId
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
