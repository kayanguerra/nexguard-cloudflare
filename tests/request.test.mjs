
import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {handler,validate} from '../server/request.mjs';
import {onRequest as configHandler} from '../functions/api/config.js';
const originalFetch=global.fetch;
const valid=()=>({flow:'quote',name:'Cliente Teste',email:'cliente@example.com',phone:'(19) 99999-9999',person:'pf',mode:'remoto',city:'Campinas',state:'SP',service:'Computadores e notebooks',message:'Computador está lento.',requestId:'12345678-1234-4123-8123-123456789abc',token:'test-token',website:''});
const env={RESEND_API_KEY:'test',MAIL_FROM:'NexGuard <site@example.com>',MAIL_TO:'destino@example.com',MAIL_TO_CONFIRMED:'true',ALLOWED_ORIGINS:'https://example.com',TURNSTILE_SITE_KEY:'test',TURNSTILE_SECRET_KEY:'test',TURNSTILE_HOSTNAMES:'example.com'};
let saved;
beforeEach(()=>{saved={...process.env};Object.assign(process.env,env);});
afterEach(()=>{process.env=saved;global.fetch=originalFetch;});
async function run(body=valid(),headers={},method='POST'){
 const request=new Request('https://example.com/api/request',{method,headers:{origin:'https://example.com','content-type':'application/json',...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
 const response=await handler(request,process.env);
 return {code:response.status,body:await response.json()};
}
test('validação rejeita contatos, campos, empresa, local e spam inválidos',()=>{
 for(const patch of [{email:'erro'},{phone:'123'},{person:'pj'},{city:''},{state:'XX'},{message:'curta'},{service:'Backup gerenciado'},{website:'spam'},{name:['array']},{requestId:'x'},{message:'x'.repeat(5001)},{token:''}])assert.throws(()=>validate({...valid(),...patch}));
 assert.equal(validate({...valid(),flow:'support',city:'',state:'',service:'Notebook'}).flow,'support');
 assert.throws(()=>validate({...valid(),flow:'support',mode:'presencial',city:''}));
});
test('bloqueia método, origem, corpo e configuração ausente',async()=>{
 assert.equal((await run(undefined,{},'GET')).code,405);
 assert.equal((await run(valid(),{origin:'https://malicious.example'})).code,403);
 assert.equal((await run(valid(),{'content-type':'text/plain'})).code,415);
 assert.equal((await run(valid(),{'content-length':'40000'})).code,413);
 assert.equal((await run('{')).code,400);
 process.env.MAIL_TO_CONFIRMED='false';assert.equal((await run()).code,503);
});
test('captcha inválido impede envio',async()=>{
 let count=0;global.fetch=async()=>{count++;return{ok:true,json:async()=>({success:false})};};
 assert.equal((await run()).code,400);assert.equal(count,1);
});
test('hostname e action inválidos impedem envio',async()=>{
 for(const patch of [{hostname:'evil.example'},{action:'other'}]){
 global.fetch=async()=>({ok:true,json:async()=>({success:true,hostname:'example.com',action:'request',...patch})});
 assert.equal((await run()).code,400);
 }
});
test('sucesso somente após confirmação do provedor e idempotência estável',async()=>{
 const sent=[];
 global.fetch=async(url,options)=>{
 if(url.includes('siteverify'))return{ok:true,json:async()=>({success:true,hostname:'example.com',action:'request'})};
 sent.push(options);return{ok:true,json:async()=>({id:'mock-receipt'})};
 };
 assert.deepEqual((await run()).body,{sent:true});
 await run({...valid(),token:'novo-token'});
 assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);
 const mail=JSON.parse(sent[0].body);assert.equal(mail.reply_to,'cliente@example.com');assert.equal(mail.to[0],env.MAIL_TO);
 await run({...valid(),flow:'support',service:'Notebook'});
 assert.match(JSON.parse(sent[2].body).subject,/Pedido de suporte/);
});
test('falhas e respostas incompletas do provedor nunca simulam sucesso',async()=>{
 for(const response of [{ok:false,status:500},{ok:true,json:async()=>({})}]){
 global.fetch=async(url)=>url.includes('siteverify')?{ok:true,json:async()=>({success:true,hostname:'example.com',action:'request'})}:response;
 const res=await run();assert.equal(res.code,502);assert(!res.body.sent);
 }
 global.fetch=async()=>{throw Error('rede');};assert.equal((await run()).code,502);
});
test('build não publica preços não aprovados ou configuração privada',()=>{
 require('child_process').execFileSync(process.execPath,['scripts/build.cjs']);
 const fs=require('node:fs');assert.deepEqual(JSON.parse(fs.readFileSync('dist/assets/prices.json','utf8')),{approved:false,items:[]});
 assert(!fs.existsSync('dist/config'));assert(!fs.existsSync('dist/.env'));assert(!fs.existsSync('dist/AGENTS.MD.txt'));assert(!fs.existsSync('dist/.dev.vars'));
 const routes=JSON.parse(fs.readFileSync('dist/_routes.json'));assert.deepEqual(routes.include,['/api/*']);assert(fs.existsSync('dist/_headers'));
});

test('config pública nunca revela chaves secretas e rejeita outros métodos',async()=>{
 const response=configHandler({request:new Request('https://example.com/api/config'),env:process.env});
 const data=await response.json();assert.deepEqual(Object.keys(data).sort(),['ready','siteKey']);assert.equal(data.ready,true);
 const denied=configHandler({request:new Request('https://example.com/api/config',{method:'POST'}),env:process.env});assert.equal(denied.status,405);
});
test('corpo excessivo é bloqueado mesmo sem content-length',async()=>{
 const res=await run({...valid(),message:'x'.repeat(40000)});assert.equal(res.code,413);
});
