import { toast } from "react-hot-toast";

type ConfirmOpts = {
  title: string;
  message?: string;
  from?: string;
  to?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function confirmToast({
  title,
  message,
  from,
  to,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
}: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    // handler ESC (lo rimuoviamo quando chiudiamo)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(false);
    };

    // funzione di chiusura centralizzata
    const dismiss = (value: boolean) => {
      window.removeEventListener("keydown", onKey);
      toast.dismiss(id);
      resolve(value);
    };

    const id = toast.custom(
      () => (
        <div
          className="max-w-sm w-full rounded-xl border bg-white shadow-xl p-3"
          role="dialog"
          aria-modal="true"
        >
          <div className="font-bold text-slate-900">{title}</div>
          {message && <div className="text-sm text-slate-600 mt-1">{message}</div>}
          {(from || to) && (
            <div className="text-xs text-slate-500 mt-2">
              {from && (
                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 mr-2">
                  da: {from}
                </span>
              )}
              {to && (
                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  a: {to}
                </span>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button
              className="px-3 py-1.5 rounded-lg border text-sm bg-white hover:bg-slate-50"
              onClick={() => dismiss(false)}
            >
              {cancelLabel}
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => dismiss(true)}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: String(Math.random()) }
    );

    window.addEventListener("keydown", onKey);
  });
}
