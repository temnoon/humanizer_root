/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ARCHIVE_API_URL: string;
  readonly VITE_OLLAMA_URL: string;
  readonly VITE_CHAT_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
