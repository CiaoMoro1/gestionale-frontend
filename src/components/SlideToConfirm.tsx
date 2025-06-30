import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  onConfirm: () => void;
  text: string;
  colorClass?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export default function SlideToConfirm({ onConfirm, text, colorClass = "bg-gray-400", icon, disabled }: Props) {
  const [dragX, setDragX] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragXRef = useRef(0);

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
      const containerWidth = containerRef.current.offsetWidth - 48;
      const currX = getClientX(ev);
      const diff = Math.max(0, Math.min(currX - startX, containerWidth));
      setDragX(diff);
      dragXRef.current = diff;
    };

    const upListener = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth - 48;
      if (dragXRef.current > containerWidth * 0.85) {
        setDragX(containerWidth);
        setTimeout(onConfirm, 200);
      }
      setTimeout(() => setDragX(0), 200);
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
      <div className={`flex items-center justify-center h-14 ${colorClass} rounded-2xl shadow-lg px-3 font-bold text-white text-lg relative`}>
        <span className="w-full text-center pointer-events-none select-none" style={{ opacity: dragX > 40 ? 0.2 : 1 }}>
          {icon} {text}
        </span>
        {/* slider pallino */}
        <div
          className="absolute top-1/2 left-0 -translate-y-1/2"
          style={{
            transform: `translate(${dragX}px, -50%)`,
            transition: isSliding ? "none" : "transform 0.2s",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onPointerDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center
              ${colorClass} border-4 border-white transition-all active:scale-95`}
            style={{
              cursor: disabled ? "not-allowed" : "grab",
              touchAction: "none",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <ChevronRight size={32} />
          </button>
        </div>
      </div>
    </div>
  );
}
