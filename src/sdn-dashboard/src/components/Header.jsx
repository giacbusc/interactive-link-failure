import { COLORS } from "../theme";

export default function Header({ activeTab, setActiveTab, controllerUp }) {
  return (
    <header
      className="flex items-center justify-between px-8 py-3 border-b"
      style={{ borderColor: COLORS.panelBorder, backgroundColor: COLORS.bg }}
    >
      <nav className="flex gap-8">
        {["Topology", "Logs"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="text-base pb-1 font-medium transition-colors"
            style={{
              color: activeTab === tab ? COLORS.ink : COLORS.inkSoft,
              borderBottom:
                activeTab === tab
                  ? `2px solid ${COLORS.ink}`
                  : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div
        className="px-4 py-2 rounded-md text-sm font-medium"
        style={{
          backgroundColor: controllerUp ? COLORS.okBg : COLORS.errorBg,
          color: controllerUp ? COLORS.ok : COLORS.error,
          border: `1px solid ${controllerUp ? COLORS.ok : COLORS.error}`,
        }}
      >
        controller {controllerUp ? "up" : "down"}
      </div>
    </header>
  );
}
