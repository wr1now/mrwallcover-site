import { verifyStripeSignature, type PaymentConfig, type StripeSession } from './commerce.ts';
type Rpc=(name:string,args:Record<string,unknown>)=>Promise<any>;
/** Stripe signs the untouched body. A fresh authenticated provider read, rather
 * than the customer redirect or event payload alone, decides fulfilment. */
export function paymentHandler(config:PaymentConfig,rpc:Rpc,getSession:(id:string)=>Promise<StripeSession>){
  return async(request:Request):Promise<Response>=>{
    const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
    if(request.method!=='POST')return reply({error:'Use POST'},405);
    try {
      if(Number(request.headers.get('content-length'))>256000)return reply({error:'Payment event too large'},413);
      const reader=request.body?.getReader();let raw='';const decoder=new TextDecoder();let size=0;
      if(!reader)throw new Error('Missing payment body');
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256000){await reader.cancel();return reply({error:'Payment event too large'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
      await verifyStripeSignature(raw,request.headers.get('stripe-signature'),config.webhookSecret);
      const event=JSON.parse(raw);
      if(!/^evt_[A-Za-z0-9_]+$/.test(event.id)||typeof event.type!=='string')throw new Error('Invalid payment event');
      if(event.type==='checkout.session.expired'){await rpc('room_expire_checkouts',{});return reply({received:true});}
      if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return reply({received:true});
      const session=await getSession(event.data?.object?.id);
      if(session.livemode&&!config.liveEnabled)throw new Error('Live payment handling is disabled');
      if(session.payment_status!=='paid')return reply({received:true});
      const metadata=session.metadata||{},intent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
      if(session.client_reference_id!==metadata.orderId||!Number.isSafeInteger(session.amount_total)||session.amount_total<=0||!intent)throw new Error('Payment identity unavailable');
      await rpc('room_receive_payment',{p_event:event.id,p_kind:event.type,p_order:metadata.orderId,p_session:session.id,p_payment:intent,p_amount:session.amount_total,p_currency:session.currency,p_owner:metadata.ownerId,p_project:metadata.projectId,p_revision:metadata.revisionId,p_hash:metadata.packageSha256});
      return reply({received:true});
    }catch{return reply({error:'Payment verification failed; retry the event or contact the operator'},400);}
  };
}
