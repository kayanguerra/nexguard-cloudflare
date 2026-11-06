import {ready} from '../../server/request.mjs';
import {json} from '../../server/response.mjs';
export function onRequest({request,env}){
  if(request.method!=='GET')return json({error:'Método não permitido.'},405,{Allow:'GET'});
  return json({ready:ready(env),siteKey:env.TURNSTILE_SITE_KEY||null});
}
