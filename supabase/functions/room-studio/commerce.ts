/** Small Stripe REST boundary. No SDK, account provisioning or key in browser code.
 * Transports are injectable so offline tests exercise the real protocol. */
export const STRIPE_API_VERSION='2026-09-30.endive'; // Verified against Stripe /api/versioning on 19 October 2026.
export interface TaxProfile { approved:true; mode:'inclusive'|'automatic'; taxCode:string; version:string; }
export interface PaymentConfig { enabled:boolean; secret:string; webhookSecret:string; liveEnabled:boolean; origin:string; }
export interface CheckoutOrder { id:string;owner_id:string;project_id:string;revision_id:string;amount_pence:number;currency:string;expires_at:string;checkout_expires_at?:string;package_sha256:string;tax_profile:TaxProfile; }
export interface StripeSession {id:string;url?:string;expires_at:number;payment_status:string;amount_total:number;currency:string;client_reference_id:string;metadata:Record<string,string>;payment_intent:string|{id:string}|null;livemode:boolean;}
export function checkoutConfigured(config:PaymentConfig):boolean {
  return config.enabled && config.webhookSecret.startsWith('whsec_') && (config.secret.startsWith('sk_test_')||(config.liveEnabled&&config.secret.startsWith('sk_live_'))) && /^https:\/\//.test(config.origin);
}
export function taxProfile(value:unknown):TaxProfile {
  const v=value as TaxProfile;
  if(!v||v.approved!==true||!['inclusive','automatic'].includes(v.mode)||!/^txcd_[0-9]+$/.test(v.taxCode)||typeof v.version!=='string'||!v.version||v.version.length>100)throw new Error('Approved tax configuration is required before checkout');
  return v;
}
export function createStripe(config:PaymentConfig,fetcher:typeof fetch=fetch) {
  async function request(path:string,method='GET',body?:URLSearchParams,key?:string,recovery=false):Promise<any>{
    if(!checkoutConfigured({...config,enabled:config.enabled||recovery}))throw new Error('Checkout is disabled until pricing and operating allowances are configured');
    const response=await fetcher('https://api.stripe.com/v1/'+path,{method,signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config.secret,'Stripe-Version':STRIPE_API_VERSION,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:body.toString()}:{})});
    const value=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error('The payment provider could not complete this request. Please retry.');
    return value;
  }
  return {
    async checkout(order:CheckoutOrder):Promise<StripeSession>{
      const tax=taxProfile(order.tax_profile);
      const p=new URLSearchParams({mode:'payment','payment_method_types[0]':'card',client_reference_id:order.id,expires_at:String(Math.floor(Date.parse(order.checkout_expires_at??order.expires_at)/1000)),success_url:config.origin+'/room-studio/?order='+order.id,cancel_url:config.origin+'/room-studio/?order='+order.id+'&checkout=cancelled','line_items[0][quantity]':'1','line_items[0][price_data][currency]':order.currency,'line_items[0][price_data][unit_amount]':String(order.amount_pence),'line_items[0][price_data][product_data][name]':'Mr Wallcover finished room render package','line_items[0][price_data][product_data][tax_code]':tax.taxCode,'line_items[0][price_data][tax_behavior]':tax.mode==='inclusive'?'inclusive':'exclusive'});
      // The advertised amount is always the total: automatic tax uses inclusive
      // pricing as well, so checkout never silently increases the frozen price.
      p.set('line_items[0][price_data][tax_behavior]','inclusive');
      p.set('automatic_tax[enabled]',tax.mode==='automatic'?'true':'false');
      if(tax.mode==='automatic')p.set('billing_address_collection','required');
      for(const [k,v] of Object.entries({orderId:order.id,ownerId:order.owner_id,projectId:order.project_id,revisionId:order.revision_id,packageSha256:order.package_sha256})){p.set(`metadata[${k}]`,v);p.set(`payment_intent_data[metadata][${k}]`,v);}
      const session=await request('checkout/sessions','POST',p,'room-checkout-'+order.id);
      if(!session.id?.startsWith('cs_')||!session.url||new URL(session.url).origin!=='https://checkout.stripe.com'||session.expires_at!==Number(p.get('expires_at')))throw new Error('Invalid checkout response; no render has been started');
      return session;
    },
    session:(id:string):Promise<StripeSession>=>{if(!/^cs_[A-Za-z0-9_]+$/.test(id))throw new Error('Invalid checkout identity');return request('checkout/sessions/'+id+'?expand[]=line_items','GET',undefined,undefined,true);},
    expire:(id:string)=>request('checkout/sessions/'+encodeURIComponent(id)+'/expire','POST',new URLSearchParams(),'room-expire-'+id,true),
    refund:(orderId:string,paymentIntent:string)=>{if(!/^pi_[A-Za-z0-9_]+$/.test(paymentIntent))throw new Error('Invalid payment identity');return request('refunds','POST',new URLSearchParams({payment_intent:paymentIntent,'metadata[orderId]':orderId}),'room-refund-'+orderId,true);},
  };
}
export async function verifyStripeSignature(raw:string,header:string|null,secret:string,now=Math.floor(Date.now()/1000)):Promise<void>{
  if(!secret.startsWith('whsec_')||!header)throw new Error('Invalid payment signature');
  const parts=header.split(',').map(v=>v.split('='));const timestamps=parts.filter(([k])=>k==='t');
  if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]))throw new Error('Invalid payment signature');
  const t=Number(timestamps[0][1]);if(Math.abs(now-t)>300)throw new Error('Expired payment signature');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw)));
  const expected=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const signatures=parts.filter(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v)).map(([,v])=>v);
  if(!signatures.some(v=>{let different=0;for(let i=0;i<64;i++)different|=v.charCodeAt(i)^expected.charCodeAt(i);return different===0;}))throw new Error('Invalid payment signature');
}
