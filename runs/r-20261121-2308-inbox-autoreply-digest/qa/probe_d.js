// Re-verify 1: NF-01 owner = Song Database owner, NF-02 handlers only from their own trigger event.
const {fire,S,R,ok,thr,setup,ago,M,H,DY,done}=require('./probe_h.js');
const pub=['getInboxData()',"setInboxStatus('contact',2,'k','Done')",'previewOldRows()',"deleteOldRows('x',1)",'setAutoReply(true)','setDigest(true)',"sendAutoReplyTest('contact',1)",'installInboxTriggers()','removeInboxTriggers()'];
const nothing=(lbl,f)=>{const p=JSON.stringify(S.props),t=S.trig.length,sd=S.sent.length,c=S.cal.length;f();ok(JSON.stringify(S.props)===p&&S.trig.length===t&&S.sent.length===sd&&S.cal.length===c,lbl+': nothing written');};
// owner model
setup([{}]);S.owner='someone.else@gmail.com';S.active='someone.else@gmail.com';S.effective='someone.else@gmail.com';
ok(thr(()=>R('getInboxData()'))===null,'owner not daniel.vizkaino allowed');
S.active='Someone.Else@Gmail.com ';ok(thr(()=>R('getInboxData()'))===null,'owner match ignores case/space');
S.owner='daniel.vizkaino@gmail.com';S.active='daniel.vizkaino@gmail.com';S.effective='daniel.vizkaino@gmail.com';ok(thr(()=>R('setDigest(false)'))===null,'daniel as owner allowed');
const deny=[['helper mode',()=>{S.owner='me.owner@gmail.com';S.active='helper@gmail.com';S.effective='helper@gmail.com'}],
 ['helper, effective=owner',()=>{S.owner='me.owner@gmail.com';S.active='helper@gmail.com';S.effective='me.owner@gmail.com'}],
 ['blank effective',()=>{S.owner='me.owner@gmail.com';S.active='';S.effective=''}],
 ['owner unknown (null)',()=>{S.owner='';S.active='me.owner@gmail.com'}],
 ['getOwner throws',()=>{S.ownerFn=()=>{throw new Error('no')};S.active='me.owner@gmail.com'}],
 ['daniel address but not owner',()=>{S.ownerFn=null;S.owner='me.owner@gmail.com';S.active='daniel.vizkaino@gmail.com';S.effective='daniel.vizkaino@gmail.com'}]];
for(const [lbl,set] of deny){setup([{}]);set();for(const c of pub)ok(/Not allowed/.test(thr(()=>R(c))||''),lbl+' refused '+c);nothing(lbl,()=>pub.forEach(c=>thr(()=>R(c))));}
S.ownerFn=null;S.owner=S.active=S.effective='me.owner@gmail.com';
// handlers
const onAR=()=>{S.props.IB_AUTO_REPLY='on';S.props.IB_AR_ON_SINCE=String(S.now-100*H);S.props.IB_DIGEST='on'};
S.trig=[];setup([{}]);onAR();R('installInboxTriggers()');
const uid=f=>S.trig.find(t=>t.getHandlerFunction()===f).getUniqueId();
S.trig.push({getHandlerFunction:()=>'fsOnFormSubmit',getUniqueId:()=>'4242'});
const bad=[['no event','()'],['undefined','(undefined)'],['empty object','({})'],['blank uid',"({triggerUid:''})"],['null uid','({triggerUid:null})'],['string event',"('x')"],
 ['guessed uid',"({triggerUid:'123456789'})"],['form trigger uid',"({triggerUid:'4242'})"]];
for(const [lbl,arg] of bad){nothing('tick '+lbl,()=>R('ibAutoReplyTick'+arg));nothing('digest '+lbl,()=>R('ibDailyDigest'+arg));}
nothing('tick with digest uid',()=>R('ibAutoReplyTick('+JSON.stringify({triggerUid:uid('ibDailyDigest')})+')'));
nothing('digest with tick uid',()=>R('ibDailyDigest('+JSON.stringify({triggerUid:uid('ibAutoReplyTick')})+')'));
// D-1 repro: page-style call with blank active user
S.active='';nothing('D-1 blank user, no event (tick)',()=>R('ibAutoReplyTick()'));nothing('D-1 blank user, no event (digest)',()=>R('ibDailyDigest()'));
// real trigger events still work, also as number and with a blank active user (real trigger runs)
R('ibAutoReplyTick('+JSON.stringify({triggerUid:uid('ibAutoReplyTick'),authMode:'FULL'})+')');ok(S.sent.length===1,'real tick event sends',S.sent.length);
R('ibDailyDigest({triggerUid:'+Number(uid('ibDailyDigest'))+'})');ok(S.cal.length===1,'real digest event (numeric uid) creates event');
// stale uid after remove
S.active='me.owner@gmail.com';const old=uid('ibAutoReplyTick');R('removeInboxTriggers()');setup([{email:'z@x.org'}]);onAR();
nothing('stale uid after remove',()=>R('ibAutoReplyTick('+JSON.stringify({triggerUid:old})+')'));
done();
