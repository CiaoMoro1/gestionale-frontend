import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import NavLink from "./NavLink";

export type NavItem = {
  label: string;
  icon: React.ReactNode;
  path?: string;
  items?: NavItem[];
};

type BadgeMap = { [path: string]: number | undefined };

type Props = {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  layout: "horizontal" | "vertical";
  onNavigate?: () => void;
  badges?: BadgeMap;
  level?: number; // indentazione visiva
};

export default function NavSection({
  label,
  icon,
  items,
  layout,
  onNavigate,
  badges = {},
  level = 0,
}: Props) {
  const location = useLocation();

  // Open se una delle route figlie è attiva
  const isChildActive = items.some(
    (i) =>
      (i.path && i.path === location.pathname) ||
      (i.items && i.items.some((sub) => sub.path === location.pathname))
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isChildActive) {
      setOpen(true);
    }
    // eslint-disable-next-line
  }, [location.pathname]);

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen(!open)}
        className={`relative w-full flex items-center justify-between gap-2 p-8 py-2 text-sm text-black font-semibold hover:bg-black/5 transition rounded-l-3xl rounded-r-s`}
        style={{ paddingLeft: `${level * 14 + 0}px` }} // indentazione opzionale
      >
        <div className="flex items-center gap-2 px-4">
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
            className="overflow-hidden flex flex-col gap-1 mt-1"
          >
            {items.map((item) =>
              item.items && item.items.length > 0 ? (
                // RICORSIONE PER I SOTTOMENU
                <NavSection
                  key={item.label}
                  label={item.label}
                  icon={item.icon}
                  items={item.items}
                  layout={layout}
                  onNavigate={onNavigate}
                  badges={badges}
                  level={level + 1}
                />
              ) : (
                // LINK SINGOLO
                <div key={item.path} className="relative flex items-center w-full">
                  <NavLink
                    label={item.label}
                    icon={item.icon}
                    path={item.path!}
                    layout={layout}
                    onClick={onNavigate}
                  />
                  {/* BADGE */}
                  {item.path &&
                    typeof badges[item.path] === "number" &&
                    badges[item.path]! > 0 && (
                      <span
                        className={`absolute right-3 top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold rounded-full shadow
                          ${item.path === "/ordini-amazon/nuovi"
                            ? "bg-green-600 text-white"
                            : item.path === "/ordini-amazon/parziali"
                            ? "bg-yellow-400 text-black"
                            : "bg-gray-300 text-gray-700"}`}
                        style={{ zIndex: 10 }}
                      >
                        {badges[item.path]}
                      </span>
                    )}
                </div>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
