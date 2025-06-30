import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  onConfirm: () => void;
  text: string;
  colorClass?: string;
  disabled?: boolean;
};

export default function SlideToConfirm({
  onConfirm,
  text,
  colorClass = "bg-gray-400",
  disabled,
}: Props) {
  const [dragX, setDragX] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragXRef = useRef(0);

  // Dimensione pallino (deve essere la stessa usata sotto)
  const ballSize = 48;
  const ballSpace = ballSize + 8; // con margine

  function handlePointerDown(e: React.PointerEvent | React.TouchEvent) {
    if (disabled) return;
    setIsSliding(true);
    const startX =
      "touches" in e && e.touches
        ? e.touches[0].clientX
        : "clientX" in e
        ? e.clientX
        : 0;

    function getClientX(ev: any) {
      return ev.touches?.[0]?.clientX ?? ev.clientX ?? 0;
    }

    const moveListener = (ev: any) => {
      if (!containerRef.current) return;
      const maxX = containerRef.current.offsetWidth - ballSpace;
      const currX = getClientX(ev);
      const diff = Math.max(0, Math.min(currX - startX, maxX));
      setDragX(diff);
      dragXRef.current = diff;
    };

    const upListener = () => {
      if (!containerRef.current) return;
      const maxX = containerRef.current.offsetWidth - ballSpace;
      if (dragXRef.current > maxX * 0.8) {
        setDragX(maxX);
        setTimeout(onConfirm, 200);
      }
      setTimeout(() => setDragX(0), 180);
      setIsSliding(false);
      window.removeEventListener("pointermove", moveListener);
      window.removeEventListener("pointerup", upListener);
      window.removeEventListener("touchmove", moveListener);
      window.removeEventListener("touchend", upListener);
    };

    window.addEventListener("pointermove", moveListener);
    window.addEventListener("pointerup", upListener);
    window.addEventListener("touchmove", moveListener, { passive: false });
    window.addEventListener("touchend", upListener);
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full sm:w-auto select-none ${disabled ? "opacity-50" : ""}`}
      style={{ maxWidth: 340, minWidth: 200 }}
    >
      <div
        className={`relative flex items-center h-14 ${colorClass} rounded-2xl shadow-lg font-bold text-white text-lg overflow-hidden`}
        style={{ backdropFilter: "blur(8px)" }}
      >
        {/* Glass overlay */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
          }}
        />

        {/* SPAZIO pallino */}
        <div style={{ width: ballSpace, minWidth: ballSpace }} />

        {/* Testo centrale, con padding sinistro per il pallino */}
        <span
          className="relative z-10 w-full text-center select-none transition-all tracking-wide"
          style={{
            opacity: dragX > 40 ? 0.32 : 1,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {text}
        </span>

        {/* Pallino */}
        <div
          className="absolute top-1/2 left-0"
          style={{
            transform: `translate(${dragX}px, -50%)`,
            transition: isSliding ? "none" : "transform 0.2s",
            zIndex: 20,
            width: ballSize,
            height: ballSize,
          }}
        >
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            disabled={disabled}
            className={`
              w-12 h-12 rounded-full border-4 border-white
              flex items-center justify-center
              bg-white/30 backdrop-blur-md
              active:scale-95 transition-shadow
              shadow-[0_0_16px_0_rgba(0,0,0,0.15)]
            `}
            style={{
              cursor: disabled ? "not-allowed" : "grab",
              touchAction: "none",
            }}
          >
            <ChevronRight size={28} className="text-white drop-shadow" />
          </button>
        </div>
      </div>
    </div>
  );
}
