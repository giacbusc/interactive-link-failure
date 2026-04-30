"""SwitchRegistry — per-switch metadata (vendor, ports, table routing)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional

LOG = logging.getLogger(__name__)


class Vendor(Enum):
    OVS = "Open vSwitch"
    ZODIAC = "Zodiac FX"
    HPE = "HPE ArubaOS"
    UNKNOWN = "Unknown"

    def __str__(self) -> str:
        return self.value


@dataclass
class SwitchInfo:
    dpid: int
    vendor: Vendor
    mfr_desc: str = ""
    hw_desc: str = ""
    sw_desc: str = ""
    serial_num: str = ""
    num_ports: int = 0

    @property
    def main_table(self) -> int:
        return 100 if self.vendor == Vendor.HPE else 0

    @property
    def vendor_label(self) -> str:
        return self.vendor.value


_HPE_MARKERS: tuple[str, ...] = ("HPE", "Hewlett", "Aruba", "HP ")
_OVS_MARKERS: tuple[str, ...] = ("Nicira", "Open vSwitch")
_ZODIAC_MARKERS: tuple[str, ...] = ("Northbound Networks", "Zodiac")


class SwitchRegistry:
    """Canonical store for all connected-switch metadata.

    Populated from ``OFPMP_DESC`` multipart replies at connect time.
    """

    def __init__(self) -> None:
        self._switches: dict[int, SwitchInfo] = {}

    # ── classification ───────────────────────────────────────────────

    @staticmethod
    def _classify(mfr: str) -> Vendor:
        if any(marker in mfr for marker in _HPE_MARKERS):
            return Vendor.HPE
        if any(marker in mfr for marker in _OVS_MARKERS):
            return Vendor.OVS
        if any(marker in mfr for marker in _ZODIAC_MARKERS):
            return Vendor.ZODIAC
        return Vendor.UNKNOWN

    # ── registration ─────────────────────────────────────────────────

    def register(self, dpid: int, body) -> SwitchInfo:
        mfr = (
            body.mfr_desc.decode(errors="replace")
            if isinstance(body.mfr_desc, bytes)
            else body.mfr_desc
        )
        info = SwitchInfo(
            dpid=dpid,
            vendor=self._classify(mfr),
            mfr_desc=mfr,
            hw_desc=(
                body.hw_desc.decode(errors="replace")
                if isinstance(body.hw_desc, bytes)
                else body.hw_desc
            ),
            sw_desc=(
                body.sw_desc.decode(errors="replace")
                if isinstance(body.sw_desc, bytes)
                else body.sw_desc
            ),
            serial_num=(
                body.serial_num.decode(errors="replace")
                if isinstance(body.serial_num, bytes)
                else body.serial_num
            ),
        )
        self._switches[dpid] = info
        LOG.info(
            "SwitchRegistry: registered dpid=%s vendor=%s hw=%s sw=%s",
            hex(dpid),
            info.vendor_label,
            info.hw_desc,
            info.sw_desc,
        )
        return info

    # ── update ───────────────────────────────────────────────────────

    def set_num_ports(self, dpid: int, num: int) -> None:
        info = self._switches.get(dpid)
        if info is not None and info.num_ports != num:
            info.num_ports = num
            LOG.debug(
                "SwitchRegistry: dpid=%s ports=%d",
                hex(dpid),
                num,
            )

    # ── queries ──────────────────────────────────────────────────────

    def get(self, dpid: int) -> Optional[SwitchInfo]:
        return self._switches.get(dpid)

    def get_vendor(self, dpid: int) -> Vendor:
        info = self._switches.get(dpid)
        return info.vendor if info else Vendor.UNKNOWN

    def main_table(self, dpid: int) -> int:
        info = self._switches.get(dpid)
        return info.main_table if info else 0

    def set_unknown(self, dpid: int) -> SwitchInfo:
        """Register a placeholder for a switch whose DESC reply hasn't arrived yet."""
        info = SwitchInfo(dpid=dpid, vendor=Vendor.UNKNOWN)
        self._switches[dpid] = info
        return info

    @property
    def all(self) -> dict[int, SwitchInfo]:
        return dict(self._switches)

    def remove(self, dpid: int) -> None:
        self._switches.pop(dpid, None)
