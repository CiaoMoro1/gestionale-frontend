const TABS = [
  { label: "Home", path: "/", icon: <Home size={24} /> },
  { label: "Ordini", path: "/ordini", icon: <ClipboardList size={24} /> },
  { label: "Prodotti", path: "/prodotti", icon: <Package size={24} /> },
];

export default function RippleBottomNav({ onSearch }: { onSearch?: () => void }) {
  const location = useLocation();
  const indicatorRef = useRef<HTMLDivElement>(null);

  const tabIndexMap = [0, 1, 2];
  const currentIndex = TABS.findIndex(tab => "/" + location.pathname.split("/")[1] === tab.path);

  useEffect(() => {
    if (indicatorRef.current && currentIndex !== -1) {
      const slotIndex = currentIndex >= 2 ? currentIndex + 1 : currentIndex;
      indicatorRef.current.style.transform = `translateX(${slotIndex * 72}px)`;
    }
  }, [currentIndex]);

  return (
    <>
      <style>{`
        .nav-indicator::before,
        .nav-indicator::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 22px;
          height: 22px;
          background: transparent;
        }
        .nav-indicator::before {
          left: -22px;
          border-top-right-radius: 22px;
          box-shadow: 1px -10px 0 0 #1e1e1e;
        }
        .nav-indicator::after {
          right: -22px;
          border-top-left-radius: 22px;
          box-shadow: -1px -10px 0 0 #1e1e1e;
        }
      `}</style>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <ul className="w-[360px] h-[72px] bg-white rounded-xl flex justify-between px-[12px] relative">
          {TABS.map((tab, i) => {
            const isActive = "/" + location.pathname.split("/")[1] === tab.path;
            const positionIndex = i >= 2 ? i + 1 : i; // salta slot centrale
            return (
              <li
                key={tab.label}
                className="relative w-[72px] h-[72px] list-none flex justify-center z-10"
                style={{ order: positionIndex }}
              >
                <Link
                  to={tab.path}
                  className="flex flex-col items-center justify-center w-full cursor-pointer select-none"
                >
                  <span className={`transition duration-500 ${isActive ? "-translate-y-8" : ""}`}>
                    {tab.icon}
                  </span>
                  <span className={`text-[11px] mt-[2px] transition-opacity duration-500 ${
                    isActive ? "opacity-100 translate-y-[6px]" : "opacity-0 translate-y-[20px]"
                  }`}>
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}

          {/* slot vuoto centrale */}
          <li className="w-[72px] h-[72px] list-none" style={{ order: 2 }} />

          {/* bottone centrale */}
          {onSearch && (
            <button
              onClick={onSearch}
              className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg z-20"
            >
              <Search size={28} />
            </button>
          )}

          {/* Indicatore attivo */}
          <div
            ref={indicatorRef}
            className="nav-indicator absolute -top-7 left-0 w-[72px] h-[72px] bg-pink-500 rounded-full border-[6px] border-[#1e1e1e] transition-all duration-500"
          />
        </ul>
      </div>
    </>
  );
}
