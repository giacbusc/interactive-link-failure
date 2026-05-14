import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { COLORS } from "./theme";
import { useController } from "./hooks/useController";
import { useLogs } from "./hooks/useLogs";
import { usePath } from "./hooks/usePath";
import { usePolicy } from "./hooks/usePolicy";
import { usePathPicker } from "./hooks/usePathPicker";
import { useToast } from "./hooks/useToast";
import { findShortestPath, pathLinksToPolicy } from "./lib/pathfinder";
import { postPolicy, deletePolicy } from "./api/controller";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import TopologyView from "./components/TopologyView";
import Legend from "./components/Legend";
import LogsView from "./components/LogsView";
import SwitchDetailsPanel from "./components/SwitchDetailsPanel";
import ToastContainer from "./components/Toast";

export default function App() {
  const [activeTab, setActiveTab] = useState("Topology");
  const [selectedSwitch, setSelectedSwitch] = useState(null);

  const { topology, throughputBps, controllerUp } = useController();
  const { logs } = useLogs("INFO");
  const toast = useToast();

  // Determine the (src, dst) MAC pair for path/policy operations.
  // Server is conventionally the source (it pushes the stream).
  const [srcMac, dstMac] = useMemo(() => {
    if (!topology?.hosts) return [null, null];
    const server = topology.hosts.find((h) => h.kind === "server");
    const client = topology.hosts.find((h) => h.kind === "client");
    return [server?.mac || null, client?.mac || null];
  }, [topology]);

  const { path: activePath } = usePath(srcMac, dstMac);
  const policy = usePolicy(srcMac, dstMac);

  const picker = usePathPicker({ topology, onToast: toast.push });

  // ---- Derive the currently active algorithm for the sidebar -----

  const algorithm = useMemo(() => {
    if (picker.mode !== "off") return "Manual";
    if (policy?.state === "POLICY_ACTIVE") return "Manual";
    return "Dijkstra";
  }, [picker.mode, policy]);

  // ---- Auto-Dijkstra fallback when policy becomes BROKEN ---------
  //
  // Polls /policy in usePolicy. When the controller reports
  // POLICY_BROKEN (the static path lost a link), we delete the policy
  // so the controller reverts to its default Dijkstra routing.

  const recoveringRef = useRef(false);

  useEffect(() => {
    if (
      policy?.state === "POLICY_BROKEN" &&
      srcMac &&
      dstMac &&
      !recoveringRef.current
    ) {
      recoveringRef.current = true;
      deletePolicy(srcMac, dstMac)
        .then(() => {
          toast.push(
            "Static path broken — recovered via Dijkstra",
            "info"
          );
        })
        .catch((e) => {
          toast.push(`Auto-recovery failed: ${e.message}`, "error");
        })
        .finally(() => {
          // small cooldown to avoid hammering if state oscillates
          setTimeout(() => {
            recoveringRef.current = false;
          }, 3000);
        });
    }
  }, [policy?.state, srcMac, dstMac, toast]);

  // ---- Algorithm selector handlers --------------------------------

  const handleSelectDijkstra = useCallback(async () => {
    if (picker.mode !== "off") {
      picker.stop();
    }
    if (policy?.state === "POLICY_ACTIVE" || policy?.state === "POLICY_BROKEN") {
      try {
        await deletePolicy(srcMac, dstMac);
        toast.push("Reverted to Dijkstra routing", "info");
      } catch (e) {
        toast.push(`Could not delete policy: ${e.message}`, "error");
      }
    }
  }, [picker, policy, srcMac, dstMac, toast]);

  const handleSelectManual = useCallback(() => {
    if (picker.mode !== "off") {
      toast.push("Already in manual mode", "info");
      return;
    }
    picker.start();
  }, [picker, toast]);

  // ---- Link click → reroute (interpretation B) --------------------

  const handleLinkClick = useCallback(
    async (clickedLink) => {
      if (!topology || !srcMac || !dstMac) return;

      const alt = findShortestPath(topology, srcMac, dstMac, [clickedLink]);
      if (!alt) {
        toast.push(
          "No alternative path available — link is critical",
          "error"
        );
        return;
      }

      const policyPath = pathLinksToPolicy(alt, srcMac);
      try {
        await postPolicy(srcMac, dstMac, policyPath);
        toast.push("Link failed — traffic rerouted", "success");
      } catch (e) {
        toast.push(`Reroute failed: ${e.message}`, "error");
      }
    },
    [topology, srcMac, dstMac, toast]
  );

  // ---- Render -----------------------------------------------------

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
          onSelectDijkstra={handleSelectDijkstra}
          onSelectManual={handleSelectManual}
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
                  picker={picker}
                  onLinkClick={handleLinkClick}
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

              {selectedSwitch && picker.mode === "off" && (
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

      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}