"""PolicyManager — stub for GOAL 1. Full implementation in GOAL 2."""

from __future__ import annotations

from enum import Enum
from typing import Optional


class PolicyState(Enum):
    UNSPECIFIED = "unspecified"
    ACTIVE = "active"
    BROKEN = "broken"


class PolicyManager:
    """Stub: will manage user-pinned paths in GOAL 2."""

    def get_state(self, src_mac: str, dst_mac: str) -> PolicyState:
        return PolicyState.UNSPECIFIED

    def set_policy(self, src_mac: str, dst_mac: str, path: list[int]) -> bool:
        return False

    def remove_policy(self, src_mac: str, dst_mac: str) -> bool:
        return False

    def get_policy_path(self, src_mac: str, dst_mac: str) -> Optional[list[int]]:
        return None
