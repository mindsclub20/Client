import { pool } from '../../lib/db.js';
import { requireAdmin, json } from '../../lib/access.js';
export async function GET(request) {
  try {
    const current = await requireAdmin(request);
    if (current.response) return current.response;
    const queries = await Promise.all([
      pool.query("SELECT count(*)::int AS count FROM public.maxweb_profiles WHERE role = 'client'"),
      pool.query("SELECT count(*)::int AS count FROM public.maxweb_projects WHERE status NOT IN ('completed','cancelled')"),
      pool.query("SELECT count(*)::int AS count FROM public.maxweb_service_requests WHERE status IN ('submitted','reviewing')"),
      pool.query("SELECT count(*)::int AS count FROM public.maxweb_quotations WHERE status = 'sent'"),
      pool.query("SELECT count(*)::int AS count FROM public.maxweb_invoices WHERE status IN ('issued','partially_paid','overdue')"),
      pool.query("SELECT count(*)::int AS count FROM public.maxweb_support_tickets WHERE status IN ('open','in_progress','waiting_for_client')"),
      pool.query(`SELECT p.id,p.title,p.status,p.updated_at,u.name AS client_name,u.email AS client_email
        FROM public.maxweb_projects p JOIN public."user" u ON u.id=p.client_user_id
        ORDER BY p.updated_at DESC LIMIT 8`)
    ]);
    return json({metrics:{clients:queries[0].rows[0].count,activeProjects:queries[1].rows[0].count,pendingRequests:queries[2].rows[0].count,quotationsAwaitingClient:queries[3].rows[0].count,unpaidInvoices:queries[4].rows[0].count,openTickets:queries[5].rows[0].count},recentProjects:queries[6].rows});
  } catch (error) { console.error('admin overview failed',error?.message); return json({error:'server_error'},500); }
}
