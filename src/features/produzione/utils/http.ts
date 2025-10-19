/* src/features/produzione/utils/http.ts */

export function currentUserName(): string {
  return window.APP_USER_NAME || localStorage.getItem("userName") || "Operatore";
}

export function headersJson(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-USER-NAME": currentUserName(),
  };
}

/** Helper per URL base API */
export function apiUrl(path: string, params?: Record<string, string | number | undefined | null>) {
  const url = new URL(`${import.meta.env.VITE_API_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}
