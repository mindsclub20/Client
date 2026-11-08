import { pool } from '../../lib/db.js';
import { requireUser, json, audit } from '../../lib/access.js';
import { text } from '../../lib/validation.js';
export async function GET(request){
  try{const current=await requireUser(request);if(current.response)return current.response;
    const {rows}=await pool.query('SELECT id,project_id,subject,message,status,priority,created_at,updated_at FROM public.maxweb_support_tickets WHERE user_id=$1 ORDER BY updated_at DESC',[current.user.id]);
    return json({tickets:rows});
  }catch(error){console.error('portal support failed',error?.message);return json({error:'server_error'},500);}
}
export async function POST(request){
  try{const current=await requireUser(request);if(current.response)return current.response;
    const body=await request.json().catch(()=>null),subject=text(body?.subject,{max:160}),message=text(body?.message,{max:4000});
    if(!subject||!message)return json({error:'invalid_input'},400);
    let projectId=null;
    if(body?.projectId){const owned=await pool.query('SELECT id FROM public.maxweb_projects WHERE id=$1 AND client_user_id=$2',[body.projectId,current.user.id]);if(!owned.rows[0])return json({error:'project_not_found'},404);projectId=body.projectId;}
    const {rows}=await pool.query('INSERT INTO public.maxweb_support_tickets(user_id,project_id,subject,message) VALUES($1,$2,$3,$4) RETURNING id,status,created_at',[current.user.id,projectId,subject,message]);
    await audit(current.user.id,'support_ticket.created','support_ticket',rows[0].id);return json({ticket:rows[0]},201);
  }catch(error){console.error('create support ticket failed',error?.message);return json({error:'server_error'},500);}
}
