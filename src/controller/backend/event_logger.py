"""event_logger — Ring-buffer log store + network event counters.

LogStore is a ``logging.Handler`` that captures every log record in a
bounded ``deque`` while letting the existing handler(s) continue to print
to stdout.  EventCounters tracks network events (switch connect/disconnect,
link up/down, host add/move, etc.) with thread-safe atomic increments.

Both are exposed via the REST API through ``GET /logs`` and ``GET /events``.
"""

from __future__ import annotations

import logging
import threading
from collections import deque
from datetime import datetime

LOG = logging.getLogger(__name__)

DEFAULT_MAX_LOGS = 10000

_LOG_LEVEL_MAP: dict[str, int] = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


class LogStore(logging.Handler):
    """Thread-safe ring-buffer that captures formatted log records.

    Attach to the root logger (or any parent) via ``logging.getLogger().addHandler()``.
    Records are stored as small dicts; the ring buffer has a fixed maximum
    capacity (default ``DEFAULT_MAX_LOGS``) so it never leaks memory.
    """

    def __init__(self, maxlen: int = DEFAULT_MAX_LOGS) -> None:
        super().__init__()
        self._buffer: deque[dict[str, str]] = deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        entry: dict[str, str] = {
            "timestamp": datetime.fromtimestamp(record.created)
            .astimezone()
            .isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": self.format(record),
        }
        with self._lock:
            self._buffer.append(entry)

    def get_logs(
        self, level: str = "DEBUG", lines: str = "ALL"
    ) -> list[dict[str, str]]:
        """Return stored log entries filtered by *level* and trimmed to *lines*.

        Args:
            level: Minimum severity (DEBUG, INFO, WARNING, ERROR, CRITICAL).
                   Entries below this level are excluded.  Default: DEBUG (show all).
            lines: Number of most-recent entries to return, or ``"ALL"`` to return
                   every matching entry.  Default: "ALL".

        Returns:
            A list of dicts, newest record last.
        """
        min_level = _LOG_LEVEL_MAP.get(level.upper(), logging.DEBUG)
        with self._lock:
            entries = list(self._buffer)

        filtered = [
            e for e in entries if _LOG_LEVEL_MAP.get(e["level"], 0) >= min_level
        ]

        if lines == "ALL":
            return filtered

        try:
            count = int(lines)
        except ValueError:
            return filtered

        if count <= 0:
            return filtered
        return filtered[-count:]


# ── Network event counters ────────────────────────────────────────────────


class EventCounters:
    """Thread-safe monotonic counters for network events.

    These are incremented by the Backend in os-ken event handlers and
    read by the REST API (``GET /events``) for monitoring.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._switch_connected: int = 0
        self._switch_disconnected: int = 0
        self._link_up: int = 0
        self._link_down: int = 0
        self._host_added: int = 0
        self._host_moved: int = 0
        self._port_up: int = 0
        self._port_down: int = 0
        self._packets_forwarded: int = 0
        self._packets_dropped: int = 0
        self._arp_replies_sent: int = 0
        self._policies_installed: int = 0
        self._policies_removed: int = 0

    # -- increment helpers --

    def increment_switch_connected(self) -> None:
        with self._lock:
            self._switch_connected += 1

    def increment_switch_disconnected(self) -> None:
        with self._lock:
            self._switch_disconnected += 1

    def increment_link_up(self) -> None:
        with self._lock:
            self._link_up += 1

    def increment_link_down(self) -> None:
        with self._lock:
            self._link_down += 1

    def increment_host_added(self) -> None:
        with self._lock:
            self._host_added += 1

    def increment_host_moved(self) -> None:
        with self._lock:
            self._host_moved += 1

    def increment_port_up(self) -> None:
        with self._lock:
            self._port_up += 1

    def increment_port_down(self) -> None:
        with self._lock:
            self._port_down += 1

    def increment_packets_forwarded(self) -> None:
        with self._lock:
            self._packets_forwarded += 1

    def increment_packets_dropped(self) -> None:
        with self._lock:
            self._packets_dropped += 1

    def increment_arp_replies_sent(self) -> None:
        with self._lock:
            self._arp_replies_sent += 1

    def increment_policy_installed(self) -> None:
        with self._lock:
            self._policies_installed += 1

    def increment_policy_removed(self) -> None:
        with self._lock:
            self._policies_removed += 1

    # -- snapshot query --

    def snapshot(self) -> dict[str, int]:
        """Return a dict snapshot of all counters (thread-safe)."""
        with self._lock:
            return {
                "switch_connected": self._switch_connected,
                "switch_disconnected": self._switch_disconnected,
                "link_up": self._link_up,
                "link_down": self._link_down,
                "host_added": self._host_added,
                "host_moved": self._host_moved,
                "port_up": self._port_up,
                "port_down": self._port_down,
                "packets_forwarded": self._packets_forwarded,
                "packets_dropped": self._packets_dropped,
                "arp_replies_sent": self._arp_replies_sent,
                "policies_installed": self._policies_installed,
                "policies_removed": self._policies_removed,
            }
