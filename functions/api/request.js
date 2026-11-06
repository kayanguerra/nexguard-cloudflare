import {handler} from '../../server/request.mjs';
export function onRequest({request,env}){return handler(request,env);}
