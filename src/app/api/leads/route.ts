import { NextRequest, NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/errors';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAuth, requireDispatcher } from '@/lib/requireAuth';
import { chunk } from '@/lib/batch';
import { toStoredPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

const LEADS_PAGE_SIZE = 1000;
const MAX_LEADS_LISTED = 50_000;
const MAX_IMPORT_BATCH = 10_000;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;
    const tenantId = auth.session.tenantId;

    const { searchParams } = new URL(req.url);
    const interest = searchParams.get('interest');
    const region = searchParams.get('region');
    const propertyType = searchParams.get('propertyType');
    const budgetMax = searchParams.get('budgetMax');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    const buildQuery = () => {
      let query = supabaseAdmin
        .from('leads')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

      if (interest) query = query.eq('interest_segment', interest);
      if (region) query = query.eq('region', region);
      if (propertyType) query = query.eq('interest_property_type', propertyType);
      if (status) query = query.eq('status', status);
      if (budgetMax) {
        const max = Number(budgetMax);
        if (!Number.isNaN(max)) query = query.lte('budget_max', max);
      }
      return query;
    };

    // O Supabase devolve no máximo 1000 linhas por consulta: sem paginar, quem
    // tem mais contatos não via (nem conseguia selecionar para campanha) o resto.
    const leads: Record<string, any>[] = [];
    for (let from = 0; from < MAX_LEADS_LISTED; from += LEADS_PAGE_SIZE) {
      const { data: page, error } = await buildQuery().range(from, from + LEADS_PAGE_SIZE - 1);
      if (error) throw error;
      leads.push(...(page || []));
      if (!page || page.length < LEADS_PAGE_SIZE) break;
    }

    let result = leads;
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
    return internalErrorResponse('api.leads', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
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

    if (contacts.length > MAX_IMPORT_BATCH) {
      return NextResponse.json(
        {
          success: false,
          error: `Importe no máximo ${MAX_IMPORT_BATCH.toLocaleString('pt-BR')} contatos por vez. Divida a planilha em partes.`,
        },
        { status: 400 }
      );
    }

    const mapped = contacts
      .map((c: any) => {
        // Sem status/created_at: reimportar a mesma lista não pode voltar
        // contatos em atendimento para "NOVO" nem apagar a data de entrada.
        // Linha nova recebe os defaults do banco.
        const item: Record<string, unknown> = {
          tenant_id: tenantId,
          name: String(c.name || '').trim() || 'Contato Importado',
          phone: toStoredPhone(String(c.phone || '')),
          updated_at: new Date().toISOString(),
        };
        if (c.status) item.status = c.status;

        const interest = c.interest || c.interest_segment;
        if (interest) item.interest_segment = interest;

        if (c.region) item.region = c.region;

        const propType = c.propertyType || c.interest_property_type;
        if (propType) item.interest_property_type = propType;

        const rawBudget = c.budgetMax ?? c.budget_max;
        if (rawBudget != null && rawBudget !== '') {
          const num = Number(rawBudget);
          if (!Number.isNaN(num)) item.budget_max = num;
        }

        return item;
      })
      .filter((c: any) => String(c.phone).length >= 10);

    // Telefone repetido na planilha derrubava a importação inteira (o upsert
    // não pode tocar a mesma linha duas vezes). Fica a última ocorrência.
    const byPhone = new Map<string, Record<string, unknown>>();
    for (const item of mapped) byPhone.set(String(item.phone), item);
    const leadsToInsert = [...byPhone.values()];

    if (leadsToInsert.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum telefone válido na lista (use DDD + número).' },
        { status: 400 }
      );
    }

    let { data: inserted, error } = await supabaseAdmin
      .from('leads')
      .upsert(leadsToInsert, { onConflict: 'tenant_id,phone', defaultToNull: false })
      .select('*');

    if (error && (error.message?.includes("'region'") || error.message?.includes('schema cache'))) {
      const sanitized = leadsToInsert.map((item) => {
        const copy = { ...item };
        delete copy.region;
        return copy;
      });
      const retryUpsert = await supabaseAdmin
        .from('leads')
        .upsert(sanitized, { onConflict: 'tenant_id,phone', defaultToNull: false })
        .select('*');
      inserted = retryUpsert.data;
      error = retryUpsert.error;
    }

    if (error) {
      let { data: fallbackInserted, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert(leadsToInsert)
        .select('*');

      if (
        insertError &&
        (insertError.message?.includes("'region'") || insertError.message?.includes('schema cache'))
      ) {
        const sanitized = leadsToInsert.map((item) => {
          const copy = { ...item };
          delete copy.region;
          return copy;
        });
        const retryInsert = await supabaseAdmin
          .from('leads')
          .insert(sanitized)
          .select('*');
        fallbackInserted = retryInsert.data;
        insertError = retryInsert.error;
      }

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
    return internalErrorResponse('api.leads', error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
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

    const updatedLeads: Record<string, any>[] = [];
    for (const part of chunk(targetIds.map(String))) {
      let { data, error } = await supabaseAdmin
        .from('leads')
        .update(payload)
        .eq('tenant_id', tenantId)
        .in('id', part)
        .select('*');

      if (error && error.message?.includes("'region'") && 'region' in payload) {
        delete payload.region;
        const retry = await supabaseAdmin
          .from('leads')
          .update(payload)
          .eq('tenant_id', tenantId)
          .in('id', part)
          .select('*');
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      updatedLeads.push(...(data || []));
    }

    return NextResponse.json({ success: true, updated: updatedLeads.length, leads: updatedLeads });
  } catch (error: any) {
    console.error('[Leads API PATCH Error]', error);
    return internalErrorResponse('api.leads', error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Apagar contatos (inclusive em massa) é destrutivo: Atendente não pode.
    const auth = await requireDispatcher(req);
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

    // Em lotes: `.in()` com muitos IDs estoura o tamanho da URL ("selecionar todos").
    let deleted = 0;
    for (const part of chunk(ids.map(String))) {
      const { error, count } = await supabaseAdmin
        .from('leads')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId)
        .in('id', part);
      if (error) throw error;
      deleted += count ?? part.length;
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    console.error('[Leads API DELETE Error]', error);
    return internalErrorResponse('api.leads', error);
  }
}
