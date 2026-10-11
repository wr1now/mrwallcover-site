/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly MW_CONTENT_PREVIEW?: string;
  readonly PUBLIC_FORM_PROVIDER?: string;
  readonly PUBLIC_FORM_ENDPOINT?: string;
  readonly PUBLIC_ANALYTICS_SRC?: string;
  readonly PUBLIC_LEAD_API?: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
