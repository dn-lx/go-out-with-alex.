import {readSettings,publicSettings} from '../../lib/owner-store.mjs';
export default async function publicConfig(request) {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'null'};
  // Same-origin fetch only: no CORS support is needed for the visitor page.
  delete headers['Access-Control-Allow-Origin'];
  if(request.method!=='GET')return new Response(JSON.stringify({error:'Method not allowed.'}),{status:405,headers});
  try{
    const current=await readSettings();
    return new Response(JSON.stringify({ok:true,settings:publicSettings(current)}),{status:200,headers});
  }catch(error){
    console.error('Public settings error:',error?.message||error);
    return new Response(JSON.stringify({ok:false,settings:{}}),{status:503,headers});
  }
}
