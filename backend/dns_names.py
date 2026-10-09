"""Domain-name rules for hosted zones and records: validation and normalization.

A zone or record name is stored in one canonical form, lowercase with exactly one
trailing dot ("example.com."), so "Example.COM", "example.com" and "example.com."
are the same name. The UI shows names without the trailing dot, as the console does.
"""

import re

# One zone-name label: letters, digits and hyphens, not starting or ending with a
# hyphen (the "LDH" rule from RFC 1035/1123). Checked after lowercasing.
_ZONE_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?")
# Record names and host names in record values may also use underscores, which
# service records need (_dmarc.example.com, _sip._tcp.example.com).
_HOST_LABEL = re.compile(r"[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?")

MAX_LABEL_LENGTH = 63
# 255 bytes on the wire = at most 253 characters in text form, without the trailing dot.
MAX_NAME_LENGTH = 253


def _check_name(raw: str, label_rule: re.Pattern[str], allowed: str, wildcard: bool = False) -> str:
    """Lowercase `raw`, drop its one optional trailing dot and check every label.

    Returns the name without the trailing dot, or raises ValueError saying what's
    wrong. `wildcard` allows "*" as the whole first label (*.example.com).
    The messages are shown to the user in the console's error banner.
    """
    typed = raw.strip()
    name = typed.lower()
    if name.endswith("."):
        name = name[:-1]  # the one optional trailing dot; any other empty label is an error

    if not name:
        raise ValueError("Domain name is empty.")
    if not name.isascii():
        raise ValueError(
            f"Domain name '{typed}' contains non-ASCII characters. "
            "Enter internationalized names in Punycode (xn--...)."
        )
    if len(name) > MAX_NAME_LENGTH:
        raise ValueError(f"Domain name is longer than {MAX_NAME_LENGTH} characters.")

    for position, label in enumerate(name.split(".")):
        if not label:
            # Same wording as the Route 53 console (e.g. for "a..b").
            raise ValueError(
                f"DomainLabelEmpty (Domain label is empty) encountered with '{typed}'"
            )
        if len(label) > MAX_LABEL_LENGTH:
            raise ValueError(
                f"Domain label '{label}' is longer than {MAX_LABEL_LENGTH} characters."
            )
        if wildcard and position == 0 and label == "*":
            continue
        if not label_rule.fullmatch(label):
            raise ValueError(
                f"Domain label '{label}' is invalid. Use only {allowed}, "
                "and don't start or end a label with a hyphen."
            )
    return name


def normalize_zone_name(raw: str) -> str:
    """Return the canonical form of a hosted zone name, or raise ValueError."""
    name = _check_name(raw, _ZONE_LABEL, "a-z, 0-9 and hyphens")
    if "." not in name:
        raise ValueError(
            f"Domain name '{raw.strip()}' must have at least two labels, such as example.com."
        )
    return name + "."


def normalize_record_name(raw: str, zone_name: str) -> str:
    """Return the canonical form of a record name in the zone `zone_name` ("example.com.").

    `raw` is fully qualified, like in the Route 53 API ("www.example.com"); the
    console's form adds the zone name to what's typed in the "subdomain" box. A
    leading "*" label makes a wildcard record. Raises ValueError for a malformed
    name or one outside the zone.
    """
    name = _check_name(raw, _HOST_LABEL, "a-z, 0-9, hyphens and underscores", wildcard=True) + "."
    if name != zone_name and not name.endswith("." + zone_name):
        # Route 53's wording.
        raise ValueError(f"RRSet with DNS name {name} is not permitted in zone {zone_name}")
    return name


def check_host_name(raw: str) -> None:
    """Raise ValueError unless `raw` is a valid host name (a CNAME target, a mail server...).

    Unlike a zone name, a single label ("localhost") is allowed.
    """
    _check_name(raw, _HOST_LABEL, "a-z, 0-9, hyphens and underscores")
