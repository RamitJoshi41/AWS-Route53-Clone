"""Route 53-style resource IDs: a prefix plus 19 uppercase letters and digits.

Hosted zones use "Z0" (Z02020872110QTE2FC2NK) and changes "C0" (C00322633S8ZY8DUPZBX0),
the shapes the console shows.
"""

import secrets
import string

_ALPHABET = string.ascii_uppercase + string.digits


def new_id(prefix: str) -> str:
    """`prefix` + 19 random characters. Not guessable (secrets), so IDs can't be probed."""
    return prefix + "".join(secrets.choice(_ALPHABET) for _ in range(19))
