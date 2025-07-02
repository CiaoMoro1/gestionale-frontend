import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import NavLink from "./NavLink";

type BadgeMap = { [path: string]: number | undefined };

export default function NavSection({
  label,
  icon,
  items,
  layout,
  onNavigate,
  badges = {},
}: {
  label: string;
  icon: React.ReactNode;
  items: { label: string; icon: React.ReactNode; path: string }[];
  layout: "horizontal" | "vertical";
  onNavigate?: () => void;
  badges?: BadgeMap;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(items.some((i) => i.path === location.pathname));

  useEffect(() => {
    if (items.some((i) => i.path === location.pathname)) {
      setOpen(true);
    }
  }, [location.pathname, items]);

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-full flex items-center justify-between gap-2 px-8 py-2 text-sm text-black font-semibold hover:bg-black/5 transition rounded-l-3xl rounded-r-s"
      >
        <div className="flex items-center gap-2">
          <span className="text-black/70">{icon}</span>
          <span>{label}</span>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-black/50"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex flex-col gap-1 pl-6 mt-1"
          >
            {items.map((item) => {
              const count = badges[item.path];
              const isBadge = typeof count === "number" && count > 0;
              return (
                <div
                  key={item.path}
                  className="relative flex items-center w-full" // full width!
                >
                  {/* Il link/menu */}
                  <NavLink {...item} layout={layout} onClick={onNavigate} />
                  {/* BADGE ABSOLUTE */}
                  {isBadge && (
                    <span
                      className={`
                        absolute right-3 top-1/2 -translate-y-1/2
                        min-w-[20px] h-5 px-1.5 flex items-center justify-center
                        text-xs font-bold rounded-full shadow
                        ${item.path === "/ordini-amazon/nuovi"
                          ? "bg-green-600 text-white"
                          : item.path === "/ordini-amazon/parziali"
                          ? "bg-yellow-400 text-black"
                          : "bg-gray-300 text-gray-700"}
                      `}
                      style={{ zIndex: 10 }}
                    >
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
