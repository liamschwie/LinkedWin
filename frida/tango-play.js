function validateTangoPuzzle(p) {
 const n=p?.gridSize,s=p?.solution,Z='LotkaCellValue_ZERO',O='LotkaCellValue_ONE';
 if(!Number.isInteger(n)||n<2||n>12||n%2||!Array.isArray(s)||s.length!==n*n||s.some(v=>v!==Z&&v!==O))throw Error('Unsupported Tango solution');
 const presets=p.presetCellIdxes||[];
 if(new Set(presets).size!==presets.length||presets.some(i=>!Number.isInteger(i)||i<0||i>=s.length))throw Error('Invalid preset indices');
 for(let a=0;a<n;a++)for(const line of [Array.from({length:n},(_,b)=>s[a*n+b]),Array.from({length:n},(_,b)=>s[b*n+a])]){
  if(line.filter(v=>v===Z).length!==n/2)throw Error('Solution violates sun/moon balance');
  for(let b=2;b<n;b++)if(line[b]===line[b-1]&&line[b]===line[b-2])throw Error('Solution contains three identical symbols');
 }
 for(const e of p.edges||[]){
  const a=e.startIdx,b=e.endIdx;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=s.length||b>=s.length||Math.abs(Math.floor(a/n)-Math.floor(b/n))+Math.abs(a%n-b%n)!==1||typeof e.isEqual!=='boolean'||(s[a]===s[b])!==e.isEqual)throw Error('Solution violates an edge constraint');
 }
 return s.slice();
}
function tangoCellValue(data){
 const known=new Set(['LotkaCellValue_UNKNOWN','LotkaCellValue_ZERO','LotkaCellValue_ONE']);
 if(known.has(data))return data;
 if(data&&typeof data==='object'){
  for(const key of ['currentState','state','value','cellValue'])if(known.has(data[key]))return data[key];
  const values=[...new Set(Object.values(data).filter(v=>known.has(v)))];
  if(values.length===1)return values[0];
 }
 throw Error('Unsupported cell state: '+JSON.stringify(data).slice(0,500));
}
function readTangoContext(){
 if(!/^\/games\/view\/tango\/?$/.test(location.pathname))throw Error('Tango page changed');
 const roots=new Set();
 for(const element of document.querySelectorAll('[data-testid="tango-game-container"], [data-cell-idx]')){
  const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)continue;
  const key=Object.keys(element).find(k=>k.startsWith('__reactFiber$'));if(!key)continue;
  let fiber=element[key],depth=0;while(fiber?.return&&depth++<150)fiber=fiber.return;
  if(fiber?.stateNode?.current)roots.add(fiber.stateNode.current);
 }
 let puzzle=null,gameId=null;const cells=new Map(),grids=[],seen=new Set(),stack=[...roots];let count=0;
 while(stack.length&&count++<20000){
  const fiber=stack.pop();if(!fiber||seen.has(fiber))continue;seen.add(fiber);
  if(fiber.sibling)stack.push(fiber.sibling);if(fiber.child)stack.push(fiber.child);
  const p=fiber.memoizedProps;if(!p||typeof p!=='object')continue;
  const next=p.game?.puzzle?.lotkaGamePuzzle||p.puzzle?.lotkaGamePuzzle;
  if(next){
   if(puzzle&&JSON.stringify(puzzle)!==JSON.stringify(next))throw Error('Ambiguous mounted Tango puzzles');
   puzzle=next;
   if(p.game?.gameUrn){const id=String(p.game.gameUrn.puzzleId);if(gameId!==null&&gameId!==id)throw Error('Ambiguous Tango game IDs');gameId=id;}
  }
  if(Number.isInteger(p.index)&&p.cellData!==undefined){
   if(cells.has(p.index)&&JSON.stringify(cells.get(p.index))!==JSON.stringify(p.cellData))throw Error('Ambiguous rendered Tango cell '+p.index);
   cells.set(p.index,p.cellData);
  }
  if(Number.isInteger(p.gridCols)&&p.gridCols===p.gridRows&&p.isDragEnabled===false&&typeof p.onClick==='function')grids.push(p);
 }
 if(!puzzle)throw Error('Tango puzzle is not mounted in the current React tree yet');
 const inputs=[...new Set(grids.filter(g=>g.gridCols===puzzle.gridSize).map(g=>g.onClick))];
 if(inputs.length!==1)throw Error('Expected one Tango input handler; found '+inputs.length);
 if(cells.size!==puzzle.gridSize*puzzle.gridSize)throw Error('Tango cells are not fully mounted yet ('+cells.size+')');
 return {puzzle,gameId,cells,onClick:inputs[0]};
}
async function replayTango(read,validate,value,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(control.cancelled)throw Error('Playback cancelled');
 let context=read();const solution=validate(context.puzzle),presets=new Set(context.puzzle.presetCellIdxes||[]);
 // Inspect the whole board before the first write, so unknown formats fail without input.
 for(let i=0;i<solution.length;i++){
  const current=value(context.cells.get(i));
  if(presets.has(i)&&current!==solution[i])throw Error('Preset does not match supplied solution at '+i);
 }
 const readGameId=context.gameId,puzzleIdentity=JSON.stringify(context.puzzle);
 let writes=0;
 for(let i=0;i<solution.length;i++){
  if(control.cancelled)throw Error('Playback cancelled');
  context=read();
  if(context.gameId!==readGameId||JSON.stringify(context.puzzle)!==puzzleIdentity)throw Error('Puzzle changed during playback');
  if(presets.has(i)||value(context.cells.get(i))===solution[i])continue;
  const handler=context.onClick;handler(i,undefined,solution[i]);writes++;
  let verified=false;
  for(let attempt=0;attempt<30;attempt++){
   await wait(20);if(control.cancelled)throw Error('Playback cancelled');
   context=read();
   if(context.gameId!==readGameId||JSON.stringify(context.puzzle)!==puzzleIdentity)throw Error('Puzzle changed during playback');
   if(value(context.cells.get(i))===solution[i]){verified=true;break;}
  }
  if(!verified)throw Error('Input handler did not set cell '+i+' to the requested symbol; stopping');
  control.events.push('TANGO SET '+i+': '+(solution[i]==='LotkaCellValue_ZERO'?'SUN':'MOON'));
 }
 control.events.push(writes?'Tango inputs finished ('+writes+' cells). Check the completion response.':'Tango already matches its supplied solution; no inputs sent.');
}
function installTangoPlayer(read,validate,value,replay,action){
 if(!/^\/games\/view\/tango\/?$/.test(location.pathname))return JSON.stringify({events:[],ready:false});
 if(!window.__tangoPlayer){
  let originalFetch=null,fetchWrapper=null;
  const control=window.__tangoPlayer={events:[],cancelled:false,running:false,started:false,ready:false,auto:false,lastError:null,
   drain(){return JSON.stringify({events:this.events.splice(0),ready:this.ready,started:this.started});},
   prepare(){
    if(window.__gameTimerCap?.armed||window.__tangoTimeTest?.armed)throw Error('Stop timer spoofing before normal playback');
    const context=read(),solution=validate(context.puzzle),presets=new Set(context.puzzle.presetCellIdxes||[]);
    for(let i=0;i<solution.length;i++){
     const current=value(context.cells.get(i));
     if(presets.has(i)&&current!==solution[i])throw Error('Preset mismatch at '+i);
    }
    return context;
   },
   inspect(){
    try{
     const c=this.prepare();
     if(!this.ready)this.events.push('TANGO READY: '+c.puzzle.gridSize+'x'+c.puzzle.gridSize+', '+c.puzzle.solution.length+' readable cells, puzzle '+c.gameId+'. Timer unchanged.');
     this.ready=true;this.lastError=null;return true;
    }catch(error){this.ready=false;if(error.message!==this.lastError)this.events.push('TANGO NOT READY: '+error.message);this.lastError=error.message;return false;}
   },
   observe(){
    if(fetchWrapper)return;
    originalFetch=window.fetch;
    fetchWrapper=function(input,init){
     const response=originalFetch.apply(this,arguments);
     try{
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      if(url.origin==='https://www.linkedin.com'&&url.searchParams.get('sduiid')==='updateGameState'&&typeof init?.body==='string'){
       const data=JSON.parse(init.body),states=data.states;
       if(Array.isArray(states)){
        const won=states.find(s=>s.key==='gameBoardHasWon')?.value===true,time=states.find(s=>s.key==='gameBoardTimeElapsed')?.value?.value;
        control.events.push('TANGO SAVE '+(won?'completion':'progress')+': '+time+' ms [unchanged]');
        if(won){
         control.events.push('TANGO COMPLETION REQUEST: '+init.body);
         response.then(r=>r.clone().text().then(text=>control.events.push('TANGO COMPLETION RESPONSE HTTP '+r.status+': '+text))).catch(error=>control.events.push('Response observation failed: '+error.message));
        }
       }
      }
     }catch(_){}
     return response;
    };window.fetch=fetchWrapper;
   },
   play(){
    if(this.running)return;
    if(!this.inspect())return;
    this.started=true;this.running=true;this.cancelled=false;this.observe();
    this.events.push('Playing Tango through its target-value input handler. Givens skipped; timer unchanged.');
    replay(read,validate,value,this).catch(error=>this.events.push('TANGO STOPPED: '+error.message)).finally(()=>{this.running=false;});
   },
   tick(){if(this.auto&&!this.started&&this.inspect())this.play();},
   stop(){this.cancelled=true;this.auto=false;if(fetchWrapper&&window.fetch===fetchWrapper)window.fetch=originalFetch;fetchWrapper=null;this.events.push('Tango player stopped; save observer restored.');}
  };
 }
 const control=window.__tangoPlayer;
 if(action==='auto'){control.auto=true;control.tick();}
 if(action==='inspect')control.inspect();
 if(action==='play')control.play();
 if(action==='stop')control.stop();
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
    try{if(!error.isNull())console.log('Tango WebView error: '+new ObjC.Object(error));else if(!result.isNull())report(new ObjC.Object(result).toString());}
    finally{callbacks.delete(callback);busy=false;if(queued){const next=queued;queued=null;evaluate(next,true);}}
   }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
  });
 }
 function invoke(action){evaluate('('+installTangoPlayer.toString()+')('+[readTangoContext,validateTangoPuzzle,tangoCellValue,replayTango].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);}
 function locate(action){
  if(view){invoke(action);return;}if(locating)return;locating=true;const run=generation;
  ObjC.schedule(ObjC.mainQueue,()=>{
   try{if(run!==generation)return;const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'tango');if(found){view=found.retain();invoke(action);}}
   catch(error){console.log('Tango discovery failed: '+error.message);}finally{if(run===generation)locating=false;}
  });
 }
 globalThis.watchTango=function(){
  if(watcher){console.log('Already waiting for Tango');return;}attempts=0;generation++;locating=false;
  console.log('AUTO: waiting for Tango. It will play once its puzzle and cell states validate.');
  watcher=setInterval(()=>{
   if(++attempts>60){clearInterval(watcher);watcher=null;if(poll)clearInterval(poll);poll=null;generation++;console.log('Tango discovery timed out; polling stopped.');return;}
   locate('auto');
  },1000);
  if(!poll)poll=setInterval(()=>evaluate('window.__tangoPlayer ? window.__tangoPlayer.drain() : JSON.stringify({events:[]})'),1000);
  locate('auto');
 };
 globalThis.inspectTango=()=>locate('inspect');
 globalThis.playTango=()=>locate('play');
 globalThis.stopTangoPlayer=()=>{
  generation++;locating=false;if(watcher)clearInterval(watcher);if(poll)clearInterval(poll);watcher=poll=null;
  if(view)invoke('stop');else console.log('Tango watcher stopped');
 };
 console.log('Tango AUTO player. Normal timer and saves. stopTangoPlayer() cancels; inspectTango() reports readiness.');
 watchTango();
}
