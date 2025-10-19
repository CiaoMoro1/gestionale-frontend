/* src/features/produzione/components/FiltersBar/CanaleSelect.tsx */
export function CanaleSelect({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">Canale</label>
      <select
        className="px-3 py-2 border rounded-xl shadow-sm bg-white font-bold text-base text-cyan-800 transition border-gray-300"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minWidth: 180 }}
      >
        <option value="">Tutti</option>
        <option value="Amazon Vendor">Amazon Vendor</option>
        <option value="Sito">Sito</option>
        <option value="Amazon Seller">Amazon Seller</option>
      </select>
    </div>
  );
}
