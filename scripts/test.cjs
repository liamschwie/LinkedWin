const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['scripts/bundle.cjs',...fs.readdirSync(path.join(root,'frida')).filter(f=>f.endsWith('.test.cjs')).sort().map(f=>'frida/'+f),'scripts/bundle.test.cjs','scripts/safety.test.cjs']){
 const result=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
