# Testing the dashboard

You don't need physical lab access to verify the dashboard works. The
controller exposes its REST API the same way regardless of what's
underneath, so you can drive it with **Mininet** on your laptop and
watch the dashboard react in real time.

## What you need

- Linux (or WSL2 on Windows, or a Linux VM on Mac). Mininet does not run
  natively on macOS or vanilla Windows because it needs Linux network
  namespaces.
- The controller repository:
  https://github.com/giacbusc/interactive-link-failure
- `uv` (Python project manager): https://docs.astral.sh/uv/
- This dashboard, with `npm install` already done.

## The setup, three terminals

```
┌────────────────┐    OpenFlow 1.3   ┌────────────────┐
│   Mininet      │ ◄───────────────► │   Controller   │
│   (root, sudo) │       :6653       │  (port 6653 +  │
└────────────────┘                   │   REST :8080)  │
                                     └───────┬────────┘
                                             │ REST
                                     ┌───────▼────────┐
                                     │   Dashboard    │
                                     │   (Vite :5173) │
                                     └────────────────┘
```

### Terminal 1 — controller

```bash
cd path/to/interactive-link-failure/src/controller/backend
uv sync                  # first time only
uv run python run.py
```

You'll see logs like `Switch <n> connected`, `link added <a>:<x> → <b>:<y>`.
The REST API is now serving on `http://localhost:8080`.

### Terminal 2 — Mininet topology

The team's `network/` folder has three "topology spawners" you can use
without writing any code:

| Script | What you get |
|---|---|
| `linear.py` | `h1—s1—s2—s3—h2` — simplest, two hosts |
| `ring.py` | linear + extra `s1—s3` link — best for fault testing |
| `full_mesh.py` | three switches fully meshed, three hosts |

```bash
cd path/to/interactive-link-failure/src/controller/network
uv sync                  # first time only
sudo uv run python ring.py
```

You drop into a `mininet>` prompt. The switches connect to the
controller (you'll see them appear in Terminal 1's logs).

> **Note on `full_mesh.py`:** that topology has three hosts (h1, h2, h3).
> The dashboard is sized for the lab (2 Pis = client + server) and only
> displays two host slots, so h3 won't appear. Use `linear.py` or
> `ring.py` for full visualisation.

### Terminal 3 — dashboard

```bash
cd path/to/sdn-dashboard
npm run dev
```

Open <http://localhost:5173>. The status pill turns green
("controller up"), the topology fills in within ~2 s.

## What you should see

- **Header**: green "controller up" badge.
- **Topology**: switches `s1`, `s2`, `s3` in slots 1, 2, 3 (top row).
  After Mininet has discovered hosts (more on this below), `h1` shows
  on the left as "VLC Client", `h2` on the right as "VLC Server".
- **Throughput**: shows `0 bps` initially, climbs when you generate
  traffic (see below).
- **Events sidebar**: real log lines from the controller, newest first.
- **Logs tab**: full controller log stream, refreshed every 2 s.

### Triggering host discovery

The controller learns hosts only when they speak. After a fresh start
you may see no hosts in the dashboard. Force them to announce
themselves with one ping inside the Mininet console:

```
mininet> h1 ping -c 1 h2
```

Within a couple of seconds both hosts appear.

### Triggering interesting events to verify the dashboard

Inside the Mininet prompt:

```
mininet> link s1 s2 down       # take a link down
mininet> link s1 s2 up         # bring it back up

mininet> h1 ping h2            # continuous traffic for throughput

mininet> iperf h1 h2           # heavier load (Mbps-class)

mininet> h1 ifconfig           # see h1's interface state
```

Each `link ... down/up` should produce a log line in the sidebar within
2-3 s and update the topology view (the failed link disappears from the
graph).

When you start `iperf`, the **Throughput** card should rise from `0` to
something visible (a few Mbps; the exact value depends on the path
length — see "Throughput interpretation" in the README).

## Switching between local-Mininet and lab modes

The dashboard does not need different code for the two cases. Only the
URL of the controller changes:

| Where the controller runs | What you set |
|---|---|
| Same machine as the dashboard (Mininet testing) | nothing — defaults to `localhost:8080` via Vite proxy |
| A different machine (lab Pi, server, etc.) | `VITE_API_BASE=http://192.168.x.y:8080` in `.env.local` |

To switch to lab mode, create a `.env.local` file at the project root:

```
VITE_API_BASE=http://192.168.1.50:8080
```

…and restart `npm run dev`. The dashboard will now fetch from the
remote controller. Same code, different config.

## Cleanup

When you exit Mininet (`Ctrl+D` from `mininet>`) it usually tears
itself down cleanly. If a previous session left stale state behind:

```bash
sudo mn -c
```

removes lingering namespaces, bridges, and interfaces.

## Common issues

**"Waiting for controller…" never goes away**
The controller isn't reachable. Check Terminal 1 for crashes. If you
changed `VITE_API_BASE`, verify the URL is correct and the port is
open.

**Hosts never appear in the topology**
The controller learns hosts from packet-in events, so silence means
invisible. Run `pingall` from the Mininet prompt to wake everything
up.

**Throughput stays at 0 bps**
The controller's `StatsCollector` polls switches every 5 s and the
dashboard polls /stats every 5 s. The first non-zero reading takes up
to 10 s after traffic starts. If it stays at 0 longer, run `iperf` to
generate sustained traffic.

**Switch numbers don't appear in the right slots**
The dashboard maps DPID → slot in `src/lib/layout.js`
(`SWITCH_DPID_TO_SLOT`). Mininet topologies use DPID 1, 2, 3 which map
to slots 1, 2, 3. If the team uses different DPIDs in the lab, update
that map.
