import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

type Articolo = {
  model_number: string;
  vendor_product_id: string;
  qty_ordered: number;
  po_number: string;
  fulfillment_center?: string;
};

type RigaInput = { quantita: number | ""; collo: number };

type Props = {
  articolo: Articolo;
  onClose: () => void;
  aggiungiParziali: (inputs: RigaInput[]) => Promise<void>;
  getParzialiStorici: (model_number: string) => { parziale: number; quantita: number }[];
  getResiduoInput: (idx: number, articolo: Articolo, inputs: RigaInput[]) => number;
};

export default function ModaleParziale({
  articolo,
  onClose,
  aggiungiParziali,
  getParzialiStorici,
  getResiduoInput
}: Props) {
  const [inputs, setInputs] = useState<RigaInput[]>([{ quantita: "", collo: 1 }]);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);

  useEffect(() => {
    setInputs([{ quantita: "", collo: 1 }]);
  }, [articolo.model_number]);

  function aggiornaInput(idx: number, campo: "quantita" | "collo", val: string | number) {
    setInputs((prev) => {
      return prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              [campo]:
                campo === "quantita"
                  ? (typeof val === "string" ? val.replace(/\D/g, "") : val)
                  : val === "" ? "" : Number(val),
            }
          : r
      );
    });
    if (campo === "quantita" && Number(val) > getResiduoInput(idx, articolo, inputs)) {
      setShakeIdx(idx);
      setTimeout(() => setShakeIdx(null), 400);
    }
  }

  function aggiungiRiga() {
    setInputs((prev) => [...prev, { quantita: "", collo: 1 }]);
  }
  function rimuoviRiga(idx: number) {
    setInputs((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function handleAggiungiParziali() {
    await aggiungiParziali(inputs);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-2xl p-5 shadow-lg min-w-[90vw] sm:min-w-[360px] w-full max-w-sm relative border flex flex-col"
        style={{ maxHeight: "92vh", minWidth: 0, width: "100%" }}
      >
        <button
          className="absolute top-3 right-3 text-neutral-400 hover:text-black text-2xl"
          onClick={onClose}
        >×</button>
        <div className="mb-1 font-bold text-blue-700 text-lg">Gestisci Parziali{articolo.fulfillment_center ? ` - ${articolo.fulfillment_center}` : ""}</div>
        <div className="mb-2 font-mono text-base flex items-center gap-3">
          <span className="bg-blue-100 px-2 py-1 rounded">
            {articolo.model_number} - Ordinati :{" "}
            <span className="inline-block px-2 py-0.5 bg-green-500 text-white rounded font-bold ml-1">
              {articolo.qty_ordered}
            </span>
          </span>
        </div>
        <div className="mb-2 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
          <b>EAN:</b>
          {articolo.vendor_product_id || <span className="text-neutral-300">N/A</span>}
        </div>
        {/* --- CONTENUTO SCORREVOLE --- */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, maxHeight: "50vh" }}>
          {/* Parziali precedenti sintesi */}
          <div className="mb-2">
            <div className="text-sm font-semibold mb-1">Parziali precedenti:</div>
            {getParzialiStorici(articolo.model_number).length === 0 ? (
              <div className="text-neutral-400 text-xs">Nessun parziale inserito</div>
            ) : (
              <span className="flex flex-wrap gap-2 text-xs">
                {getParzialiStorici(articolo.model_number).map((r, i) => (
                  <span key={i} className="bg-blue-100 px-2 py-0.5 rounded font-bold">
                    {r.quantita}
                  </span>
                ))}
              </span>
            )}
          </div>
          {/* Input Quantità + Collo affiancati, multipli */}
          <div className="flex flex-col gap-2 mb-3">
            {inputs.map((inp, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs mb-1">Quantità</label>
                  <input
                    type="number"
                    min={1}
                    max={getResiduoInput(idx, articolo, inputs)}
                    value={inp.quantita === 0 ? "" : inp.quantita}
                    onChange={e => {
                      let v = Number(e.target.value);
                      if (isNaN(v)) v = 0;
                      const max = getResiduoInput(idx, articolo, inputs);
                      if (v > max) {
                        v = max;
                        setShakeIdx(idx);
                        setTimeout(() => setShakeIdx(null), 400);
                      }
                      if (v < 1) v = 0;
                      aggiornaInput(idx, "quantita", v);
                    }}
                    className={`w-full border rounded-lg p-2 text-center font-bold text-blue-700 outline-blue-400 ${shakeIdx === idx ? "ring-2 ring-red-400 animate-shake" : ""}`}
                    placeholder="Quantità"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1">Collo</label>
                  <input
                    type="number"
                    min={1}
                    value={inp.collo === 0 ? "" : inp.collo}
                    onChange={e => {
                      let v = e.target.value;
                      if (v === "" || v === "0") {
                        aggiornaInput(idx, "collo", "");
                      } else {
                        let num = Number(v);
                        if (isNaN(num) || num < 1) num = 1;
                        aggiornaInput(idx, "collo", num);
                      }
                    }}
                    className="w-full border rounded-lg p-2 text-center font-bold outline-blue-400"
                    placeholder="Collo"
                  />
                </div>
                <button
                  className="ml-2 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                  onClick={() => rimuoviRiga(idx)}
                  disabled={inputs.length === 1}
                  title="Rimuovi riga"
                >
                  <Minus size={18} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-between mb-1">
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 font-semibold rounded-full hover:bg-blue-200 transition"
              onClick={aggiungiRiga}
            >
              <Plus size={18} /> Aggiungi Collo
            </button>
          </div>
        </div>
        {/* --- FINE CONTENUTO SCORREVOLE --- */}
        <div className="flex justify-end mt-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-full shadow hover:bg-blue-700 transition"
            onClick={handleAggiungiParziali}
            disabled={
              inputs.every((inp, idx) =>
                !inp.quantita ||
                inp.quantita <= 0 ||
                inp.collo <= 0 ||
                Number(inp.quantita) > getResiduoInput(idx, articolo, inputs)
              )
            }
          >
            Aggiungi
          </button>
        </div>
        <style>
          {`
            @keyframes shake {
              0% { transform: translateX(0);}
              20% { transform: translateX(-5px);}
              40% { transform: translateX(5px);}
              60% { transform: translateX(-5px);}
              80% { transform: translateX(5px);}
              100% { transform: translateX(0);}
            }
            .animate-shake { animation: shake 0.4s; }
          `}
        </style>
      </div>
    </div>
  );
}
