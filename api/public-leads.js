import { pool } from '../lib/db.js';
import { json } from '../lib/access.js';
import { text, email } from '../lib/validation.js';
export async function POST(request){try{const b=await request.json().catch(()=>null),name=text(b?.name,{max:120}),message=text(b?.message,{max:3000}),mail=b?.email?email(b.email):null,phone=b?.phone?text(b.phone,{max:32}):null;if(!name||!message||(b?.email&&!mail)||(b?.phone&&!phone))return json({error:'invalid_input'},400);const {rows}=await pool.query('INSERT INTO public.maxweb_public_leads(name,email,phone,service_type,message) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[name,mail,phone,text(b?.serviceType||'',{min:0,max:100}),message]);return json({lead:rows[0]},201);}catch(e){console.error(e?.message);return json({error:'server_error'},500);}}
