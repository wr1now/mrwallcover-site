/** Customer money and compute reservations are intentionally separate ledgers. */
export type RenderOrderState = 'checkout_pending'|'expired'|'paid'|'queued'|'running'|'delivered'|'refund_pending'|'refund_failed'|'refunded'|'support_requested';
export interface RenderOrder {
  id:string; projectId:string|null; revisionId:string|null; state:RenderOrderState;
  amountPence:number; currency:string; packageSha256:string;
  checkoutUrl?:string; expiresAt:string; jobId?:string; error?:string;
  processingStarted?:boolean; supportRequestedAt?:string|null;
  createdAt:string; updatedAt:string;
}
export interface RenderQuote {
  available:boolean; amountPence:number|null; currency:string;
  outputs:{stills:number; width:number; height:number; panoramaWidth:number; panoramaHeight:number};
  reason?:string;
}
