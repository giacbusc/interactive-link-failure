import { useState } from "react";
import { COLORS } from "./theme";
import { useController } from "./hooks/useController";
import { useLogs } from "./hooks/useLogs";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import TopologyView from "./components/TopologyView";
import Legend from "./components/Legend";
import LogsView from "./components/LogsView";

export default function App() {
  const [activeTab, setActiveTab] = useState("Topology");
  const [algorithm, setAlgorithm] = useState("Dijkstra");

  // Live state from the controller (see hooks/useController.js,
  // hooks/useLogs.js).
  const { topology, throughputBps, controllerUp } = useController();
  const { logs } = useLogs("INFO");

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

        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === "Topology" ? (
            <>
              {topology ? (
                <TopologyView topology={topology} />
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
            </>
          ) : (
            <LogsView />
          )}
        </main>
      </div>
    </div>
  );
}
