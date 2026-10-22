function validateZipPuzzle(puzzle) {
  const n=puzzle?.gridSize,route=puzzle?.solution,checkpoints=puzzle?.orderedSequence;
  if (!Number.isInteger(n)||n<2||n>20||!Array.isArray(route)||route.length!==n*n||new Set(route).size!==n*n||route.some(v=>!Number.isInteger(v)||v<0||v>=n*n)) throw Error('Solution must visit every grid cell exactly once with unique indices');
  if (!Array.isArray(checkpoints)||checkpoints.length<2||new Set(checkpoints).size!==checkpoints.length||checkpoints.some(v=>!Number.isInteger(v)||v<0||v>=n*n)) throw Error('Invalid checkpoints');
  if (route[0]!==checkpoints[0]||route.at(-1)!==checkpoints.at(-1)||JSON.stringify(route.filter(v=>checkpoints.includes(v)))!==JSON.stringify(checkpoints)) throw Error('Solution checkpoint order/start/finish is incorrect');
  const blocked=new Set(),directions={UP:-n,DOWN:n,LEFT:-1,RIGHT:1};
  if(!Array.isArray(puzzle.walls??[])) throw Error('Invalid wall list');
  for(const wall of puzzle.walls||[]) {
    const direction=String(wall?.direction).replace('WallDirection_','');
    if(!Object.hasOwn(directions,direction)||!Number.isInteger(wall?.cellIdx)||wall.cellIdx<0||wall.cellIdx>=n*n) throw Error('Unknown wall format');
    blocked.add([wall.cellIdx,wall.cellIdx+directions[direction]].sort((a,b)=>a-b).join(':'));
  }
  for(let i=1;i<route.length;i++) {
    const a=route[i-1],b=route[i];
    if(Math.abs(Math.floor(a/n)-Math.floor(b/n))+Math.abs(a%n-b%n)!==1) throw Error('Solution contains nonadjacent cells');
    if(blocked.has([a,b].sort((a,b)=>a-b).join(':'))) throw Error('Solution crosses a wall');
  }
  return route.slice();
}
function checkZipCells(cells,route) {
  for(const index of route) {
    const cell=cells.get(index);
    if(!cell) throw Error('Missing visible cell '+index);
    const rect=cell.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
    if(rect.width<30||rect.height<30||x<0||y<0||x>window.innerWidth||y>window.innerHeight) throw Error('Board must be fully visible with cells at least 30 pixels wide');
  }
}
async function replayZipDrag(cells,route,control) {
  const wait=()=>new Promise(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(resolve):setTimeout(resolve,32));
  function send(index,type,buttons,shift=0) {
    if(type!=='mouseup'){
      if(control.cancelled)throw Error('Playback cancelled');
      control.check?.();
      if(cells.get(index)?.isConnected===false)throw Error('Zip board changed during drag');
    }
    const cell=cells.get(index),rect=cell.getBoundingClientRect();
    cell.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,button:0,buttons,clientX:rect.x+rect.width/2+shift,clientY:rect.y+rect.height/2}));
  }
  if(control.cancelled) throw Error('Playback cancelled');
  let last=route[0];
  try {
    send(last,'mousedown',1);
    await wait();
    // Cross the grid controller's drag threshold within the initial cell.
    send(last,'mousemove',1,12);
    await wait();
    for(const index of route.slice(1)) {
      if(control.cancelled) throw Error('Playback cancelled');
      send(index,'mousemove',1);last=index;
      await wait();
    }
  } finally {send(last,'mouseup',0);}
}
function installZipPlayer(capture,validate,check,replay,action) {
  if(!/^\/games\/view\/zip\/?$/.test(location.pathname)) return JSON.stringify({events:['Not a Zip page']});
  if(!window.__zipPlayer) {
    let fetchWrapper=null,originalFetch=null;
    const control=window.__zipPlayer={running:false,cancelled:false,events:[],
      drain(){return JSON.stringify({events:this.events.splice(0)});},
      prepare(){
        if(window.__gameTimerCap?.armed) throw Error('Stop the timer cap before using playback');
        const snapshot=JSON.parse(capture());
        const records=snapshot.puzzles.filter(r=>r.value?.trailGamePuzzle);
        if(records.length!==1||(snapshot.games||[]).length>1)throw Error('Expected one current Zip puzzle');
        const record=records[0];
        const puzzle=record.value.trailGamePuzzle,route=validate(puzzle);
        const candidates=[...document.querySelectorAll('[data-trail-grid], [data-testid="interactive-grid"]')].filter(grid=>{const r=grid.getBoundingClientRect();return r.width>0&&r.height>0;});
        const grids=candidates.length?candidates:[document];
        const matches=[];
        for(const grid of grids) {
          const cells=new Map();let duplicate=false;
          for(const cell of grid.querySelectorAll('[data-cell-idx]')) {
            const rect=cell.getBoundingClientRect();if(!rect.width||!rect.height) continue;
            const index=Number(cell.getAttribute('data-cell-idx'));
            if(cells.has(index)) duplicate=true;
            cells.set(index,cell);
          }
          if(!duplicate&&cells.size===route.length) {check(cells,route);matches.push(cells);}
        }
        if(matches.length!==1) throw Error('Expected one visible Zip grid; found '+matches.length+'. Keep only the board visible.');
        return {snapshot,puzzle,route,cells:matches[0]};
      },
      inspect(){
        try {const info=this.prepare();this.events.push('ZIP READY: '+info.puzzle.gridSize+'x'+info.puzzle.gridSize+', '+info.route.length+' validated cells, '+info.puzzle.orderedSequence.length+' checkpoints. Normal timer; no moves made.');}
        catch(error){this.events.push('ZIP NOT READY: '+error.message);}
      },
      play(){
        if(this.running) {this.events.push('Playback already running');return;}
        let info;try{info=this.prepare();}catch(error){this.events.push('Cannot play: '+error.message);return;}
        this.cancelled=false;this.running=true;
        const identity=JSON.stringify([info.puzzle,info.snapshot.games||[]]);
        this.check=()=>{
          const current=this.prepare();
          if(JSON.stringify([current.puzzle,current.snapshot.games||[]])!==identity||info.route.some(i=>current.cells.get(i)!==info.cells.get(i)))throw Error('Zip puzzle or grid changed during drag');
        };
        if(!fetchWrapper) {
          originalFetch=window.fetch;
          fetchWrapper=function(input,init){
            const result=originalFetch.apply(this,arguments);
            try {
              const target=new URL(typeof input==='string'?input:input.url,location.href);
              if(target.origin==='https://www.linkedin.com'&&target.searchParams.get('sduiid')==='updateGameState'&&typeof init?.body==='string') {
                const data=JSON.parse(init.body),states=data.states;
                if(Array.isArray(states)) {
                  const won=states.find(s=>s.key==='gameBoardHasWon')?.value===true,time=states.find(s=>s.key==='gameBoardTimeElapsed')?.value?.value;
                  control.events.push('ZIP SAVE '+(won?'completion':'progress')+': '+time+' ms [unchanged]');
                  if(won) result.then(r=>r.clone().text().then(text=>control.events.push('ZIP COMPLETION RESPONSE HTTP '+r.status+': '+text))).catch(error=>control.events.push('Response observation failed: '+error.message));
                }
              }
            }catch(_){}
            return result;
          };
          window.fetch=fetchWrapper;
        }
        this.events.push('Playing the validated route through normal drag events. Timer unchanged.');
        replay(info.cells,info.route,this).then(()=>this.events.push('Route input finished. Check the board and completion response; input alone does not prove a saved win.')).catch(error=>this.events.push('Playback stopped: '+error.message)).finally(()=>{this.running=false;this.check=null;});
      },
      stop(){this.cancelled=true;if(fetchWrapper&&window.fetch===fetchWrapper)window.fetch=originalFetch;fetchWrapper=null;this.events.push('Player stopped; fetch observer restored.');}
    };
  }
  const control=window.__zipPlayer;
  if(action==='inspect')control.inspect();
  if(action==='play')control.play();
  if(action==='stop')control.stop();
  return control.drain();
}

function captureZipBoard() {
  if(!/^\/games\/view\/zip\/?$/.test(location.pathname))throw Error('Zip page changed');
  const roots=new Set(),puzzles=[],games=[],timers=[],cells=[],identities=new Set();
  for(const element of document.querySelectorAll('[data-cell-idx]')){
    const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)continue;
    cells.push({index:element.getAttribute('data-cell-idx'),text:element.textContent.trim(),label:element.getAttribute('aria-label'),x:rect.x+rect.width/2,y:rect.y+rect.height/2});
    const key=Object.keys(element).find(k=>k.startsWith('__reactFiber$'));if(!key)continue;
    let fiber=element[key],depth=0;while(fiber?.return&&depth++<150)fiber=fiber.return;
    if(fiber?.stateNode?.current)roots.add(fiber.stateNode.current);
  }
  const stack=[...roots],seen=new Set();let count=0;
  while(stack.length&&count++<20000){
    const fiber=stack.pop();if(!fiber||seen.has(fiber))continue;seen.add(fiber);
    if(fiber.child)stack.push(fiber.child);if(fiber.sibling)stack.push(fiber.sibling);
    const props=fiber.memoizedProps;if(!props||typeof props!=='object')continue;
    const puzzle=props.game?.puzzle?.trailGamePuzzle||props.puzzle?.trailGamePuzzle;
    if(puzzle){
      const key=JSON.stringify(puzzle);if(!identities.has(key)){identities.add(key);puzzles.push({source:'mounted game props',value:{trailGamePuzzle:puzzle}});}
      const urn=props.game?.gameUrn;
      if(urn){const info={puzzleId:String(urn.puzzleId),gameTypeId:String(urn.gameTypeId)};if(!games.some(g=>g.puzzleId===info.puzzleId&&g.gameTypeId===info.gameTypeId))games.push(info);}
    }
    if(props.timeInMs!==undefined&&props.isRunning!==undefined&&typeof props.onTimeUpdate==='function')timers.push({timeInMs:String(props.timeInMs),isRunning:props.isRunning});
  }
  return JSON.stringify({url:location.href,games,puzzles,timers,cells});
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
  let view=null,poll=null,busy=false,deferred=null;const callbacks=new Set();
  function report(text){try{for(const event of JSON.parse(text).events||[])console.log(event);}catch(_){console.log(text);}}
  function evaluate(source,priority=false){
    if(!view)return;if(busy){if(priority)deferred=source;return;}busy=true;
    ObjC.schedule(ObjC.mainQueue,()=>{
      const callback=new ObjC.Block({retType:'void',argTypes:['pointer','pointer'],implementation(value,error){
        try{if(!error.isNull())console.log('Zip WebView error: '+new ObjC.Object(error));else if(!value.isNull())report(new ObjC.Object(value).toString());}
        finally{callbacks.delete(callback);busy=false;if(deferred){const next=deferred;deferred=null;evaluate(next,true);}}
      }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
    });
  }
  function command(action){
    ObjC.schedule(ObjC.mainQueue,()=>{
      if(!view){const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'zip');if(found)view=found.retain();}
      if(!view){console.log('No visible Zip WebView. Open the board, then run inspectZip().');return;}
      evaluate('('+installZipPlayer.toString()+')('+[captureZipBoard,validateZipPuzzle,checkZipCells,replayZipDrag].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);
      if(!poll&&action!=='stop')poll=setInterval(()=>evaluate('window.__zipPlayer ? window.__zipPlayer.drain() : JSON.stringify({events:[]})'),1000);
    });
  }
  globalThis.inspectZip=()=>command('inspect');
  globalThis.playZip=()=>command('play');
  globalThis.stopZipPlayer=()=>{if(poll)clearInterval(poll);poll=null;command('stop');if(poll)clearInterval(poll);poll=null;};
  console.log('Zip player ready. inspectZip() checks the board; playZip() draws the route; stopZipPlayer() cancels. No clock or save rewriting.');
  command('inspect');
}
