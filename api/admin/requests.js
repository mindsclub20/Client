import { pool } from '../../lib/db.js';
import { requireAdmin, json, audit } from '../../lib/access.js';
const statuses=['submitted','reviewing','quoted','accepted','declined','converted'];
export async function GET(request){
  try{const current=await requireAdmin(request);if(current.response)return current.response;
    const {rows}=await pool.query(`SELECT r.*,u.name AS client_name,u.email AS client_email FROM public.maxweb_service_requests r
      JOIN public."user" u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 300`);
    return json({requests:rows});
  }catch(error){console.error('admin requests failed',error?.message);return json({error:'server_error'},500);}
}
export async function PATCH(request){
  try{const current=await requireAdmin(request);if(current.response)return current.response;
    const body=await request.json().catch(()=>null);if(!body?.id||!statuses.includes(body?.status))return json({error:'invalid_input'},400);
    const {rows}=await pool.query('UPDATE public.maxweb_service_requests SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,status',[body.id,body.status]);
    if(!rows[0])return json({error:'request_not_found'},404);
    await audit(current.user.id,'service_request.status_changed','service_request',body.id,{status:body.status});
    return json({request:rows[0]});
  }catch(error){console.error('update request failed',error?.message);return json({error:'server_error'},500);}
}
