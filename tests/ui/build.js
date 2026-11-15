const fs=require('fs');const D=require('path').join(__dirname,'../../apps-script')+'/';
let html=fs.readFileSync(D+'Form.html','utf8');
html=html.replace(/<\?!= include\('(\w+)'\); \?>/g,(m,n)=>fs.readFileSync(D+n+'.html','utf8'));
if(/<\?/.test(html)) throw new Error('scriptlet left');
const mock=fs.readFileSync(__dirname+'/mock.js','utf8');
html=html.replace('<head>','<head><script>'+mock+'</script>');
fs.writeFileSync(__dirname+'/page.html',html);
console.log('built',html.length);
