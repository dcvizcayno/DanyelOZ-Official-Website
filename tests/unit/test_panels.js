const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname + '/test_features.js','utf8');
// reuse mock sheet + context from the features test, without its assertions
const setup=src.split('// First call creates the tab')[0].replace("setValue(x) { sh.data[r - 1][c - 1] = x; return this; },","setValue(x) { sh.data[r - 1][c - 1] = x; return this; },\n        clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (sh.data[r - 1 + i]) sh.data[r - 1 + i][c - 1 + j] = ''; return this; },");
eval(setup.replace("vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);", "")
  + `
ctx.DriveApp={Access:{ANYONE_WITH_LINK:'a'},Permission:{VIEW:'v'},getFoldersByName:()=>({hasNext:()=>false}),createFolder:n=>({createFile:b=>({getId:()=>'IMG1',setSharing(){}})})};
ctx.Utilities.base64Decode=b=>Buffer.from(b,'base64'); ctx.Utilities.newBlob=(x,m,n)=>({name:n});
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),ctx);
let p=ctx.getPanels();
assert.strictEqual(p.length,4); assert.deepStrictEqual(p.map(x=>x.title),['Albums','Singles',"EP's",'Holidays']);
assert.ok(p.every(x=>x.visible===true));
const t=tabs.find(x=>x.name==='explore'); assert.strictEqual(t.data[0].join(),'order,visible,title,script,sub,text,link,image,focus');
// reorder, hide one, edit, add a new one with upload
const next=[p[1],Object.assign({},p[0],{visible:false}),Object.assign({},p[3],{text:'=1+1'}),{title:'Covers',sub:'Reimagined',link:'https://www.danyeloz.info/live/acoustic-takes',image:'',imageFile:{name:'c.jpg',mimeType:'image/jpeg',base64:'eA=='}}];
let r=ctx.savePanels(next);
assert.strictEqual(r.saved,4);
assert.deepStrictEqual(r.panels.map(x=>x.title+':'+x.visible),['Singles:true','Albums:false','Holidays:true','Covers:true']);
assert.strictEqual(r.panels[3].image,'https://drive.google.com/file/d/IMG1/view');
assert.strictEqual(r.panels[2].text,"'=1+1");
// fewer panels: old rows cleared
r=ctx.savePanels(r.panels.slice(0,2)); assert.strictEqual(ctx.getPanels().length,2);
// validation
assert.throws(()=>ctx.savePanels([{title:''}]),/needs a header/);
assert.throws(()=>ctx.savePanels([{title:'X',link:'javascript:alert(1)'}]),/https/);
assert.throws(()=>ctx.savePanels([{title:'X',image:'http://x.jpg'}]),/https/);
assert.strictEqual(ctx.getPanels().length,2);  // nothing changed after a rejected save
console.log('ALL PANEL TESTS PASSED');`);
