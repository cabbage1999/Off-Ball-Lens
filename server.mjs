import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {explain,foundryConfiguration} from './src/agent.mjs';
import {listScenarios} from './src/scenarios.mjs';
import {MODEL_VERSION} from './src/model.mjs';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.md':'text/markdown; charset=utf-8'};
const SECURITY={'x-content-type-options':'nosniff','referrer-policy':'same-origin','x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};

function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...SECURITY});res.end(JSON.stringify(data));}
async function readJson(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))throw Object.assign(new Error('Use application/json'),{status:415});
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>12000)throw Object.assign(new Error('Request is too large'),{status:413});chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
}

export function createServer(options={}){
  const env=options.env??process.env,root=path.resolve(options.root??ROOT),rates=new Map();let active=0,cloudVerified=false;
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://local.invalid'),pathname=decodeURIComponent(url.pathname);
      if(req.method==='GET'&&pathname==='/api/health'){
        const config=foundryConfiguration(env);
        return json(res,200,{ok:true,mode:config.configured?'cloud-configured':'offline',cloud:{configured:config.configured,verified:cloudVerified},model:MODEL_VERSION,message:cloudVerified?'A cloud explanation has completed and passed evidence validation during this server session.':config.configured?'A successful cloud explanation is needed to verify the connection.':'No complete Azure configuration. Deterministic local explanations are available.'});
      }
      if(req.method==='GET'&&pathname==='/api/scenarios')return json(res,200,{scenarios:listScenarios()});
      if(pathname==='/api/explain'){
        if(req.method!=='POST')return json(res,405,{error:'Use POST'});
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{return json(res,403,{error:'Invalid origin'});}
          if(origin.host!==req.headers.host)return json(res,403,{error:'Cross-origin requests are not accepted'});}
        const ip=req.socket.remoteAddress??'unknown',now=Date.now();
        if(rates.size>1000)for(const [key,value]of rates)if(now-value.start>60000)rates.delete(key);
        let rate=rates.get(ip);if(!rate||now-rate.start>60000){rate={start:now,count:0};rates.set(ip,rate);}
        if(++rate.count>20)return json(res,429,{error:'Too many explanation requests. Try again in a minute.'});
        if(active>=2)return json(res,503,{error:'Two explanation requests are already running. Try again shortly.'});
        const input=await readJson(req);
        // Body reads yield. Reserve a slot only after the body completes so
        // simultaneous header-first requests cannot all pass the earlier gate.
        if(active>=2)return json(res,503,{error:'Two explanation requests are already running. Try again shortly.'});
        active++;
        try{const output=await explain(input,{env,fetchImpl:options.fetchImpl,timeoutMs:options.timeoutMs});if(output.cloud.verified)cloudVerified=true;return json(res,200,output);}finally{active--;}
      }
      if(pathname.startsWith('/api/'))return json(res,404,{error:'Unknown API route'});
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
      const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),extension=path.extname(relative);
      if(relative.split('/').some(part=>part.startsWith('.'))||!MIME[extension]||!(/^(?:index\.html|app\.mjs|style\.css|favicon\.(?:svg|ico)|(?:src|data|docs|assets)\/[^\0]+)$/.test(relative)))return json(res,404,{error:'Not found'});
      let filename;try{filename=await realpath(path.resolve(root,relative));}catch{return json(res,404,{error:'Not found'});}
      if(!filename.startsWith(root+path.sep))return json(res,403,{error:'Forbidden path'});
      const body=await readFile(filename);res.writeHead(200,{'content-type':MIME[extension],'cache-control':'no-cache',...SECURITY});res.end(req.method==='HEAD'?undefined:body);
    }catch(error){json(res,error.status??(error instanceof TypeError||error instanceof RangeError?400:500),{error:error.status||error instanceof TypeError||error instanceof RangeError?error.message:'Request could not be completed'});}
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const port=Number(process.env.PORT??4173),host=process.env.HOST??'127.0.0.1';
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be 1–65535');
  const server=createServer();server.listen(port,host,()=>{
    const configured=foundryConfiguration(process.env).configured;
    console.log(`Off-Ball Lens: http://${host}:${port}`);
    console.log(configured?'Microsoft Foundry configured; connection not yet verified.':'Offline mode: no cloud call will be made.');
  });
}
