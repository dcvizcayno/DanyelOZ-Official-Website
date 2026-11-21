// QA T-005 probe harness: own mocks, loads Code.gs + FormsSetup.gs + Inbox.gs in one vm context.
const fs=require('fs'),vm=require('vm'),path=require('path');
const D=path.join(__dirname,'../../../apps-script');
const M=60000,H=3600000,DY=86400000;
const S={now:Date.parse('2026-11-22T03:00:00Z'),props:{},sent:[],logs:[],trig:[],cal:[],held:false,failLock:false,quota:100,active:'me.owner@gmail.com',effective:'me.owner@gmail.com',owner:'me.owner@gmail.com',ownerFn:null,uidN:900000,onSend:null,books:{},rand:Math.random,songs:[]};
class FD extends Date{constructor(...a){a.length?super(...a):super(S.now)} static now(){return S.now}}
const fmt=(d,tz,f)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return f.replace('yyyy',p.year).replace('MM',p.month).replace('dd',p.day).replace('HH',p.hour).replace('mm',p.minute)};
function sheet(formId,heads,rows){const sh={d:[heads.slice(),...rows.map(r=>r.slice())],getFormUrl:()=>formId?'https://docs.google.com/forms/d/'+formId+'/edit':null,getName:()=>formId||'x',
 getLastRow(){return sh.d.length},getLastColumn(){return Math.max(0,...sh.d.map(r=>r.length))},
 getRange(r,c,nr=1,nc=1){return{getValues(){const o=[];for(let i=0;i<nr;i++){const w=[];for(let j=0;j<nc;j++){const v=(sh.d[r-1+i]||[])[c-1+j];w.push(v==null?'':v)}o.push(w)}return o},setValue(v){const w=sh.d[r-1];while(w.length<c)w.push('');w[c-1]=v}}},
 deleteRow(r){if(r<2)throw new Error('HEADER DELETE');sh.d.splice(r-1,1)}};return sh}
const CH=['Timestamp','First name','Last name','Email','What would you like to contact me about?','Subject','Message'];
const SH=['Timestamp','Name','Email','Company or production','Song or songs','Project','Media type','Territory','Term','Timeline','Budget range','Notes'];
const CID='QACONTACTFORM0001',SID='QASYNCFORM00000001';
const ago=ms=>new FD(S.now-ms);
const crow=(o={})=>[o.ts||ago(30*M),o.first==null?'Maria':o.first,'Santos',o.email||'maria@example.org',o.topic||'Fan Contact',o.subject||'SUBJMARK',o.message||'MSGMARK body'];
const srow=(o={})=>[o.ts||ago(30*M),o.name||'Kim Lee',o.email||'kim@prod.example',o.company||'COMPMARK','SONGMARK','PROJMARK','Film','Worldwide','1 year','Soon','',''];
function setup(c=[],s=[],extra={}){S.props=Object.assign({FS_CONTACT_FORM_ID:CID,FS_SYNC_FORM_ID:SID,FS_INBOX_SHEET_ID:'INBOX1',FS_SONG_DB_ID:'SONGDB1'},extra);
 S.sent=[];S.logs=[];S.cal=[];S.held=false;S.failLock=false;S.quota=100;S.onSend=null;S.songs=[];
 const a=sheet(CID,CH,c.map(crow)),b=sheet(SID,SH,s.map(srow));S.books={INBOX1:{getId:()=>'INBOX1',getSheets:()=>[a,b]}};return{a,b}}
const P={getProperty:k=>k in S.props?S.props[k]:null,setProperty:(k,v)=>{S.props[k]=String(v)},deleteProperty:k=>{delete S.props[k]},getKeys:()=>Object.keys(S.props),getProperties:()=>Object.assign({},S.props)};
const lock={tryLock(){if(S.held||S.failLock)return false;S.held=true;return true},waitLock(){if(!this.tryLock())throw new Error('lock')},releaseLock(){S.held=false},hasLock(){return S.held}};
const g={Date:FD,Math:Object.assign(Object.create(Math),{random:()=>S.rand()}),console,JSON,Intl,
 Logger:{log:m=>S.logs.push(String(m))},
 PropertiesService:{getScriptProperties:()=>P,getUserProperties:()=>P,getDocumentProperties:()=>P},
 LockService:{getScriptLock:()=>lock,getDocumentLock:()=>lock,getUserLock:()=>lock},
 Session:{getActiveUser:()=>({getEmail:()=>S.active}),getEffectiveUser:()=>({getEmail:()=>S.effective}),getScriptTimeZone:()=>'America/New_York'},
 Utilities:{formatDate:fmt,sleep(){},getUuid:()=>'u'},
 MailApp:{getRemainingDailyQuota:()=>typeof S.quota==='function'?S.quota():S.quota,sendEmail(m){if(typeof m!=='object'||arguments.length>1)throw new Error('non-object sendEmail');S.sent.push({m,locked:S.held});if(typeof S.quota==='number')S.quota--;if(S.onSend)S.onSend(m)}},
 SpreadsheetApp:{flush(){},openById:id=>{if(!S.books[id])throw new Error('nobook');return S.books[id]},getActiveSpreadsheet:()=>({getId:()=>'SONGDB1',getOwner:()=>S.ownerFn?S.ownerFn():(S.owner?{getEmail:()=>S.owner}:null)})},
 FormApp:{openByUrl(){throw new Error('x')},openById(){throw new Error('x')}},
 CalendarApp:{Visibility:{PRIVATE:'PRIVATE',DEFAULT:'DEFAULT'},getDefaultCalendar:()=>({
  createEvent(t,s,e,o){const ev={t,s,e,o:o||{},vis:null,tags:{},extra:arguments.length,setVisibility(v){ev.vis=v},setTag(k,v){ev.tags[k]=v},getTag:k=>ev.tags[k]||null};S.cal.push(ev);return ev},
  getEventsForDay:d=>S.cal.filter(ev=>fmt(ev.s,'Asia/Manila','yyyy-MM-dd')===fmt(d,'Asia/Manila','yyyy-MM-dd'))})},
 ScriptApp:{getProjectTriggers:()=>S.trig.slice(),deleteTrigger:t=>{S.trig=S.trig.filter(x=>x!==t)},
  newTrigger(fn){const cfg={fn,parts:[]};const b={timeBased(){cfg.parts.push('time');return b},everyMinutes(n){cfg.parts.push('min'+n);return b},atHour(h){cfg.parts.push('h'+h);return b},everyDays(n){cfg.parts.push('d'+n);return b},inTimezone(z){cfg.parts.push(z);return b},forSpreadsheet(){cfg.parts.push('ss');return b},onFormSubmit(){return b},create(){const u=String(++S.uidN*7919);const t={cfg,getHandlerFunction:()=>fn,getUniqueId:()=>u};S.trig.push(t);return t}};return b}}};
const ctx=vm.createContext(new Proxy(g,{has:()=>true,get:(t,k)=>k in t?t[k]:(k in globalThis?globalThis[k]:undefined)}));
for(const f of ['Code.gs','FormsSetup.gs','Inbox.gs'])vm.runInContext(fs.readFileSync(path.join(D,f),'utf8'),ctx,{filename:f});
vm.runInContext('getSongs=function(){return {songs:QA_SONGS()}}',ctx);g.QA_SONGS=()=>S.songs;
const R=(c)=>vm.runInContext(c,ctx);
// fire a handler the way Apps Script does: with the event of one of this project's own triggers
const fire=(fn)=>{let t=S.trig.find(x=>x.getHandlerFunction()===fn);if(!t){const u=String(++S.uidN*7919);t={getHandlerFunction:()=>fn,getUniqueId:()=>u,cfg:{fn}};S.trig.push(t)}return R(fn+'('+JSON.stringify({triggerUid:t.getUniqueId(),authMode:'FULL'})+')')};
let fails=0,passes=0;const ok=(c,m,x)=>{if(c){passes++}else{fails++;console.log('FAIL '+m+(x!==undefined?' :: '+JSON.stringify(x).slice(0,300):''))}};
const thr=(fn)=>{try{fn();return null}catch(e){return e.message}};
module.exports={fire,S,R,ok,thr,setup,ago,M,H,DY,FD,sheet,CH,SH,CID,SID,done:()=>{console.log('QA probe: '+passes+' passed, '+fails+' failed');process.exitCode=fails?1:0},g};
