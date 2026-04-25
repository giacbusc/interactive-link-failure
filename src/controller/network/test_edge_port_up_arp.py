"""Confirms BUG-002: Port UP does not recompute spanning tree / flood rules.

When an edge port comes back UP, the controller adds it to the graph but
does NOT recompute the spanning tree or refresh flood rules.  As a
result the reconnected host is deaf to broadcast/ARP traffic and becomes
unreachable from other hosts.

Setup (linear):  h1 — s1 — s2 — s3 — h2

Test sequence:
1. Baseline ping both directions.
2. Bring h1-s1 down  → edge-port purge cleans h1, ST recomputes without h1's port.
3. Bring h1-s1 up    → port re-added to graph, but ST + flood rules STALE.
4. Ping h2 → h1 fails (ARP blackholed at s1 — flood rule doesn't include h1's port).
5. Ping h1 → h2 succeeds (h1's first unicast triggers packet-in → path installed).
   Asymmetry confirms the bug is in flood rules, not path computation.
"""

import time
import subprocess
from mininet.net import Mininet
from mininet.node import RemoteController, OVSSwitch
from mininet.log import setLogLevel, info


def test_port_up_missing_st_recompute():
    subprocess.run(["mn", "-c"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    net = Mininet(controller=RemoteController, switch=OVSSwitch, build=False)
    net.addController("c0", ip="127.0.0.1", port=6653)

    s1 = net.addSwitch("s1", dpid="0000000000000001")
    s2 = net.addSwitch("s2", dpid="0000000000000002")
    s3 = net.addSwitch("s3", dpid="0000000000000003")

    h1 = net.addHost("h1", ip="10.0.0.1", mac="00:00:00:00:00:01")
    h2 = net.addHost("h2", ip="10.0.0.2", mac="00:00:00:00:00:02")

    net.addLink(h1, s1)
    net.addLink(s1, s2)
    net.addLink(s2, s3)
    net.addLink(s3, h2)

    net.build()
    net.start()

    info("*** Waiting for topology discovery\n")
    time.sleep(5)

    info("*** 1. Baseline ping (both directions)\n")
    loss_baseline = net.pingAll()

    info("*** 2. Bringing h1-s1 link DOWN (edge port purge + ST recompute)\n")
    net.configLinkStatus("h1", "s1", "down")
    time.sleep(3)

    info("*** 3. Bringing h1-s1 link UP (port re-added, ST NOT recomputed)\n")
    net.configLinkStatus("h1", "s1", "up")
    time.sleep(2)  # Port comes up but flood rules are still stale

    # Flush ARP caches on both hosts so we force a broadcast ARP request
    for h in [h1, h2]:
        h.cmd("ip neigh flush all 2>/dev/null")

    info("*** 4. Ping h2 → h1 (should FAIL — ARP blackholed at s1)\n")
    loss_h2_to_h1 = net.ping([h2, h1])

    info("*** 5. Ping h1 → h2 (should SUCCEED — unicast packet-in triggers path)\n")
    loss_h1_to_h2 = net.ping([h1, h2])

    net.stop()
    subprocess.run(["mn", "-c"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # BUG-002 confirmed if: h1→h2 works (0% loss) BUT h2→h1 fails (>0% loss).
    # This asymmetry shows the ST/flood rules are stale while path computation
    # still works.
    bug_confirmed = loss_h1_to_h2 == 0.0 and loss_h2_to_h1 > 0.0
    baseline_ok = loss_baseline == 0.0

    if baseline_ok and bug_confirmed:
        print("\n\033[93m=========================================\033[0m")
        print("\033[93m  BUG-002 CONFIRMED                      \033[0m")
        print(f"\033[93m  h1→h2 = {loss_h1_to_h2}% (OK via packet-in)   \033[0m")
        print(f"\033[93m  h2→h1 = {loss_h2_to_h1}% (FAIL — stale flood) \033[0m")
        print("\033[93m  Asymmetry confirms ST not recomputed   \033[0m")
        print("\033[93m=========================================\033[0m\n")
    elif baseline_ok and not bug_confirmed:
        print("\n\033[92m=========================================\033[0m")
        print("\033[92m  BUG-002 NOT REPRODUCED                  \033[0m")
        print(f"\033[92m  h1→h2 = {loss_h1_to_h2}%, h2→h1 = {loss_h2_to_h1}%  \033[0m")
        print("\033[92m=========================================\033[0m\n")
    else:
        print("\n\033[91m=========================================\033[0m")
        print(
            f"\033[91m  BASELINE FAILED (loss={loss_baseline}%) — "
            f"environment issue  \033[0m"
        )
        print("\033[91m=========================================\033[0m\n")


if __name__ == "__main__":
    setLogLevel("info")
    info("\n--- Running BUG-002: Port UP ST Recompute Test ---\n")
    test_port_up_missing_st_recompute()
