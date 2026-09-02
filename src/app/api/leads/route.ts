import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

function formatWhatsAppPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  // Brazilian phone without DDI (10 or 11 digits) -> prepend 55
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

// GET: List all contacts for tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false });
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      leads: leads || []
    });

  } catch (error: any) {
    console.error('[Leads API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Import/Save contacts into Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, contacts } = body; // contacts: [{ name: string, phone: string }]

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ success: false, error: 'Envie uma lista válida de contatos.' }, { status: 400 });
    }

    // 1. Get or fallback tenant_id
    let activeTenantId = tenantId;
    if (!activeTenantId) {
      const { data: tenant } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
      activeTenantId = tenant?.id;
    }

    if (!activeTenantId) {
      return NextResponse.json({ success: false, error: 'Tenant não localizado.' }, { status: 400 });
    }

    // 2. Prepare payload for insertion with automatic DDI +55 sanitization
    const leadsToInsert = contacts
      .map((c: any) => ({
        tenant_id: activeTenantId,
        name: c.name?.trim() || 'Contato Importado',
        phone: formatWhatsAppPhone(c.phone),
        status: 'QUALIFIED',
        created_at: new Date().toISOString()
      }))
      .filter((c: any) => c.phone.length >= 10);

    // 3. Upsert / Insert into Supabase
    const { data: inserted, error } = await supabaseAdmin
      .from('leads')
      .upsert(leadsToInsert, { onConflict: 'tenant_id,phone' })
      .select('*');

    if (error) {
      // Fallback normal insert if upsert constraint differs
      const { data: fallbackInserted, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert(leadsToInsert)
        .select('*');

      if (insertError) throw insertError;
      return NextResponse.json({ success: true, inserted: fallbackInserted?.length || contacts.length });
    }

    return NextResponse.json({
      success: true,
      inserted: inserted?.length || contacts.length
    });

  } catch (error: any) {
    console.error('[Leads API POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
