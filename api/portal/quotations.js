import { pool } from '../../lib/db.js';
import { requireUser, json, audit } from '../../lib/access.js';
export async function GET(request){
  try{const current=await requireUser(request);if(current.response)return current.response;
    const {rows}=await pool.query('SELECT id,project_id,title,line_items,amount,currency,status,notes,valid_until,created_at FROM public.maxweb_quotations WHERE user_id=$1 ORDER BY created_at DESC',[current.user.id]);
    return json({quotations:rows});
  }catch(error){console.error('portal quotations failed',error?.message);return json({error:'server_error'},500);}
}
export async function PATCH(request){
  try{const current=await requireUser(request);if(current.response)return current.response;
    const body=await request.json().catch(()=>null);if(!body?.id||!['approved','rejected'].includes(body?.status))return json({error:'invalid_input'},400);
    const {rows}=await pool.query("UPDATE public.maxweb_quotations SET status=$3,updated_at=now() WHERE id=$1 AND user_id=$2 AND status='sent' RETURNING id,status",[body.id,current.user.id,body.status]);
    if(!rows[0])return json({error:'quotation_not_found_or_not_actionable'},404);
    await audit(current.user.id,'quotation.'+body.status,'quotation',body.id);return json({quotation:rows[0]});
  }catch(error){console.error('quotation decision failed',error?.message);return json({error:'server_error'},500);}
}
