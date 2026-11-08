import { pool } from '../../lib/db.js';
import { requireUser, json } from '../../lib/access.js';
export async function GET(request){
  try{const current=await requireUser(request);if(current.response)return current.response;
    const {rows}=await pool.query(`SELECT i.id,i.invoice_number,i.description,i.amount,i.currency,i.status,i.due_date,i.created_at,
      COALESCE((SELECT SUM(p.amount) FROM public.maxweb_payments p WHERE p.invoice_id=i.id AND p.status='confirmed'),0) AS paid_amount
      FROM public.maxweb_invoices i WHERE i.user_id=$1 ORDER BY i.created_at DESC`,[current.user.id]);
    return json({invoices:rows});
  }catch(error){console.error('portal invoices failed',error?.message);return json({error:'server_error'},500);}
}
