import { supabase } from './supabase-client.js';
(function(){
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function api(path,options={}){
    const o={credentials:'same-origin',cache:'no-store',...options};
    o.headers={...(o.headers||{})};
    if(o.body&&typeof o.body!=='string'){o.headers['content-type']='application/json';o.body=JSON.stringify(o.body);}
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.access_token)o.headers.Authorization='Bearer '+session.access_token;
    const r=await fetch(path,o),d=await r.json().catch(()=>({}));
    if(r.status===401){await supabase.auth.signOut();location.href='/#login';throw Error('Please log in again.');}
    if(!r.ok)throw Error(d.error||d.message||'Request failed');
    return d;
  }
  function notice(s,error=false){const e=document.getElementById('notice');e.textContent=s;e.hidden=false;e.className=error?'notice error':'notice';}
  function date(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString();}
  function status(v){const s=esc(v||'unknown');return '<span class="status">'+s.replaceAll('_',' ')+'</span>';}
  async function logout(){await supabase.auth.signOut();location.href='/';}
  document.getElementById('logout')?.addEventListener('click',logout);
  window.MW={api,esc,notice,date,status};
})();
