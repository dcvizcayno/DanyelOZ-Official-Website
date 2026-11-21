// 9 am digest.
const {fire,S,R,ok,thr,setup,ago,M,H,DY,done}=require('./probe_h.js');
const run=()=>fire('ibDailyDigest');
S.now=Date.parse('2026-11-22T01:05:00Z');   // 09:05 Manila
const mkSongs=()=>[{song_title:'Soon Song',release_date:'2026-11-25'},{song_title:'Edge Song',release_date:'2026-11-29'},{song_title:'Late Song',release_date:'2026-11-30'},{song_title:'Past Song',release_date:'2026-11-20'},{song_title:'Today Song',release_date:'2026-11-22'}];
let sh=setup([{first:'Ana',ts:ago(3*DY)},{first:'http://evil.example',email:'e@x.org'},{first:'Done',email:'d@x.org'}],[{ts:ago(26*H)}]);
sh.a.d[0].push('status');sh.a.d[1].push('');sh.a.d[2].push('New');sh.a.d[3].push('Done');
S.songs=mkSongs();run();ok(S.cal.length===0,'digest off: 0 events');
S.props.IB_DIGEST='on';run();
ok(S.cal.length===1,'one event',S.cal.length);const ev=S.cal[0]||{o:{}};
ok(ev.t==='To-do: 3 messages, 3 releases','title counts',ev.t);
ok(ev.s&&ev.s.toISOString()==='2026-11-22T01:00:00.000Z'&&ev.e-ev.s===15*M,'09:00-09:15 Manila',ev.s&&ev.s.toISOString());
ok(ev.vis==='PRIVATE','private');ok(Object.keys(ev.o).join()==='description'&&ev.extra===4,'no guests/invites/location',Object.keys(ev.o));
const de=ev.o.description||'';
ok(!/@|http|www\.|SUBJMARK|MSGMARK|Santos|COMPMARK|SONGMARK|PROJMARK|Lee|maria|kim@/i.test(de),'no email/text/link in description',de);
ok(/Contact, Ana, Fan Contact, 3 days old/.test(de)&&/Sync request, Kim, 1 day old/.test(de)&&/no name/.test(de)&&!/Done/.test(de.split('Releases')[0]),'lines',de);
ok(/Soon Song/.test(de)&&/Edge Song/.test(de)&&/Today Song/.test(de)&&!/Late Song|Past Song/.test(de),'releases next 7 days');
run();ok(S.cal.length===1,'second run same day: still 1');
delete S.props['IB_DIGEST_DONE_2026-11-22'];run();ok(S.cal.length===1,'property gone but tagged event: still 1');
S.now+=DY;run();ok(S.cal.length===2,'next day: new event');
// empty
setup([],[]);S.props.IB_DIGEST='on';S.songs=[];run();ok(S.cal.length===0,'nothing open: no event');
sh=setup([{}]);sh.a.d[0].push('status');sh.a.d[1].push('Replied');S.props.IB_DIGEST='on';run();ok(S.cal.length===0,'only replied rows: no event');
// releases only
setup([],[]);S.props.IB_DIGEST='on';S.songs=[{song_title:'Soon Song',release_date:'2026-11-25'}];run();ok(S.cal.length===1&&S.cal[0].t==='To-do: 1 release','releases only',S.cal[0]&&S.cal[0].t);
// Manila day boundary: 17:30Z = 01:30 Manila next day
S.now=Date.parse('2026-11-22T17:30:00Z');setup([{ts:new Date(S.now-2*H)}]);S.props.IB_DIGEST='on';run();
ok(S.cal[0]&&S.cal[0].s.toISOString()==='2026-11-23T01:00:00.000Z','Manila day used',S.cal[0]&&S.cal[0].s.toISOString());
// stranger and lock
setup([{}]);S.props.IB_DIGEST='on';R('ibDailyDigest()');ok(S.cal.length===0,'digest without trigger event: none');
S.failLock=true;ok(thr(run)===null&&S.cal.length===0,'lock busy: no throw, none');
// >20 lines
setup(Array.from({length:23},(_,i)=>({email:'z'+i+'@x.org',ts:ago((i+1)*H)})));S.props.IB_DIGEST='on';S.failLock=false;run();
ok(/\+3 more/.test(S.cal[0].o.description),'cap 20 lines');
done();
