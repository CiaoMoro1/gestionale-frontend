// src/components/Modal.tsx
import type { ReactNode } from "react";
import { useEffect } from "react";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  footer?: ReactNode; // 🔹 nuovo: area azioni in basso
};

export function Modal({ children, onClose, title, footer }: ModalProps) {
  // Blocca lo scroll del body quando il modale è aperto
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        // Mobile/tablet: quasi full-screen
        // Desktop: card centrata
        className="
          bg-white 
          w-full h-full max-w-full max-h-full 
          sm:w-[95%] sm:h-auto sm:max-w-5xl sm:max-h-[90vh] 
          rounded-none sm:rounded-2xl 
          shadow-2xl border border-gray-200
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b rounded-2xl bg-gray-50">
          <h2 className="text-[clamp(1rem,2.4vw,1.4rem)] font-semibold text-gray-800">
            {title ?? "Dettaglio"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 text-xl leading-none"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        {/* Contenuto scrollabile */}
        <div className="p-4 sm:p-6 overflow-auto flex-1">
          {children}
        </div>

        {/* Footer (opzionale) */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 border-t bg-white flex flex-col sm:flex-row rounded-b-2xl justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
