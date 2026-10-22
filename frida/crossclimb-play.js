function validateCrossclimbPuzzle(p){
 const rungs=p?.rungs;
 if(!Array.isArray(rungs)||rungs.length<3||rungs.length>20)throw Error('Unsupported Crossclimb rungs');
 const length=rungs[0]?.word?.length;
 if(!Number.isInteger(length)||length<2||length>12)throw Error('Unsupported word length');
 const indices=new Set(),words=new Set();
 for(const r of rungs){
  if(!Number.isInteger(r?.solutionRungIndex)||r.solutionRungIndex<0||r.solutionRungIndex>=rungs.length||indices.has(r.solutionRungIndex))throw Error('Invalid or duplicate solution rung index');indices.add(r.solutionRungIndex);
  if(typeof r.word!=='string'||r.word.length!==length||!/^[A-Z]+$/.test(r.word)||words.has(r.word))throw Error('Invalid word length or duplicate word');words.add(r.word);
  if(typeof r.clue!=='string'||!r.clue.trim())throw Error('Missing rung clue');
 }
 const ordered=rungs.slice().sort((a,b)=>a.solutionRungIndex-b.solutionRungIndex);
 for(let i=1;i<ordered.length;i++){
  let changes=0;for(let j=0;j<length;j++)if(ordered[i-1].word[j]!==ordered[i].word[j])changes++;
  if(changes!==1)throw Error('Adjacent ladder words must differ by one letter');
 }
 return ordered;
}
function captureCrossclimbPuzzle(){
 const found=new Map();let decoded=0,bytes=0;
 for(const node of Array.from(document.querySelectorAll('code[id^="bpr-guid-"],script[type="application/json"]')).slice(0,60)){
  const text=node.textContent||'';if(text.length>3000000||!text.includes('crossClimbGamePuzzle'))continue;
  if(++decoded>8||(bytes+=text.length)>8000000)break;
  let data;try{data=JSON.parse(text);}catch(_){continue;}
  const stack=[data],seen=new Set();let count=0;
  while(stack.length&&count++<50000){
   const value=stack.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
   const p=value.crossClimbGamePuzzle;
   if(Array.isArray(p?.rungs)){
    const puzzle={rungs:p.rungs.map(r=>({solutionRungIndex:r.solutionRungIndex,word:r.word,clue:r.clue}))};
    found.set(JSON.stringify(puzzle),{puzzle,node,text});
   }
   for(const child of Object.values(value))if(child&&typeof child==='object')stack.push(child);
  }
 }
 if(found.size!==1)throw Error('Expected one embedded Crossclimb puzzle');return found.values().next().value;
}
function readCrossclimbContext(source){
 if(!/^\/games\/view\/crossclimb\/?$/.test(location.pathname)||source.node.isConnected===false||source.node.textContent!==source.text)throw Error('Crossclimb puzzle changed');
 const roots=Array.from(document.querySelectorAll('.crossclimb__container')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;});
 if(roots.length!==1)throw Error('Expected one visible Crossclimb board');
 const root=roots[0],length=source.puzzle.rungs[0]?.word?.length;
 const rows=Array.from(root.querySelectorAll('.crossclimb__guess[data-guess-id]')).map(element=>{
  const inputs=Array.from(element.querySelectorAll('input[data-crossclimb-guess-input-idx]')).sort((a,b)=>Number(a.getAttribute('data-crossclimb-guess-input-idx'))-Number(b.getAttribute('data-crossclimb-guess-input-idx')));
  if(inputs.length&&inputs.length!==length)throw Error('Unexpected Crossclimb row length');
  for(let i=0;i<inputs.length;i++)if(Number(inputs[i].getAttribute('data-crossclimb-guess-input-idx'))!==i||!/^$|^[A-Z]$/.test(inputs[i].value))throw Error('Unsupported Crossclimb input state');
  return {element,inputs,value:inputs.length?inputs.map(e=>e.value||'_').join(''):null};
 });
 if(rows.length!==source.puzzle.rungs.length||rows.slice(1,-1).some(r=>r.inputs.length!==length))throw Error('Crossclimb rows are not fully mounted');
 return {puzzle:source.puzzle,root,rows};
}
async function fillCrossclimbRow(read,row,expected,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
 function check(){if(control.cancelled)throw Error('Playback cancelled');return read();}
 let c=check();if(!row.inputs.length)throw Error('Crossclimb row is locked');
 row.inputs[0].focus();row.inputs[0].click();await wait(40);c=check();
 row=c.rows.find(r=>r.element===row.element);
 if(!row||!row.element.classList.contains('crossclimb__guess--active'))throw Error('Crossclimb row selection not confirmed');
 const ids=(row.inputs[0].getAttribute('aria-describedby')||'').split(/\s+/);
 const clueNode=ids.filter(id=>id.startsWith('crossclimb-clue-section-')).map(id=>document.getElementById(id)).find(Boolean);
 const clueText=normalize(clueNode?.innerText||c.root.innerText);
 const matches=c.puzzle.rungs.filter(r=>clueText.includes(normalize(r.clue)));
 if(expected){if(!matches.some(r=>r.word===expected.word))throw Error('Selected clue does not match expected boundary word');}
 else{
  const middle=matches.filter(r=>r.solutionRungIndex>0&&r.solutionRungIndex<c.puzzle.rungs.length-1);
  if(middle.length!==1)throw Error('Selected Crossclimb clue is ambiguous');expected=middle[0];
 }
 for(let i=0;i<expected.word.length;i++)if(row.inputs[i].value&&row.inputs[i].value!==expected.word[i])throw Error('Existing Crossclimb letters conflict with clue; clear manually');
 const last=Array.from(expected.word,(_,i)=>i).filter(i=>row.inputs[i].value!==expected.word[i]).at(-1);
 for(let i=0;i<expected.word.length;i++){
  c=check();row=c.rows.find(r=>r.element===row.element);if(!row)throw Error('Crossclimb row changed during input');
  const input=row.inputs[i];if(input.value===expected.word[i])continue;
  if(input.disabled||input.readOnly)throw Error('Crossclimb input is disabled');
  input.focus();input.click();
  if(expected.word===control.finishingWord&&i===last)await control.beforeFinish?.(check);
  control.noteInput?.();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,expected.word[i]);
  input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:expected.word[i]}));
  let verified=false,feedback='';
  for(let attempt=0;attempt<30;attempt++){
   await wait(20);c=check();
   const current=(i===expected.word.length-1&&c.rows.find(r=>r.value===expected.word))||c.rows.find(r=>r.element===row.element);
   // shortcut: English row feedback; add verified localized markers for other locales.
   const label=current?.element.getAttribute('aria-label')||'',count=/\b(\d+) characters? guessed\b/i.exec(label);
   const advanced=i===expected.word.length-1&&current?.value===expected.word&&!current.element.classList.contains('crossclimb__guess--active')&&c.rows.some(r=>r.element!==current.element&&r.element.classList.contains('crossclimb__guess--active'));
   const complete=current?.value===expected.word&&/\ball characters guessed\b/i.test(label);
   feedback=JSON.stringify({value:current?.value,label,advanced});
   if(current?.inputs[i]?.value===expected.word[i]&&(count&&Number(count[1])===current.inputs.filter(e=>e.value).length||label.toUpperCase().includes(expected.word)||advanced||complete)){row=current;verified=true;break;}
  }
  if(!verified)throw Error('Crossclimb app did not confirm letter '+i+' for '+expected.word+'; stopping. Feedback: '+feedback);
 }
 control.events.push('CROSSCLIMB SET: '+expected.word);return expected.word;
}
async function reorderCrossclimbRow(read,from,to,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function check(){if(control.cancelled)throw Error('Playback cancelled');return read();}
 let c=check();if(from===to)return;
 if(from<1||to<1||from>=c.rows.length-1||to>=c.rows.length-1)throw Error('Cannot reorder boundary rows');
 const expected=c.rows.map(r=>r.value),row=c.rows[from],handle=row.element.querySelector('.crossclimb__guess-dragger__left[data-sortable-handle]');
 if(!handle||handle.getAttribute('aria-disabled')==='true')throw Error('Crossclimb reorder handle unavailable');
 const key=(target,name,code)=>target.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:name,code:name,keyCode:code,which:code}));
 let confirmed=false;
 try{
  handle.focus();key(handle,'Enter',13);await wait(40);c=check();
  if(!row.element.classList.contains('is-activated'))throw Error('Crossclimb keyboard reorder activation not confirmed');
  for(let step=0;step<Math.abs(from-to);step++){
   c=check();const target=document.activeElement;
   if(!target||!c.root.contains(target))throw Error('Crossclimb keyboard reorder focus lost');
   key(target,from>to?'ArrowUp':'ArrowDown',from>to?38:40);await wait(160);
  }
  c=check();key(document.activeElement,'Enter',13);confirmed=true;
 }finally{if(!confirmed){const target=document.activeElement;if(target)key(target,'Escape',27);}}
 expected.splice(to,0,expected.splice(from,1)[0]);let verified=false;
 for(let attempt=0;attempt<30;attempt++){await wait(20);c=check();if(JSON.stringify(c.rows.slice(1,-1).map(r=>r.value))===JSON.stringify(expected.slice(1,-1))){verified=true;break;}}
 if(!verified)throw Error('Crossclimb reorder did not commit expected row order');
 control.events.push('CROSSCLIMB REORDER: '+from+' → '+to);
}
async function replayCrossclimb(read,validate,fill,reorder,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(control.cancelled)throw Error('Playback cancelled');
 const initial=read(),ordered=validate(initial.puzzle),identity=JSON.stringify(initial.puzzle),middle=ordered.slice(1,-1);
 control.finishingWord=[ordered[0],ordered.at(-1)].filter(r=>!initial.rows.some(row=>row.value===r.word)).at(-1)?.word;
 function check(){if(control.cancelled)throw Error('Playback cancelled');const c=read();if(c.root!==initial.root||JSON.stringify(c.puzzle)!==identity)throw Error('Crossclimb puzzle changed');return c;}
 let c=check();const full=new Set();
 for(const row of c.rows.slice(1,-1)){
  if(!middle.some(r=>Array.from(row.value).every((v,i)=>v==='_'||v===r.word[i])))throw Error('Existing Crossclimb letters conflict with solution; clear manually');
  if(!row.value.includes('_')){if(full.has(row.value))throw Error('Duplicate existing Crossclimb word');full.add(row.value);}
 }
 for(let attempt=0;attempt<middle.length;attempt++){
  c=check();const row=c.rows.slice(1,-1).find(r=>r.value.includes('_'));if(!row)break;await fill(check,row,null,control);
 }
 for(let i=1;i<ordered.length-1;i++){
  c=check();const from=c.rows.findIndex(r=>r.value===ordered[i].word);
  if(from<1||from>=ordered.length-1)throw Error('Missing expected middle word '+ordered[i].word);
  if(from!==i)await reorder(check,from,i,control);
 }
 for(const index of [0,ordered.length-1]){
  let unlocked=false;
  for(let attempt=0;attempt<30;attempt++){c=check();if(c.rows[index].inputs.length===ordered[index].word.length){unlocked=true;break;}await wait(20);}
  if(!unlocked)throw Error('Crossclimb boundary rows did not unlock after sorting');
  if(c.rows[index].value!==ordered[index].word)await fill(check,c.rows[index],ordered[index],control);
 }
 control.events.push('Crossclimb inputs finished. Check the original completion response.');
}
function observeCrossclimbSaves(control){
 const originalFetch=window.fetch,XHR=window.XMLHttpRequest,requests=new WeakMap(),pending=new Set();
 const originalOpen=XHR?.prototype.open,originalSend=XHR?.prototype.send;
 function matches(url,body){
  try{return new URL(url,location.href).origin==='https://www.linkedin.com'&&typeof body==='string'&&/gameStoredRecord|gameBoardHasWon/.test(body);}catch(_){return false;}
 }
 function fetchWrapper(input,init){
  const result=originalFetch.apply(this,arguments);
  if(matches(typeof input==='string'?input:input?.url,init?.body)){
   control.events.push('CROSSCLIMB FETCH SAVE [unchanged]: '+init.body);
   result.then(r=>r.clone().text().then(t=>control.events.push('CROSSCLIMB FETCH RESPONSE HTTP '+r.status+': '+t))).catch(e=>control.events.push('Crossclimb save observation failed: '+e.message));
  }
  return result;
 }
 function openWrapper(method,url){requests.set(this,String(url));return originalOpen.apply(this,arguments);}
 function sendWrapper(body){
  if(matches(requests.get(this),body)){
   control.events.push('CROSSCLIMB XHR SAVE [unchanged]: '+body);
   const xhr=this,entry={xhr,done:null};
   entry.done=()=>{
    pending.delete(entry);xhr.removeEventListener('loadend',entry.done);
    try{
     const response=xhr.response,status=xhr.status;
     const report=text=>control.events.push('CROSSCLIMB XHR RESPONSE HTTP '+status+': '+text);
     if(response&&typeof response.text==='function'){
      response.text().then(report).catch(e=>control.events.push('Crossclimb response observation failed: '+e.message));
     }else{
      const binary=Object.prototype.toString.call(response)==='[object ArrayBuffer]'||ArrayBuffer.isView(response);
      const text=binary?new TextDecoder().decode(response):typeof response==='string'?response:JSON.stringify(response);
      report(text);
      if(text==='{}')control.events.push('CROSSCLIMB RESPONSE FORMAT: '+xhr.responseType+' '+Object.prototype.toString.call(response));
     }
    }catch(e){control.events.push('Crossclimb response observation failed: '+e.message);}
   };
   pending.add(entry);xhr.addEventListener('loadend',entry.done);
  }
  return originalSend.apply(this,arguments);
 }
 window.fetch=fetchWrapper;
 if(XHR){XHR.prototype.open=openWrapper;XHR.prototype.send=sendWrapper;}
 return ()=>{
  if(window.fetch===fetchWrapper)window.fetch=originalFetch;
  if(XHR?.prototype.open===openWrapper)XHR.prototype.open=originalOpen;
  if(XHR?.prototype.send===sendWrapper)XHR.prototype.send=originalSend;
  for(const entry of pending)entry.xhr.removeEventListener('loadend',entry.done);pending.clear();
 };
}
function installCrossclimbPlayer(capture,readBoard,validate,fill,reorder,replay,observe,action){
 if(!/^\/games\/view\/crossclimb\/?$/.test(location.pathname))return JSON.stringify({events:[],ready:false});
 if(!window.__crossclimbPlayerV3){
  window.__crossclimbPlayerV1?.stop();
  window.__crossclimbPlayerV2?.stop();
  let restore=null,source=null;
  const read=()=>{if(!source)source=capture();return readBoard(source);};
  const control=window.__crossclimbPlayerV3={events:[],cancelled:false,running:false,started:false,ready:false,auto:false,lastError:null,
   drain(){return JSON.stringify({events:this.events.splice(0),ready:this.ready,started:this.started});},
   inspect(){
    try{
     if(window.__gameTimerCap?.armed)throw Error('Stop timer spoofing before normal playback');
     const c=read(),solution=validate(c.puzzle);
     if(!this.ready)this.events.push('CROSSCLIMB READY: '+solution.length+' rungs, '+solution[0].word.length+' letters. Timer unchanged.');
     this.ready=true;this.lastError=null;return true;
    }catch(e){this.ready=false;if(e.message!==this.lastError)this.events.push('CROSSCLIMB NOT READY: '+e.message);this.lastError=e.message;return false;}
   },
   play(){
    if(this.running||!this.inspect())return;
    this.started=true;this.cancelled=false;this.running=true;if(!restore)restore=observe(this);
    this.events.push('Playing Crossclimb through normal letter input and keyboard row reordering. Timer unchanged.');
    replay(read,validate,fill,reorder,this).catch(e=>this.events.push('CROSSCLIMB STOPPED: '+e.message)).finally(()=>{this.running=false;});
   },
   tick(){if(this.auto&&!this.started&&this.inspect())this.play();},
   stop(){this.cancelled=true;this.auto=false;if(restore)restore();restore=null;this.events.push('Crossclimb player stopped; save observers restored.');}
  };
 }
 const control=window.__crossclimbPlayerV3;
 if(action==='auto'){control.auto=true;control.tick();}
 if(action==='inspect')control.inspect();if(action==='play')control.play();if(action==='stop')control.stop();
 return control.drain();
}
function findVisibleGameWebView(windows, webClass, game) {
  const stack = [];
  for (let i = 0; i < Number(windows.count()); i++) stack.push(windows.objectAtIndex_(i));
  let visited = 0;
  while (stack.length && visited++ < 2000) {
    const candidate = stack.pop();
    if (candidate.isHidden()) continue;
    if (candidate.isKindOfClass_(webClass)) {
      const url = candidate.URL();
      const match = url && /^https:\/\/www\.linkedin\.com\/games\/view\/([a-z][a-z0-9-]*)(?:[/?#]|$)/i.exec(url.toString());
      if (match && (!game || match[1] === game)) return candidate;
      continue;
    }
    const children = candidate.subviews();
    for (let i = 0; i < Number(children.count()); i++) stack.push(children.objectAtIndex_(i));
  }
  return null;
}

if(typeof ObjC!=='undefined'&&ObjC.available){
 let view=null,watcher=null,poll=null,busy=false,queued=null,attempts=0,generation=0,locating=false;
 const callbacks=new Set();
 function report(text){try{const data=JSON.parse(text);for(const event of data.events||[])console.log(event);if(data.started&&watcher){clearInterval(watcher);watcher=null;}}catch(_){console.log(text);}}
 function evaluate(source,priority=false){
  if(!view)return;if(busy){if(priority)queued=source;return;}busy=true;
  ObjC.schedule(ObjC.mainQueue,()=>{
   const callback=new ObjC.Block({retType:'void',argTypes:['pointer','pointer'],implementation(result,error){
    try{if(!error.isNull())console.log('Crossclimb WebView error: '+new ObjC.Object(error));else if(!result.isNull())report(new ObjC.Object(result).toString());}
    finally{callbacks.delete(callback);busy=false;if(queued){const next=queued;queued=null;evaluate(next,true);}}
   }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
  });
 }
 function invoke(action){evaluate('('+installCrossclimbPlayer.toString()+')('+[captureCrossclimbPuzzle,readCrossclimbContext,validateCrossclimbPuzzle,fillCrossclimbRow,reorderCrossclimbRow,replayCrossclimb,observeCrossclimbSaves].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);}
 function locate(action){
  if(view){invoke(action);return;}if(locating)return;locating=true;const run=generation;
  ObjC.schedule(ObjC.mainQueue,()=>{
   try{if(run!==generation)return;const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'crossclimb');if(found){view=found.retain();invoke(action);}}
   catch(error){console.log('Crossclimb discovery failed: '+error.message);}finally{if(run===generation)locating=false;}
  });
 }
 globalThis.watchCrossclimb=function(){
  if(watcher){console.log('Already waiting for Crossclimb');return;}attempts=0;generation++;locating=false;
  console.log('AUTO: waiting for Crossclimb. It will play once its puzzle and cell states validate.');
  watcher=setInterval(()=>{
   if(++attempts>60){clearInterval(watcher);watcher=null;if(poll)clearInterval(poll);poll=null;generation++;console.log('Crossclimb discovery timed out; polling stopped.');return;}
   locate('auto');
  },1000);
  if(!poll){let ticks=0;poll=setInterval(()=>{
   if(++ticks>120){stopCrossclimbPlayer();console.log('Crossclimb observation timed out; player and polling stopped.');return;}
   evaluate('window.__crossclimbPlayerV3 ? window.__crossclimbPlayerV3.drain() : JSON.stringify({events:[]})');
  },1000);}
  locate('auto');
 };
 globalThis.inspectCrossclimb=()=>locate('inspect');
 globalThis.playCrossclimb=()=>locate('play');
 globalThis.stopCrossclimbPlayer=()=>{
  generation++;locating=false;if(watcher)clearInterval(watcher);if(poll)clearInterval(poll);watcher=poll=null;
  if(view)invoke('stop');else console.log('Crossclimb watcher stopped');
 };
 console.log('Crossclimb AUTO player. Normal timer and saves. stopCrossclimbPlayer() cancels; inspectCrossclimb() reports readiness.');
 watchCrossclimb();
}
