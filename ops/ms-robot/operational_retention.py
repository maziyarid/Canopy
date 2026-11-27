#!/usr/bin/env python3
"""Fail-closed operational retention and data_domain validation for AAX-55.

Does not enable retention, does not deploy, does not mutate production.
"""
from __future__ import annotations

MAX_DOMAIN_LENGTH = 64
MAX_MODE_LENGTH = 32
ALLOWED_DOMAINS = frozenset({"operational", "medical", "thesis", "research"})
ALLOWED_MODES = frozenset({"dry-run", "inspect", "apply"})


class RetentionRefused(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def normalise_domain(raw: str | None) -> str:
    if not isinstance(raw, str):
        raise RetentionRefused("domain_invalid")
    # Reject control/DEL/non-ASCII in the *raw* value before strip/lower.
    if any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127 for c in raw):
        raise RetentionRefused("domain_control_rejected")
    cleaned = raw.strip().lower()
    if not cleaned or len(cleaned) > MAX_DOMAIN_LENGTH:
        raise RetentionRefused("domain_invalid")
    if cleaned not in ALLOWED_DOMAINS:
        raise RetentionRefused("domain_unknown")
    return cleaned


def normalise_mode(raw: str | None) -> str:
    if not isinstance(raw, str):
        raise RetentionRefused("mode_invalid")
    if any(ord(c) < 32 or ord(c) == 127 or ord(c) > 127 for c in raw):
        raise RetentionRefused("mode_control_rejected")
    cleaned = raw.strip().lower()
    if not cleaned or len(cleaned) > MAX_MODE_LENGTH:
        raise RetentionRefused("mode_invalid")
    if cleaned not in ALLOWED_MODES:
        raise RetentionRefused("mode_unknown")
    return cleaned
