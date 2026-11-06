import business from '../config/business.cjs';
import {json} from './response.mjs';
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function ready(env){
  return Boolean(env.RESEND_API_KEY&&env.MAIL_FROM&&emailPattern.test(env.MAIL_TO||'')&&env.MAIL_TO_CONFIRMED==='true'&&env.ALLOWED_ORIGINS&&env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY&&env.TURNSTILE_HOSTNAMES);
}
export function validate(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Dados inválidos.');
  const limits={name:120,email:254,phone:22,person:2,company:120,mode:10,city:120,state:2,service:120,message:5000,period:120,website:200,requestId:36,token:2048,flow:7};
  const d={};
  for(const [k,max]of Object.entries(limits)){
    if(raw[k]!==undefined&&typeof raw[k]!=='string')throw Error('Dados inválidos.');
    d[k]=(raw[k]||'').trim();
    if(d[k].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(d[k]))throw Error('Campo inválido: '+k);
  }
  if(!['quote','support'].includes(d.flow)||!['pf','pj'].includes(d.person)||!['remoto','presencial'].includes(d.mode))throw Error('Selecione o tipo de solicitação, cliente e modalidade.');
  if(d.name.length<2||/[\r\n]/.test(d.name)||!emailPattern.test(d.email)||/[\r\n]/.test(d.email))throw Error('Informe nome e e-mail válidos.');
  const phone=d.phone.replace(/\D/g,'');
  if(!/^[+0-9() .-]+$/.test(d.phone)||phone.length<10||phone.length>13)throw Error('Informe WhatsApp com DDD.');
  if(d.person==='pj'&&!d.company)throw Error('Informe o nome da empresa.');
  if((d.flow==='quote'||d.mode==='presencial')&&(!d.city||!states.has(d.state)))throw Error('Informe cidade e estado.');
  if(d.state&&!states.has(d.state))throw Error('Estado inválido.');
  if(d.flow==='quote'&&![...business.services,'Ainda não sei','Resultado do checkup de TI'].includes(d.service))throw Error('Selecione um serviço válido.');
  if(!d.service||d.message.length<10)throw Error('Informe o serviço e descreva a necessidade com pelo menos 10 caracteres.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.requestId))throw Error('Identificação inválida. Atualize a página.');
  if(!d.token||d.website)throw Error('Não foi possível validar a solicitação.');
  return d;
}

async function readBody(request){
  const reader=request.body?.getReader();
  if(!reader)throw new Error('Dados inválidos.');
  let size=0;const chunks=[];
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();const e=new Error('Solicitação muito longa.');e.status=413;throw e;}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handler(request,env){
  const fail=(status,error)=>json({error},status);
  if(request.method!=='POST')return json({error:'Método não permitido.'},405,{Allow:'POST'});
  if(!ready(env))return fail(503,'O envio está em configuração. Utilize o WhatsApp.');
  const origins=env.ALLOWED_ORIGINS.split(',').map(x=>x.trim());
  if(!origins.includes(request.headers.get('origin')))return fail(403,'Origem não autorizada.');
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail(415,'Formato não permitido.');
  if(Number(request.headers.get('content-length')||0)>32768)return fail(413,'Solicitação muito longa.');
  let data;
  try{data=validate(await readBody(request));}
  catch(error){return fail(error.status||400,error instanceof SyntaxError?'Dados inválidos.':error.message);}
  try{
    const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:data.token}),signal:AbortSignal.timeout(7000)
    });
    if(!verification.ok)return fail(503,'Verificação indisponível. Tente novamente.');
    const check=await verification.json();
    if(!check.success||check.action!=='request'||!env.TURNSTILE_HOSTNAMES.split(',').map(x=>x.trim()).includes(check.hostname))return fail(400,'Verificação expirada ou inválida. Conclua a verificação e tente novamente.');
    const {token,website,requestId,...safe}=data;
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(safe))))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const text=[
      data.flow==='support'?'Pedido de suporte':'Solicitação de orçamento',
      'Nome: '+data.name,'E-mail: '+data.email,'WhatsApp: '+data.phone,
      'Cliente: '+(data.person==='pj'?'Pessoa jurídica':'Pessoa física'),
      data.person==='pj'?'Empresa: '+data.company:null,
      'Modalidade: '+data.mode,'Local: '+[data.city,data.state].filter(Boolean).join(' / '),
      'Serviço / equipamento: '+data.service,data.period?'Melhor período: '+data.period:null,
      '',data.message
    ].filter(x=>x!==null).join('\n');
    const result=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'nexguard-'+requestId+'-'+digest},
      body:JSON.stringify({from:env.MAIL_FROM,to:[env.MAIL_TO],reply_to:data.email,subject:data.flow==='support'?'NexGuard — Pedido de suporte':'NexGuard — Solicitação de orçamento',text}),
      signal:AbortSignal.timeout(12000)
    });
    if(!result.ok)return fail(result.status===429?429:502,'Não foi possível confirmar o envio. Seus dados foram mantidos. Tente novamente ou utilize o WhatsApp.');
    const receipt=await result.json();
    if(!receipt.id)return fail(502,'Não foi possível confirmar o envio. Tente novamente.');
    return json({sent:true});
  }catch{
    return fail(502,'Não foi possível confirmar o envio. Seus dados foram mantidos. Tente novamente ou utilize o WhatsApp.');
  }
}
