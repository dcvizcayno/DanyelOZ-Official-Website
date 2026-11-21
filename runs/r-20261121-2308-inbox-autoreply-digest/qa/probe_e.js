// Re-verify 2 (D-12): allow only when owner and effective are non-empty and equal, and active is blank or the owner.
const {fire,S,R,ok,thr,setup,H,done}=require('./probe_h.js');
const pub=['getInboxData()',"setInboxStatus('contact',2,'k','Done')",'previewOldRows()',"deleteOldRows('x',1)",'setAutoReply(true)','setDigest(true)',"sendAutoReplyTest('contact',1)",'installInboxTriggers()','removeInboxTriggers()'];
const OWN='danyel.owner@gmail.com';
const snap=()=>JSON.stringify([S.props,S.trig.length,S.sent.length,S.cal.length]);
// allowed: blank active (real "Execute as Me, Only myself"), and active == owner, in any case
for(const [lbl,a] of [['blank active',''],['active == owner',OWN],['active owner other case',' Danyel.Owner@Gmail.com']]){
 setup([{}]);S.ownerFn=null;S.owner=OWN;S.effective=OWN;S.active=a;
 for(const c of pub){const m=thr(()=>R(c));ok(!/Not allowed/.test(m||''),lbl+' allowed '+c,m);}}
setup([{}]);S.owner=OWN;S.effective=OWN;S.active='';R('setAutoReply(true)');ok(S.props.IB_AUTO_REPLY==='on','blank-active owner can switch on');
ok(R("sendAutoReplyTest('sync',2)").to==='daniel.vizkaino@gmail.com'&&S.sent.length===1,'blank-active owner test send to Daniel only');
// refused, with the right message and nothing written
const MO=/^Not allowed: the Song Database owner could not be read/,ME=/^Not allowed: the admin app must be deployed as Execute as: Me$/,MA=/^Not allowed: you are signed in as a different Google account than the Song Database owner$/;
const cases=[
 ['helper mode (active==effective==helper)',{owner:OWN,effective:'helper@gmail.com',active:'helper@gmail.com'},ME],
 ['helper mode, blank active',{owner:OWN,effective:'helper@gmail.com',active:''},ME],
 ['different signed-in account',{owner:OWN,effective:OWN,active:'other@gmail.com'},MA],
 ['blank effective',{owner:OWN,effective:'',active:''},ME],
 ['blank effective, active owner',{owner:OWN,effective:'',active:OWN},ME],
 ['blank owner',{owner:'',effective:OWN,active:''},MO],
 ['null owner (Shared Drive)',{owner:null,effective:OWN,active:OWN},MO],
 ['owner throws',{throws:true,effective:OWN,active:''},MO],
 ['daniel address, not owner',{owner:OWN,effective:'daniel.vizkaino@gmail.com',active:'daniel.vizkaino@gmail.com'},ME]];
for(const [lbl,c,re] of cases){setup([{}]);S.trig=[{getHandlerFunction:()=>'fsOnFormSubmit',getUniqueId:()=>'1'}];
 S.owner=c.owner;S.ownerFn=c.throws?()=>{throw new Error('x')}:null;S.effective=c.effective;S.active=c.active;const b=snap();
 for(const f of pub){const m=thr(()=>R(f))||'';ok(re.test(m)&&!/@/.test(m),lbl+' '+f,m);}
 ok(snap()===b,lbl+': nothing written');}
S.ownerFn=null;S.owner=S.effective=OWN;S.active='';
// NF-02 unchanged
setup([{}]);S.trig=[];R('installInboxTriggers()');S.props.IB_AUTO_REPLY='on';S.props.IB_AR_ON_SINCE=String(S.now-100*H);S.props.IB_DIGEST='on';
const b=snap();R('ibAutoReplyTick()');R('ibDailyDigest({})');R("ibAutoReplyTick({triggerUid:'999'})");
R('ibDailyDigest('+JSON.stringify({triggerUid:S.trig.find(t=>t.getHandlerFunction()==='ibAutoReplyTick').getUniqueId()})+')');
ok(snap()===b,'NF-02: no event, {}, guessed uid, other handler uid -> nothing');
fire('ibAutoReplyTick');fire('ibDailyDigest');ok(S.sent.length===1&&S.cal.length===1,'NF-02: real trigger events still run');
done();
