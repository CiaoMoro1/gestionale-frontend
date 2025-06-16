type OrderAddressFormProps = {
  order: any;
  formData: {
    shipping_address: string;
    shipping_zip: string;
    shipping_city: string;
    shipping_province: string;
    shipping_country: string;
  };
  setFormData: (data: any) => void;
  parcelCount: number;
  setParcelCount: (val: number) => void;
  onSave: () => void;
  loading: boolean;
  badge: { type: "success" | "error"; message: string } | null;
};

export default function OrderAddressForm({
  order,
  formData,
  setFormData,
  parcelCount,
  setParcelCount,
  onSave,
  loading,
}: OrderAddressFormProps) {
  const paymentLabel: Record<string, string> = {
    contrassegno: "Pagamento alla consegna (contrassegno)",
    paid: "Pagato",
    pending: "Pagamento in attesa",
  };
  const paymentStatusKey = (order?.payment_status || "").toLowerCase();
  const paymentString = paymentLabel.hasOwnProperty(paymentStatusKey)
    ? paymentLabel[paymentStatusKey]
    : order?.payment_status || "—";

  return (
    <div className="bg-gray-50 rounded-2xl p-5 shadow space-y-3">
      <div className="text-fluid-base text-gray-800">
        <span className="font-semibold">Cliente:</span> {order.customer_name}
      </div>
      <div className="flex gap-4">
        <div>
          <span className="font-semibold">Tipo pagamento:</span> {paymentString}
        </div>
        <div>
          <span className="font-semibold">Totale:</span> {order.total ? `€ ${order.total}` : "—"}
        </div>
      </div>
      <div className="flex gap-4 items-center">
        <label className="font-semibold text-gray-600">Colli:</label>
        <input
          className="rounded-xl border px-2 py-1 w-16 text-center font-bold"
          type="number"
          min={1}
          max={10}
          value={parcelCount}
          onChange={e => setParcelCount(Math.max(1, parseInt(e.target.value) || 1))}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex-1">
          <label className="text-fluid-sm text-gray-500">Indirizzo</label>
          <input
            className="block w-full rounded-xl border px-3 py-2 text-fluid-base"
            type="text"
            value={formData.shipping_address}
            onChange={e => setFormData({ ...formData, shipping_address: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="w-28">
          <label className="text-fluid-sm text-gray-500">CAP</label>
          <input
            className="block w-full rounded-xl border px-3 py-2 text-fluid-base"
            type="text"
            value={formData.shipping_zip}
            onChange={e => setFormData({ ...formData, shipping_zip: e.target.value })}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex-1">
          <label className="text-fluid-sm text-gray-500">Città</label>
          <input
            className="block w-full rounded-xl border px-3 py-2 text-fluid-base"
            type="text"
            value={formData.shipping_city}
            onChange={e => setFormData({ ...formData, shipping_city: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="w-28">
          <label className="text-fluid-sm text-gray-500">Provincia</label>
          <input
            className="block w-full rounded-xl border px-3 py-2 text-fluid-base"
            type="text"
            value={formData.shipping_province}
            onChange={e => setFormData({ ...formData, shipping_province: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="w-24">
          <label className="text-fluid-sm text-gray-500">Nazione</label>
          <input
            className="block w-full rounded-xl border px-3 py-2 text-fluid-base"
            type="text"
            value={formData.shipping_country}
            onChange={e => setFormData({ ...formData, shipping_country: e.target.value })}
            autoComplete="off"
          />
        </div>
      </div>
      <button
        className="mt-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-5 py-3 text-fluid-base font-semibold shadow w-full sm:w-auto transition"
        onClick={onSave}
        disabled={loading}
      >
        Salva indirizzo e colli
      </button>
    </div>
  );
}
