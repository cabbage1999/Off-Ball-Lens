import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from '../server.mjs';

test('HTTP integration: health, input validation, local explanation, and source protection',async()=>{
  const server=createServer({env:{}});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const health=await (await fetch(`${base}/api/health`)).json();assert.equal(health.cloud.configured,false);assert.equal(health.cloud.verified,false);
    const reply=await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenarioId:'crowded'})});
    assert.equal(reply.status,200);const result=await reply.json();assert.equal(result.source,'offline-template');assert.ok(result.summary.meanDelta<0);
    assert.equal((await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400);
    assert.equal((await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})).status,415);
    assert.equal((await fetch(`${base}/api/explain`,{method:'POST',headers:{'content-type':'application/json','origin':'https://unrelated.example'},body:'{}'})).status,403);
    assert.equal((await fetch(`${base}/.env`)).status,404);
    assert.equal((await fetch(`${base}/server.mjs`)).status,404);
    assert.equal((await fetch(`${base}/src/model.mjs`)).status,200);
    assert.equal((await fetch(`${base}/api/private`)).status,404);
  }finally{server.close();await once(server,'close');}
});

test('header-first simultaneous requests cannot bypass the two-request concurrency limit',async()=>{
  const env={AZURE_OPENAI_ENDPOINT:'https://test-resource.openai.azure.com',AZURE_OPENAI_API_KEY:'mock-only',AZURE_OPENAI_DEPLOYMENT:'mock-deployment'};
  let current=0,peak=0;
  const fetchImpl=async()=>{current++;peak=Math.max(peak,current);await delay(150);current--;return {ok:false,status:503};};
  const server=createServer({env,fetchImpl});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const body=JSON.stringify({scenarioId:'diagonal'}),requests=[];
    const results=[0,1,2].map(()=>new Promise((resolve,reject)=>{
      const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/explain',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.on('error',reject);req.flushHeaders();requests.push(req);
    }));
    await delay(30);for(const req of requests)req.end(body);
    const statuses=(await Promise.all(results)).sort();
    assert.deepEqual(statuses,[200,200,503]);assert.equal(peak,2);
  }finally{server.close();await once(server,'close');}
});
