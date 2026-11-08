import { pool } from '../../lib/db.js';
import { requireAdmin, json, audit } from '../../lib/access.js';
import { isProjectStatus } from '../../lib/permissions.js';
import { text, money } from '../../lib/validation.js';
export async function GET(request){
  try{
    const current=await requireAdmin(request);if(current.response)return current.response;
    const {rows}=await pool.query(`SELECT p.*,u.name AS client_name,u.email AS client_email,
      COALESCE((SELECT json_agg(json_build_object('id',m.id,'title',m.title,'status',m.status) ORDER BY m.sort_order)
      FROM public.maxweb_project_milestones m WHERE m.project_id=p.id),'[]'::json) AS milestones
      FROM public.maxweb_projects p JOIN public."user" u ON u.id=p.client_user_id ORDER BY p.updated_at DESC LIMIT 300`);
    return json({projects:rows});
  }catch(error){console.error('admin projects failed',error?.message);return json({error:'server_error'},500);}
}
export async function POST(request){
  const current=await requireAdmin(request);if(current.response)return current.response;
  const body=await request.json().catch(()=>null);
  const clientId=text(body?.clientUserId,{max:128}),title=text(body?.title,{max:180}),description=text(body?.description||'',{min:0,max:5000}),service=text(body?.serviceType,{max:120});
  if(!clientId||!title||description===null||!service)return json({error:'invalid_input'},400);
  const budget=body?.budget===''||body?.budget==null?null:money(body.budget);
  if(body?.budget!=null&&body?.budget!==''&&budget===null)return json({error:'invalid_budget'},400);
  const milestones=Array.isArray(body?.milestones)?body.milestones.slice(0,20).map(v=>text(v,{max:180})).filter(Boolean):typeof body?.milestones==='string'?body.milestones.split('\n').slice(0,20).map(v=>text(v,{max:180})).filter(Boolean):[];
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const profile=await client.query("SELECT user_id FROM public.maxweb_profiles WHERE user_id=$1 AND role='client'",[clientId]);
    if(!profile.rows[0]){await client.query('ROLLBACK');return json({error:'client_not_found'},404);}
    const {rows}=await client.query(`INSERT INTO public.maxweb_projects(client_user_id,title,description,service_type,due_date,budget,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[clientId,title,description,service,body?.dueDate||null,budget,current.user.id]);
    for(let i=0;i<milestones.length;i++)await client.query('INSERT INTO public.maxweb_project_milestones(project_id,title,sort_order) VALUES($1,$2,$3)',[rows[0].id,milestones[i],i]);
    await client.query(`INSERT INTO public.maxweb_audit_logs(actor_user_id,action,entity_type,entity_id,details)
      VALUES($1,'project.created','project',$2,$3::jsonb)`,[current.user.id,rows[0].id,JSON.stringify({clientId,milestones:milestones.length})]);
    await client.query('COMMIT');return json({project:rows[0]},201);
  }catch(error){await client.query('ROLLBACK').catch(()=>{});console.error('create project failed',error?.message);return json({error:'server_error'},500);}
  finally{client.release();}
}
export async function PATCH(request){
  try{
    const current=await requireAdmin(request);if(current.response)return current.response;
    const body=await request.json().catch(()=>null);
    if(!body?.id||!isProjectStatus(body?.status))return json({error:'invalid_input'},400);
    const {rows}=await pool.query('UPDATE public.maxweb_projects SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,status',[body.id,body.status]);
    if(!rows[0])return json({error:'project_not_found'},404);
    const update=body?.update?text(body.update,{max:3000}):null;
    if(update)await pool.query("INSERT INTO public.maxweb_project_updates(project_id,author_user_id,visibility,body) VALUES($1,$2,'client',$3)",[body.id,current.user.id,update]);
    await audit(current.user.id,'project.status_changed','project',body.id,{status:body.status});
    return json({project:rows[0]});
  }catch(error){console.error('update project failed',error?.message);return json({error:'server_error'},500);}
}
