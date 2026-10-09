import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {requestJSON} from '../server/providers.mjs';
import {createApp} from '../server/index.mjs';
import {settingsSchema} from '../server/config.mjs';
const config=settingsSchema.parse({enabled:true,name:'Transport fixture',apiKey:'test-fixture-only',model:'fixture',format:'chat-completions',baseUrl:'https://fixture.invalid/v1',maxTokens:1800});
test('content provider observes cancellation while waiting for an upstream response',async()=>{
 const controller=new AbortController();let observed;
 const fetcher=async(_url,options)=>{observed=options.signal;return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));};
 const job=requestJSON(config,'JSON test',{},z.object({ok:z.boolean()}),fetcher,{signal:controller.signal});
 controller.abort();await assert.rejects(job,error=>error.code==='CANCELLED');assert.equal(observed.aborted,true);
});
test('planning gets a per-request output budget without mutating saved custom settings',async()=>{
 let received;const server=createApp({store:{get:()=>config},provider:async c=>{received=c;return null;}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/plan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({days:3,budget:1500,interests:['culture'],pace:'slow'})});assert.equal(response.status,200);assert.equal(received.maxTokens,3000);assert.equal(config.maxTokens,1800);assert.equal(received.baseUrl,config.baseUrl);}finally{await new Promise(r=>server.close(r));}
});