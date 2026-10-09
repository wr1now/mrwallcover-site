/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_FORM_PROVIDER?: string;
  readonly PUBLIC_FORM_ENDPOINT?: string;
  readonly PUBLIC_ANALYTICS_SRC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
