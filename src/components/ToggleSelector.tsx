// src/components/ToggleSelector.tsx
type Props = {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function ToggleSelector({ checked, disabled, onToggle }: Props) {
  if (disabled) return <span className="text-gray-300">—</span>;

  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label="Seleziona ordine"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`w-10 h-6 rounded-full transition-colors duration-300 relative ${
        checked ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}
