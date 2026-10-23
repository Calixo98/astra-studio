// Local-only production preview: serve dist with the exact versioned Vercel headers.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const config=JSON.parse((await readFile('vercel.json','utf8')).replace(/^\uFEFF/,''));
const headers=Object.fromEntries(config.headers[0].headers.map(({key,value})=>[key,value]));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403,headers);res.end();return;}
    const data=await readFile(file);
    res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)]??'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404,headers);res.end('Not found');}
}).listen(Number(process.env.PORT??4173),'127.0.0.1',()=>console.log('Local security preview on http://127.0.0.1:'+(process.env.PORT??4173)));
