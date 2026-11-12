import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { ownerEmail, readInvites, writeInvites, readSettings, writeSettings, sanitizedSettings, publicInvites, makeInvite } from '../../lib/owner-store.mjs';

const COOKIE='__Host-bunny_owner';
const MAX_AGE=8*60*60;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const reply=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
const secret=()=>process.env.BUNNY_OWNER_SESSION_SECRET;
const sign=text=>createHmac('sha256',secret()).update(text).digest('base64url');
const same=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
function makeToken(email){
  const payload=Buffer.from(JSON.stringify({sub:email,exp:Math.floor(Date.now()/1000)+MAX_AGE,csrf:randomBytes(18).toString('base64url')})).toString('base64url');
  return payload+'.'+sign(payload);
}
function session(request){
  if(!secret()||secret().length<32)return null;
  const raw=request.headers.get('cookie')||'';
  const value=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!value||value.length>2000)return null;
  const [payload,signature]=value.split('.');
  if(!payload||!signature||!same(signature,sign(payload)))return null;
  try{
    const obj=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return obj.sub===ownerEmail&&obj.exp>Math.floor(Date.now()/1000)&&obj.exp<Math.floor(Date.now()/1000)+MAX_AGE+30 ? obj : null;
  }catch{return null;}
}
function envCredentials(){try{return JSON.parse(process.env.BUNNY_OWNER_CREDENTIALS||'{}');}catch{return {};}}
const credentialStore=()=>getStore({name:'alex-bunny-owner-auth-develop',consistency:'strong'});
async function readCredentials(){return (await credentialStore().get('owner-credential',{type:'json'}))||envCredentials();}
async function saveCredentials(obj){await credentialStore().setJSON('owner-credential',obj);}
function passwordMatches(pw,cred){
  if(typeof pw!=='string'||pw.length>200||pw.length<12||cred.email!==ownerEmail||!/^[0-9a-f]{32}$/.test(cred.salt||'')||!/^[0-9a-f]{64}$/.test(cred.hash||''))return false;
  const target=Buffer.from(cred.hash,'hex');
  const computed=scryptSync(pw,Buffer.from(cred.salt,'hex'),32);
  return timingSafeEqual(target,computed);
}
function hashedCredentials(password){
  if(typeof password!=='string'||password.length<14||password.length>120)throw Error('Owner password must be at least 14 characters.');
  const salt=randomBytes(16).toString('hex');
  return {email:ownerEmail,salt,hash:scryptSync(password,Buffer.from(salt,'hex'),32).toString('hex')};
}
async function loginGuard(request){
  const ip=(request.headers.get('x-nf-client-connection-ip')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,100);
  const key=createHash('sha256').update(ip+'|'+secret()).digest('hex');
  const guardStore=getStore({name:'alex-bunny-owner-throttle-develop',consistency:'strong'});
  let record=(await guardStore.get(key,{type:'json'}))||{count:0,start:Date.now()};
  if(Date.now()-record.start>15*60*1000)record={count:0,start:Date.now()};
  return {record,async recordFailure(){record.count++;await guardStore.setJSON(key,record);},async clear(){await guardStore.delete(key);}};
}
function sameOrigin(request){
  const origin=request.headers.get('origin');
  try{return Boolean(origin)&&new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
const cookie=token=>COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+MAX_AGE;
const clearCookie=()=>COOKIE+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
export default async function owner(request){
  if(!secret()||secret().length<32||!process.env.BUNNY_OWNER_CREDENTIALS)return reply({error:'Owner sign-in has not been provisioned.'},503);
  const action=new URL(request.url).searchParams.get('action')||'state';
  if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed.'},405);
  if(request.method==='POST'&&!sameOrigin(request))return reply({error:'Origin rejected.'},403);
  let body={};
  if(request.method==='POST'){
    if(Number(request.headers.get('content-length')||0)>25000)return reply({error:'Request too large.'},413);
    const raw=await request.text();
    if(raw.length>25000)return reply({error:'Request too large.'},413);
    try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON.'},400);}
  }
  try{
    if(action==='login'&&request.method==='POST'){
      const email=String(body.email||'').trim().toLowerCase();
      const guard=await loginGuard(request);
      if(guard.record.count>=6)return reply({error:'Too many attempts. Try again later.'},429);
      const cred=await readCredentials();
      if(email!==ownerEmail||!passwordMatches(body.password,cred)){
        await guard.recordFailure();
        return reply({error:'Invalid email or password.'},401);
      }
      await guard.clear();
      return reply({ok:true,email:ownerEmail},200,{'Set-Cookie':cookie(makeToken(ownerEmail))});
    }
    const user=session(request);
    if(!user)return reply({error:'Sign in required.'},401);
    if(action==='state'&&request.method==='GET'){
      const [settings,invites]=await Promise.all([readSettings(),readInvites()]);
      return reply({ok:true,email:ownerEmail,csrf:user.csrf,settings:sanitizedSettings(settings),invites:publicInvites(invites)});
    }
    if(request.method!=='POST'||!same(request.headers.get('x-bunny-csrf'),user.csrf))return reply({error:'Session verification failed.'},403);
    if(action==='logout')return reply({ok:true},200,{'Set-Cookie':clearCookie()});
    if(action==='save'){
      const clean=sanitizedSettings(body.settings);
      await writeSettings(clean);
      return reply({ok:true,settings:clean});
    }
    if(action==='invite'){
      const data=body.invite||{};
      const current=await readInvites();
      if(current.length>=40&&!current.some(x=>x.id===data.id))return reply({error:'Maximum 40 invitations.'},400);
      const prior=current.find(x=>x.id===data.id);
      const updated=makeInvite(data,prior);
      const next=prior?current.map(x=>x.id===updated.id?updated:x):[...current,updated];
      await writeInvites(next);
      return reply({ok:true,invites:publicInvites(next)});
    }
    if(action==='delete'){
      const id=String(body.id||'');
      const current=await readInvites();
      if(!current.some(x=>x.id===id))return reply({error:'Invitation not found.'},404);
      const next=current.filter(x=>x.id!==id);
      await writeInvites(next);
      return reply({ok:true,invites:publicInvites(next)});
    }
    if(action==='password'){
      const cred=await readCredentials();
      if(!passwordMatches(body.currentPassword,cred))return reply({error:'Incorrect current password.'},403);
      await saveCredentials(hashedCredentials(body.newPassword));
      return reply({ok:true},200,{'Set-Cookie':clearCookie()});
    }
    return reply({error:'Unknown action.'},404);
  }catch(error){
    console.error('Owner request failed',error?.message||error);
    return reply({error:error?.message&&/^(A maximum|Each extra|Name and|Invitation ID|Password must|Owner password)/.test(error.message)?error.message:'Unable to complete the request.'},400);
  }
}
