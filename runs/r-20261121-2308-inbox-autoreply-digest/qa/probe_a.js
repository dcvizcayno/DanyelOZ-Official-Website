// Screen API: shape, status/row identity, delete, owner check, triggers.
const {S,R,ok,thr,setup,ago,M,H,DY,done}=require('./probe_h.js');
let sh=setup([{first:'Ana',ts:ago(2*H)},{first:'Old',ts:ago(400*DY),email:'old@x.org'}],[{ts:ago(1*H)}]);
let d=R('getInboxData()');
const keys='type,row,rowKey,date,firstName,name,email,emailOk,topic,subject,songs,company,project,media,territory,term,timeline,budget,message,notes,status,autoReplyAt,autoReplyTemplate'.split(',');
ok(d.items.length===3,'3 items',d.items.length);
ok(keys.every(k=>k in d.items[0]),'item keys',Object.keys(d.items[0]));
ok(d.items[0].type==='sync'&&d.items[2].firstName==='Old','newest first',d.items.map(i=>i.type+i.firstName));
ok(d.oldCount===1,'oldCount 1',d.oldCount);
ok(['autoReply','digest','capPerDay','sentToday','paused'].every(k=>k in d.settings)&&d.settings.autoReply===false&&d.settings.digest===false,'settings default off',d.settings);
ok(d.templates.contact.length===5&&d.templates.sync.length===5&&d.templates.contact[0].subject&&d.templates.sync[4].body,'templates 5+5');
ok('autoReply' in d.triggers&&'digest' in d.triggers,'triggers',d.triggers);
// status with row identity
const it=d.items.find(i=>i.firstName==='Ana');
ok(thr(()=>R(`setInboxStatus('contact',${it.row},${JSON.stringify(it.rowKey)},'Done')`))===null,'status Done ok');
ok(sh.a.d[it.row-1][CHI('status')]==='Done','Done written by header');
function CHI(n){return sh.a.d[0].indexOf(n)}
ok(/List changed/.test(thr(()=>R(`setInboxStatus('contact',${it.row},'2020-01-01T00:00:00.000Z|maria@example.org','Replied')`))||''),'stale key refused');
ok(thr(()=>R(`setInboxStatus('contact',${it.row},${JSON.stringify(it.rowKey)},'=HYPERLINK("x")')`))!==null,'bad status refused');
ok(thr(()=>R(`setInboxStatus('evil',2,'k','Done')`))!==null,'bad type refused');
// row shift: delete row 2 then write old row number
const old=d.items.find(i=>i.firstName==='Old');sh.a.deleteRow(2);
ok(/List changed/.test(thr(()=>R(`setInboxStatus('contact',${old.row},${JSON.stringify(old.rowKey)},'Done')`))||''),'shifted row refused');
// delete two-step
sh=setup([{first:'A',ts:ago(366*DY),email:'a@x.org'},{first:'B',ts:ago(364*DY),email:'b@x.org'},{first:'C',ts:'abc',email:'c@x.org'}],[{ts:ago(500*DY)}]);
let pv=R('previewOldRows()');ok(pv.count===2&&pv.token,'preview count 2',pv);
sh.a.d.push(['x'].length&&[ago(700*DY),'D','Z','d@x.org','Fan Contact','s','m']);
ok(/changed/.test(thr(()=>R(`deleteOldRows(${JSON.stringify(pv.token)},2)`))||''),'count changed refused');
ok(sh.a.d.length===5&&sh.b.d.length===2,'nothing deleted after refusal');
pv=R('previewOldRows()');let res=R(`deleteOldRows(${JSON.stringify(pv.token)},${pv.count})`);
ok(res.deleted===3&&sh.a.d.length===3&&sh.a.d[0][0]==='Timestamp'&&sh.b.d.length===1,'deleted 3, header kept, 364d+abc kept',{res,a:sh.a.d.map(r=>r[1])});
ok(thr(()=>R(`deleteOldRows('nonsense',1)`))!==null,'bad token refused');
S.now+=20*M;ok(thr(()=>R(`deleteOldRows(${JSON.stringify(pv.token)},0)`))!==null,'expired/zero refused');
// song db guard
setup([{ts:ago(400*DY)}],[],{FS_INBOX_SHEET_ID:'SONGDB1'});ok(/Song Database/.test(thr(()=>R('previewOldRows()'))||''),'inbox==songdb refused');
// owner check
setup([{}]);const pub=['getInboxData()',"setInboxStatus('contact',2,'k','Done')",'previewOldRows()',"deleteOldRows('x',1)",'setAutoReply(true)','setDigest(true)',"sendAutoReplyTest('contact',1)",'installInboxTriggers()','removeInboxTriggers()'];
S.active='me.owner@gmail.com';S.effective='me.owner@gmail.com';ok(thr(()=>R('getInboxData()'))===null,'owner (not daniel addr) allowed');
for(const [a,e,lbl] of [['stranger@gmail.com','me.owner@gmail.com','stranger'],['me.owner@gmail.com','stranger@gmail.com','effective not owner'],['','','both blank'],['helper@gmail.com','helper@gmail.com','helper mode (active==effective==helper)']]){
 S.active=a;S.effective=e;const before=JSON.stringify(S.props),tn=S.trig.length;
 for(const c of pub)ok(/Not allowed/.test(thr(()=>R(c))||''),lbl+' refused '+c);
 ok(JSON.stringify(S.props)===before&&S.trig.length===tn&&S.sent.length===0,lbl+' wrote nothing');}
S.active=S.effective='me.owner@gmail.com';
// triggers
S.trig=[];const mk=fn=>({getHandlerFunction:()=>fn,cfg:{fn}});S.trig.push(mk('fsOnFormSubmit'),mk('tkAutoPostTick'),mk('ibAutoReplyTick'),mk('ibAutoReplyTick'),mk('ibDailyDigest'));
let tc=R('installInboxTriggers()');tc=R('installInboxTriggers()');
const cnt=f=>S.trig.filter(t=>t.getHandlerFunction()===f).length;
ok(cnt('ibAutoReplyTick')===1&&cnt('ibDailyDigest')===1&&cnt('fsOnFormSubmit')===1&&cnt('tkAutoPostTick')===1&&S.trig.length===4,'install idempotent',S.trig.map(t=>t.cfg));
const dg=S.trig.find(t=>t.getHandlerFunction()==='ibDailyDigest').cfg.parts.join(','),tk=S.trig.find(t=>t.getHandlerFunction()==='ibAutoReplyTick').cfg.parts.join(',');
ok(dg==='time,h9,d1,Asia/Manila'&&tk==='time,min10','trigger config',{dg,tk});
ok(tc.autoReply===1&&tc.digest===1,'counts returned');
R('removeInboxTriggers()');R('removeInboxTriggers()');ok(S.trig.length===2&&cnt('fsOnFormSubmit')===1,'remove only ib',S.trig.map(t=>t.getHandlerFunction()));
// switches
setup([{}]);let st=R('setAutoReply(true)');const since=S.props.IB_AR_ON_SINCE;S.now+=M;R('setAutoReply(true)');
ok(st.autoReply&&S.props.IB_AR_ON_SINCE===since,'on twice keeps since');R('setAutoReply(false)');ok(S.props.IB_AUTO_REPLY==='off','off');
// test send
S.sent=[];for(let i=0;i<5;i++)R(`sendAutoReplyTest('sync',${1+i})`);
ok(S.sent.length===5&&S.sent.every(x=>x.m.to==='daniel.vizkaino@gmail.com'),'tests to daniel');
ok(thr(()=>R(`sendAutoReplyTest('sync',1)`))!==null&&S.sent.length===5,'6th test refused');
setup([{}]);S.quota=45;ok(thr(()=>R(`sendAutoReplyTest('contact',1)`))!==null&&S.sent.length===0,'test obeys floor');
done();
