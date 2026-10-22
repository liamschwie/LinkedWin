function validateWendPuzzle(p){
 const rows=p?.gridRows||p?.gridSize,cols=p?.gridCols||p?.gridSize,letters=p?.puzzleLetters,words=p?.solutionWords;
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<2||cols<2||rows>20||cols>20||!Array.isArray(letters)||letters.length!==rows*cols||letters.some(v=>typeof v!=='string'||!/^$|^[A-Z]$/.test(v))||!Array.isArray(words)||!words.length)throw Error('Unsupported Wend puzzle');
 // shortcut: nonempty preset schemas need a live capture before automatic playback.
 if(!Array.isArray(p.presets||[])||!Array.isArray(p.presetWordsIndexes||[])||(p.presets||[]).length||(p.presetWordsIndexes||[]).length)throw Error('Unsupported Wend presets');
 const covered=new Set(),paths=[];
 for(const word of words){
  const path=word?.sequencingIndex;
  if(!Array.isArray(path)||path.length<2)throw Error('Unsupported Wend word path');
  for(let j=0;j<path.length;j++){
   const i=path[j];if(!Number.isInteger(i)||i<0||i>=letters.length||!letters[i])throw Error('Word crosses a hole or invalid cell');
   if(covered.has(i))throw Error('Solution words overlap');covered.add(i);
   if(j){const a=path[j-1];if(Math.abs(Math.floor(a/cols)-Math.floor(i/cols))+Math.abs(a%cols-i%cols)!==1)throw Error('Word contains nonadjacent cells');}
  }
  paths.push(path.slice());
 }
 if(covered.size!==letters.filter(Boolean).length)throw Error('Words must cover all non-hole cells');
 return paths;
}
function readWendContext(){
 if(!/^\/games\/view\/wend\/?$/.test(location.pathname))throw Error('Wend page changed');
 const roots=new Set(),cells=new Map();
 for(const e of document.querySelectorAll('[data-cell-idx]')){
  const rect=e.getBoundingClientRect();if(!rect.width||!rect.height)continue;
  const i=Number(e.getAttribute('data-cell-idx'));if(!Number.isInteger(i)||cells.has(i))throw Error('Ambiguous Wend cells');cells.set(i,e);
  const key=Object.keys(e).find(k=>k.startsWith('__reactFiber$'));if(!key)continue;
  let fiber=e[key],depth=0;while(fiber?.return&&depth++<150)fiber=fiber.return;
  if(fiber?.stateNode?.current)roots.add(fiber.stateNode.current);
 }
 const stack=[...roots],seen=new Set(),puzzles=[],grids=[],candidates=new Map();let count=0;
 while(stack.length&&count++<20000){
  const fiber=stack.pop();if(!fiber||seen.has(fiber))continue;seen.add(fiber);
  if(fiber.child)stack.push(fiber.child);if(fiber.sibling)stack.push(fiber.sibling);
  const p=fiber.memoizedProps;
  if(p&&typeof p==='object'){
   if(p.game?.puzzle?.wendGamePuzzle)puzzles.push({puzzle:p.game.puzzle.wendGamePuzzle,gameId:String(p.game.gameUrn?.puzzleId)});
   if(typeof p.isDragEnabled==='boolean'&&typeof p.renderCell==='function')grids.push(p);
  }
  const hooks=new Set();let hook=fiber.memoizedState;
  for(let i=0;hook&&typeof hook==='object'&&!hooks.has(hook)&&i<80;i++,hook=hook.next){
   hooks.add(hook);const value=hook.memoizedState;
   if(Array.isArray(value)&&value.length&&value.every(w=>w&&Array.isArray(w.sequencingIndex))){
    const paths=value.map(w=>w.sequencingIndex.slice());candidates.set(paths.map(p=>p.join(',')).sort().join('|'),paths);
   }
  }
 }
 const ids=new Set(puzzles.map(p=>p.gameId+':'+JSON.stringify(p.puzzle)));if(ids.size!==1)throw Error('Expected one current Wend puzzle');
 const c=puzzles[0],rows=c.puzzle.gridRows||c.puzzle.gridSize,cols=c.puzzle.gridCols||c.puzzle.gridSize,total=rows*cols;
 if(cells.size!==total||[...cells.keys()].some(i=>i<0||i>=total))throw Error('Wend cells are not fully mounted');
 const inputs=grids.filter(g=>g.gridRows===rows&&g.gridCols===cols);if(inputs.length!==1)throw Error('Expected one Wend drag grid');
 const g=inputs[0],rendered=new Map(),selected=new Set();
 for(let i=0;i<total;i++){
  const cell=g.renderCell(i)?.props;
  if(cell?.idx!==i||cell.letter!==c.puzzle.puzzleLetters[i]||typeof cell.isSelected!=='boolean')throw Error('Unsupported rendered Wend cell '+i);
  rendered.set(i,cell);if(cell.isSelected)selected.add(i);
 }
 const matches=[];
 for(const paths of candidates.values()){
  const used=new Set();let valid=true;
  for(const path of paths)for(let j=0;j<path.length;j++){
   const i=path[j],cell=rendered.get(i);
   if(!Number.isInteger(i)||used.has(i)||!cell?.isSelected||cell.positionInWord!==j){valid=false;break;}used.add(i);
  }
  if(valid&&used.size===selected.size)matches.push(paths);
 }
 if(matches.length>1)throw Error('Ambiguous Wend word state');
 if(selected.size&&!matches.length)throw Error('Wend word state does not match rendered cells');
 return {...c,cells,words:matches[0]||[],inputEnabled:g.isDragEnabled&&['onStartDrag','onDragging','onEndDrag'].every(k=>typeof g[k]==='function')};
}
function checkWendProgress(words,solution){
 const targets=new Set(solution.map(p=>p.join(','))),done=new Set();
 for(const path of words){const key=path.join(',');if(!targets.has(key)||done.has(key))throw Error('Existing Wend path conflicts with supplied solution; clear it manually');done.add(key);}
 return done;
}
async function replayWend(read,validate,progress,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(control.cancelled)throw Error('Playback cancelled');
 const initial=read(),solution=validate(initial.puzzle),identity=JSON.stringify(initial.puzzle);
 function check(){
  if(control.cancelled)throw Error('Playback cancelled');
  const c=read();if(c.gameId!==initial.gameId||JSON.stringify(c.puzzle)!==identity)throw Error('Wend puzzle changed');return c;
 }
 const lastWord=solution.filter(path=>!progress(initial.words,solution).has(path.join(','))).at(-1);
 let c=check(),writes=0;progress(c.words,solution);
 // Validate every target's geometry before the first input.
 for(const path of solution)for(const i of path){
  const r=c.cells.get(i).getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  if(r.width<30||r.height<30||x<0||y<0||x>window.innerWidth||y>window.innerHeight)throw Error('Wend board must be fully visible with cells at least 30 pixels wide');
 }
 function send(index,type,buttons,shift=0){
  const cell=c.cells.get(index),r=cell.getBoundingClientRect();
  cell.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0,buttons,clientX:r.x+r.width/2+shift,clientY:r.y+r.height/2}));
 }
 for(const path of solution){
  c=check();const key=path.join(',');if(progress(c.words,solution).has(key))continue;
  if(c.inputEnabled===false)throw Error('Wend drag input is disabled before all words are complete');
  let last=path[0];
  try{
   control.noteInput?.();send(last,'mousedown',1);await wait(80);c=check();
   // Preserve the proven grid controller's within-cell drag threshold crossing.
   send(last,'mousemove',1,12);await wait(80);
   for(const i of path.slice(1)){c=check();if(path===lastWord&&i===path.at(-1)){await control.beforeFinish?.(check);c=check();}send(i,'mousemove',1);last=i;await wait(80);}
  }finally{send(last,'mouseup',0);}
  let verified=false;
  for(let attempt=0;attempt<30;attempt++){await wait(20);c=check();if(progress(c.words,solution).has(key)){verified=true;break;}}
  if(!verified)throw Error('Wend input did not commit word '+path[0]+'; stopping');
  writes++;control.events.push('WEND SET '+path[0]+': '+path.map(i=>initial.puzzle.puzzleLetters[i]).join(''));
 }
 control.events.push(writes?'Wend inputs finished ('+writes+' words). Check the completion response.':'Wend already solved; no inputs sent.');
}
function observeWendSaves(control){
 const originalFetch=window.fetch,XHR=window.XMLHttpRequest,requests=new WeakMap(),pending=new Set();
 const originalOpen=XHR?.prototype.open,originalSend=XHR?.prototype.send;
 function matches(url,body){
  try{return new URL(url,location.href).origin==='https://www.linkedin.com'&&typeof body==='string'&&/gameStoredRecord|gameBoardHasWon/.test(body);}catch(_){return false;}
 }
 function fetchWrapper(input,init){
  const result=originalFetch.apply(this,arguments);
  if(matches(typeof input==='string'?input:input?.url,init?.body)){
   control.events.push('WEND FETCH SAVE [unchanged]: '+init.body);
   result.then(r=>r.clone().text().then(t=>control.events.push('WEND FETCH RESPONSE HTTP '+r.status+': '+t))).catch(e=>control.events.push('Wend save observation failed: '+e.message));
  }
  return result;
 }
 function openWrapper(method,url){requests.set(this,String(url));return originalOpen.apply(this,arguments);}
 function sendWrapper(body){
  if(matches(requests.get(this),body)){
   control.events.push('WEND XHR SAVE [unchanged]: '+body);
   const xhr=this,entry={xhr,done:null};
   entry.done=()=>{
    pending.delete(entry);xhr.removeEventListener('loadend',entry.done);
    try{
     const response=xhr.response,status=xhr.status;
     const report=text=>control.events.push('WEND XHR RESPONSE HTTP '+status+': '+text);
     if(response&&typeof response.text==='function'){
      response.text().then(report).catch(e=>control.events.push('Wend response observation failed: '+e.message));
     }else{
      const binary=Object.prototype.toString.call(response)==='[object ArrayBuffer]'||ArrayBuffer.isView(response);
      const text=binary?new TextDecoder().decode(response):typeof response==='string'?response:JSON.stringify(response);
      report(text);
      if(text==='{}')control.events.push('WEND RESPONSE FORMAT: '+xhr.responseType+' '+Object.prototype.toString.call(response));
     }
    }catch(e){control.events.push('Wend response observation failed: '+e.message);}
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
function installWendPlayer(read,validate,progress,replay,observe,action){
 if(!/^\/games\/view\/wend\/?$/.test(location.pathname))return JSON.stringify({events:[],ready:false});
 if(!window.__wendPlayerV1){
  let restore=null;
  const control=window.__wendPlayerV1={events:[],cancelled:false,running:false,started:false,ready:false,auto:false,lastError:null,
   drain(){return JSON.stringify({events:this.events.splice(0),ready:this.ready,started:this.started});},
   inspect(){
    try{
     if(window.__gameTimerCap?.armed)throw Error('Stop timer spoofing before normal playback');
     const c=read(),solution=validate(c.puzzle);progress(c.words,solution);
     if(!this.ready)this.events.push('WEND READY: '+c.puzzle.gridRows+'x'+c.puzzle.gridCols+', '+solution.length+' validated words, puzzle '+c.gameId+'. Timer unchanged.');
     this.ready=true;this.lastError=null;return true;
    }catch(e){this.ready=false;if(e.message!==this.lastError)this.events.push('WEND NOT READY: '+e.message);this.lastError=e.message;return false;}
   },
   play(){
    if(this.running||!this.inspect())return;
    this.started=true;this.cancelled=false;this.running=true;if(!restore)restore=observe(this);
    this.events.push('Playing Wend through normal word drag events. Each word verified; timer unchanged.');
    replay(read,validate,progress,this).catch(e=>this.events.push('WEND STOPPED: '+e.message)).finally(()=>{this.running=false;});
   },
   tick(){if(this.auto&&!this.started&&this.inspect())this.play();},
   stop(){this.cancelled=true;this.auto=false;if(restore)restore();restore=null;this.events.push('Wend player stopped; save observers restored.');}
  };
 }
 const control=window.__wendPlayerV1;
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
    try{if(!error.isNull())console.log('Wend WebView error: '+new ObjC.Object(error));else if(!result.isNull())report(new ObjC.Object(result).toString());}
    finally{callbacks.delete(callback);busy=false;if(queued){const next=queued;queued=null;evaluate(next,true);}}
   }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
  });
 }
 function invoke(action){evaluate('('+installWendPlayer.toString()+')('+[readWendContext,validateWendPuzzle,checkWendProgress,replayWend,observeWendSaves].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);}
 function locate(action){
  if(view){invoke(action);return;}if(locating)return;locating=true;const run=generation;
  ObjC.schedule(ObjC.mainQueue,()=>{
   try{if(run!==generation)return;const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'wend');if(found){view=found.retain();invoke(action);}}
   catch(error){console.log('Wend discovery failed: '+error.message);}finally{if(run===generation)locating=false;}
  });
 }
 globalThis.watchWend=function(){
  if(watcher){console.log('Already waiting for Wend');return;}attempts=0;generation++;locating=false;
  console.log('AUTO: waiting for Wend. It will play once its puzzle and cell states validate.');
  watcher=setInterval(()=>{
   if(++attempts>60){clearInterval(watcher);watcher=null;if(poll)clearInterval(poll);poll=null;generation++;console.log('Wend discovery timed out; polling stopped.');return;}
   locate('auto');
  },1000);
  if(!poll){let ticks=0;poll=setInterval(()=>{
   if(++ticks>120){stopWendPlayer();console.log('Wend observation timed out; player and polling stopped.');return;}
   evaluate('window.__wendPlayerV1 ? window.__wendPlayerV1.drain() : JSON.stringify({events:[]})');
  },1000);}
  locate('auto');
 };
 globalThis.inspectWend=()=>locate('inspect');
 globalThis.playWend=()=>locate('play');
 globalThis.stopWendPlayer=()=>{
  generation++;locating=false;if(watcher)clearInterval(watcher);if(poll)clearInterval(poll);watcher=poll=null;
  if(view)invoke('stop');else console.log('Wend watcher stopped');
 };
 console.log('Wend AUTO player. Normal timer and saves. stopWendPlayer() cancels; inspectWend() reports readiness.');
 watchWend();
}
