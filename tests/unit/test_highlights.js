const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname + '/test_features.js','utf8');
eval(src.split('// First call creates the tab')[0].replace("vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);","") + `
const hl=makeSheet('music_highlights',[
 ['Row','actLabel','title','subtitle','catalogTag','accentHex','appleMusicUrl','spotifyUrl','youtubeMusicUrl','amazonMusicUrl','Actions','month','slot','bandcamp_embed','coverImageUrl'],
 ['','Act 1','The Encounter','Listen now','EP','#C82829','https://music.apple.com/a','','','','','2026-11','1','<iframe src="https://bandcamp.com/EmbeddedPlayer/album=1/"></iframe>','https://drive.google.com/file/d/X/view'],
 ['','Act 2','The Search','Listen now','EP','#5E6F64','','','','','','2026-11','2','',''],
 ['','Act 3','The Realization','Listen now','EP','#D4C66A','','','','','','2026-11','3','','']]);
tabs.push(hl);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),ctx);
let h=ctx.getHighlights();
assert.strictEqual(h['2026-11'].filter(Boolean).length,3);
assert.strictEqual(h['2026-11'][0].bandcamp_embed.includes('bandcamp.com'),true);
assert.strictEqual(hl.data[0].length,15);   // nothing added: all columns already exist
// Save December with 2 cards; Row/Actions columns untouched and blank
let r=ctx.saveHighlightsMonth('2026-12',[{title:'Kareena',actLabel:'EP',accentHex:'#AA3344',bandcamp_embed:'<iframe src="https://bandcamp.com/EmbeddedPlayer/album=3257298651/"></iframe>',subtitle:'Pre-order now'},{},{title:'Dahlia',subtitle:'=bad'}]);
assert.strictEqual(r.saved,2);
h=ctx.getHighlights();
assert.strictEqual(h['2026-12'][0].title,'Kareena'); assert.strictEqual(h['2026-12'][1],null); assert.strictEqual(h['2026-12'][2].subtitle,"'=bad");
assert.strictEqual(h['2026-11'].filter(Boolean).length,3);
const dec=hl.data.find(x=>x[2]==='Kareena'); assert.strictEqual(dec[0],''); assert.strictEqual(dec[10],'');
// Re-save November with 1 card replaces it
r=ctx.saveHighlightsMonth('2026-11',[{title:'The Encounter'}]); h=ctx.getHighlights();
assert.strictEqual(h['2026-11'].filter(Boolean).length,1);
// Validation, nothing changes
const before=JSON.stringify(hl.data);
assert.throws(()=>ctx.saveHighlightsMonth('2026-12',[{title:'X',spotifyUrl:'javascript:alert(1)'}]),/https/);
assert.throws(()=>ctx.saveHighlightsMonth('2026-12',[{title:'X',accentHex:'red'}]),/color/);
assert.throws(()=>ctx.saveHighlightsMonth('2026-12',[{title:'X',bandcamp_embed:'<script>x</script>'}]),/Bandcamp/);
assert.strictEqual(JSON.stringify(hl.data),before);
// Missing columns get added to an old-style tab
const old=makeSheet('music_highlights',[['Row','actLabel','title'],['','Act 1','A']]);
tabs.splice(tabs.indexOf(hl),1,old); ctx.getHighlights();
assert.ok(['month','slot','bandcamp_embed','spotifyUrl'].every(c=>old.data[0].includes(c)));
console.log('ALL HIGHLIGHT TESTS PASSED');`);
