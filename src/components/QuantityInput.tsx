import { useState } from "react"
import { useUpdateQuantity } from "../hooks/useUpdateQuantity"

type Props = {
  productId: string
  initialQuantity: number
}

export function QuantityInput({ productId, initialQuantity }: Props) {
  const [adjustment, setAdjustment] = useState<string>("0")
  const [showToast, setShowToast] = useState(false)
  const { mutate, status } = useUpdateQuantity()
  const isLoading = status === "pending"

  const parsedAdjustment = parseInt(adjustment) || 0
  const computedFinal = initialQuantity + parsedAdjustment

  const handleDeltaChange = (delta: number) => {
    const current = parseInt(adjustment) || 0
    setAdjustment((current + delta).toString())
  }

  const handleManualDelta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (/^-?\d*$/.test(val)) setAdjustment(val)
  }

  const handleSave = () => {
    const value = parseInt(adjustment)
    if (isNaN(value)) return
    mutate(
      { productId, value, mode: "delta" },
      {
        onSuccess: () => {
          setShowToast(true)
          setTimeout(() => setShowToast(false), 1500)
          setAdjustment("0")
        },
      }
    )
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="relative flex flex-col gap-1">
      {/* Box quantità attuale */}
      <div className="text-sm text-gray-700">
        Quantità attuale:{" "}
        <span className="font-bold text-black">{initialQuantity}</span>
      </div>

      {/* Box quantità finale */}
      <div className="text-sm text-gray-800">
        Dopo modifica:{" "}
        <span className="font-bold text-blue-600">{computedFinal}</span>
      </div>

      {/* Controlli delta */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => handleDeltaChange(-1)}
          className="px-2 py-1 bg-gray-200 rounded"
          disabled={isLoading}
        >
          −
        </button>
        <input
          type="text"
          value={adjustment}
          onChange={handleManualDelta}
          className="w-16 text-center border rounded"
          disabled={isLoading}
        />
        <button
          onClick={() => handleDeltaChange(1)}
          className="px-2 py-1 bg-gray-200 rounded"
          disabled={isLoading}
        >
          +
        </button>

        <button
          onClick={handleSave}
          className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded shadow"
          disabled={isLoading || parsedAdjustment === 0}
        >
          Salva
        </button>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="mt-1 px-3 py-1 bg-green-600 text-white text-xs rounded shadow w-fit">
          ✅ Salvato
        </div>
      )}
    </div>
  )
}
