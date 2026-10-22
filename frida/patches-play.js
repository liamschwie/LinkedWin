function validatePatchesPuzzle(p){
 const rows=p?.gridRows,cols=p?.gridCols,regions=p?.solution,clues=p?.clueCells;
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<2||cols<2||rows>20||cols>20||!Array.isArray(regions)||!regions.length||!Array.isArray(clues)||!clues.length)throw Error('Unsupported Patches puzzle');
 const count=rows*cols,clueMap=new Map(),covered=new Set(),result=[];
 for(const clue of clues){
  const i=clue?.cellIdx;
  if(!Number.isInteger(i)||i<0||i>=count||clueMap.has(i))throw Error('Invalid clue index');clueMap.set(i,clue);
 }
 for(const region of regions){
  const cells=region?.cellIdxes;
  if(!Array.isArray(cells)||!cells.length||new Set(cells).size!==cells.length||cells.some(i=>!Number.isInteger(i)||i<0||i>=count))throw Error('Invalid region cells');
  if(cells.some(i=>covered.has(i)))throw Error('Solution regions overlap');
  const rs=cells.map(i=>Math.floor(i/cols)),cs=cells.map(i=>i%cols),top=Math.min(...rs),left=Math.min(...cs),bottom=Math.max(...rs),right=Math.max(...cs);
  const height=bottom-top+1,width=right-left+1;
  if(height*width!==cells.length)throw Error('Region is not a complete rectangle');
  const contained=cells.filter(i=>clueMap.has(i));if(contained.length!==1)throw Error('Each region must contain exactly one clue');
  const clue=clueMap.get(contained[0]);
  if(!Number.isInteger(clue.numberConstraint)||clue.numberConstraint<1||clue.numberConstraint!==cells.length)throw Error('Region violates number constraint');
  const shapes={PatchesShapeConstraint_HORIZONTAL_RECT:width>height,PatchesShapeConstraint_VERTICAL_RECT:height>width,PatchesShapeConstraint_SQUARE:height===width};
  if(!Object.hasOwn(shapes,clue.shapeConstraint)||!shapes[clue.shapeConstraint])throw Error('Unsupported or violated shape constraint');
  for(const i of cells)covered.add(i);
  result.push({startIdx:top*cols+left,endIdx:bottom*cols+right,cellIdxes:cells.slice()});
 }
 if(covered.size!==count||regions.length!==clues.length)throw Error('Solution must cover every cell and clue');
 return result;
}
function readPatchesContext(){
 if(!/^\/games\/view\/patches\/?$/.test(location.pathname))throw Error('Patches page changed');
 const roots=new Set(),cells=new Map();
 for(const e of document.querySelectorAll('[data-cell-idx]')){
  const rect=e.getBoundingClientRect();if(!rect.width||!rect.height)continue;
  const index=Number(e.getAttribute('data-cell-idx'));
  if(!Number.isInteger(index)||cells.has(index))throw Error('Ambiguous Patches cells');cells.set(index,e);
  const key=Object.keys(e).find(k=>k.startsWith('__reactFiber$'));if(!key)continue;
  let fiber=e[key],depth=0;while(fiber?.return&&depth++<150)fiber=fiber.return;
  if(fiber?.stateNode?.current)roots.add(fiber.stateNode.current);
 }
 const stack=[...roots],seen=new Set(),puzzles=[],grids=[],regionLists=new Map();let count=0;
 function collect(value){
  if(!Array.isArray(value)||!value.length||!value.every(r=>r&&Array.isArray(r.cells)))return;
  const regions=value.map(r=>r.cells.slice().sort((a,b)=>a-b));
  const key=regions.map(r=>r.join(',')).sort().join('|');regionLists.set(key,regions);
 }
 while(stack.length&&count++<20000){
  const fiber=stack.pop();if(!fiber||seen.has(fiber))continue;seen.add(fiber);
  if(fiber.child)stack.push(fiber.child);if(fiber.sibling)stack.push(fiber.sibling);
  const p=fiber.memoizedProps;
  if(p&&typeof p==='object'){
   if(p.game?.puzzle?.patchesGamePuzzle)puzzles.push({puzzle:p.game.puzzle.patchesGamePuzzle,gameId:String(p.game.gameUrn?.puzzleId)});
   if(Number.isInteger(p.gridRows)&&Number.isInteger(p.gridCols)&&['onStartDrag','onDragging','onEndDrag'].every(k=>typeof p[k]==='function'))grids.push(p);
   for(const v of Object.values(p))collect(v);
  }
  const hooks=new Set();let hook=fiber.memoizedState;
  for(let i=0;hook&&typeof hook==='object'&&!hooks.has(hook)&&i<80;i++,hook=hook.next){hooks.add(hook);collect(hook.memoizedState);}
 }
 const ids=new Set(puzzles.map(p=>p.gameId+':'+JSON.stringify(p.puzzle)));
 if(ids.size!==1)throw Error('Expected one current Patches puzzle');
 const c=puzzles[0],total=c.puzzle.gridRows*c.puzzle.gridCols;
 if(cells.size!==total||[...cells.keys()].some(i=>i<0||i>=total))throw Error('Patches cells are not fully mounted');
 const inputs=grids.filter(g=>g.gridRows===c.puzzle.gridRows&&g.gridCols===c.puzzle.gridCols);
 if(inputs.length!==1)throw Error('Expected one Patches drag handler');
 if(regionLists.size>1)throw Error('Ambiguous committed Patches region state');
 let regions=[];
 if(regionLists.size)regions=regionLists.values().next().value;
 else for(const e of cells.values()){
  const label=e.getAttribute('aria-label');
  // shortcut: blank-board detection uses captured English labels until region state exists.
  if(!/^Row \d+, column \d+(?:,|$)/.test(label||'')||/\bregion\b/i.test(label))throw Error('Patches region state is not readable');
 }
 const g=inputs[0];return {...c,cells,regions,onStartDrag:g.onStartDrag,onDragging:g.onDragging,onEndDrag:g.onEndDrag};
}
function checkPatchesProgress(regions,solution){
 const targets=new Set(solution.map(r=>r.cellIdxes.slice().sort((a,b)=>a-b).join(','))),done=new Set();
 for(const cells of regions){
  if(!Array.isArray(cells))throw Error('Unsupported existing Patches region');
  const key=cells.slice().sort((a,b)=>a-b).join(',');
  if(!targets.has(key)||done.has(key))throw Error('Existing patch conflicts with supplied solution; clear it manually');done.add(key);
 }
 return done;
}
async function replayPatches(read,validate,progress,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(control.cancelled)throw Error('Playback cancelled');
 const initial=read(),solution=validate(initial.puzzle),identity=JSON.stringify(initial.puzzle);
 function check(){
  if(control.cancelled)throw Error('Playback cancelled');
  const c=read();if(c.gameId!==initial.gameId||JSON.stringify(c.puzzle)!==identity)throw Error('Patches puzzle changed');
  return {c,done:progress(c.regions,solution)};
 }
 let writes=0;
 for(const region of solution){
  let {c,done}=check();const key=region.cellIdxes.slice().sort((a,b)=>a-b).join(',');if(done.has(key))continue;
  let release=c.onEndDrag;
  try{
   const start=c.onStartDrag;start(region.startIdx);await wait(40);
   ({c}=check());release=c.onEndDrag;
   const drag=c.onDragging;drag({cellIdx:region.endIdx});await wait(40);
  }finally{release();}
  let verified=false;
  for(let attempt=0;attempt<30;attempt++){await wait(20);({done}=check());if(done.has(key)){verified=true;break;}}
  if(!verified)throw Error('Patches input did not commit region '+region.startIdx+'..'+region.endIdx+'; stopping');
  writes++;control.events.push('PATCHES SET '+region.startIdx+'..'+region.endIdx+': '+region.cellIdxes.length+' cells');
 }
 control.events.push(writes?'Patches inputs finished ('+writes+' regions). Check the completion response.':'Patches already solved; no inputs sent.');
}
function observePatchesSaves(control){
 const originalFetch=window.fetch,XHR=window.XMLHttpRequest,requests=new WeakMap(),pending=new Set();
 const originalOpen=XHR?.prototype.open,originalSend=XHR?.prototype.send;
 function matches(url,body){
  try{return new URL(url,location.href).origin==='https://www.linkedin.com'&&typeof body==='string'&&/gameStoredRecord|gameBoardHasWon/.test(body);}catch(_){return false;}
 }
 function fetchWrapper(input,init){
  const result=originalFetch.apply(this,arguments);
  if(matches(typeof input==='string'?input:input?.url,init?.body)){
   control.events.push('PATCHES FETCH SAVE [unchanged]: '+init.body);
   result.then(r=>r.clone().text().then(t=>control.events.push('PATCHES FETCH RESPONSE HTTP '+r.status+': '+t))).catch(e=>control.events.push('Patches save observation failed: '+e.message));
  }
  return result;
 }
 function openWrapper(method,url){requests.set(this,String(url));return originalOpen.apply(this,arguments);}
 function sendWrapper(body){
  if(matches(requests.get(this),body)){
   control.events.push('PATCHES XHR SAVE [unchanged]: '+body);
   const xhr=this,entry={xhr,done:null};
   entry.done=()=>{
    pending.delete(entry);xhr.removeEventListener('loadend',entry.done);
    try{
     const response=xhr.response,status=xhr.status;
     const report=text=>control.events.push('PATCHES XHR RESPONSE HTTP '+status+': '+text);
     if(response&&typeof response.text==='function'){
      response.text().then(report).catch(e=>control.events.push('Patches response observation failed: '+e.message));
     }else{
      const binary=Object.prototype.toString.call(response)==='[object ArrayBuffer]'||ArrayBuffer.isView(response);
      const text=binary?new TextDecoder().decode(response):typeof response==='string'?response:JSON.stringify(response);
      report(text);
      if(text==='{}')control.events.push('PATCHES RESPONSE FORMAT: '+xhr.responseType+' '+Object.prototype.toString.call(response));
     }
    }catch(e){control.events.push('Patches response observation failed: '+e.message);}
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
function installPatchesPlayer(read,validate,progress,replay,observe,action){
 if(!/^\/games\/view\/patches\/?$/.test(location.pathname))return JSON.stringify({events:[],ready:false});
 if(!window.__patchesPlayerV1){
  let restore=null;
  const control=window.__patchesPlayerV1={events:[],cancelled:false,running:false,started:false,ready:false,auto:false,lastError:null,
   drain(){return JSON.stringify({events:this.events.splice(0),ready:this.ready,started:this.started});},
   inspect(){
    try{
     if(window.__gameTimerCap?.armed)throw Error('Stop timer spoofing before normal playback');
     const c=read(),solution=validate(c.puzzle);progress(c.regions,solution);
     if(!this.ready)this.events.push('PATCHES READY: '+c.puzzle.gridRows+'x'+c.puzzle.gridCols+', '+solution.length+' validated regions, puzzle '+c.gameId+'. Timer unchanged.');
     this.ready=true;this.lastError=null;return true;
    }catch(e){this.ready=false;if(e.message!==this.lastError)this.events.push('PATCHES NOT READY: '+e.message);this.lastError=e.message;return false;}
   },
   play(){
    if(this.running||!this.inspect())return;
    this.started=true;this.cancelled=false;this.running=true;if(!restore)restore=observe(this);
    this.events.push('Playing Patches through normal rectangle drag callbacks. Each committed region verified; timer unchanged.');
    replay(read,validate,progress,this).catch(e=>this.events.push('PATCHES STOPPED: '+e.message)).finally(()=>{this.running=false;});
   },
   tick(){if(this.auto&&!this.started&&this.inspect())this.play();},
   stop(){this.cancelled=true;this.auto=false;if(restore)restore();restore=null;this.events.push('Patches player stopped; save observers restored.');}
  };
 }
 const control=window.__patchesPlayerV1;
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
    try{if(!error.isNull())console.log('Patches WebView error: '+new ObjC.Object(error));else if(!result.isNull())report(new ObjC.Object(result).toString());}
    finally{callbacks.delete(callback);busy=false;if(queued){const next=queued;queued=null;evaluate(next,true);}}
   }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
  });
 }
 function invoke(action){evaluate('('+installPatchesPlayer.toString()+')('+[readPatchesContext,validatePatchesPuzzle,checkPatchesProgress,replayPatches,observePatchesSaves].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);}
 function locate(action){
  if(view){invoke(action);return;}if(locating)return;locating=true;const run=generation;
  ObjC.schedule(ObjC.mainQueue,()=>{
   try{if(run!==generation)return;const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'patches');if(found){view=found.retain();invoke(action);}}
   catch(error){console.log('Patches discovery failed: '+error.message);}finally{if(run===generation)locating=false;}
  });
 }
 globalThis.watchPatches=function(){
  if(watcher){console.log('Already waiting for Patches');return;}attempts=0;generation++;locating=false;
  console.log('AUTO: waiting for Patches. It will play once its puzzle and cell states validate.');
  watcher=setInterval(()=>{
   if(++attempts>60){clearInterval(watcher);watcher=null;if(poll)clearInterval(poll);poll=null;generation++;console.log('Patches discovery timed out; polling stopped.');return;}
   locate('auto');
  },1000);
  if(!poll){let ticks=0;poll=setInterval(()=>{
   if(++ticks>120){stopPatchesPlayer();console.log('Patches observation timed out; player and polling stopped.');return;}
   evaluate('window.__patchesPlayerV1 ? window.__patchesPlayerV1.drain() : JSON.stringify({events:[]})');
  },1000);}
  locate('auto');
 };
 globalThis.inspectPatches=()=>locate('inspect');
 globalThis.playPatches=()=>locate('play');
 globalThis.stopPatchesPlayer=()=>{
  generation++;locating=false;if(watcher)clearInterval(watcher);if(poll)clearInterval(poll);watcher=poll=null;
  if(view)invoke('stop');else console.log('Patches watcher stopped');
 };
 console.log('Patches AUTO player. Normal timer and saves. stopPatchesPlayer() cancels; inspectPatches() reports readiness.');
 watchPatches();
}
