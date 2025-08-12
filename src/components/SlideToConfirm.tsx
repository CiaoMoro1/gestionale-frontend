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
  const dragXRef = useRef<number>(0);

  // Dimensione pallino (deve essere la stessa usata sotto)
  const ballSize = 48;
  const ballSpace = ballSize + 8; // con margine

  function getClientX(ev: PointerEvent | TouchEvent): number {
    if ("touches" in ev) {
      return ev.touches?.[0]?.clientX ?? 0;
    }
    return (ev as PointerEvent).clientX ?? 0;
  }

  function handlePointerDown(
    e: React.PointerEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>
  ) {
    if (disabled) return;
    setIsSliding(true);

    const startX =
      "touches" in e.nativeEvent
        ? e.nativeEvent.touches?.[0]?.clientX ?? 0
        : (e as React.PointerEvent<HTMLButtonElement>).clientX ?? 0;

    const moveListener = (ev: PointerEvent | TouchEvent) => {
      if (!containerRef.current) return;
      // Evita lo scroll su mobile mentre trascini
      if ("preventDefault" in ev) {
        try {
          ev.preventDefault();
        } catch {
          /* noop */
        }
      }
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

      window.removeEventListener("pointermove", moveListener as EventListener);
      window.removeEventListener("pointerup", upListener as EventListener);
      window.removeEventListener("touchmove", moveListener as EventListener);
      window.removeEventListener("touchend", upListener as EventListener);
    };

    window.addEventListener("pointermove", moveListener as EventListener);
    window.addEventListener("pointerup", upListener as EventListener);
    window.addEventListener("touchmove", moveListener as EventListener, { passive: false });
    window.addEventListener("touchend", upListener as EventListener);
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

        {/* Spazio per il pallino */}
        <div style={{ width: ballSpace, minWidth: ballSpace }} />

        {/* Testo centrale */}
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
