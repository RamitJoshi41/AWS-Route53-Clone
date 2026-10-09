"""Domain-name rules for hosted zones: validation and normalization.

A zone name is stored in one canonical form, lowercase with exactly one trailing
dot ("example.com."), so "Example.COM", "example.com" and "example.com." are the
same zone. The UI shows names without the trailing dot, as the console does.
"""

import re

# One DNS label: letters, digits and hyphens, not starting or ending with a hyphen
# (the "LDH" rule from RFC 1035/1123). Checked after lowercasing.
_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?")

MAX_LABEL_LENGTH = 63
# 255 bytes on the wire = at most 253 characters in text form, without the trailing dot.
MAX_NAME_LENGTH = 253


def normalize_zone_name(raw: str) -> str:
    """Return the canonical form of `raw`, or raise ValueError saying what's wrong.

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

    labels = name.split(".")
    for label in labels:
        if not label:
            # Same wording as the Route 53 console (e.g. for "a..b").
            raise ValueError(
                f"DomainLabelEmpty (Domain label is empty) encountered with '{typed}'"
            )
        if len(label) > MAX_LABEL_LENGTH:
            raise ValueError(
                f"Domain label '{label}' is longer than {MAX_LABEL_LENGTH} characters."
            )
        if not _LABEL.fullmatch(label):
            raise ValueError(
                f"Domain label '{label}' is invalid. Use only a-z, 0-9 and hyphens, "
                "and don't start or end a label with a hyphen."
            )
    if len(labels) < 2:
        raise ValueError(
            f"Domain name '{typed}' must have at least two labels, such as example.com."
        )

    return name + "."
