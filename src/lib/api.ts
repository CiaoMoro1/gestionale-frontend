// src/lib/api.ts
const API_URL: string = import.meta.env.VITE_API_URL as string;

// Dichiara la proprietà opzionale in Window (no any)
declare global {
  interface Window {
    APP_USER_NAME?: string;
  }
}

/** Ritorna il nome utente da header FE (tipizzato). */
export function getUserName(): string {
  return window.APP_USER_NAME ?? localStorage.getItem("userName") ?? "Operatore";
}

/** Join robusto per evitare doppie / o slash mancanti. */
function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Fetch verso il backend Flask con header X-USER-NAME sempre presente.
 * Niente any. Mergiamo headers in modo typesafe usando `Headers`.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const h = new Headers(init.headers); // accetta HeadersInit in ingresso
  // Imposta/forza gli header richiesti
  if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
  h.set("X-USER-NAME", getUserName());

  return fetch(joinUrl(API_URL, path), {
    ...init,
    headers: h,
  });
}
