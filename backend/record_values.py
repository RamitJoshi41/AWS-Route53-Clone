"""Record values (RDATA) for each record type: validation and normalization.

A record holds one or more values, each a string in the type's standard text form,
exactly what the console's Value box takes (one value per line):

    A      192.0.2.235                      AAAA   2001:db8::8a2e:370:bab5
    CNAME  www.example.com                  PTR    www.example.com
    NS     ns1.amazon.com                   MX     10 mailserver.example.com
    TXT    "Sample Text Entries"            SRV    1 10 5269 xmpp-server.example.com
    CAA    0 issue "caa.example.com"        SOA    ns.example.net. hostmaster.example.com. 1 7200 900 1209600 86400

Like Route 53, the checks run on the server, and a failure reads like Route 53's,
which the console shows in its error banner:
    ARRDATAIllegalIPv4Address (Value is not a valid IPv4 address) encountered with 'abc'
The "Format: ..." hints are the console's own.
"""

import ipaddress
import re
from collections.abc import Callable

from dns_names import check_host_name

MAX_UINT16 = 65535
MAX_UINT32 = 4294967295
MAX_INT32 = 2147483647  # also the largest TTL Route 53 accepts
MAX_CHARACTER_STRING = 255  # bytes in one TXT/CAA string (RFC 1035)
CAA_TAGS = ("issue", "issuewild", "issuemail", "iodef")

MX_FORMAT = "Format: [priority] [mail server host name]"
SRV_FORMAT = "Format: [priority] [weight] [port] [server host name]"
CAA_FORMAT = "Format: [flag] [tag] [value]"
SOA_FORMAT = (
    "Format: [authority-domain] [hostmaster-email-address] [zone-serial-number] "
    "[refresh-time] [retry-time] [expire-time] [negative caching TTL]"
)
QUOTES_PROBLEM = "InvalidCharacterString (Value should be enclosed in quotation marks)"


def _invalid(problem: str, value: str) -> ValueError:
    return ValueError(f"{problem} encountered with '{value}'")


def _host(value: str, whole: str) -> str:
    """Check a host-name field; errors quote the whole value they came from."""
    try:
        check_host_name(value)
    except ValueError as error:
        raise _invalid(str(error).split(" encountered with ")[0], whole) from None
    return value


def _number(field: str, label: str, maximum: int, whole: str) -> str:
    # isascii: str.isdigit() also accepts digits like "²", which int() rejects.
    if not (field.isascii() and field.isdigit()) or int(field) > maximum:
        raise _invalid(f"{label} must be an integer between 0 and {maximum}", whole)
    return str(int(field))  # "010" -> "10"


def _fields(value: str, count: int, fmt: str) -> list[str]:
    fields = value.split()
    if len(fields) != count:
        raise _invalid(f"Value doesn't match the expected format. {fmt}", value)
    return fields


# A quoted character-string: "..." in which \" and \\ are escaped characters.
_QUOTED = re.compile(r'"((?:[^"\\]|\\.)*)"')


def _quoted_strings(value: str) -> list[str]:
    """Split `"one" "two"` into its strings (escapes kept), or raise ValueError."""
    strings, position = [], 0
    while position < len(value):
        if value[position].isspace():
            position += 1
            continue
        match = _QUOTED.match(value, position)
        if match is None:
            raise _invalid(QUOTES_PROBLEM, value)
        position = match.end()
        if position < len(value) and not value[position].isspace():
            raise _invalid(QUOTES_PROBLEM, value)  # e.g. "a"b
        strings.append(match.group(1))
    return strings


def _quote_bare_word(value: str) -> str:
    """Route 53 accepts one word without quotes and stores it quoted: hello -> "hello"."""
    if value and '"' not in value and not any(c.isspace() for c in value):
        return f'"{value}"'
    return value


def _check_string_length(strings: list[str], whole: str) -> None:
    for string in strings:
        unescaped = re.sub(r"\\(.)", r"\1", string)
        if len(unescaped.encode("utf-8")) > MAX_CHARACTER_STRING:
            raise _invalid("CharacterStringTooLong (Value is too long)", whole)


# --- One function per type: check a stripped value, return its normalized form ---


def _a(value: str) -> str:
    try:
        return str(ipaddress.IPv4Address(value))
    except ValueError:
        raise _invalid("ARRDATAIllegalIPv4Address (Value is not a valid IPv4 address)", value) from None


def _aaaa(value: str) -> str:
    try:
        if "%" in value:  # a scope ID (fe80::1%eth0) is local to one machine, not DNS data
            raise ValueError
        ipaddress.IPv6Address(value)
    except ValueError:
        raise _invalid("AAAARRDATAIllegalIPv6Address (Value is not a valid IPv6 address)", value) from None
    return value  # kept as typed: the console shows the address the way it was entered


def _domain_name(value: str) -> str:
    return _host(value, value)


def _mx(value: str) -> str:
    priority, host = _fields(value, 2, MX_FORMAT)
    return f"{_number(priority, 'Priority', MAX_UINT16, value)} {_host(host, value)}"


def _srv(value: str) -> str:
    priority, weight, port, target = _fields(value, 4, SRV_FORMAT)
    numbers = [
        _number(field, label, MAX_UINT16, value)
        for field, label in ((priority, "Priority"), (weight, "Weight"), (port, "Port"))
    ]
    return " ".join([*numbers, _host(target, value)])


def _txt(value: str) -> str:
    value = _quote_bare_word(value)
    _check_string_length(_quoted_strings(value), value)
    return value


def _caa(value: str) -> str:
    fields = value.split(maxsplit=2)
    if len(fields) != 3:
        raise _invalid(f"Value doesn't match the expected format. {CAA_FORMAT}", value)
    flag, tag, tag_value = fields
    flag = _number(flag, "Flag", 255, value)
    if tag.lower() not in CAA_TAGS:
        raise _invalid(f"Tag must be one of: {', '.join(CAA_TAGS)}", value)
    strings = _quoted_strings(_quote_bare_word(tag_value))
    if len(strings) != 1:
        raise _invalid(f"Value doesn't match the expected format. {CAA_FORMAT}", value)
    _check_string_length(strings, value)
    return f'{flag} {tag.lower()} "{strings[0]}"'


def _soa(value: str) -> str:
    fields = _fields(value, 7, SOA_FORMAT)
    names = [_host(field, value) for field in fields[:2]]
    serial = _number(fields[2], "Serial number", MAX_UINT32, value)
    labels = ("Refresh time", "Retry time", "Expire time", "Negative caching TTL")
    timers = [_number(field, label, MAX_INT32, value) for field, label in zip(fields[3:], labels)]
    return " ".join([*names, serial, *timers])


_NORMALIZERS: dict[str, Callable[[str], str]] = {
    "A": _a,
    "AAAA": _aaaa,
    "CAA": _caa,
    "CNAME": _domain_name,
    "MX": _mx,
    "NS": _domain_name,
    "PTR": _domain_name,
    "SOA": _soa,
    "SRV": _srv,
    "TXT": _txt,
}


def normalize_values(record_type: str, values: list[str]) -> list[str]:
    """Check every value of a record of `record_type` and return them normalized.

    Raises ValueError with a console-style message for the first bad value, or
    for a value listed twice.
    """
    normalize = _NORMALIZERS[record_type]
    result: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = raw.strip()
        if not value:
            raise ValueError("A value is empty. Enter one value per line.")
        value = normalize(value)
        if record_type == "AAAA":  # 2001:db8::1 and 2001:0DB8:0::1 are the same address
            key = str(ipaddress.IPv6Address(value))
        elif record_type in ("TXT", "CAA"):  # text in quoted strings is case-sensitive
            key = value
        else:  # DNS names aren't
            key = value.lower().rstrip(".")
        if key in seen:
            raise ValueError(f"Duplicate Resource Record: '{value}'")
        seen.add(key)
        result.append(value)
    return result
