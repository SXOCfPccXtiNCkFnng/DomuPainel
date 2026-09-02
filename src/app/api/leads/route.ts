import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

function formatWhatsAppPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { searchParams } = new URL(req.url);
    const interest = searchParams.get('interest');
    const region = searchParams.get('region');
    const propertyType = searchParams.get('propertyType');
    const budgetMax = searchParams.get('budgetMax');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    let query = supabaseAdmin
      .from('leads')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (interest) query = query.eq('interest_segment', interest);
    if (region) query = query.eq('region', region);
    if (propertyType) query = query.eq('interest_property_type', propertyType);
    if (status) query = query.eq('status', status);
    if (budgetMax) {
      const max = Number(budgetMax);
      if (!Number.isNaN(max)) query = query.lte('budget_max', max);
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    let result = leads || [];
    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      const digits = needle.replace(/\D/g, '');
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(needle) ||
          (digits && l.phone?.includes(digits)) ||
          l.region?.toLowerCase().includes(needle) ||
          l.interest_segment?.toLowerCase().includes(needle)
      );
    }

    return NextResponse.json({ success: true, leads: result });
  } catch (error: any) {
    console.error('[Leads API GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const { contacts } = body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Envie uma lista válida de contatos.' },
        { status: 400 }
      );
    }

    const leadsToInsert = contacts
      .map((c: any) => ({
        tenant_id: tenantId,
        name: c.name?.trim() || 'Contato Importado',
        phone: formatWhatsAppPhone(c.phone),
        status: c.status || 'NOVO',
        interest_segment: c.interest || c.interest_segment || null,
        region: c.region || null,
        interest_property_type: c.propertyType || c.interest_property_type || null,
        budget_max:
          c.budgetMax != null && c.budgetMax !== ''
            ? Number(c.budgetMax)
            : c.budget_max != null
              ? Number(c.budget_max)
              : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      .filter((c: any) => c.phone.length >= 10);

    const { data: inserted, error } = await supabaseAdmin
      .from('leads')
      .upsert(leadsToInsert, { onConflict: 'tenant_id,phone' })
      .select('*');

    if (error) {
      const { data: fallbackInserted, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert(leadsToInsert)
        .select('*');
      if (insertError) throw insertError;
      return NextResponse.json({
        success: true,
        inserted: fallbackInserted?.length || contacts.length,
      });
    }

    return NextResponse.json({
      success: true,
      inserted: inserted?.length || contacts.length,
      leads: inserted,
    });
  } catch (error: any) {
    console.error('[Leads API POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json();
    const { id, ids, updates } = body;

    const targetIds: string[] = Array.isArray(ids) ? ids : id ? [id] : [];
    if (targetIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Informe id ou ids.' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ success: false, error: 'Informe updates.' }, { status: 400 });
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('name' in updates) payload.name = updates.name;
    if ('interest' in updates || 'interest_segment' in updates) {
      payload.interest_segment = updates.interest ?? updates.interest_segment;
    }
    if ('region' in updates) payload.region = updates.region;
    if ('propertyType' in updates || 'interest_property_type' in updates) {
      payload.interest_property_type = updates.propertyType ?? updates.interest_property_type;
    }
    if ('budgetMax' in updates || 'budget_max' in updates) {
      const raw = updates.budgetMax ?? updates.budget_max;
      payload.budget_max = raw === '' || raw == null ? null : Number(raw);
    }
    if ('status' in updates) {
      payload.status = updates.status;
      if (updates.status === 'VISITA_AGENDADA' || updates.status === 'EM_ATENDIMENTO') {
        payload.last_contact_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(payload)
      .eq('tenant_id', tenantId)
      .in('id', targetIds)
      .select('*');

    if (error) throw error;

    return NextResponse.json({ success: true, updated: data?.length || 0, leads: data });
  } catch (error: any) {
    console.error('[Leads API PATCH Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const id = (body.id || searchParams.get('id') || '') as string;
    const ids: string[] = Array.isArray(body.ids) ? body.ids : id ? [id] : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Informe o id (ou ids) do contato.' },
        { status: 400 }
      );
    }

    const { error, count } = await supabaseAdmin
      .from('leads')
      .delete({ count: 'exact' })
      .eq('tenant_id', tenantId)
      .in('id', ids);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: count ?? ids.length });
  } catch (error: any) {
    console.error('[Leads API DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
