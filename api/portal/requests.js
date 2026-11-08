import { pool } from '../../lib/db.js';
import { requireUser, json, audit } from '../../lib/access.js';
import { text } from '../../lib/validation.js';
export async function GET(request) {
  try {
    const current=await requireUser(request);if(current.response)return current.response;
    const {rows}=await pool.query('SELECT id,service_type,title,details,preferred_timeline,status,created_at FROM public.maxweb_service_requests WHERE user_id=$1 ORDER BY created_at DESC',[current.user.id]);
    return json({requests:rows});
  } catch(error){console.error('portal requests failed',error?.message);return json({error:'server_error'},500);}
}
export async function POST(request) {
  try {
    const current=await requireUser(request);if(current.response)return current.response;
    const body=await request.json().catch(()=>null);
    const title=text(body?.title,{max:160}),details=text(body?.details,{max:5000}),service=text(body?.serviceType,{max:100});
    if(!title||!details||!service)return json({error:'invalid_input'},400);
    const {rows}=await pool.query(`INSERT INTO public.maxweb_service_requests(user_id,service_type,title,details,preferred_timeline)
      VALUES($1,$2,$3,$4,$5) RETURNING id,status,created_at`,[current.user.id,service,title,details,text(body?.preferredTimeline||'',{min:0,max:120})]);
    await audit(current.user.id,'service_request.created','service_request',rows[0].id);
    return json({request:rows[0]},201);
  } catch(error){console.error('create request failed',error?.message);return json({error:'server_error'},500);}
}
