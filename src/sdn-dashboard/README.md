# SDN Controller Dashboard

Web frontend for the Lab Experience 2026 SDN controller. Visualises the
network topology and (eventually) lets users pin custom forwarding paths
through the controller's REST API.

> **Want to test the dashboard without lab access?**
> See [TESTING.md](./TESTING.md) for a full walkthrough using Mininet
> on your laptop.

## Stack

- **Vite** + **React 18** + **Tailwind CSS**
- **lucide-react** for icons
- Topology rendering: hand-drawn SVG (no graph library)
- API client: native `fetch` (no axios / react-query / swr)

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

The dev server proxies `/api/*` to `http://localhost:8080`, so make
sure the controller is running locally. To point at a controller on a
different host:

```bash
echo "VITE_API_BASE=http://192.168.1.50:8080" > .env.local
npm run dev
```

The same code runs against either Mininet (your laptop) or the real lab.

## Project layout

```
src/
├── App.jsx                       — root component
├── main.jsx                      — React bootstrap
├── index.css                     — Tailwind directives
├── theme.js                      — colour tokens
│
├── api/
│   └── controller.js             — fetch wrappers for every endpoint
│                                   (topology, stats, flows, path,
│                                    policy, logs, events)
│
├── hooks/
│   ├── useController.js          — polls /topology and /stats/ports,
│   │                               computes throughput by interpolation
│   └── useLogs.js                — polls /logs, formats entries for
│                                   the events sidebar
│
├── lib/
│   ├── layout.js                 — fixed slot positions, sizes,
│   │                               DPID/MAC → slot mapping
│   ├── transform.js              — API response → GUI shape
│   └── format.js                 — bitrate formatting
│
└── components/
    ├── Header.jsx, Sidebar.jsx, AlgorithmSelector.jsx,
    ├── MetricsGrid.jsx, EventList.jsx, Legend.jsx, LogsView.jsx,
    ├── TopologyView.jsx
    └── topology/
        ├── SwitchNode.jsx, ControllerNode.jsx,
        ├── HostNode.jsx, Link.jsx
```

## Live data flow

```
                                poll (2 s)
   useController ────────────► GET /topology  ──► transformTopology()
        │                                              │
        │                         poll (5 s)          ▼
        ├────────────────────► GET /stats/ports ──► aggregateBytes()
        │                                              │
        │                                         computeThroughputBps()
        ▼                                              ▼
   { topology,               ◄──── interpolation ───── throughputBps,
     throughputBps,                                 controllerUp,
     controllerUp, error }                          error }

   useLogs ─────────────────► GET /logs?level=INFO  (poll 3 s)
                                       │
                                       ▼
                               { logs[], error }   (newest first)
```

## Topology layout

The lab demo has at most 6 switches and 2 hosts (the two Raspberry
Pis). Rather than computing positions dynamically — which produced
overlaps when both hosts attached to the same switch — **every
possible node has a fixed slot**.

```
                  SDN Controller
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   Switch 1        Switch 2        Switch 3       (top row)
   slot 1          slot 2          slot 3

   Switch 4        Switch 5        Switch 6       (bottom row)
   slot 4          slot 5          slot 6

  VLC Client                                  VLC Server
  (slot client)                              (slot server)
   anchored left                             anchored right
```

Slot positions live in `src/lib/layout.js`:

- `SWITCH_SLOTS` — 3 × 2 grid, slot indices 1..6
- `HOST_SLOTS` — `client` (left) and `server` (right)
- `CONTROLLER_POSITION` — top-center

The data layer (`transform.js`) only decides which slots are *active*.
Inactive slots are simply not rendered.

### Slot assignment

By default, switch DPID N → slot N (`SWITCH_DPID_TO_SLOT` in
`layout.js`). Update that map if the lab uses different DPIDs. Hosts
are classified by MAC: trailing octet `:02` → server (right),
anything else → client (left).

When the API reports a switch with an unmapped DPID, the GUI logs a
warning and skips it — better than overlapping an existing slot.
Same for links pointing to unmapped DPIDs: dropped silently to avoid
"floating" lines.

### Connection drawing

Links are clipped to each node's bounding box (`linkEndpoints` in
`layout.js`), so the rendered line touches the border of each box
cleanly instead of running through the rectangle.

## Metrics

| Metric      | Source                                                | Status |
| ----------- | ----------------------------------------------------- | ------ |
| Throughput  | `/stats/ports`, interpolated between two snapshots    | ✅ live |
| Faults      | placeholder (`—`)                                     | ⏳ awaits backend wiring |

Removed (cannot be measured with the current controller):

- **Latency** — would need an active probe (ICMP or OpenFlow echo
  round-trip per host pair).
- **Packet Loss** — not exposed by the controller.

## Throughput interpretation

`computeThroughputBps` sums `tx_bytes + rx_bytes` across **every**
switch port and divides by 2 to undo the double-counting (each byte
appears as tx on the sending port and rx on the receiving port of the
same link).

This is "aggregate switch traffic per second", not "user-visible
stream rate". On a multi-hop path each logical byte traverses N
links, so the displayed value scales with path length. For a clean
stream-rate readout the sum should be restricted to **edge ports** —
a future refinement once `/topology` exposes per-port classification.

## Next steps

1. Implement the **Manual** algorithm UI: click switches in order,
   build a path, POST to `/policy/{src}/{dst}`. The REST helpers
   (`postPolicy`, `deletePolicy`) are already in `api/controller.js`.
2. Wire the **Faults** card to a counter from `/events`
   (`link_down` looks like the right candidate).
3. Add a level filter to the Logs tab so demos can switch between
   DEBUG / INFO / WARNING quickly.
