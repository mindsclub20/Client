import { pool } from '../../lib/db.js';
import { requireUser, json } from '../../lib/access.js';
export async function GET(request) {
  try {
    const current=await requireUser(request); if(current.response)return current.response;
    const {rows}=await pool.query(`SELECT p.id,p.title,p.description,p.service_type,p.status,p.start_date,p.due_date,p.budget,p.currency,p.updated_at,
      COALESCE((SELECT json_agg(json_build_object('id',m.id,'title',m.title,'status',m.status,'dueDate',m.due_date) ORDER BY m.sort_order)
        FROM public.maxweb_project_milestones m WHERE m.project_id=p.id),'[]'::json) AS milestones,
      COALESCE((SELECT json_agg(json_build_object('id',u.id,'body',u.body,'createdAt',u.created_at) ORDER BY u.created_at DESC)
        FROM public.maxweb_project_updates u WHERE u.project_id=p.id AND u.visibility='client'),'[]'::json) AS updates
      FROM public.maxweb_projects p WHERE p.client_user_id=$1 ORDER BY p.updated_at DESC`,[current.user.id]);
    return json({projects:rows});
  } catch(error){console.error('portal projects failed',error?.message);return json({error:'server_error'},500);}
}
