const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const sandbox={};vm.runInNewContext(fs.readFileSync(__dirname+'/zip-play.js','utf8'),sandbox);
 const capture=JSON.parse(fs.readFileSync(__dirname+'/../tests/fixtures/zip-board.json','utf8'));
 const puzzle=capture.puzzles[0].value.trailGamePuzzle;
 const route=sandbox.validateZipPuzzle(puzzle);
 assert.deepEqual(Array.from(route),puzzle.solution);
 assert.throws(()=>sandbox.validateZipPuzzle({...puzzle,solution:[...puzzle.solution.slice(1),0]}),/checkpoint|start|finish|adjacent/i);
 assert.throws(()=>sandbox.validateZipPuzzle({...puzzle,solution:puzzle.solution.map(()=>0)}),/unique|every/i);
 assert.throws(()=>sandbox.validateZipPuzzle({...puzzle,walls:[{cellIdx:0,direction:'WallDirection_DOWN'}]}),/wall/i);
 let cancelDuring=null;
 class Cell {
  constructor(index){this.index=index;this.parentElement=null;}
  getAttribute(key){return key==='data-cell-idx'?String(this.index):null;}
  getBoundingClientRect(){return {x:(this.index%6)*50,y:Math.floor(this.index/6)*50,width:50,height:50};}
  dispatchEvent(event){event.target=this;const rect=this.getBoundingClientRect();event.offsetX=event.clientX-rect.x;event.offsetY=event.clientY-rect.y;
   if(event.type==='mousedown'){controller.startDrag(event);trace.push(controller.getCellIdx(event));}
   else if(event.type==='mousemove'){const result=controller.shouldHandleDrag(event);if(result&&trace.at(-1)!==result.cellIdx)trace.push(result.cellIdx);}
   else if(event.type==='mouseup')controller.finishDrag();if(cancelDuring&&event.type==='mousemove'&&this.index===12)cancelDuring.cancelled=true;return true;}
 }
 // A small threshold simulator keeps the source tree independent of app bundles.
 const controller={isMouseDown:false,dragging:false,x:0,y:0,
  getCellIdx(event){return event.target.index;},
  startDrag(event){this.isMouseDown=true;this.dragging=false;this.x=event.offsetX;this.y=event.offsetY;},
  shouldHandleDrag(event){
   if(!this.isMouseDown)return null;
   if(Math.hypot(event.offsetX-this.x,event.offsetY-this.y)>10)this.dragging=true;
   return this.dragging?{cellIdx:this.getCellIdx(event)}:null;
  },
  finishDrag(){this.isMouseDown=false;this.dragging=false;}
 },trace=[];
 const cells=new Map(Array.from({length:36},(_,i)=>[i,new Cell(i)]));
 const page={MouseEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},window:{innerWidth:400,innerHeight:800},setTimeout:fn=>fn()};
 vm.runInNewContext(fs.readFileSync(__dirname+'/zip-play.js','utf8'),page);
 await page.replayZipDrag(cells,route,{cancelled:false,events:[]});
 assert.deepEqual(trace,Array.from(route),'threshold simulator receives the exact full path');
 assert.equal(controller.isMouseDown,false,'mouse released after playback');
 const badCells=new Map(cells);badCells.delete(6);
 assert.throws(()=>page.checkZipCells(badCells,route),/missing/i);
 const cancel={cancelled:true,events:[]};trace.length=0;
 await assert.rejects(page.replayZipDrag(cells,route,cancel),/cancelled/i);
 assert.equal(controller.isMouseDown,false,'cancel releases drag state');
 cancelDuring={cancelled:false,events:[]};trace.length=0;
 await assert.rejects(page.replayZipDrag(cells,route,cancelDuring),/cancelled/i);
 assert.deepEqual(trace,[0,6,12],'mid-drag cancellation sends no remaining path');
 assert.equal(controller.isMouseDown,false,'mid-drag cancellation releases mouse');
 cancelDuring=null;trace.length=0;
 const sent=[];
 const originalFetch=(input,init)=>{sent.push({input,init});return Promise.resolve({status:200,clone(){return this;},text:async()=>'0:{"response":{"errors":[],"gamePlayState":"END_SOLVED"}}'});};
 page.URL=URL;page.location={pathname:'/games/view/zip',href:'https://www.linkedin.com/games/view/zip'};
 page.window.fetch=originalFetch;
 const grid={getBoundingClientRect:()=>({width:300,height:300}),querySelectorAll:()=>[...cells.values()]};
 page.document={querySelectorAll:()=>[grid]};
 const inject=action=>page.installZipPlayer(()=>JSON.stringify(capture),page.validateZipPuzzle,page.checkZipCells,page.replayZipDrag,action);
 let status=JSON.parse(inject('inspect'));
 assert(status.events.some(e=>e.includes('ZIP READY')));
 assert.equal(trace.length,0,'inspection does not start play');
 inject('play');await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(trace,Array.from(route),'installed player sends the validated route');
 const request={method:'POST',body:JSON.stringify({states:[{key:'gameBoardHasWon',value:true},{key:'gameBoardTimeElapsed',value:{type:'bigint',value:'4444'}}]})};
 await page.window.fetch('https://www.linkedin.com/flagship-web/rsc-action/actions/server-request?sduiid=updateGameState',request);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent[0].init,request,'completion request is observed without mutation');
 status=JSON.parse(inject('drain'));
 assert(status.events.some(e=>e.includes('ZIP SAVE completion: 4444 ms')));
 assert(status.events.some(e=>e.includes('ZIP COMPLETION RESPONSE HTTP 200')));
 inject('stop');assert.equal(page.window.fetch,originalFetch,'stop restores the fetch observer');
 console.log('Zip: captured route, adjacency/checkpoints/walls, missing cells, simulated drag path and cancellation passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
