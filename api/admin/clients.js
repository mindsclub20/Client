import { pool } from '../../lib/db.js';
import { requireAdmin, json } from '../../lib/access.js';
export async function GET(request) {
  try {
    const current=await requireAdmin(request); if(current.response)return current.response;
    const {rows}=await pool.query(`SELECT u.id,u.name,u.email,p.phone,p.created_at,
      (SELECT count(*)::int FROM public.maxweb_projects pr WHERE pr.client_user_id=u.id) AS project_count
      FROM public.maxweb_profiles p JOIN public."user" u ON u.id=p.user_id
      WHERE p.role='client' ORDER BY p.created_at DESC LIMIT 250`);
    return json({clients:rows});
  } catch(error){console.error('admin clients failed',error?.message);return json({error:'server_error'},500);}
}
