// Summarize existing observer events without retaining account IDs or save payloads.
module.exports=function summarizeLinkedWinEvent(message,game){
 const clean=value=>String(value??'').replace(/(?:Bearer|Basic)\s+[^\s,"']+/gi,'[credential]').replace(/urn:[^\s"'<>]+/gi,'[id]').replace(/https?:\/\/[^\s"'<>]+/gi,'[url]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').replace(/[A-Za-z0-9_-]{24,}/g,'[id]').slice(0,400);
 const result={game,time:Date.now(),stage:'status'};
 const response=/RESPONSE HTTP (\d+):\s*([\s\S]*)/.exec(message),request=/(?:SAVE \[unchanged\]|COMPLETION REQUEST):\s*([\s\S]*)/.exec(message);
 if(!response&&!request){result.message=clean(message);return result;}
 result.stage=response?'response':'request';if(response)result.status=Number(response[1]);
 const text=response?response[2]:request[1];if(text.length>2000000){result.decoded=false;return result;}
 const documents=[];
 for(const line of text.split('\n').slice(0,100)){
  try{documents.push(JSON.parse(line.replace(/^[a-f0-9]+:/i,'')));}catch(_){}
 }
 if(!documents.length){result.decoded=false;return result;}
 const number=v=>{const n=typeof v==='object'?v?.value:v;return typeof n==='number'&&Number.isFinite(n)?n:typeof n==='string'&&/^-?\d+$/.test(n)?Number(n):undefined;};
 const stack=documents,seen=new Set();let count=0;
 while(stack.length&&count++<10000){
  const value=stack.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
  if(['IN_PROGRESS','END_SOLVED','END_REVEALED','NOT_STARTED'].includes(value.gamePlayState))result.gamePlayState=value.gamePlayState;
  if(number(value.timeElapsed)!==undefined)result.elapsedSeconds=number(value.timeElapsed);
  if(value.key==='gameBoardTimeElapsed'&&number(value.value)!==undefined)result.elapsedMs=number(value.value);
  if(value.key==='gameBoardHasWon'&&typeof value.value==='boolean')result.won=value.value;
  if(value.key==='gameBoardPuzzleId'&&number(value.value)!==undefined)result.puzzleId=number(value.value);
  if(typeof value.resourceKey==='string'){
   const ids=/,\s*(-?\d+),\s*(-?\d+)\)$/.exec(value.resourceKey);if(ids){result.gameType=Number(ids[1]);result.puzzleId=Number(ids[2]);}
  }
  if(response&&value.$type==='GameUpdateResponse')result.updateAcknowledged=true;
  if(Array.isArray(value.errors)){
   result.errors??=[];
   result.errors.push(...value.errors.slice(0,8-result.errors.length).map(error=>typeof error==='string'?{message:clean(error)}:{code:clean(error?.code??error?.errorCode??error?.status),message:clean(error?.message??error?.errorMessage??error?.exceptionClass)}));
  }
  for(const child of Object.values(value))if(child&&typeof child==='object')stack.push(child);
 }
 return result;
};
