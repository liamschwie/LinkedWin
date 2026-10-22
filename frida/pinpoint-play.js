function validatePinpointPuzzle(p){
 if(!Array.isArray(p?.solutions)||!p.solutions.length)throw Error('Missing Pinpoint solutions');
 const answer=p.solutions[0];
 if(typeof answer!=='string'||!answer.trim()||answer.length>50)throw Error('Invalid Pinpoint answer');
 if(!Array.isArray(p.clues)||!p.clues.length||p.clues.length>5||p.clues.some(c=>typeof c!=='string'||!c.trim()))throw Error('Invalid Pinpoint clues');
 return answer;
}
function capturePinpointPuzzle(){
 const found=new Map();let decoded=0,bytes=0;
 for(const node of Array.from(document.querySelectorAll('code[id^="bpr-guid-"],script[type="application/json"]')).slice(0,60)){
  const text=node.textContent||'';if(text.length>3000000||!text.includes('blueprintGamePuzzle'))continue;
  if(++decoded>8||(bytes+=text.length)>8000000)break;
  let data;try{data=JSON.parse(text);}catch(_){continue;}
  const stack=[data],seen=new Set();let count=0;
  while(stack.length&&count++<50000){
   const value=stack.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
   const p=value.blueprintGamePuzzle;
   if(Array.isArray(p?.solutions)&&Array.isArray(p.clues)){
    const puzzle={solutions:p.solutions.slice(),clues:p.clues.slice()};
    found.set(JSON.stringify(puzzle),{puzzle,node,text});
   }
   for(const child of Object.values(value))if(child&&typeof child==='object')stack.push(child);
  }
 }
 if(found.size!==1)throw Error('Expected one embedded Pinpoint puzzle');return found.values().next().value;
}
function readPinpointContext(source){
 if(!/^\/games\/view\/pinpoint\/?$/.test(location.pathname)||source.node.isConnected===false||source.node.textContent!==source.text)throw Error('Pinpoint puzzle changed');
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 const roots=Array.from(document.querySelectorAll('.pinpoint__container')).filter(visible);
 if(roots.length!==1)throw Error('Expected one visible Pinpoint board');
 const root=roots[0],forms=Array.from(root.querySelectorAll('form.pinpoint__form')).filter(visible),inputs=Array.from(root.querySelectorAll('input.pinpoint__input')).filter(visible);
 if(forms.length!==1||inputs.length!==1||inputs[0].form!==forms[0])throw Error('Pinpoint answer form unavailable; board may already be solved');
 const input=inputs[0],form=forms[0];
 if(input.disabled||input.readOnly||typeof form.requestSubmit!=='function')throw Error('Pinpoint input must be enabled');
 return {puzzle:source.puzzle,root,input,form};
}
async function replayPinpoint(read,validate,control){
 function check(){if(control.cancelled)throw Error('Playback cancelled');return read();}
 let c=check();const answer=validate(c.puzzle);
 if(c.input.value&&c.input.value!==answer)throw Error('Existing Pinpoint guess conflicts; clear manually');
 const input=c.input,form=c.form;
 input.focus();input.click();c=check();
 if(c.input!==input||c.form!==form)throw Error('Pinpoint input changed');
 control.noteInput?.();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,answer);
 input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:answer}));
 await new Promise(resolve=>setTimeout(resolve,80));c=check();
 if(c.input!==input||c.form!==form||input.value!==answer||validate(c.puzzle)!==answer)throw Error('Pinpoint answer input not retained');
 await control.beforeFinish?.(check);c=check();
 if(c.input!==input||c.form!==form||input.value!==answer)throw Error('Pinpoint input changed before submission');
 form.requestSubmit();
 control.events.push('PINPOINT SUBMITTED: '+answer+'. Check the original completion response; input alone does not prove a saved win.');
}
function observePinpointSaves(control){
 const originalFetch=window.fetch,XHR=window.XMLHttpRequest,requests=new WeakMap(),pending=new Set();
 const originalOpen=XHR?.prototype.open,originalSend=XHR?.prototype.send;
 function matches(url,body){
  try{return new URL(url,location.href).origin==='https://www.linkedin.com'&&typeof body==='string'&&/gameStoredRecord|gameBoardHasWon/.test(body);}catch(_){return false;}
 }
 function fetchWrapper(input,init){
  const result=originalFetch.apply(this,arguments);
  if(matches(typeof input==='string'?input:input?.url,init?.body)){
   control.events.push('PINPOINT FETCH SAVE [unchanged]: '+init.body);
   result.then(r=>r.clone().text().then(t=>control.events.push('PINPOINT FETCH RESPONSE HTTP '+r.status+': '+t))).catch(e=>control.events.push('Pinpoint save observation failed: '+e.message));
  }
  return result;
 }
 function openWrapper(method,url){requests.set(this,String(url));return originalOpen.apply(this,arguments);}
 function sendWrapper(body){
  if(matches(requests.get(this),body)){
   control.events.push('PINPOINT XHR SAVE [unchanged]: '+body);
   const xhr=this,entry={xhr,done:null};
   entry.done=()=>{
    pending.delete(entry);xhr.removeEventListener('loadend',entry.done);
    try{
     const response=xhr.response,status=xhr.status;
     const report=text=>control.events.push('PINPOINT XHR RESPONSE HTTP '+status+': '+text);
     if(response&&typeof response.text==='function'){
      response.text().then(report).catch(e=>control.events.push('Pinpoint response observation failed: '+e.message));
     }else{
      const binary=Object.prototype.toString.call(response)==='[object ArrayBuffer]'||ArrayBuffer.isView(response);
      const text=binary?new TextDecoder().decode(response):typeof response==='string'?response:JSON.stringify(response);
      report(text);
      if(text==='{}')control.events.push('PINPOINT RESPONSE FORMAT: '+xhr.responseType+' '+Object.prototype.toString.call(response));
     }
    }catch(e){control.events.push('Pinpoint response observation failed: '+e.message);}
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
function installPinpointPlayer(capture,readBoard,validate,replay,observe,action){
 if(!/^\/games\/view\/pinpoint\/?$/.test(location.pathname))return JSON.stringify({events:[],ready:false});
 if(!window.__pinpointPlayerV1){
  let restore=null,source=null;
  const read=()=>{if(!source)source=capture();return readBoard(source);};
  const control=window.__pinpointPlayerV1={events:[],cancelled:false,running:false,started:false,ready:false,auto:false,lastError:null,
   drain(){return JSON.stringify({events:this.events.splice(0),ready:this.ready,started:this.started});},
   inspect(){
    try{
     if(window.__gameTimerCap?.armed)throw Error('Stop timer spoofing before normal playback');
     const c=read(),solution=validate(c.puzzle);
     if(!this.ready)this.events.push('PINPOINT READY: '+solution+'. Timer unchanged.');
     this.ready=true;this.lastError=null;return true;
    }catch(e){this.ready=false;if(e.message!==this.lastError)this.events.push('PINPOINT NOT READY: '+e.message);this.lastError=e.message;return false;}
   },
   play(){
    if(this.running||!this.inspect())return;
    this.started=true;this.cancelled=false;this.running=true;if(!restore)restore=observe(this);
    this.events.push('Playing Pinpoint through normal input and form submission. Timer unchanged.');
    replay(read,validate,this).catch(e=>this.events.push('PINPOINT STOPPED: '+e.message)).finally(()=>{this.running=false;});
   },
   tick(){if(this.auto&&!this.started&&this.inspect())this.play();},
   stop(){this.cancelled=true;this.auto=false;if(restore)restore();restore=null;this.events.push('Pinpoint player stopped; save observers restored.');}
  };
 }
 const control=window.__pinpointPlayerV1;
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
    try{if(!error.isNull())console.log('Pinpoint WebView error: '+new ObjC.Object(error));else if(!result.isNull())report(new ObjC.Object(result).toString());}
    finally{callbacks.delete(callback);busy=false;if(queued){const next=queued;queued=null;evaluate(next,true);}}
   }});callbacks.add(callback);view.evaluateJavaScript_completionHandler_(source,callback);
  });
 }
 function invoke(action){evaluate('('+installPinpointPlayer.toString()+')('+[capturePinpointPuzzle,readPinpointContext,validatePinpointPuzzle,replayPinpoint,observePinpointSaves].map(fn=>fn.toString()).join(',')+','+JSON.stringify(action)+')',true);}
 function locate(action){
  if(view){invoke(action);return;}if(locating)return;locating=true;const run=generation;
  ObjC.schedule(ObjC.mainQueue,()=>{
   try{if(run!==generation)return;const found=findVisibleGameWebView(ObjC.classes.UIApplication.sharedApplication().windows(),ObjC.classes.WKWebView,'pinpoint');if(found){view=found.retain();invoke(action);}}
   catch(error){console.log('Pinpoint discovery failed: '+error.message);}finally{if(run===generation)locating=false;}
  });
 }
 globalThis.watchPinpoint=function(){
  if(watcher){console.log('Already waiting for Pinpoint');return;}attempts=0;generation++;locating=false;
  console.log('AUTO: waiting for Pinpoint. It will play once its puzzle and cell states validate.');
  watcher=setInterval(()=>{
   if(++attempts>60){clearInterval(watcher);watcher=null;if(poll)clearInterval(poll);poll=null;generation++;console.log('Pinpoint discovery timed out; polling stopped.');return;}
   locate('auto');
  },1000);
  if(!poll){let ticks=0;poll=setInterval(()=>{
   if(++ticks>120){stopPinpointPlayer();console.log('Pinpoint observation timed out; player and polling stopped.');return;}
   evaluate('window.__pinpointPlayerV1 ? window.__pinpointPlayerV1.drain() : JSON.stringify({events:[]})');
  },1000);}
  locate('auto');
 };
 globalThis.inspectPinpoint=()=>locate('inspect');
 globalThis.playPinpoint=()=>locate('play');
 globalThis.stopPinpointPlayer=()=>{
  generation++;locating=false;if(watcher)clearInterval(watcher);if(poll)clearInterval(poll);watcher=poll=null;
  if(view)invoke('stop');else console.log('Pinpoint watcher stopped');
 };
 console.log('Pinpoint AUTO player. Normal timer and saves. stopPinpointPlayer() cancels; inspectPinpoint() reports readiness.');
 watchPinpoint();
}
