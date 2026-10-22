import { createStripe } from '../room-studio/commerce.ts';
import { paymentHandler } from '../room-studio/payment-handler.ts';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):unknown};
const env=(key:string)=>Deno.env.get(key)||'';
const base=env('SUPABASE_URL').replace(/\/$/,''),secret=env('SUPABASE_SERVICE_ROLE_KEY');
const config={enabled:env('ROOM_STUDIO_CHECKOUT_ENABLED')==='true',secret:env('ROOM_STUDIO_STRIPE_SECRET_KEY'),webhookSecret:env('ROOM_STUDIO_STRIPE_WEBHOOK_SECRET'),liveEnabled:env('ROOM_STUDIO_PAYMENTS_LIVE_ENABLED')==='true',origin:(env('ROOM_STUDIO_ALLOWED_ORIGINS')||'https://www.mrwallcover.com').split(',')[0].trim()};
const handler=paymentHandler(config,async(name,args)=>{
  if(!base||!secret)throw new Error('Private payment storage unavailable');
  const response=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!response.ok)throw new Error('Payment transaction unavailable');return response.json();
},createStripe(config).session);
// No user JWT/CORS requirement: the raw Stripe signature is the authentication.
Deno.serve(handler);
