
window.__mk=(function(){var lines=[],t=6;for(var i=0;i<34;i++){lines.push({s:t,e:t+4.2,t:'[Lyric line '+(i+1)+']'});t+=4.2+(i%4===3?2.4:0.6);}
var M={bounds:[0,9,18,27],lines:lines,dur:t+5};
M.view=function(st){var v={series_id:'SER1',song_title:'Carmen',source_name:'Carmen lyric video 9x16.mp4',status:st,message:st==='Planning'?'Listening for the lyrics':'',created_at:'2026-11-12T05:40',run_url:'',parts:[],max:59,endcard:true,lines:M.lines,duration:M.dur,effective_max:57,bounds:M.bounds};
 if(st==='Ready'){v.parts=[1,2,3].map(function(k){return {short_id:'S'+k,part:k+'/3',scheduled_date:'2026-11-1'+(2+k),scheduled_time:'19:00',yt:true,tt:true,ig:false,yt_video_id:'',status:'Scheduled',drive_file_id:'CLIP'+k,yt_title:'Carmen · Part '+k+' of 3 #Shorts',tt_caption:'Part '+k+' of 3. She danced like the floor owed her money.'+(k<3?' Part '+(k+1)+' tomorrow.':' Full song: danyeloz.info'),tt_tags:'#DanyelOZ #Carmen',ig_caption:'Carmen, Part '+k+' of 3.',ig_tags:'#DanyelOZ'};});}
 return v;};
M.data=function(){return {songs:[{song_id:'111',song_title:'Carmen',release_date:'2026-10-26',release_type:'Single',hasStory:true,hasBandcamp:true,hasVideo:true,cover:''},{song_id:'222',song_title:'Aubrey',release_date:'2026-09-28',release_type:'Single',hasStory:false,hasBandcamp:false,hasVideo:false,cover:''}],
 videos:[{id:'V2',name:'aubrey final.mp4',sizeMb:120},{id:'V1',name:'Carmen lyric video 9x16.mp4',sizeMb:182}],
 series:M.list||[],repo:'dcvizcayno/DanyelOZ-Official-Website',hasToken:true,youtube:true,folderUrl:'https://drive.google.com/drive/folders/F'};};
return M;})();
(function(){
var desc='The word Onsra is from the Boro language. It means loving someone while already knowing it won’t last.\n\nI learned it on a trip to India in 2010. This song is what that word felt like.';
var songs=[
 {row:2,song_id:'6799528628',song_title:'Onsra (Kareena)',release_date:'2026-11-09',release_type:'Single',song_genre:'Pop, Alt R&B',song_theme_1:'HEARTBREAK',song_theme_2:'',song_description:desc,song_ISRC:'QZES82600001',song_qr:'',song_upc:'',record_label:'Danyel OZ',yt_video_link:'',spotify_link:'https://open.spotify.com/track/1',appl_music_link:'https://music.apple.com/x',amazon_link:'',bandcamp_embed:'<iframe src="https://bandcamp.com/EmbeddedPlayer/album=1/"></iframe>',song_arts:''},
 {row:3,song_id:'111',song_title:'Carmen',release_date:'2026-10-26',release_type:'Single',song_genre:'Alternative Pop',song_description:'',song_ISRC:'',song_qr:'',song_upc:'',record_label:'',yt_video_link:'',spotify_link:'',appl_music_link:'',amazon_link:'',bandcamp_embed:'<iframe src="https://bandcamp.com/EmbeddedPlayer/album=2/"></iframe>',song_arts:''},
 {row:4,song_id:'222',song_title:'Ursula',release_date:'2026-10-12',release_type:'EP',song_genre:'Pop',song_description:'A porch light left on.',song_ISRC:'QZES82600003',song_qr:'x',song_upc:'123456789012',record_label:'Danyel OZ',yt_video_link:'https://youtu.be/abcdefghijk',spotify_link:'https://open.spotify.com/track/3',appl_music_link:'https://music.apple.com/y',amazon_link:'https://music.amazon.com/z',bandcamp_embed:'<iframe src="https://bandcamp.com/EmbeddedPlayer/album=3/"></iframe>',song_arts:'https://drive.google.com/file/d/A/view'}];
var themes=[{theme:'HOPE AND DREAMS',tagline:'for the ones still believing',visible:true},{theme:'HEARTBREAK',tagline:'when it ends anyway',visible:true}];
var cols=['song_theme_1','song_theme_2','song_id','song_title','release_date','release_type','song_genre','song_description','song_ISRC','song_qr','song_upc','record_label','yt_video_link','spotify_link','appl_music_link','amazon_link','bandcamp_embed','song_arts'];
function mk(id,title,file,date,status,extra){return Object.assign({short_id:id,song_id:'',song_title:title,drive_file_id:'F'+id,file_name:file,size_mb:'38.2',scheduled_date:date,scheduled_time:date?'19:30':'',yt:true,tt:true,ig:false,status:status,angle:'story',
 yt_title:'Onsra: loving someone you already know you will lose #Shorts',yt_description:'The word Onsra is from the Boro language. It means loving someone while already knowing it won’t last.\n\nFull song on Bandcamp: https://danyeloz.bandcamp.com/album/onsra-kareena',
 yt_tags:'#Shorts #DanyelOZ #Onsra #AltPop #RnB #LoveSong',tt_caption:'POV: you love someone and you already know how it ends',tt_tags:'#DanyelOZ #Onsra #LoveSong #NewMusic',ig_caption:'A word for a feeling.\n\nFull song: link in bio (danyeloz.info)',ig_tags:'#DanyelOZ #Onsra #IndieMusic',yt_video_id:'',created_at:'2026-11-09T12:00',updated_at:''},extra||{});}
var shorts=[mk('S1','Carmen','carmen_hook.mp4','2026-11-10','Scheduled'),mk('S2','Onsra (Kareena)','onsra_hook_v2.mp4','2026-11-12','Draft',{song_id:'6799528628'}),mk('S3','Ursula','ursula_porch_light.mp4','2026-11-16','Ready to post',{ig:true}),mk('S4','Aubrey','aubrey_notes.mp4','2026-11-04','Uploaded (private)',{yt_video_id:'YT1'})];
window.__calls=[];
window.__tk=(function(){var T={today:'2026-11-13',
 songs:[{title:'Today',date:'2024-01-05',type:'Single',upc:'111111111111',isrc:'QZRP42414262'},{title:'Goodbye Album',date:'2024-06-01',type:'Album',upc:'222222222222',isrc:''},{title:'My Girl',date:'2024-03-01',type:'Single',upc:'333333333333',isrc:'QZK6L2424380'},{title:'No List Yet',date:'2025-01-01',type:'Single',upc:'444444444444',isrc:'QZAAA2500001'},{title:'Kareena',date:'2026-12-14',type:'EP',upc:'555555555555',isrc:''}],
 tracks:[{isrc:'QZRP42414262',track_title:'Today',artist:'Danyel OZ',duration:'3:02',explicit:false,first_release:'2024-01-05',first_upc:'111111111111',releases:2,language:'',has_lyrics:false,has_abc:false},{isrc:'QZK6L2424380',track_title:'My Girl',artist:'Danyel OZ',duration:'3:10',explicit:false,first_release:'2024-03-01',first_upc:'333333333333',releases:2,language:'English',has_lyrics:true,has_abc:true},{isrc:'QZXX52600001',track_title:'Dahlia',artist:'Danyel OZ',duration:'3:20',explicit:false,first_release:'2026-12-07',first_upc:'555555555555',releases:1,language:'',has_lyrics:false,has_abc:false}],
 rts:[{upc:'111111111111',release_title:'Today',disc:1,track_number:1,isrc:'QZRP42414262',track_title:'Today',duration:'3:02',bonus:false},{upc:'222222222222',release_title:'Goodbye Album',disc:1,track_number:1,isrc:'QZRP42414262',track_title:'Goodbye',duration:'6:00',bonus:false},{upc:'222222222222',release_title:'Goodbye Album',disc:1,track_number:2,isrc:'QZK6L2424380',track_title:'My Girl',duration:'3:10',bonus:true},{upc:'333333333333',release_title:'My Girl',disc:1,track_number:1,isrc:'QZK6L2424380',track_title:'My Girl',duration:'3:11',bonus:false},{upc:'555555555555',release_title:'Kareena',disc:1,track_number:1,isrc:'QZXX52600001',track_title:'Dahlia',duration:'3:20',bonus:false}],
 fixes:{},drafts:{QZK6L2424380:true},checks:{reuse:[{isrc:'QZRP42414262',issue:'different song names; lengths differ by 178 s'}],noTracklist:[{upc:'444444444444',title:'No List Yet',date:'2025-01-01'}],noUpc:[{title:'Bleeding Heart',date:'2027-04-30'}],badCodes:[],singleMismatch:[],noLyrics:1},
 statuses:['To check','Keep as is','Republish planned','Sent to DistroKid','Republished'],plans:['','New ISRC','New UPC','New ISRC and UPC','Fix the title only'],artists:['Danyel OZ','M4RCU$ H33R0']};
 T.detail=function(isrc){var t=T.tracks.filter(function(x){return x.isrc===isrc;})[0];return {track:Object.assign({},t,{lyrics:t.has_lyrics?'Verse one line\nVerse two line\n\nChorus line':'',abc:t.has_abc?'X:1\nT:My Girl\nM:4/4\nL:1/8\nK:G\n|:GABc dedB|dedB dedB:|':''}),released:t.first_release<=T.today,notes:isrc==='QZK6L2424380'?{bpm:'92',key:'G major',time_signature:'4/4',chords:'G C D G',draft_lyrics:'Verse one line (new)\n',draft_abc:'',notes:''}:null,fix:null,on:T.rts.filter(function(r){return r.isrc===isrc;}).map(function(r){return Object.assign({date:'2024-01-05',type:'Single'},r);})};};
 return T;})();
var H={
 getTracksAdmin:function(){return JSON.parse(JSON.stringify(window.__tk));},
 getTrackDetail:function(i){return window.__tk.detail(i);},
 saveTrackInfo:function(i,d){window.__tkInfo=d;return {ok:true};},
 saveTrackNotes:function(i,d){window.__tkNotes=d;return {ok:true};},
 publishTrackText:function(i,d){if(i==='QZXX52600001')throw new Error("This song isn't out yet (2026-12-07). Keep it as a draft until release day.");window.__tkPub=d;return {ok:true};},
 saveTrackFix:function(i,d){window.__tkFix=[i,d];return {ok:true};},
 saveReleaseTracklist:function(u,l){window.__tkTl=[u,l];return {ok:true,added:0,count:l.length};},
 getMakerData:function(){return window.__mk.data();},
 planSeries:function(d){window.__plan=d;return window.__mk.view('Planning');},
 getSeries:function(id){window.__gets=(window.__gets||0)+1;return window.__mk.view(window.__mk.next||'Planned');},
 saveSeriesBounds:function(id,b){window.__mk.bounds=b;return window.__mk.view('Planned');},
 replanSeries:function(id,m){return window.__mk.view('Planning');},
 cutSeries:function(id,o){window.__cut=o;return window.__mk.view('Cutting');},
 deleteSeries:function(id){return {removed:id};},
 uploadShortToYouTube:function(id){return {studio:'https://studio.youtube.com/video/X/edit'};},

 getAlbumsAdmin:function(page){window.__page=page;if(page==='ep'){return {page:'ep',library:[
  {song_id:'e1',song_title:'The Search',release_date:'2026-09-18',type:'EP',bandcamp:true,story:true,cover:'',kind:'ep',part_of:'',show:true,collection:'',position:0,accent:'',hook:'',tracks:'4',bonus:'',store_url:'',featured:false},
  {song_id:'e2',song_title:'Mixed Signals',release_date:'2025-09-08',type:'EP',bandcamp:false,story:false,cover:'',kind:'unsorted',part_of:'',show:false,collection:'',position:0,accent:'',hook:'',tracks:'',bonus:'',store_url:'',featured:false},
  {song_id:'e3',song_title:'Kareena',release_date:'2026-12-14',type:'EP',bandcamp:true,story:true,cover:'',kind:'unsorted',part_of:'',show:false,collection:'',position:0,accent:'',hook:'',tracks:'',bonus:'',store_url:'',featured:false}],
  collections:[],kinds:['unsorted','ep','installment','single'],mainAlbums:["She's A Puzzle",'Midnight Struggles'],maxCollections:8};}
 var L=[
  {song_id:'a1',song_title:"She's A Puzzle",release_date:'2025-03-01',bandcamp:true,story:true,cover:'',kind:'main',part_of:'',show:true,collection:'Heartbreak, Reflection & Closure',position:1,accent:'#EBB531',hook:'',tracks:'17',bonus:'5',store_url:'',featured:true},
  {song_id:'a2',song_title:'LOVEROO',release_date:'2023-02-01',bandcamp:true,story:true,cover:'',kind:'main',part_of:'',show:true,collection:'Love, Romance & Relationships',position:1,accent:'#3ED2DE',hook:'',tracks:'14',bonus:'',store_url:'',featured:false},
  {song_id:'a3',song_title:'Puzzle Piece 1',release_date:'2024-12-01',bandcamp:false,story:false,cover:'',kind:'installment',part_of:'',show:false,collection:'',position:0,accent:'',hook:'',tracks:'',bonus:'',store_url:'',featured:false},
  {song_id:'a4',song_title:'Better Off Without You',release_date:'2026-12-01',bandcamp:false,story:false,cover:'',kind:'unsorted',part_of:'',show:false,collection:'',position:0,accent:'',hook:'',tracks:'',bonus:'',store_url:'',featured:false},
  {song_id:'a5',song_title:'Really A Single',release_date:'2024-01-01',bandcamp:false,story:false,cover:'',kind:'unsorted',part_of:'',show:false,collection:'',position:0,accent:'',hook:'',tracks:'',bonus:'',store_url:'',featured:false}];
  return {library:L,collections:[{name:'Love, Romance & Relationships',tagline:'',alias:'',visible:true},{name:'Heartbreak, Reflection & Closure',tagline:'',alias:'',visible:true},{name:'Marcus Heero Collections',tagline:'',alias:'Marcus Heero',visible:true}],kinds:['unsorted','main','installment','ep','single'],maxCollections:8};},
 saveAlbumLibrary:function(l,pg){window.__lib=l;window.__libPage=pg;return {saved:l.length};},
 saveAlbumDetails:function(d){window.__det=d;return {saved:true};},
 saveAlbumOrder:function(o){window.__ord=o;return {saved:1};},
 setFeaturedAlbum:function(k,pg){window.__feat=k;window.__featPage=pg;return {featured:k?k.song_title:'auto'};},
 saveAlbumCollections:function(l,pg){window.__cols=l;window.__colsPage=pg;return {saved:l.length,albumsMoved:0};},

 getThemeNames:function(){return {names:themes.map(function(t){return t.theme;}),columns:true};},
 getSinglesAdmin:function(){return {featured:[{song_id:'6799528628',song_title:'Onsra (Kareena)',found:true,bandcamp:true},{song_id:'222',song_title:'Ursula',found:true,bandcamp:true},{song_id:'',song_title:'Old Song',found:false,bandcamp:false}],themes:themes.map(function(t){return Object.assign({count:1},t);}),themeColumns:true,songs:songs.map(function(s){return {row:s.row,song_id:s.song_id,song_title:s.song_title,release_date:s.release_date,release_type:s.release_type,bandcamp:/EmbeddedPlayer/.test(s.bandcamp_embed),story:!!s.song_description,theme1:s.song_theme_1||'',theme2:s.song_theme_2||''};}),max:{featured:10,themes:5,name:32,tagline:80}};},
 saveFeatured:function(l){window.__saved=l;return {saved:l.length};},
 saveThemes:function(l){window.__themes=l;return {saved:l.filter(function(t){return t.theme;}).length,songsUpdated:1};},
 saveSongThemes:function(l){window.__st=l;return {saved:l.length};},
 getSongs:function(){return {columns:cols,songs:JSON.parse(JSON.stringify(songs))};},
 saveSong:function(d){return {row:d.row,isNew:false};},
 getShortsList:function(){return shorts;},
 getShortsData:function(){return {shorts:JSON.parse(JSON.stringify(shorts)),songs:songs.map(function(s){return {song_id:s.song_id,song_title:s.song_title,release_date:s.release_date,release_type:s.release_type,song_genre:s.song_genre,hasStory:!!s.song_description,hasBandcamp:true};}),
   angles:{story:'Story behind the song',vocal:'Late-night vocal take',acoustic:'Acoustic breakdown',hook:'Chorus hook'},statuses:['Draft','Scheduled','Ready to post','Uploaded (private)','Published'],ai:false,youtube:true,sheetUrl:'https://docs.google.com/spreadsheets/d/B',folderUrl:'https://drive.google.com/drive/folders/F',uploadLimitMb:30,youtubeLimitMb:50};},
 listShortFiles:function(){return [{id:'V9',name:'onsra_chorus_live.mp4',sizeMb:22.4},{id:'FS2',name:'onsra_hook_v2.mp4',sizeMb:38.2}];},
 addShort:function(d){var s=mk('S9',songs.find(function(x){return x.song_id===d.song_id;}).song_title,'onsra_chorus_live.mp4',d.scheduled_date,d.scheduled_date?'Scheduled':'Draft');shorts.push(s);return {short:s,warning:'',source:'template'};},
 saveShort:function(d){var s=shorts.find(function(x){return x.short_id===d.short_id;});Object.assign(s,d);return JSON.parse(JSON.stringify(s));},
 generateCaptions:function(id){var s=shorts.find(function(x){return x.short_id===id;});s.tt_caption='Late night, one mic, Onsra.';return {short:JSON.parse(JSON.stringify(s)),warning:'',source:'template'};},
 applyBatch:function(ids){return {scheduled:ids.length,skipped:0};},
 getXData:function(){return {connected:true,repo:'dcvizcayno/danyeloz-embeds',error:'',drafts:1,workflow:'active',report:'https://github.com/x/issues/5',minSamples:3,exploreRate:0.2,
   draft:{number:2,url:'https://github.com/dcvizcayno/danyeloz-embeds/issues/2',title:'X draft: NOTE TO SELF',created:'2026-11-05T11:07:00Z',song:'NOTE TO SELF',hook:'question',link:'bandcamp',version:1,text:'Ever held on to something long after it was over? "NOTE TO SELF" lives in that space.\n\nhttps://danyeloz.bandcamp.com/track/note-to-self',length:110,testMode:true},
   rotation:{eligible:50,postedThisRound:0,noStory:['Carmen','Dahlia','Ivy','June','Mara','Nina','Opal','Pia','Rue','Sia','Tess','Vera'],notYet:[{title:'Carmen',hasStory:false},{title:'The Realization',hasStory:true},{title:'Aubrey',hasStory:true},{title:'The Search',hasStory:true}],
     songs:[{title:'Carmen',hasStory:false,postedThisRound:false},{title:'The Realization',hasStory:true,postedThisRound:false},{title:'Aubrey',hasStory:true,postedThisRound:false},
       {title:'<b>Bold</b> & a very long song title that keeps going and going to test wrapping on a phone',hasStory:true,postedThisRound:false},
       {title:'Semantics',hasStory:true,postedThisRound:true},{title:'NOTE TO SELF',hasStory:true,postedThisRound:true}]},
   approaches:[{name:'question',tries:0,score:null},{name:'story',tries:0,score:null},{name:'invite',tries:0,score:null},{name:'behind',tries:0,score:null}],posts:[]};},
 xDraftSong:function(title,replace){window.__xPick=[title,replace];if(title==='Aubrey')throw new Error('“Aubrey” has no Bandcamp code in the Song Database.');return {requested:true,song:title,replaced:replace?1:0};},
 getAnalytics:function(){return {youtube:{connected:true,channel:'Danyel OZ',error:''},x:{connected:true,error:''},
   shorts:shorts.map(function(s){return {short_id:s.short_id,song_title:s.song_title,date:s.scheduled_date,status:s.status,yt:true,tt:true,ig:false,yt_video_id:s.yt_video_id,tags:s.yt_tags,stats:s.yt_video_id?{views:0,likes:0,comments:0}:null};}),
   xPosts:[],totals:{ytVideos:1,ytViews:0,ytLikes:0,ytComments:0,xPosts:0,xViews:0,xLikes:0,xClicks:0},hashtags:[]};}
};
function runner(ok,fail){var r={withSuccessHandler:function(f){return runner(f,fail);},withFailureHandler:function(f){return runner(ok,f);}};
 Object.keys(H).forEach(function(k){r[k]=function(){var a=arguments;window.__calls.push(k);setTimeout(function(){try{var v=H[k].apply(null,a);ok&&ok(v);}catch(e){fail&&fail(e);}},30);};});return r;}
window.google={script:{run:runner()}};
window.confirm=function(){return true;};
})();
