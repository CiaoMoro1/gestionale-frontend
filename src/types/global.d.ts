// src/types/global.d.ts
export {};

declare global {
  interface Window {
    APP_USER_NAME?: string; // nome operatore messo dall'app
  }
}
