from io import BytesIO
import time

import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd
import requests
import streamlit as st


CONTROLLER_API = "http://192.168.1.10:8080"
REFRESH_RATE = 6  # seconds (should be more than 5 seconds to avoid hitting controller rate limits)


st.set_page_config(layout="wide", page_title="Live Network Topology Monitor")


def format_throughput(mbps):
    return f"{mbps:.2f} Mbps"


def clear_api_cache():
    get_topology.clear()
    get_stats.clear()
    get_path.clear()


def reset_to_dijkstra():
    src = st.session_state.get("current_src")
    dst = st.session_state.get("current_dst")
    if src and dst:
        requests.delete(f"{CONTROLLER_API}/policy/{src}/{dst}")
        clear_api_cache()
        st.toast("Reset to Dijkstra (Shortest Path) algorithm.")


def apply_static_path():
    src = st.session_state.get("current_src")
    dst = st.session_state.get("current_dst")
    path_input = st.session_state.get("manual_path_input", "")

    if not src or not dst:
        st.toast("Source or destination not known yet.")
        return

    try:
        topo = get_topology()
        if not topo:
            st.error("Controller topology is not available.")
            return

        dpid_to_alias, alias_to_dpid = get_switch_aliases(topo.get("switches", []))
        dpids = [
            parse_switch_token(item, alias_to_dpid)
            for item in path_input.split(",")
            if item.strip()
        ]
        if len(dpids) < 2:
            st.toast("Path must have at least 2 switches (e.g. s1, s2, s3)")
            return

        links = topo.get("links", [])
        path_payload = []

        for index in range(len(dpids) - 1):
            src_dpid = dpids[index]
            dst_dpid = dpids[index + 1]
            link = next(
                (
                    item
                    for item in links
                    if int(item["src_dpid"]) == src_dpid
                    and int(item["dst_dpid"]) == dst_dpid
                ),
                None,
            )

            if not link:
                reverse_link = next(
                    (
                        item
                        for item in links
                        if int(item["src_dpid"]) == dst_dpid
                        and int(item["dst_dpid"]) == src_dpid
                    ),
                    None,
                )
                if reverse_link:
                    link = {
                        "src_dpid": src_dpid,
                        "src_port": reverse_link["dst_port"],
                        "dst_dpid": dst_dpid,
                        "dst_port": reverse_link["src_port"],
                    }

            if not link:
                src_label = dpid_to_alias.get(src_dpid, str(src_dpid))
                dst_label = dpid_to_alias.get(dst_dpid, str(dst_dpid))
                st.error(f"No physical link found between {src_label} and {dst_label}!")
                return

            path_payload.append(
                {
                    "src_dpid": link["src_dpid"],
                    "src_port": link["src_port"],
                    "dst_dpid": link["dst_dpid"],
                    "dst_port": link["dst_port"],
                }
            )

        response = requests.post(
            f"{CONTROLLER_API}/policy/{src}/{dst}",
            json={"path": path_payload},
        )
        if response.status_code == 200:
            clear_api_cache()
            st.toast("Static path applied successfully!")
        else:
            st.error(f"Error setting path: {response.text}")
    except Exception as exc:
        st.error(f"Invalid path format: {exc}")


def get_switch_aliases(switches):
    if "switch_aliases" not in st.session_state:
        st.session_state.switch_aliases = {}
    if "next_switch_alias" not in st.session_state:
        st.session_state.next_switch_alias = 1

    aliases = st.session_state.switch_aliases
    for dpid in sorted(switch["dpid"] for switch in switches):
        if dpid not in aliases:
            aliases[dpid] = f"s{st.session_state.next_switch_alias}"
            st.session_state.next_switch_alias += 1

    dpid_to_alias = {int(dpid): alias for dpid, alias in aliases.items()}
    alias_to_dpid = {alias.lower(): dpid for dpid, alias in dpid_to_alias.items()}
    return dpid_to_alias, alias_to_dpid


def parse_switch_token(token, alias_to_dpid):
    cleaned = token.strip().lower()
    if cleaned in alias_to_dpid:
        return alias_to_dpid[cleaned]

    if cleaned.isdigit():
        alias = f"s{cleaned}"
        if alias in alias_to_dpid:
            return alias_to_dpid[alias]

    return int(cleaned, 0)


@st.cache_data(ttl=REFRESH_RATE)
def get_topology():
    try:
        response = requests.get(f"{CONTROLLER_API}/topology", timeout=3)
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


@st.cache_data(ttl=REFRESH_RATE)
def get_stats():
    try:
        response = requests.get(f"{CONTROLLER_API}/stats/ports", timeout=3)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception:
        return None


@st.cache_data(ttl=REFRESH_RATE)
def get_path(src_mac, dst_mac):
    try:
        response = requests.get(f"{CONTROLLER_API}/path/{src_mac}/{dst_mac}", timeout=3)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception:
        return None


def build_stats_table(dpid_to_alias):
    stats = get_stats()
    max_throughput_mbps = 0.0

    if "prev_stats" not in st.session_state:
        st.session_state.prev_stats = {}
    if "prev_time" not in st.session_state:
        st.session_state.prev_time = time.time()

    current_time = time.time()
    time_diff = current_time - st.session_state.prev_time
    table_data = []
    new_prev_stats = {}

    if stats and "switches" in stats:
        for switch in stats["switches"]:
            dpid = switch["dpid"]
            for port in switch["ports"]:
                port_id = f"s{dpid}-p{port['port_no']}"
                rx_bytes = port["rx_bytes"]
                tx_bytes = port["tx_bytes"]
                new_prev_stats[port_id] = {"rx": rx_bytes, "tx": tx_bytes}

                throughput_rx = 0.0
                throughput_tx = 0.0
                if port_id in st.session_state.prev_stats and time_diff > 0:
                    rx_diff = rx_bytes - st.session_state.prev_stats[port_id]["rx"]
                    tx_diff = tx_bytes - st.session_state.prev_stats[port_id]["tx"]
                    throughput_rx = (rx_diff * 8) / time_diff / 1_000
                    throughput_tx = (tx_diff * 8) / time_diff / 1_000

                max_throughput_mbps = max(
                    max_throughput_mbps,
                    throughput_rx,
                    throughput_tx,
                )

                table_data.append(
                    {
                        "Switch": dpid_to_alias.get(int(dpid), f"dpid:{dpid}"),
                        "Port": port["port_no"],
                        "RX Pkts": port["rx_packets"],
                        "TX Pkts": port["tx_packets"],
                        "RX Mbps": format_throughput(throughput_rx).replace(
                            " Mbps", ""
                        ),
                        "TX Mbps": format_throughput(throughput_tx).replace(
                            " Mbps", ""
                        ),
                    }
                )

    st.session_state.prev_stats = new_prev_stats
    st.session_state.prev_time = current_time
    return table_data, max_throughput_mbps


def build_dashboard_data():
    topo = get_topology()
    if not topo:
        st.session_state.current_src = None
        st.session_state.current_dst = None
        return None

    graph = nx.Graph()
    switches = topo.get("switches", [])
    links = topo.get("links", [])
    hosts = topo.get("hosts", [])
    dpid_to_alias, _ = get_switch_aliases(switches)

    if "known_edges" not in st.session_state:
        st.session_state.known_edges = set()

    current_edges = set()

    for switch in switches:
        dpid = switch["dpid"]
        alias = dpid_to_alias.get(dpid, f"dpid:{dpid}")
        graph.add_node(alias, type="switch", label=f"{alias}\nDPID {dpid}")

    for link in links:
        src_dpid = int(link["src_dpid"])
        dst_dpid = int(link["dst_dpid"])
        src = dpid_to_alias.get(src_dpid, f"dpid:{src_dpid}")
        dst = dpid_to_alias.get(dst_dpid, f"dpid:{dst_dpid}")
        edge = tuple(sorted([src, dst]))
        current_edges.add(edge)
        st.session_state.known_edges.add(edge)

    host_map = {}
    host_table = []
    for index, host in enumerate(hosts):
        mac = host["mac"]
        dpid = int(host["dpid"])
        host_name = f"h{index + 1}"
        ips = host.get("ips", [])
        ip_label = ", ".join(ips) if ips else "unknown IP"
        attached_switch = dpid_to_alias.get(dpid, f"dpid:{dpid}")
        host_map[mac] = host_name
        graph.add_node(mac, type="host", label=f"{host_name}\n{ip_label}")

        host_table.append(
            {
                "Host": host_name,
                "IP Address": ip_label,
                "MAC": mac,
                "Switch": attached_switch,
                "Port": host["port"],
            }
        )

        edge = tuple(sorted([mac, attached_switch]))
        current_edges.add(edge)
        st.session_state.known_edges.add(edge)

    for src, dst in st.session_state.known_edges:
        graph.add_edge(src, dst)

    down_edges = st.session_state.known_edges - current_edges
    host_macs = [host["mac"] for host in hosts]

    src_host = None
    dst_host = None
    if len(host_macs) >= 2:
        src_host = host_macs[0]
        dst_host = host_macs[1]

    st.session_state.current_src = src_host
    st.session_state.current_dst = dst_host

    path_data = None
    path_edges = []
    if src_host and dst_host and src_host != dst_host:
        path_data = get_path(src_host, dst_host)
        if path_data and path_data.get("hops"):
            dpids = [hop["dpid"] for hop in path_data["hops"]]

            def safe_edge(a, b):
                return tuple(sorted([a, b]))

            first_switch = dpid_to_alias.get(int(dpids[0]), f"dpid:{dpids[0]}")
            path_edges.append(safe_edge(src_host, first_switch))
            for index in range(len(dpids) - 1):
                current_switch = dpid_to_alias.get(
                    int(dpids[index]), f"dpid:{dpids[index]}"
                )
                next_switch = dpid_to_alias.get(
                    int(dpids[index + 1]), f"dpid:{dpids[index + 1]}"
                )
                path_edges.append(safe_edge(current_switch, next_switch))
            last_switch = dpid_to_alias.get(int(dpids[-1]), f"dpid:{dpids[-1]}")
            path_edges.append(safe_edge(last_switch, dst_host))

    table_data, max_throughput_mbps = build_stats_table(dpid_to_alias)
    switch_table = [
        {"Switch": dpid_to_alias[dpid], "DPID": dpid}
        for dpid in sorted(switch["dpid"] for switch in switches)
    ]

    return {
        "graph": graph,
        "hosts": hosts,
        "host_map": host_map,
        "switch_aliases": dpid_to_alias,
        "switch_table": switch_table,
        "host_table": host_table,
        "src_host": src_host,
        "dst_host": dst_host,
        "path_data": path_data,
        "path_edges": path_edges,
        "down_edges": down_edges,
        "table_data": table_data,
        "max_throughput_mbps": max_throughput_mbps,
    }


def render_metrics(data):
    fault_count = data.get("fault_count", len(data.get("down_edges", [])))

    st.markdown("---")
    st.header("Metrics")
    metric_left, metric_right = st.columns(2)
    metric_left.metric("Latency", "N/A")
    metric_right.metric("Throughput", format_throughput(data["max_throughput_mbps"]))

    metric_left, metric_right = st.columns(2)
    metric_left.metric("Packet Loss", "N/A")
    metric_right.metric("Faults", str(fault_count))

    st.markdown("---")
    st.header("Events")
    st.info("Event logging coming soon...")


def render_topology_plot(data):
    graph = data["graph"]
    path_edges = data["path_edges"]
    down_edges = data["down_edges"]

    plt.close("all")
    fig, ax = plt.subplots(figsize=(10, 6))
    pos = nx.spring_layout(graph, seed=42)
    labels = nx.get_node_attributes(graph, "label")

    switch_nodes = [
        node for node, attr in graph.nodes(data=True) if attr.get("type") == "switch"
    ]
    nx.draw_networkx_nodes(
        graph,
        pos,
        nodelist=switch_nodes,
        node_color="lightgray",
        node_shape="o",
        node_size=1000,
        ax=ax,
    )

    host_nodes = [
        node for node, attr in graph.nodes(data=True) if attr.get("type") == "host"
    ]
    nx.draw_networkx_nodes(
        graph,
        pos,
        nodelist=host_nodes,
        node_color="lightblue",
        node_shape="o",
        node_size=1000,
        ax=ax,
    )

    nx.draw_networkx_labels(graph, pos, labels=labels, font_size=10, ax=ax)

    valid_down_edges = [edge for edge in down_edges if graph.has_edge(edge[0], edge[1])]
    if valid_down_edges:
        nx.draw_networkx_edges(
            graph,
            pos,
            edgelist=valid_down_edges,
            style="--",
            edge_color="red",
            width=2.0,
            alpha=0.8,
            ax=ax,
        )

    inactive_edges = [
        edge
        for edge in st.session_state.known_edges
        if tuple(sorted(edge)) not in path_edges
        and tuple(sorted(edge)) not in down_edges
    ]
    if inactive_edges:
        nx.draw_networkx_edges(
            graph,
            pos,
            edgelist=inactive_edges,
            style="--",
            edge_color="gray",
            alpha=0.5,
            ax=ax,
        )

    valid_path_edges = [
        edge for edge in path_edges if graph.has_edge(edge[0], edge[1])
    ]
    if valid_path_edges:
        nx.draw_networkx_edges(
            graph,
            pos,
            edgelist=valid_path_edges,
            width=3.0,
            edge_color="green",
            ax=ax,
        )

    ax.set_axis_off()
    fig.tight_layout(pad=0)
    plot_buffer = BytesIO()
    fig.savefig(plot_buffer, format="png", bbox_inches="tight", dpi=140)
    plot_buffer.seek(0)
    st.image(plot_buffer, use_container_width=True)
    plt.close(fig)


def render_path_status(data):
    path_data = data["path_data"]
    src_host = data["src_host"]
    dst_host = data["dst_host"]
    host_map = data["host_map"]
    switch_aliases = data["switch_aliases"]

    if path_data and path_data.get("hops"):
        path_str = (
            f"{host_map.get(src_host, src_host)} -> "
            + " -> ".join(
                [
                    switch_aliases.get(int(hop["dpid"]), f"dpid:{hop['dpid']}")
                    for hop in path_data["hops"]
                ]
            )
            + f" -> {host_map.get(dst_host, dst_host)}"
        )
        st.success(f"**Current Path:** {path_str}")
    else:
        st.error("**Current Path:** No active path found (Destination unreachable)")

    if path_data:
        st.write(f"**State:** {path_data.get('state', 'Unknown')}")
        st.write(f"**Plane:** {path_data.get('plane', 'Unknown')}")


def render_alias_tables(data):
    st.subheader("Alias Mapping")
    if data["switch_table"]:
        st.dataframe(
            pd.DataFrame(data["switch_table"]),
            use_container_width=True,
            hide_index=True,
        )

    if data["host_table"]:
        st.dataframe(
            pd.DataFrame(data["host_table"]),
            use_container_width=True,
            hide_index=True,
        )


st.sidebar.header("Algorithm")
if st.sidebar.button("Refresh Now", use_container_width=True):
    clear_api_cache()
    st.rerun()

st.sidebar.button(
    "Dijkstra (Default Route)",
    on_click=reset_to_dijkstra,
    use_container_width=True,
)

with st.sidebar.expander("Static / Manual Path"):
    st.text_input("Enter Switch Aliases (e.g. s1, s2, s4)", key="manual_path_input")
    st.button("Apply Static Path", on_click=apply_static_path, use_container_width=True)

dashboard_slot = st.empty()


def render_live_dashboard():
    clear_api_cache()
    data = build_dashboard_data()

    dashboard_slot.empty()
    with dashboard_slot.container():
        title_col, status_col = st.columns([4, 1])
        with title_col:
            st.title("Live Network Topology Monitor")
        with status_col:
            st.markdown(
                "### Controller UP" if data is not None else "### Controller DOWN"
            )

        st.markdown(
            "Choose host attachment points to see the active path highlighted in green."
        )

        if data is None:
            st.session_state.latest_metrics = None
            st.warning(
                "Cannot connect to SDN Controller. Make sure `run.py` is running."
            )
            return

        st.session_state.latest_metrics = {
            "max_throughput_mbps": data["max_throughput_mbps"],
            "fault_count": len(data["down_edges"]),
        }

        if len(data["hosts"]) == 1:
            st.warning("Only 1 host discovered. Need at least 2 to show a path.")
        elif not data["hosts"]:
            st.warning(
                "No hosts discovered yet. Generate some traffic (e.g. ping) in your network to discover them."
            )

        graph_col, stats_col = st.columns([2, 1])
        with graph_col:
            st.subheader("Network Topology")
            render_topology_plot(data)
            render_path_status(data)

        with stats_col:
            st.subheader("Port Statistics (Throughput)")
            if data["table_data"]:
                df = pd.DataFrame(data["table_data"])
                st.dataframe(df, use_container_width=True, hide_index=True)
            else:
                st.info("Waiting for switch metrics...")
            render_alias_tables(data)


def render_live_metrics():
    data = st.session_state.get("latest_metrics")
    if data is None:
        st.markdown("---")
        st.header("Metrics")
        st.info("Waiting for controller data...")
        st.markdown("---")
        st.header("Events")
        st.info("Event logging coming soon...")
        return

    render_metrics(data)


if hasattr(st, "fragment"):
    render_live_dashboard = st.fragment(run_every=f"{REFRESH_RATE}s")(
        render_live_dashboard
    )
    render_live_metrics = st.fragment(run_every=f"{REFRESH_RATE}s")(
        render_live_metrics
    )

render_live_dashboard()

with st.sidebar:
    render_live_metrics()
