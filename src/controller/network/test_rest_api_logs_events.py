import sys
import time
import json
import subprocess
import urllib.request
import urllib.error

from mininet.net import Mininet
from mininet.node import RemoteController, OVSSwitch
from mininet.log import setLogLevel, info

API_BASE = "http://127.0.0.1:8080"


def _api_get(path: str) -> tuple[int, dict | None]:
    url = f"{API_BASE}{path}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError, ValueError:
            return e.code, {"detail": body}
    except urllib.error.URLError:
        return -1, None


_EVENT_KEYS = {
    "switch_connected",
    "switch_disconnected",
    "link_up",
    "link_down",
    "host_added",
    "host_moved",
    "port_up",
    "port_down",
    "packets_forwarded",
    "packets_dropped",
    "arp_replies_sent",
    "policies_installed",
    "policies_removed",
}

_LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
_LOG_NUMERIC = {
    "DEBUG": 10,
    "INFO": 20,
    "WARNING": 30,
    "ERROR": 40,
    "CRITICAL": 50,
}


def test_rest_api_logs_events():
    """Validate GET /logs and GET /events endpoints.

    Ring topology: h1—s1—s2—s3—h2 with backup s1—s3.

    Checks:
    - GET /logs returns 200 with expected structure (entries, level, lines, returned).
    - Level filtering: only entries at or above the requested level.
    - Lines filtering: limited to the requested number of newest entries.
    - Default parameters (no query string) return everything.
    - GET /events returns 200 with all expected event keys present.
    - After traffic, packet event counters are non-zero.
    """
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
    net.addLink(s1, s3)

    net.build()
    net.start()

    info("*** Pinging to learn hosts\n")
    net.pingAll()

    info("*** Waiting for topology discovery\n")
    time.sleep(6)

    net.pingAll()
    time.sleep(2)

    passed = True

    # ── Test 1: GET /logs — default params (level=DEBUG, lines=ALL) ──
    info("*** 1. GET /logs — default parameters\n")
    status, data = _api_get("/logs")
    if status != 200:
        info(f"FAIL: /logs returned {status}\n")
        passed = False
    elif "entries" not in data:
        info("FAIL: /logs missing 'entries' key\n")
        passed = False
    elif data.get("level") != "DEBUG":
        info(f"FAIL: expected default level=DEBUG, got {data.get('level')}\n")
        passed = False
    elif data.get("returned", 0) == 0:
        info("FAIL: /logs returned 0 entries (controller should have produced logs)\n")
        passed = False
    else:
        info(f"PASS: /logs — {data['returned']} entries, level={data['level']}\n")

    # ── Test 2: GET /logs — level=INFO filtering ─────────────────────
    info("*** 2. GET /logs?level=INFO — level filter\n")
    status, data = _api_get("/logs?level=INFO")
    if status != 200:
        info(f"FAIL: /logs?level=INFO returned {status}\n")
        passed = False
    elif "entries" not in data:
        info("FAIL: /logs?level=INFO missing 'entries' key\n")
        passed = False
    else:
        all_ok = True
        for e in data["entries"]:
            if _LOG_NUMERIC.get(e["level"], 0) < _LOG_NUMERIC["INFO"]:
                info(
                    f"FAIL: entry below INFO threshold: {e['level']} — {e['message'][:80]}\n"
                )
                all_ok = False
                break
        if all_ok:
            info(f"PASS: /logs?level=INFO — {data['returned']} entries at INFO+\n")
        else:
            passed = False

    # ── Test 3: GET /logs — lines limit ──────────────────────────────
    info("*** 3. GET /logs?lines=5 — line limit\n")
    status, data = _api_get("/logs?lines=5")
    if status != 200:
        info(f"FAIL: /logs?lines=5 returned {status}\n")
        passed = False
    elif data.get("returned", 0) > 5:
        info(
            f"FAIL: /logs?lines=5 returned {data['returned']} entries (expected <=5)\n"
        )
        passed = False
    else:
        info(f"PASS: /logs?lines=5 — returned {data['returned']} entries\n")

    # ── Test 4: GET /logs — level=WARNING with lines=3 ───────────────
    info("*** 4. GET /logs?level=WARNING&lines=3 — combined filter\n")
    status, data = _api_get("/logs?level=WARNING&lines=3")
    if status != 200:
        info(f"FAIL: /logs?level=WARNING&lines=3 returned {status}\n")
        passed = False
    else:
        all_warn = True
        for e in data["entries"]:
            if _LOG_NUMERIC.get(e["level"], 0) < _LOG_NUMERIC["WARNING"]:
                info(f"FAIL: entry below WARNING threshold: {e['level']}\n")
                all_warn = False
                break
        if not all_warn:
            passed = False
        elif data.get("returned", 0) > 3:
            info(f"FAIL: expected <=3 entries, got {data['returned']}\n")
            passed = False
        else:
            info(f"PASS: /logs?level=WARNING&lines=3 — {data['returned']} entries\n")

    # ── Test 5: GET /events — basic structure ──────────────────────
    info("*** 5. GET /events — structure\n")
    status, data = _api_get("/events")
    if status != 200:
        info(f"FAIL: /events returned {status}\n")
        passed = False
    elif not isinstance(data, dict):
        info("FAIL: /events body is not a dict\n")
        passed = False
    else:
        all_keys = True
        for key in _EVENT_KEYS:
            if key not in data:
                info(f"FAIL: /events missing key '{key}'\n")
                all_keys = False
                break
        if all_keys:
            info(f"PASS: /events — all {len(_EVENT_KEYS)} keys present\n")
        else:
            passed = False

    # ── Test 6: GET /events — switch-connected non-zero ────────────
    info("*** 6. GET /events — switch_connected > 0\n")
    status, data = _api_get("/events")
    if status != 200:
        info(f"FAIL: /events returned {status}\n")
        passed = False
    elif data.get("switch_connected", 0) <= 0:
        info(f"FAIL: switch_connected={data['switch_connected']}, expected > 0\n")
        passed = False
    else:
        info(f"PASS: switch_connected={data['switch_connected']}\n")

    # ── Test 7: GET /events — host_added non-zero (hosts discovered) ─
    info("*** 7. GET /events — host_added > 0\n")
    status, data = _api_get("/events")
    if status != 200:
        info(f"FAIL: /events returned {status}\n")
        passed = False
    elif data.get("host_added", 0) <= 0:
        info(
            f"FAIL: host_added={data['host_added']}, expected > 0 (hosts should be discovered)\n"
        )
        passed = False
    else:
        info(f"PASS: host_added={data['host_added']}\n")

    # ── Test 8: GET /events — link_up likely non-zero ──────────────
    info("*** 8. GET /events — link_up (links discovered via LLDP)\n")
    status, data = _api_get("/events")
    if status != 200:
        info(f"FAIL: /events returned {status}\n")
        passed = False
    else:
        info(f"SKIP: link_up={data['link_up']} — depends on LLDP timing\n")

    # ── Test 9: Trigger traffic, then check packet events ──────────
    info("*** 9. Pinging to trigger packet events\n")
    net.pingAll()
    time.sleep(2)

    status, data = _api_get("/events")
    if status != 200:
        info(f"FAIL: /events returned {status}\n")
        passed = False
    elif data.get("packets_forwarded", 0) <= 0:
        info(
            f"FAIL: packets_forwarded={data['packets_forwarded']}, expected > 0 after ping\n"
        )
        passed = False
    else:
        info(
            f"PASS: packets_forwarded={data['packets_forwarded']}, "
            f"arp_replies_sent={data['arp_replies_sent']}\n"
        )

    # ── Test 10: logs present after traffic ───────────────────────────
    info("*** 10. GET /logs — entries still returned after traffic\n")
    status, data = _api_get("/logs")
    if status != 200:
        info(f"FAIL: /logs returned {status}\n")
        passed = False
    elif data.get("returned", 0) <= 0:
        info("FAIL: /logs returned 0 entries after traffic\n")
        passed = False
    else:
        info(f"PASS: /logs — {data['returned']} entries after traffic\n")

    net.stop()
    subprocess.run(["mn", "-c"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if passed:
        print("\n\033[92m=========================================\033[0m")
        print("\033[92m                 PASS                    \033[0m")
        print("\033[92m=========================================\033[0m\n")
    else:
        print("\n\033[91m=========================================\033[0m")
        print("\033[91m                 FAIL                    \033[0m")
        print("\033[91m=========================================\033[0m\n")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    setLogLevel("info")
    info("\n--- Running REST API Logs & Events Test ---\n")
    test_rest_api_logs_events()
