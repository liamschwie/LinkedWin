const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const runtime={},file=__dirname+'/wend-play.js';if(fs.existsSync(file))vm.runInNewContext(fs.readFileSync(file,'utf8'),runtime);
assert.equal(typeof runtime.validateWendPuzzle,'function','Wend validator exists');
const puzzle={gridRows:3,gridCols:3,gridSize:0,puzzleLetters:['A','B','C','','','','D','E','F'],solutionWords:[{sequencingIndex:[0,1,2]},{sequencingIndex:[6,7,8]}],presetWordsIndexes:[],presets:[]};
assert.deepEqual(Array.from(runtime.validateWendPuzzle(puzzle),p=>Array.from(p)),[[0,1,2],[6,7,8]]);
let bad=structuredClone(puzzle);bad.solutionWords[0].sequencingIndex=[0,2,1];assert.throws(()=>runtime.validateWendPuzzle(bad),/adjacent/i);
bad=structuredClone(puzzle);bad.solutionWords[0].sequencingIndex=[0,1,4];assert.throws(()=>runtime.validateWendPuzzle(bad),/hole/i);
bad=structuredClone(puzzle);bad.solutionWords.pop();assert.throws(()=>runtime.validateWendPuzzle(bad),/cover/i);
bad=structuredClone(puzzle);bad.solutionWords.push({sequencingIndex:[0,1,2]});assert.throws(()=>runtime.validateWendPuzzle(bad),/overlap/i);
bad=structuredClone(puzzle);bad.presets=[{}];assert.throws(()=>runtime.validateWendPuzzle(bad),/preset/i);
(async()=>{
 let committed=[],active=null,down=null,moving=false;const events=[];
 const hook={memoizedState:[],next:null},root={memoizedProps:{game:{puzzle:{wendGamePuzzle:puzzle},gameUrn:{puzzleId:42}}},memoizedState:hook,child:null,sibling:null};
 function publish(){hook.memoizedState=[...committed,...(active?[{sequencingIndex:active.slice()}]:[])];}
 const grid={gridRows:3,gridCols:3,isDragEnabled:true,onStartDrag(){},onDragging(){},onEndDrag(){},renderCell:i=>{
  const w=hook.memoizedState.find(w=>w.sequencingIndex.includes(i));
  return {props:{idx:i,letter:puzzle.puzzleLetters[i],isSelected:!!w,positionInWord:w?w.sequencingIndex.indexOf(i):undefined}};
 }};root.child={memoizedProps:grid,child:null,sibling:null};
 const stale={return:null,stateNode:{current:root}};
 const cells=Array.from({length:9},(_,i)=>({textContent:puzzle.puzzleLetters[i],getAttribute:k=>k==='data-cell-idx'?String(i):null,getBoundingClientRect:()=>({x:(i%3)*60,y:Math.floor(i/3)*60,width:60,height:60}),dispatchEvent(e){
  events.push([i,e.type,e.clientX]);
  if(e.type==='mousedown'){down={i,x:e.clientX,y:e.clientY};moving=false;}
  if(e.type==='mousemove'&&down){if(!moving&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10){moving=true;active=[down.i];}if(moving&&active.at(-1)!==i)active.push(i);publish();}
  if(e.type==='mouseup'){if(active&&active.length>1)committed.push({sequencingIndex:active.slice()});active=null;down=null;publish();}
 }}));cells[0]['__reactFiber$test']={return:stale};
 runtime.document={querySelectorAll:()=>cells};runtime.location={pathname:'/games/view/wend',href:'https://www.linkedin.com/games/view/wend'};runtime.window={innerWidth:400,innerHeight:800};runtime.setTimeout=fn=>fn();runtime.MouseEvent=function(type,props){this.type=type;Object.assign(this,props);};
 const control={cancelled:false,events:[]};
 let finishes=0,noted=0;control.noteInput=()=>noted++;control.beforeFinish=async check=>{finishes++;check();};
 await runtime.replayWend(runtime.readWendContext,runtime.validateWendPuzzle,runtime.checkWendProgress,control);assert(finishes>0&&noted>0,'finishing action passes through the shared completion gate');delete control.beforeFinish;delete control.noteInput;
 assert.deepEqual(committed.map(w=>Array.from(w.sequencingIndex)),[[0,1,2],[6,7,8]]);
 grid.isDragEnabled=false;
 await runtime.replayWend(runtime.readWendContext,runtime.validateWendPuzzle,runtime.checkWendProgress,control);
 assert.equal(events.filter(e=>e[1]==='mouseup').length,2,'completed disabled board is read without replay');
 grid.isDragEnabled=true;
 assert.equal(events.filter(e=>e[1]==='mouseup').length,2);assert.equal(events[1][2]-events[0][2],12,'cross drag threshold inside starting cell');
 events.length=0;await runtime.replayWend(runtime.readWendContext,runtime.validateWendPuzzle,runtime.checkWendProgress,control);assert.equal(events.length,0);
 await assert.rejects(runtime.replayWend(runtime.readWendContext,runtime.validateWendPuzzle,runtime.checkWendProgress,{cancelled:true,events:[]}),/cancel/i);
 committed=[{sequencingIndex:[0,1]}];publish();await assert.rejects(runtime.replayWend(runtime.readWendContext,runtime.validateWendPuzzle,runtime.checkWendProgress,control),/existing/i);assert.equal(events.length,0);
 committed=[];publish();const dispatch=cells[0].dispatchEvent;cells[0].dispatchEvent=function(e){dispatch.call(this,e);if(e.type==='mousedown')control.cancelled=true;};
 await assert.rejects(runtime.replayWend(runtime.readWendContext,runtime.validateWendPuzzle,runtime.checkWendProgress,control),/cancel/i);assert.equal(events.at(-1)[1],'mouseup');assert.equal(committed.length,0);control.cancelled=false;cells[0].dispatchEvent=dispatch;
 const render=grid.renderCell;grid.renderCell=i=>{const e=render(i);if(i===0)e.props.isSelected=true;return e;};
 assert.throws(()=>runtime.readWendContext(),/state/i,'rendered selection must agree with stored paths');grid.renderCell=render;
 const originals=cells.map(c=>c.dispatchEvent);for(const c of cells)c.dispatchEvent=e=>events.push([-1,e.type]);
 events.length=0;await assert.rejects(runtime.replayWend(runtime.readWendContext,runtime.validateWendPuzzle,runtime.checkWendProgress,control),/did not commit/i);assert.equal(events.filter(e=>e[1]==='mousedown').length,1,'ineffective playback stops after one word');
 cells.forEach((c,i)=>{c.dispatchEvent=originals[i];});events.length=0;
 const sent=[],originalFetch=(input,init)=>{sent.push(init);return Promise.resolve({status:200,clone(){return this;},text:async()=>'END_SOLVED'});};
 runtime.window.fetch=originalFetch;runtime.URL=URL;
 const helpers=['readWendContext','validateWendPuzzle','checkWendProgress','replayWend','observeWendSaves'].map(k=>runtime[k].toString()).join(',');
 const inject=action=>vm.runInNewContext('('+runtime.installWendPlayer.toString()+')('+helpers+','+JSON.stringify(action)+')',runtime);
 inject('auto');await new Promise(resolve=>setImmediate(resolve));assert.equal(committed.length,2,'serialized automatic installer plays both words');
 const request={method:'POST',body:JSON.stringify({states:[{key:'gameBoardHasWon',value:true}]})};
 await runtime.window.fetch('https://www.linkedin.com/flagship-web/rsc-action/actions/server-request?sduiid=updateGameState',request);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent[0],request);assert(JSON.parse(inject('drain')).events.some(e=>e.includes('WEND FETCH RESPONSE HTTP 200: END_SOLVED')));inject('stop');assert.equal(runtime.window.fetch,originalFetch);
 console.log('Wend: constraints, current root and rendered-state agreement, normal drag, threshold, lift between words, no-op, existing-path guards and cancellation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
