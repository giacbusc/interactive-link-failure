import { useState, useMemo } from "react";
import { COLORS } from "./theme";
import { useController } from "./hooks/useController";
import { useLogs } from "./hooks/useLogs";
import { usePath } from "./hooks/usePath";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import TopologyView from "./components/TopologyView";
import Legend from "./components/Legend";
import LogsView from "./components/LogsView";
import SwitchDetailsPanel from "./components/SwitchDetailsPanel";

export default function App() {
  const [activeTab, setActiveTab] = useState("Topology");
  const [algorithm, setAlgorithm] = useState("Dijkstra");
  const [selectedSwitch, setSelectedSwitch] = useState(null);

  const { topology, throughputBps, controllerUp } = useController();
  const { logs } = useLogs("INFO");

  // Determine the (src, dst) MAC pair for the current path. We follow
  // the lab convention: VLC Server is the source (it pushes the stream),
  // VLC Client is the destination.
  const [srcMac, dstMac] = useMemo(() => {
    if (!topology?.hosts) return [null, null];
    const server = topology.hosts.find((h) => h.kind === "server");
    const client = topology.hosts.find((h) => h.kind === "client");
    return [server?.mac || null, client?.mac || null];
  }, [topology]);

  const { path: activePath } = usePath(srcMac, dstMac);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: COLORS.bg }}
    >
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        controllerUp={controllerUp}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          algorithm={algorithm}
          setAlgorithm={setAlgorithm}
          throughputBps={throughputBps}
          events={logs}
        />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === "Topology" ? (
            <>
              {topology ? (
                <TopologyView
                  topology={topology}
                  activePath={activePath}
                  selectedSwitch={selectedSwitch}
                  onSelectSwitch={setSelectedSwitch}
                />
              ) : (
                <div
                  className="flex-1 flex items-center justify-center text-sm m-4 rounded-lg"
                  style={{
                    color: COLORS.inkSoft,
                    backgroundColor: COLORS.bg,
                    border: `1px solid ${COLORS.ink}`,
                  }}
                >
                  {controllerUp
                    ? "Loading topology…"
                    : "Waiting for controller — make sure it's running on http://localhost:8080"}
                </div>
              )}
              <Legend />

              {/* Floating details panel for the clicked switch */}
              {selectedSwitch && (
                <SwitchDetailsPanel
                  sw={selectedSwitch}
                  onClose={() => setSelectedSwitch(null)}
                />
              )}
            </>
          ) : (
            <LogsView />
          )}
        </main>
      </div>
    </div>
  );
}