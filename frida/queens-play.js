function validateQueensPuzzle(p){
 const n=p?.gridSize,s=p?.solution,g=p?.colorGrid;
 if(!Number.isInteger(n)||n<4||n>20||!Array.isArray(s)||s.length!==n)throw Error('Unsupported Queens solution');
 if(!Array.isArray(g)||g.length!==n||g.some(r=>!Array.isArray(r?.colors)||r.colors.length!==n||r.colors.some(c=>!Number.isInteger(c)||c<0)))throw Error('Invalid color grid');
 const rows=new Set(),cols=new Set(),regions=new Set(),route=[];
 for(const position of s){
  const r=position?.row,c=position?.col;
  if(!Number.isInteger(r)||!Number.isInteger(c)||r<0||c<0||r>=n||c>=n)throw Error('Invalid queen position');
  if(rows.has(r)||cols.has(c))throw Error('Duplicate queen row or column');
  const region=g[r].colors[c];
  if(regions.has(region))throw Error('Duplicate queen region');
  rows.add(r);cols.add(c);regions.add(region);route.push(r*n+c);
 }
 if(new Set(g.flatMap(r=>r.colors)).size!==n)throw Error('Expected one region per queen');
 for(let i=0;i<s.length;i++)for(let j=i+1;j<s.length;j++)if(Math.abs(s[i].row-s[j].row)<=1&&Math.abs(s[i].col-s[j].col)<=1)throw Error('Solution has touching queens');
 return route;
}
function queensCellValue(label){
 // shortcut: English accessibility labels only; add verified locales when needed.
 if(typeof label==='string'){
  if(/^Empty cell of color /.test(label))return 'empty';
  if(/^Cross of color /.test(label))return 'cross';
  if(/^Queen of color /.test(label))return 'queen';
 }
 throw Error('Unsupported Queens cell state: '+String(label).slice(0,120));
}
function readQueensContext(){
 if(!/^\/games\/view\/queens\/?$/.test(location.pathname))throw Error('Queens page changed');
 const roots=new Set(),cells=new Map();
 for(const element of document.querySelectorAll('[data-cell-idx]')){
  const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)continue;
  const index=Number(element.getAttribute('data-cell-idx'));
  if(!Number.isInteger(index)||cells.has(index))throw Error('Ambiguous Queens cell index');
  cells.set(index,element.getAttribute('aria-label'));
  const key=Object.keys(element).find(k=>k.startsWith('__reactFiber$'));if(!key)continue;
  let fiber=element[key],depth=0;while(fiber?.return&&depth++<150)fiber=fiber.return;
  if(fiber?.stateNode?.current)roots.add(fiber.stateNode.current);
 }
 const puzzles=[],grids=[],seen=new Set(),stack=[...roots];let count=0;
 while(stack.length&&count++<20000){
  const fiber=stack.pop();if(!fiber||seen.has(fiber))continue;seen.add(fiber);
  if(fiber.child)stack.push(fiber.child);if(fiber.sibling)stack.push(fiber.sibling);
  const p=fiber.memoizedProps;if(!p||typeof p!=='object')continue;
  if(p.game?.puzzle?.queensGamePuzzle)puzzles.push({puzzle:p.game.puzzle.queensGamePuzzle,gameId:String(p.game.gameUrn?.puzzleId)});
  if(Number.isInteger(p.gridCols)&&p.gridCols===p.gridRows&&typeof p.onClick==='function')grids.push(p);
 }
 const identities=new Set(puzzles.map(p=>p.gameId+':'+JSON.stringify(p.puzzle)));
 if(identities.size!==1)throw Error('Expected one mounted Queens puzzle');
 const context=puzzles[0],n=context.puzzle.gridSize;
 const handlers=[...new Set(grids.filter(g=>g.gridCols===n&&!g.disabled&&!g.isReadOnly).map(g=>g.onClick))];
 if(handlers.length!==1)throw Error('Expected one enabled Queens input handler');
 if(cells.size!==n*n||[...cells.keys()].some(i=>i<0||i>=n*n))throw Error('Queens cells are not fully mounted');
 return {...context,cells,onClick:handlers[0]};
}
async function replayQueens(read,validate,value,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(control.cancelled)throw Error('Playback cancelled');
 const initial=read(),route=validate(initial.puzzle),targets=new Set(route),identity=JSON.stringify(initial.puzzle);
 function check(){
  if(control.cancelled)throw Error('Playback cancelled');
  const c=read();
  if(c.gameId!==initial.gameId||JSON.stringify(c.puzzle)!==identity)throw Error('Puzzle changed during playback');
  for(let i=0;i<c.puzzle.gridSize*c.puzzle.gridSize;i++)if(value(c.cells.get(i))==='queen'&&!targets.has(i))throw Error('Queen outside the supplied solution at '+i+'; clear it manually');
  return c;
 }
 const last=route.filter(i=>value(initial.cells.get(i))!=='queen').at(-1);
 let context=check(),writes=0;
 for(const index of route){
  context=check();
  for(let click=0;value(context.cells.get(index))!=='queen'&&click<2;click++){
   if(index===last){await control.beforeFinish?.(check);context=check();}
   control.noteInput?.();const before=value(context.cells.get(index)),handler=context.onClick;
   handler(index);writes++;
   let changed=false;
   for(let attempt=0;attempt<30;attempt++){
    await wait(20);context=check();
    const after=value(context.cells.get(index));
    if(after!==before){
     if(after!=='queen'&&!(before==='empty'&&after==='cross'))throw Error('Unexpected Queens input transition');
     changed=true;break;
    }
   }
   if(!changed)throw Error('Queens input did not change cell '+index+'; stopping');
   context=check();
  }
  if(value(context.cells.get(index))!=='queen')throw Error('Queens input failed to place queen '+index);
  control.events.push('QUEENS SET '+index+': QUEEN');
 }
 control.events.push(writes?'Queens inputs finished ('+writes+' clicks). Check the completion response.':'Queens already solved; no inputs sent.');
}
function installQueensPlayer(read,validate,value,replay,action){
 if(!/^\/games\/view\/queens\/?$/.test(location.pathname))return JSON.stringify({events:[],ready:false});
 if(!window.__queensPlayerV1){
  let originalFetch=null,fetchWrapper=null;
  const control=window.__queensPlayerV1={events:[],cancelled:false,running:false,started:false,ready:false,auto:false,lastError:null,
   drain(){return JSON.stringify({events:this.events.splice(0),ready:this.ready,started:this.started});},
   prepare(){
    if(window.__gameTimerCap?.armed||window.__queensTimeTest?.armed)throw Error('Stop timer spoofing before normal playback');
    const context=read(),targets=new Set(validate(context.puzzle));
    for(let i=0;i<context.puzzle.gridSize*context.puzzle.gridSize;i++){
     if(value(context.cells.get(i))==='queen'&&!targets.has(i))throw Error('Queen outside the supplied solution at '+i+'; clear it manually');
    }
    return context;
   },
   inspect(){
    try{
     const c=this.prepare();
     if(!this.ready)this.events.push('QUEENS READY: '+c.puzzle.gridSize+'x'+c.puzzle.gridSize+', '+c.cells.size+' readable cells, puzzle '+c.gameId+'. Timer unchanged.');
     this.ready=true;this.lastError=null;return true;
    }catch(error){this.ready=false;if(error.message!==this.lastError)this.events.push('QUEENS NOT READY: '+error.message);this.lastError=error.message;return false;}
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
        control.events.push('QUEENS SAVE '+(won?'completion':'progress')+': '+time+' ms [unchanged]');
        if(won){
         control.events.push('QUEENS COMPLETION REQUEST: '+init.body);
         response.then(r=>r.clone().text().then(text=>control.events.push('QUEENS COMPLETION RESPONSE HTTP '+r.status+': '+text))).catch(error=>control.events.push('Response observation failed: '+error.message));
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
    this.events.push('Playing Queens through its normal click handler. Each transition verified; timer unchanged.');
    replay(read,validate,value,this).catch(error=>this.events.push('QUEENS STOPPED: '+error.message)).finally(()=>{this.running=false;});
   },
   tick(){if(this.auto&&!this.started&&this.inspect())this.play();},
   stop(){this.cancelled=true;this.auto=false;if(fetchWrapper&&window.fetch===fetchWrapper)window.fetch=originalFetch;fetchWrapper=null;this.events.push('Queens player stopped; save observer restored.');}
  };
 }
 const control=window.__queensPlayerV1;
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
    try{if(!error.isNull())console.log('Queens WebView error: '+new ObjC.Object(error));else if(!result.isNull())report(new ObjC.Object(result).toString());}
    finally{callbacks.delete(callback);busy=false;if(queued){const next=queued;queued=null;evaluate(next,true);}}
   }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
  });
 }
 function invoke(action){evaluate('('+installQueensPlayer.toString()+')('+[readQueensContext,validateQueensPuzzle,queensCellValue,replayQueens].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);}
 function locate(action){
  if(view){invoke(action);return;}if(locating)return;locating=true;const run=generation;
  ObjC.schedule(ObjC.mainQueue,()=>{
   try{if(run!==generation)return;const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'queens');if(found){view=found.retain();invoke(action);}}
   catch(error){console.log('Queens discovery failed: '+error.message);}finally{if(run===generation)locating=false;}
  });
 }
 globalThis.watchQueens=function(){
  if(watcher){console.log('Already waiting for Queens');return;}attempts=0;generation++;locating=false;
  console.log('AUTO: waiting for Queens. It will play once its puzzle and cell states validate.');
  watcher=setInterval(()=>{
   if(++attempts>60){clearInterval(watcher);watcher=null;if(poll)clearInterval(poll);poll=null;generation++;console.log('Queens discovery timed out; polling stopped.');return;}
   locate('auto');
  },1000);
  if(!poll)poll=setInterval(()=>evaluate('window.__queensPlayerV1 ? window.__queensPlayerV1.drain() : JSON.stringify({events:[]})'),1000);
  locate('auto');
 };
 globalThis.inspectQueens=()=>locate('inspect');
 globalThis.playQueens=()=>locate('play');
 globalThis.stopQueensPlayer=()=>{
  generation++;locating=false;if(watcher)clearInterval(watcher);if(poll)clearInterval(poll);watcher=poll=null;
  if(view)invoke('stop');else console.log('Queens watcher stopped');
 };
 console.log('Queens AUTO player. Normal timer and saves. stopQueensPlayer() cancels; inspectQueens() reports readiness.');
 watchQueens();
}
