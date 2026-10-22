const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const runtime={},file=__dirname+'/crossclimb-play.js';if(fs.existsSync(file))vm.runInNewContext(fs.readFileSync(file,'utf8'),runtime);
assert.equal(typeof runtime.validateCrossclimbPuzzle,'function','Crossclimb validator exists');
const p={rungs:[{solutionRungIndex:0,word:'SAME',clue:'First boundary'},{solutionRungIndex:3,word:'LIMP',clue:'Synthetic clue 3'},{solutionRungIndex:1,word:'LAME',clue:'Synthetic clue 1'},{solutionRungIndex:4,word:'LIME',clue:'Synthetic clue 4'},{solutionRungIndex:2,word:'LAMP',clue:'Synthetic clue 2'},{solutionRungIndex:5,word:'TIME',clue:'Last boundary'}]};
assert.deepEqual(Array.from(runtime.validateCrossclimbPuzzle(p),r=>r.word),['SAME','LAME','LAMP','LIMP','LIME','TIME']);
assert.equal(p.rungs[1].word,'LIMP','validation preserves initial shuffled order');
let b=structuredClone(p);b.rungs[1].solutionRungIndex=1;assert.throws(()=>runtime.validateCrossclimbPuzzle(b),/index/i);
b=structuredClone(p);b.rungs[1].word='ZOOM';assert.throws(()=>runtime.validateCrossclimbPuzzle(b),/one letter/i);
b=structuredClone(p);b.rungs[1].word='LONGER';assert.throws(()=>runtime.validateCrossclimbPuzzle(b),/length/i);
b=structuredClone(p);b.rungs[1].clue='';assert.throws(()=>runtime.validateCrossclimbPuzzle(b),/clue/i);
console.log('Crossclimb: shuffled order, contiguous unique indices, word length, clues and one-letter ladder passed.');
(async()=>{
 assert.equal(typeof runtime.replayCrossclimb,'function','Crossclimb playback exists');
 let active=null,picked=null,pending=-1,sourceText='fixture';const writes=[];
 const ordered=runtime.validateCrossclimbPuzzle(p),initial=p.rungs.map(r=>({...r}));
 const tokens=new WeakMap();const cls=e=>({contains:k=>tokens.get(e).has(k)});
 const root={getBoundingClientRect:()=>({width:400,height:700}),contains:e=>e===group||rows.some(r=>r===e||r.inputs.includes(e)||r.handle===e),querySelectorAll:()=>rows};
 Object.defineProperty(root,'innerText',{get:()=>active?active.rung.clue:''});
 const rows=initial.map((r,i)=>{
  const e={rung:r,id:String(i),inputs:[],getAttribute:k=>k==='data-guess-id'?e.id:k==='aria-label'?(e.inputs.length===4&&e.inputs.every(x=>x.value)?'Row '+e.id+(tokens.get(e).has('crossclimb__guess--active')?', Active row, all characters guessed.':', Inactive row'):'Row '+e.id+', '+e.inputs.filter(x=>x.value).length+' characters guessed'):null,querySelectorAll:()=>e.inputs,querySelector:()=>e.handle,getBoundingClientRect:()=>({width:300,height:50})};tokens.set(e,new Set(['crossclimb__guess']));e.classList=cls(e);
  e.handle={focus(){document.activeElement=e.handle;},getAttribute:k=>k==='aria-disabled'?'false':null,dispatchEvent:ev=>group.dispatchEvent(ev)};
  function unlock(){if(e.inputs.length)return;e.inputs=Array.from({length:4},(_,j)=>({value:'',disabled:false,readOnly:false,focus(){document.activeElement=this;},click(){for(const row of rows)tokens.get(row).delete('crossclimb__guess--active');tokens.get(e).add('crossclimb__guess--active');active=e;},getAttribute:k=>k==='data-crossclimb-guess-input-idx'?String(j):null,dispatchEvent(ev){if(ev.type==='input'){writes.push([e.rung.word,j,this.value]);if(e.inputs.map(x=>x.value).join('')===e.rung.word){const next=rows[rows.indexOf(e)+1];if(next&&next.inputs.length){tokens.get(e).delete('crossclimb__guess--active');tokens.get(next).add('crossclimb__guess--active');active=next;}}}}}));}
  e.unlock=unlock;if(i>0&&i<initial.length-1)unlock();return e;
 });
 const group={dispatchEvent(ev){if(ev.type!=='keydown')return;if(ev.key==='Enter'){
  if(!picked){picked=rows.find(r=>r.handle===document.activeElement);if(!picked)return;pending=rows.indexOf(picked);tokens.get(picked).add('is-activated');document.activeElement=group;}
  else{rows.splice(rows.indexOf(picked),1);rows.splice(pending,0,picked);tokens.get(picked).delete('is-activated');picked=null;if(rows.slice(1,-1).map(r=>r.rung.word).join(',')==='LAME,LAMP,LIMP,LIME'){rows[0].unlock();rows.at(-1).unlock();}}
 }else if(ev.key==='ArrowUp'&&picked)pending--;else if(ev.key==='Escape'&&picked){tokens.get(picked).delete('is-activated');picked=null;}}};
 const document={activeElement:null,querySelectorAll:s=>s==='.crossclimb__container'?[root]:[],getElementById:()=>null};
 const source={puzzle:p,node:{textContent:sourceText,isConnected:true},text:sourceText};
 runtime.document=document;runtime.location={pathname:'/games/view/crossclimb',href:'https://www.linkedin.com/games/view/crossclimb'};runtime.setTimeout=fn=>fn();
 runtime.HTMLInputElement=function(){};Object.defineProperty(runtime.HTMLInputElement.prototype,'value',{set(v){this.value=v;}});
 runtime.InputEvent=function(type,props){this.type=type;Object.assign(this,props);};runtime.KeyboardEvent=runtime.InputEvent;
 const read=()=>runtime.readCrossclimbContext(source),control={cancelled:false,events:[]};
 let finishes=0,noted=0;control.noteInput=()=>noted++;control.beforeFinish=async check=>{finishes++;check();};
 await runtime.replayCrossclimb(read,runtime.validateCrossclimbPuzzle,runtime.fillCrossclimbRow,runtime.reorderCrossclimbRow,control);assert(finishes>0&&noted>0,'finishing action passes through the shared completion gate');delete control.beforeFinish;delete control.noteInput;
 assert.deepEqual(rows.map(r=>r.inputs.map(i=>i.value).join('')),['SAME','LAME','LAMP','LIMP','LIME','TIME']);assert.equal(writes.length,24);
 writes.length=0;await runtime.replayCrossclimb(read,runtime.validateCrossclimbPuzzle,runtime.fillCrossclimbRow,runtime.reorderCrossclimbRow,control);assert.equal(writes.length,0);
 rows.at(-1).inputs[0].value='';finishes=0;control.beforeFinish=async check=>{finishes++;assert.equal(check().rows.at(-1).value,'_IME');};
 await runtime.replayCrossclimb(read,runtime.validateCrossclimbPuzzle,runtime.fillCrossclimbRow,runtime.reorderCrossclimbRow,control);assert.equal(finishes,1,'partially filled final word still waits before its last missing letter');delete control.beforeFinish;writes.length=0;
 await assert.rejects(runtime.replayCrossclimb(read,runtime.validateCrossclimbPuzzle,runtime.fillCrossclimbRow,runtime.reorderCrossclimbRow,{cancelled:true,events:[]}),/cancel/i);
 rows[1].inputs[0].value='Z';await assert.rejects(runtime.replayCrossclimb(read,runtime.validateCrossclimbPuzzle,runtime.fillCrossclimbRow,runtime.reorderCrossclimbRow,control),/existing/i);assert.equal(writes.length,0);rows[1].inputs[0].value='L';
 const tmp=rows[1];rows[1]=rows[2];rows[2]=tmp;
 const dispatch=group.dispatchEvent;group.dispatchEvent=ev=>{dispatch(ev);if(ev.key==='Enter'&&picked)control.cancelled=true;};
 await assert.rejects(runtime.reorderCrossclimbRow(read,2,1,control),/cancel/i);assert.equal(picked,null,'cancel releases keyboard reorder');control.cancelled=false;group.dispatchEvent=dispatch;
 group.dispatchEvent=()=>{};await assert.rejects(runtime.reorderCrossclimbRow(read,2,1,control),/activation/i);group.dispatchEvent=dispatch;
 const target=rows.find(r=>r.rung.word==='LAME'),label=target.getAttribute;const inputDispatch=target.inputs[0].dispatchEvent;target.inputs[0].dispatchEvent=()=>{};target.inputs[0].value='';target.getAttribute=k=>k==='aria-label'?'Row 2, 0 characters guessed':label(k);
 await assert.rejects(runtime.fillCrossclimbRow(read,read().rows.find(r=>r.element===target),target.rung,control),/did not confirm/i);target.getAttribute=label;target.inputs[0].dispatchEvent=inputDispatch;
 source.node.textContent='different puzzle';assert.throws(read,/changed/i);
 rows.sort((a,b)=>a.rung.solutionRungIndex-b.rung.solutionRungIndex);
 const embedded={textContent:JSON.stringify({gamePuzzle:{crossClimbGamePuzzle:p}}),isConnected:true};
 document.querySelectorAll=s=>s.startsWith('code[')?[embedded]:s==='.crossclimb__container'?[root]:[];
 const sent=[],originalFetch=(input,init)=>{sent.push(init);return Promise.resolve({status:200,clone(){return this;},text:async()=>'END_SOLVED'});};runtime.window={fetch:originalFetch};runtime.URL=URL;
 const helpers=['captureCrossclimbPuzzle','readCrossclimbContext','validateCrossclimbPuzzle','fillCrossclimbRow','reorderCrossclimbRow','replayCrossclimb','observeCrossclimbSaves'].map(k=>runtime[k].toString()).join(',');
 const inject=action=>vm.runInNewContext('('+runtime.installCrossclimbPlayer.toString()+')('+helpers+','+JSON.stringify(action)+')',runtime);
 assert.equal(JSON.parse(inject('inspect')).ready,true,'serialized installer extracts real embedded puzzle schema');
 inject('auto');await new Promise(resolve=>setImmediate(resolve));
 const request={method:'POST',body:JSON.stringify({variables:{entity:{entity:{gameStoredRecord:{gamePlayState:'END_SOLVED'}}}}})};
 await runtime.window.fetch('https://www.linkedin.com/voyager/api/graphql',request);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent[0],request);assert(JSON.parse(inject('drain')).events.some(e=>e.includes('CROSSCLIMB FETCH RESPONSE HTTP 200: END_SOLVED')));inject('stop');assert.equal(runtime.window.fetch,originalFetch);
 console.log('Crossclimb: DOM input, app-state feedback, middle filling, verified keyboard reorder, boundary unlock, no-op, cancellation, conflicting values and puzzle changes passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
