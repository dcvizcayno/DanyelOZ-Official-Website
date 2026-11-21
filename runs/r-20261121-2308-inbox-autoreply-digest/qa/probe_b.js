// Auto-reply tick.
const {fire,S,R,ok,thr,setup,ago,M,H,DY,done}=require('./probe_h.js');
const ON=()=>{S.props.IB_AUTO_REPLY='on';S.props.IB_AR_ON_SINCE=String(S.now-100*H)};
const tick=()=>fire('ibAutoReplyTick');const day='2026-11-22';
const autoCol=(sh,vals)=>{sh.d[0].push('status','auto_reply_at');vals.forEach((v,i)=>{sh.d[i+1].push('',v)})};
// OFF
setup([{},{email:'b@x.org'}],[{}]);tick();ok(S.sent.length===0,'missing switch: 0');
S.props.IB_AUTO_REPLY='off';S.props.IB_AR_ON_SINCE=String(S.now-100*H);tick();ok(S.sent.length===0,'OFF: 0');
// window and switch-on time
setup([{ts:ago(19*M),email:'a1@x.org'},{ts:ago(20*M),email:'a2@x.org'},{ts:ago(72*H),email:'a3@x.org'},{ts:ago(72*H+M),email:'a4@x.org'}]);ON();tick();
ok(S.sent.map(x=>x.m.to).sort().join()==='a2@x.org,a3@x.org','window 20min..72h',S.sent.map(x=>x.m.to));
setup([{ts:ago(5*H),email:'a1@x.org'},{ts:ago(1*H),email:'a2@x.org'}]);ON();S.props.IB_AR_ON_SINCE=String(S.now-2*H);tick();
ok(S.sent.length===1&&S.sent[0].m.to==='a2@x.org','only after switch-on',S.sent.map(x=>x.m.to));
// templates random, mail shape, no submitted text, recorded
const seen={contact:new Set(),sync:new Set()};let shapeOk=true,leak=[],rec=true;
for(let i=0;i<40;i++){const sh=setup([{}],[{}]);ON();tick();
 for(const x of S.sent){const m=x.m;if(Object.keys(m).sort().join()!=='body,name,replyTo,subject,to'||m.name!=='Danyel OZ'||m.replyTo!=='daniel.vizkaino@gmail.com'||x.locked)shapeOk=false;
  for(const mk of ['SUBJMARK','MSGMARK','Santos','COMPMARK','SONGMARK','PROJMARK','Lee'])if((m.body+m.subject).includes(mk))leak.push(mk);}
 for(const [k,s] of [['contact',sh.a],['sync',sh.b]]){const v=s.d[1][s.d[0].indexOf('auto_reply_at')];const n=/^\d{4}-\d\d-\d\dT[\d:.]+Z #([1-5])$/.exec(v);if(!n)rec=false;else seen[k].add(n[1]);}
 if(S.logs.some(l=>/maria|kim|SUBJMARK|MSGMARK|example/i.test(l)))leak.push('LOG');}
ok(shapeOk,'mail keys/name/replyTo, sent outside lock');ok(leak.length===0,'no submitted text in mail or logs',leak);ok(rec,'auto_reply_at = ISO #n');
ok(seen.contact.size===5&&seen.sync.size===5,'random templates 1..5 both sets',{c:[...seen.contact],s:[...seen.sync]});
// first name filter
const names=[['Ana','Hi Ana,'],['José-Luis','Hi José-Luis,'],['http://evil.example','Hi,'],['evil.example','Hi,'],['Win$','Hi,'],['a@b','Hi,'],['Ana123','Hi,'],['Abcdefghijklmnopqrstuvwxy','Hi,'],['\u202Eevil.example','Hi,'],['Ana\u202Elive.com','Hi,']];
for(const [n,g] of names){setup([{first:n}]);ON();tick();const b=S.sent[0]&&S.sent[0].m.body||'';ok(b.split('\n')[0]===g&&!/[\u202A-\u202E\u2066-\u2069\u200B-\u200F]/.test(b),'name '+JSON.stringify(n),b.split('\n')[0]);}
setup([{first:'\u202EAna'}]);ON();tick();{const f=(S.sent[0]||{m:{body:''}}).m.body.split('\n')[0];ok(f==='Hi Ana,'||f==='Hi,','bidi+Ana greets safely',f);}
setup([],[{name:'Kim Lee'}]);ON();tick();ok(S.sent[0].m.body.startsWith('Hi Kim,'),'sync first token');
setup([{first:''}]);ON();tick();ok(S.sent.length===0,'blank first name (required field) -> row invalid, 0 sends');
// aliases
let sh=setup([{email:'v1+a@gmail.com'},{email:'V.1@googlemail.com',ts:ago(40*M)}],[{email:'v1@gmail.com',ts:ago(50*M)}]);ON();tick();
ok(S.sent.length===1,'alias one send',S.sent.map(x=>x.m.to));S.now+=20*M;tick();ok(S.sent.length===1,'alias still one next run');
// skip list
setup([{email:'daniel.vizkaino@gmail.com'},{email:'Daniel.Vizkaino+x@googlemail.com'},{email:'x@danyeloz.info'},{email:'noreply@x.io'},{email:'bounces@x.io'},{email:'postmaster@x.io'}]);ON();tick();
ok(S.sent.length===0,'own/noreply skipped',S.sent.map(x=>x.m.to));
// 30-day rule
sh=setup([{email:'r@x.org',ts:ago(29*DY)},{email:'r@x.org'}]);autoCol(sh.a,[new Date(S.now-29*DY).toISOString()+' #2','']);ON();tick();ok(S.sent.length===0,'30-day: 29d -> 0');
sh=setup([{email:'r@x.org',ts:ago(31*DY)},{email:'r@x.org'}]);autoCol(sh.a,[new Date(S.now-31*DY).toISOString()+' #2','']);ON();tick();ok(S.sent.length===1,'30-day: 31d -> 1');
sh=setup([{email:'r@x.org'}],[{email:'R@X.org',ts:ago(29*DY)}]);autoCol(sh.b,[new Date(S.now-29*DY).toISOString()+' #1']);ON();tick();ok(S.sent.length===0,'30-day across tabs');
// burst
const many=n=>Array.from({length:n},(_,i)=>({email:'u'+i+'@x.org',ts:ago((21+i*3)*M)}));
setup(many(11));ON();tick();tick();
ok(S.sent.length===1&&S.sent[0].m.to==='daniel.vizkaino@gmail.com'&&S.props['IB_AR_PAUSED_'+day],'burst: 0 replies, one notice, paused',S.sent.map(x=>x.m.to));
setup(many(10));ON();tick();ok(S.sent.length===5,'10 rows: no burst, 5 sent',S.sent.length);
// caps
setup(many(8).map(r=>Object.assign(r,{ts:ago(2*H+r.ts.getTime()%1000)})));ON();tick();ok(S.sent.length===5,'max 5 per run');tick();ok(S.sent.length===8,'rest next run');
setup(many(8).map(r=>Object.assign(r,{ts:ago(2*H)})));ON();S.props['IB_AR_COUNT_'+day]='28';tick();ok(S.sent.length===2&&S.props['IB_AR_COUNT_'+day]==='30','cap 30: 2 left');tick();ok(S.sent.length===2,'cap reached: 0');
// quota floor
setup(many(3).map(r=>Object.assign(r,{ts:ago(2*H)})));ON();S.quota=46;tick();ok(S.sent.length===1,'quota 46 -> 1 then stops at 45',S.sent.length);
sh=setup(many(3).map(r=>Object.assign(r,{ts:ago(2*H)})));ON();S.quota=45;tick();ok(S.sent.length===0,'quota 45 -> 0');
sh=setup(many(3).map(r=>Object.assign(r,{ts:ago(2*H)})));ON();S.quota=47;tick();const ac=sh.a.d[0].indexOf('auto_reply_at');
ok(S.sent.length===2&&sh.a.d.slice(1).filter(r=>r[ac]==='').length===1&&S.props['IB_AR_COUNT_'+day]==='2','quota mid-run: undo unclaimed row and count',{n:S.sent.length,c:S.props['IB_AR_COUNT_'+day]});
// overlapping ticks + lock busy
setup(many(3).map(r=>Object.assign(r,{ts:ago(2*H)})));ON();let inner=0;S.onSend=()=>{if(!inner++){tick()}};tick();ok(S.sent.length===3,'overlap: 3 sends total',S.sent.length);
setup([{}]);ON();S.failLock=true;ok(thr(tick)===null&&S.sent.length===0,'lock busy: 0, no throw');
// invalid rows
setup([{topic:'Fan Contact\nX'},{email:'bad@@x',first:'B'},{message:'x'.repeat(4001),email:'c@x.org'}]);ON();tick();ok(S.sent.length===0,'invalid rows 0',S.sent.map(x=>x.m.to));
// trigger user check
setup([{}]);ON();R('ibAutoReplyTick()');ok(S.sent.length===0,'tick without trigger event ignored');
done();
