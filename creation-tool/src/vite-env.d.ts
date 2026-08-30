/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" switches api.ts from Tauri invoke() to the HTTP test server. */
  readonly VITE_USE_HTTP_API?: string;
  /** Base URL of the Rust HTTP test server. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Injected by the Tauri runtime; absent in a plain browser (e2e test mode). */
  __TAURI_INTERNALS__?: unknown;
}
