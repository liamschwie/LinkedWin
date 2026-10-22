function parseMiniSudokuCells(records){
 // shortcut: only the captured 6x6 DOM format; add other sizes after capturing them.
 if(!Array.isArray(records)||records.length!==36)throw Error('Expected 36 Mini Sudoku cells');
 const n=6,ordered=Array(36),values=[],givens=[],walls=[];
 for(const r of records){
  if(!/^\d+$/.test(String(r.index)))throw Error('Invalid cell index');
  const i=Number(r.index);if(i<0||i>=36||ordered[i])throw Error('Duplicate or invalid cell index');ordered[i]=r;
 }
 for(let i=0;i<36;i++){
  const r=ordered[i],text=r.text.trim(),classes=new Set(r.className.split(/\s+/));
  if(!classes.has('sudoku-cell')||!/^$|^[1-6]$/.test(text))throw Error('Unsupported cell contents at '+i);
  const v=text===''?0:Number(text);values.push(v);
  if(classes.has('sudoku-cell-prefilled')&&!v)throw Error('Empty prefilled cell');
  givens.push(classes.has('sudoku-cell-prefilled')?v:0);
  walls.push(Object.fromEntries(['top','right','bottom','left'].map(d=>[d,classes.has('sudoku-cell-wall-'+d)])));
 }
 const regions=Array(36).fill(-1);let region=0;
 for(let start=0;start<36;start++){
  if(regions[start]!==-1)continue;
  const stack=[start];regions[start]=region;let size=0;
  while(stack.length){
   const i=stack.pop();size++;
   const row=Math.floor(i/n),col=i%n;
   for(const [j,dir,opposite,valid] of [[i-n,'top','bottom',row>0],[i+1,'right','left',col<n-1],[i+n,'bottom','top',row<n-1],[i-1,'left','right',col>0]]){
    if(!valid)continue;
    if(walls[i][dir]!==walls[j][opposite])throw Error('Asymmetric region wall at '+i);
    if(!walls[i][dir]&&regions[j]===-1){regions[j]=region;stack.push(j);}
   }
  }
  if(size!==n)throw Error('Each region must contain six cells');region++;
 }
 if(region!==n)throw Error('Expected six regions');
 return {n,values,givens,regions};
}
function solveMiniSudoku(board){
 const {n,values,givens,regions}=board||{};
 if(n!==6||![values,givens,regions].every(a=>Array.isArray(a)&&a.length===36)||[...values,...givens].some(v=>!Number.isInteger(v)||v<0||v>6)||regions.some(v=>!Number.isInteger(v)||v<0||v>=6)||Array.from({length:6},(_,r)=>regions.filter(v=>v===r).length).some(size=>size!==6))throw Error('Invalid Mini Sudoku board');
 const peers=Array.from({length:36},(_,i)=>Array.from({length:36},(_,j)=>j).filter(j=>j!==i&&(Math.floor(i/n)===Math.floor(j/n)||i%n===j%n||regions[i]===regions[j])));
 const work=givens.slice();
 for(let i=0;i<36;i++)if(work[i]&&peers[i].some(j=>work[j]===work[i]))throw Error('Conflicting givens');
 let nodes=0;const solutions=[];
 function search(){
  if(++nodes>100000)throw Error('Sudoku search limit exceeded');
  let index=-1,choices=null;
  for(let i=0;i<36;i++)if(!work[i]){
   const allowed=[1,2,3,4,5,6].filter(v=>!peers[i].some(j=>work[j]===v));
   if(!allowed.length)return;
   if(!choices||allowed.length<choices.length){index=i;choices=allowed;if(allowed.length===1)break;}
  }
  if(index===-1){solutions.push(work.slice());return;}
  for(const v of choices){work[index]=v;search();work[index]=0;if(solutions.length>=2)return;}
 }
 search();if(solutions.length!==1)throw Error('Puzzle must have exactly one unique solution');
 return solutions[0];
}
function readMiniSudokuContext(parse){
 if(!/^\/games\/view\/mini-sudoku\/?$/.test(location.pathname))throw Error('Mini Sudoku page changed');
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 const grids=Array.from(document.querySelectorAll('.sudoku-grid')).filter(visible);
 if(grids.length!==1)throw Error('Expected one visible Sudoku grid');
 const grid=grids[0],elements=Array.from(grid.querySelectorAll('[data-cell-idx]')).filter(visible);
 const board=parse(elements.map(e=>({index:e.getAttribute('data-cell-idx'),text:e.textContent.trim(),className:e.getAttribute('class')||''})));
 const cells=Array(36);for(const e of elements)cells[Number(e.getAttribute('data-cell-idx'))]=e;
 const buttons=[];
 for(let v=1;v<=6;v++){
  const matches=Array.from(document.querySelectorAll('button')).filter(e=>visible(e)&&e.textContent.trim()===String(v));
  if(matches.length!==1)throw Error('Expected one number button '+v);buttons.push(matches[0]);
 }
 return {grid,board,cells,buttons};
}
async function replayMiniSudoku(read,solve,control){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 if(control.cancelled)throw Error('Playback cancelled');
 const initial=read(),solution=solve(initial.board),identity=JSON.stringify([initial.board.givens,initial.board.regions]);
 function check(){
  if(control.cancelled)throw Error('Playback cancelled');
  const c=read();if(c.grid!==initial.grid||JSON.stringify([c.board.givens,c.board.regions])!==identity)throw Error('Sudoku puzzle changed');
  for(let i=0;i<36;i++)if(c.board.values[i]&&c.board.values[i]!==solution[i])throw Error('Existing value conflicts with solution at '+i+'; clear it manually');
  return c;
 }
 const last=solution.map((_,i)=>i).filter(i=>initial.board.values[i]!==solution[i]).at(-1);
 let c=check(),writes=0;
 for(let i=0;i<36;i++){
  c=check();if(c.board.values[i]===solution[i])continue;
  control.noteInput?.();
  const cell=c.cells[i];
  // Use a complete mouse gesture for grid controllers that select on release.
  try{cell.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,buttons:1}));}
  finally{cell.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,buttons:0}));}
  cell.click();await wait(40);c=check();
  const selected=c.cells[i],classes=selected.getAttribute('class')||'';
  if(selected.getAttribute('aria-selected')!=='true'&&!/\bsudoku-cell(?:--|-)(?:is-)?(?:selected|active)\b/.test(classes))throw Error('Cell selection not confirmed at '+i+': '+classes);
  if(c.board.values[i]!==0)throw Error('Cell changed during selection');
  if(i===last){await control.beforeFinish?.(check);c=check();}
  if(c.buttons[solution[i]-1].disabled)throw Error('Number '+solution[i]+' is disabled for selected cell '+i);
  c.buttons[solution[i]-1].click();writes++;
  let verified=false;
  for(let attempt=0;attempt<30;attempt++){await wait(20);c=check();if(c.board.values[i]===solution[i]){verified=true;break;}}
  if(!verified)throw Error('Number input did not set cell '+i+'; stopping');
  control.events.push('SUDOKU SET '+i+': '+solution[i]);
 }
 control.events.push(writes?'Sudoku inputs finished ('+writes+' cells). Check the save response.':'Sudoku already solved; no inputs sent.');
}
function observeMiniSudokuSaves(control){
 const originalFetch=window.fetch,XHR=window.XMLHttpRequest,requests=new WeakMap(),pending=new Set();
 const originalOpen=XHR?.prototype.open,originalSend=XHR?.prototype.send;
 function matches(url,body){
  try{return new URL(url,location.href).origin==='https://www.linkedin.com'&&typeof body==='string'&&/gameStoredRecord|gameBoardHasWon/.test(body);}catch(_){return false;}
 }
 function fetchWrapper(input,init){
  const result=originalFetch.apply(this,arguments);
  if(matches(typeof input==='string'?input:input?.url,init?.body)){
   control.events.push('SUDOKU FETCH SAVE [unchanged]: '+init.body);
   result.then(r=>r.clone().text().then(t=>control.events.push('SUDOKU FETCH RESPONSE HTTP '+r.status+': '+t))).catch(e=>control.events.push('Sudoku save observation failed: '+e.message));
  }
  return result;
 }
 function openWrapper(method,url){requests.set(this,String(url));return originalOpen.apply(this,arguments);}
 function sendWrapper(body){
  if(matches(requests.get(this),body)){
   control.events.push('SUDOKU XHR SAVE [unchanged]: '+body);
   const xhr=this,entry={xhr,done:null};
   entry.done=()=>{
    pending.delete(entry);xhr.removeEventListener('loadend',entry.done);
    try{
     const response=xhr.response,status=xhr.status;
     const report=text=>control.events.push('SUDOKU XHR RESPONSE HTTP '+status+': '+text);
     if(response&&typeof response.text==='function'){
      response.text().then(report).catch(e=>control.events.push('Sudoku response observation failed: '+e.message));
     }else{
      const binary=Object.prototype.toString.call(response)==='[object ArrayBuffer]'||ArrayBuffer.isView(response);
      const text=binary?new TextDecoder().decode(response):typeof response==='string'?response:JSON.stringify(response);
      report(text);
      if(text==='{}')control.events.push('SUDOKU RESPONSE FORMAT: '+xhr.responseType+' '+Object.prototype.toString.call(response));
     }
    }catch(e){control.events.push('Sudoku response observation failed: '+e.message);}
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
function installMiniSudokuPlayer(readBoard,parse,solve,replay,observe,action){
 if(!/^\/games\/view\/mini-sudoku\/?$/.test(location.pathname))return JSON.stringify({events:[],ready:false});
 const read=()=>readBoard(parse);
 if(!window.__miniSudokuPlayerV3){
  window.__miniSudokuPlayerV1?.stop();
  window.__miniSudokuPlayerV2?.stop();
  let restore=null;
  const control=window.__miniSudokuPlayerV3={events:[],cancelled:false,running:false,started:false,ready:false,auto:false,lastError:null,
   drain(){return JSON.stringify({events:this.events.splice(0),ready:this.ready,started:this.started});},
   inspect(){
    try{
     if(window.__gameTimerCap?.armed)throw Error('Stop timer spoofing before normal playback');
     const c=read(),solution=solve(c.board);
     for(let i=0;i<36;i++)if(c.board.values[i]&&c.board.values[i]!==solution[i])throw Error('Existing value conflicts with solution at '+i);
     if(!this.ready)this.events.push('SUDOKU READY: 6x6, '+c.board.givens.filter(Boolean).length+' givens, unique solution. Timer unchanged.');
     this.ready=true;this.lastError=null;return true;
    }catch(e){this.ready=false;if(e.message!==this.lastError)this.events.push('SUDOKU NOT READY: '+e.message);this.lastError=e.message;return false;}
   },
   play(){
    if(this.running||!this.inspect())return;
    this.started=true;this.cancelled=false;this.running=true;if(!restore)restore=observe(this);
    this.events.push('Playing Mini Sudoku through normal cell and number-button input. Timer unchanged.');
    replay(read,solve,this).catch(e=>this.events.push('SUDOKU STOPPED: '+e.message)).finally(()=>{this.running=false;});
   },
   tick(){if(this.auto&&!this.started&&this.inspect())this.play();},
   stop(){this.cancelled=true;this.auto=false;if(restore)restore();restore=null;this.events.push('Sudoku player stopped; save observers restored.');}
  };
 }
 const control=window.__miniSudokuPlayerV3;
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
    try{if(!error.isNull())console.log('MiniSudoku WebView error: '+new ObjC.Object(error));else if(!result.isNull())report(new ObjC.Object(result).toString());}
    finally{callbacks.delete(callback);busy=false;if(queued){const next=queued;queued=null;evaluate(next,true);}}
   }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
  });
 }
 function invoke(action){evaluate('('+installMiniSudokuPlayer.toString()+')('+[readMiniSudokuContext,parseMiniSudokuCells,solveMiniSudoku,replayMiniSudoku,observeMiniSudokuSaves].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);}
 function locate(action){
  if(view){invoke(action);return;}if(locating)return;locating=true;const run=generation;
  ObjC.schedule(ObjC.mainQueue,()=>{
   try{if(run!==generation)return;const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'mini-sudoku');if(found){view=found.retain();invoke(action);}}
   catch(error){console.log('MiniSudoku discovery failed: '+error.message);}finally{if(run===generation)locating=false;}
  });
 }
 globalThis.watchMiniSudoku=function(){
  if(watcher){console.log('Already waiting for MiniSudoku');return;}attempts=0;generation++;locating=false;
  console.log('AUTO: waiting for MiniSudoku. It will play once its puzzle and cell states validate.');
  watcher=setInterval(()=>{
   if(++attempts>60){clearInterval(watcher);watcher=null;if(poll)clearInterval(poll);poll=null;generation++;console.log('MiniSudoku discovery timed out; polling stopped.');return;}
   locate('auto');
  },1000);
  if(!poll){let ticks=0;poll=setInterval(()=>{
   if(++ticks>120){stopMiniSudokuPlayer();console.log('Mini Sudoku observation timed out; player and polling stopped.');return;}
   evaluate('window.__miniSudokuPlayerV3 ? window.__miniSudokuPlayerV3.drain() : JSON.stringify({events:[]})');
  },1000);}
  locate('auto');
 };
 globalThis.inspectMiniSudoku=()=>locate('inspect');
 globalThis.playMiniSudoku=()=>locate('play');
 globalThis.stopMiniSudokuPlayer=()=>{
  generation++;locating=false;if(watcher)clearInterval(watcher);if(poll)clearInterval(poll);watcher=poll=null;
  if(view)invoke('stop');else console.log('MiniSudoku watcher stopped');
 };
 console.log('MiniSudoku AUTO player. Normal timer and saves. stopMiniSudokuPlayer() cancels; inspectMiniSudoku() reports readiness.');
 watchMiniSudoku();
}
