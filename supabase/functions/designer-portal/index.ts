import { createDesignerPortalHandler } from '../../../server/designer-portal/service.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

// The gateway may allow the deliberately public share.get action, but all other
// actions independently verify the bearer token against Auth /user in service.ts.
// No JWT decoding or browser-supplied role can confer permission.
export const handler = createDesignerPortalHandler({ env: Deno.env });
Deno.serve(handler);
