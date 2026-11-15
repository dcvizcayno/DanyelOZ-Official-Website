const fs=require('fs');const code=fs.readFileSync(require('path').join(__dirname, '../../tools/SpotifyBackfill.gs'),'utf8');
const rows=[['song_title','song_upc','song_ISRC','spotify_link'],
 ['Has Link','111','', 'https://open.spotify.com/album/x'],
 ['Blue and Red Christmas','199514770810','',''],
 ['Padded','12345678901','',''],
 ['Track Only','','USABC2400001',''],
 ['Stranger','222222222222','',''],
 ['Nothing','','',''],
 ['Not There','333333333333','','']];
const writes=[];const logs=[];
const cell=(r,c)=>({setValue:v=>{writes.push([r,c,v]);rows[r-1][c-1]=v;}});
const resp=(c,b,h={})=>({getResponseCode:()=>c,getContentText:()=>JSON.stringify(b),getHeaders:()=>h});
let n429=0;
global.SpreadsheetApp={getActive:()=>({getSheetByName:()=>({getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),getRange:cell})}),flush(){}};
const P={};global.PropertiesService={getScriptProperties:()=>({getProperty:k=>k==="SPOTIFY_CLIENT_ID"?" id ":k==="SPOTIFY_CLIENT_SECRET"?"sec":P[k],setProperty:(k,v)=>P[k]=v,deleteProperty:k=>delete P[k]})};global.console.log=(...a)=>logs.push(a.join(" "));
global.Utilities={base64Encode:s=>Buffer.from(s).toString('base64'),sleep(){},formatDate:(d)=>d.toISOString()};
global.Logger={log:s=>logs.push(s)};
const A=(name,artist,url)=>({name,artists:[{name:artist}],external_urls:{spotify:url}});
global.UrlFetchApp={fetch:(u,o)=>{
 if(/token/.test(u)){ if(Buffer.from(o.headers.Authorization.slice(6),'base64').toString()!=='id:sec') return resp(400,{}); return resp(200,{access_token:'T'});}
 const q=decodeURIComponent(u.split('q=')[1]);
 if(q==='upc:199514770810'){ if(!n429++) return resp(429,{},{'Retry-After':'1'}); return resp(200,{albums:{items:[A('Blue and Red Christmas','Someone Else','https://open.spotify.com/album/bad'),A('Blue & Red Christmas','Danyel OZ','https://open.spotify.com/album/good')]}});}
 if(q==='upc:012345678901') return resp(200,{albums:{items:[A('Padded','M4RCU$ H33R0','https://open.spotify.com/album/pad')]}});
 if(q==='isrc:USABC2400001') return resp(200,{tracks:{items:[A('Track Only','Danyel OZ','https://open.spotify.com/track/t')]}});
 if(q==='upc:222222222222') return resp(200,{albums:{items:[A('Stranger','Other Guy','https://open.spotify.com/album/s')]}});
 return resp(200,{albums:{items:[]}});
}};
eval(code);
previewSpotify(); process.stdout.write("preview writes "+writes.length+"\n"+logs.join("\n")+"\n---\n"); logs.length=0;
backfillSpotify(); process.stdout.write(JSON.stringify(writes)+"\n"+logs.join("\n")+"\n---\n"); logs.length=0;
// long 429: stops cleanly and saves the row
// Long wait: make every search return 429 with a 120 s wait.
rows.forEach((r,i)=>{ if(i>0 && i!==1) r[3]=''; });
const origFetch=UrlFetchApp.fetch; UrlFetchApp.fetch=(u,o)=>/token/.test(u)?origFetch(u,o):resp(429,{},{'Retry-After':'83160'});
backfillSpotify(); process.stdout.write(logs.join('\n')+'\nsaved: '+JSON.stringify(P)+'\n---\n'); logs.length=0;
UrlFetchApp.fetch=origFetch; backfillSpotify(); process.stdout.write(logs.join('\n')+'\nsaved: '+JSON.stringify(P)+'\n');
