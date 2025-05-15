import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";

type Props = {
  label: string;
  icon: React.ReactNode;
  path: string;
  layout?: "horizontal" | "vertical";
  onClick?: () => void;
};

export default function NavLink({ label, icon, path, layout = "horizontal", onClick }: Props) {
  const location = useLocation();
  const isActive = location.pathname === path;

  if (layout === "vertical") {
    return (
      <Link
        to={path}
        onClick={onClick}
        className="flex flex-col items-center justify-center relative text-xs text-black/70"
        aria-label={label}
      >
        <div className="relative h-10 w-10 flex items-center justify-center">
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="active-circle"
                className="absolute w-10 h-10 rounded-xl bg-gradient-to-br from-black/50 via-black/20 to-gray-300 z-0"
              />
            )}
          </AnimatePresence>
          <div className="relative z-10">{icon}</div>
        </div>
        <span className="mt-1 text-[clamp(0.7rem,1.5vw,0.875rem)] font-medium text-black/80">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={path}
      onClick={onClick}
      className={`relative flex items-center gap-2 px-8 py-2 text-sm w-full transition-colors duration-200
        ${isActive ? "text-black font-semibold bg-gray-200" : "text-black/50 hover:bg-black/5"}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-l-3xl rounded-r-s`}
      aria-label={label}
    >
      {isActive && (
        <span className="absolute right-[-12px] top-0 bottom-0 w-6 bg-gray-200  z-[-1]" />
      )}
      {icon}
      <span className="text-[clamp(0.85rem,1.8vw,1rem)] font-semibold text-black">{label}</span>
    </Link>
  );
}
