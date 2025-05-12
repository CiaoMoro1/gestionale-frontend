// src/components/EvadiStatus.tsx
export function EvadiStatus({ stato, tot, disponibili }: { stato: "green" | "yellow" | "red"; tot: number; disponibili: number }) {
  const base = "text-[clamp(1rem,1.6vw,1.2rem)] font-semibold rounded-full px-3 py-2";
  const label = `${disponibili}/${tot}`;

  const colorClasses =
    stato === "green"
      ? "bg-green-600 text-white"
      : stato === "yellow"
      ? "bg-yellow-300 text-black"
      : "bg-gray-300 text-gray-600";

  return (
    <div className="relative w-fit mx-auto">
      <span className={`${base} ${colorClasses}`}>{label}</span>

      {stato === "red" && (
        <span className="absolute -right-3 -top-3 opacity-30 hover:opacity-100 transition-opacity text-[clamp(1rem,2vw,1.25rem)]">
          🔒
        </span>
      )}
    </div>
  );
}