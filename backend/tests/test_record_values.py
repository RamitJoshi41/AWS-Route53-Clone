import pytest

from record_values import normalize_values


@pytest.mark.parametrize(
    ("record_type", "raw", "expected"),
    [
        ("A", " 192.0.2.235 ", "192.0.2.235"),
        ("AAAA", "2001:0db8::8a2e:0370:bab5", "2001:0db8::8a2e:0370:bab5"),  # kept as typed
        ("AAAA", "::1", "::1"),
        ("CNAME", "www.example.com", "www.example.com"),
        ("CNAME", "_abc.acm-validations.aws.", "_abc.acm-validations.aws."),
        ("PTR", "www.example.com", "www.example.com"),
        ("NS", "ns1.amazon.com", "ns1.amazon.com"),
        ("MX", "10 mailserver.example.com", "10 mailserver.example.com"),
        ("MX", "  010   mail.example.com ", "10 mail.example.com"),  # spacing and leading zeros
        ("SRV", "1 10 5269 xmpp-server.example.com", "1 10 5269 xmpp-server.example.com"),
        ("TXT", '"Sample Text Entries"', '"Sample Text Entries"'),
        ("TXT", "hello", '"hello"'),  # one bare word is quoted, as Route 53 does
        ("TXT", '"v=spf1 -all" "second string"', '"v=spf1 -all" "second string"'),
        ("TXT", r'"say \"hi\""', r'"say \"hi\""'),  # escaped quotes
        ("CAA", '0 issue "caa.example.com"', '0 issue "caa.example.com"'),
        ("CAA", "0 ISSUE letsencrypt.org", '0 issue "letsencrypt.org"'),
        ("CAA", '128 iodef "mailto:security@example.com"', '128 iodef "mailto:security@example.com"'),
        (
            "SOA",
            "ns.example.net. hostmaster.example.com. 1 7200 900 1209600 86400",
            "ns.example.net. hostmaster.example.com. 1 7200 900 1209600 86400",
        ),
    ],
)
def test_valid_values_are_normalized(record_type: str, raw: str, expected: str) -> None:
    assert normalize_values(record_type, [raw]) == [expected]


@pytest.mark.parametrize(
    ("record_type", "raw", "message_part"),
    [
        ("A", "abc", "ARRDATAIllegalIPv4Address (Value is not a valid IPv4 address) encountered with 'abc'"),
        ("A", "256.1.1.1", "ARRDATAIllegalIPv4Address"),
        ("A", "192.0.2.01", "ARRDATAIllegalIPv4Address"),  # leading zeros are ambiguous (octal)
        ("A", "2001:db8::1", "ARRDATAIllegalIPv4Address"),
        ("AAAA", "192.0.2.1", "AAAARRDATAIllegalIPv6Address (Value is not a valid IPv6 address)"),
        ("AAAA", "fe80::1%eth0", "AAAARRDATAIllegalIPv6Address"),
        ("CNAME", "a..b", "DomainLabelEmpty (Domain label is empty) encountered with 'a..b'"),
        ("NS", "bad host", "is invalid"),
        ("MX", "mail.example.com", "Format: [priority] [mail server host name]"),
        ("MX", "70000 mail.example.com", "Priority must be an integer between 0 and 65535"),
        ("MX", "-1 mail.example.com", "Priority must be an integer"),
        ("MX", "²0 mail.example.com", "Priority must be an integer"),  # a non-ASCII digit
        ("SRV", "1 10 xmpp.example.com", "Format: [priority] [weight] [port] [server host name]"),
        ("SRV", "1 10 99999 xmpp.example.com", "Port must be an integer between 0 and 65535"),
        ("TXT", "two words", "InvalidCharacterString (Value should be enclosed in quotation marks)"),
        ("TXT", '"unterminated', "InvalidCharacterString"),
        ("TXT", '"a"b', "InvalidCharacterString"),
        ("TXT", '"' + "x" * 256 + '"', "CharacterStringTooLong (Value is too long)"),
        ("CAA", "0 issue", "Format: [flag] [tag] [value]"),
        ("CAA", '0 badtag "x"', "Tag must be one of: issue, issuewild, issuemail, iodef"),
        ("CAA", '256 issue "x"', "Flag must be an integer between 0 and 255"),
        ("SOA", "ns.example.net. hostmaster.example.com. 1 7200", "Format: [authority-domain]"),
    ],
)
def test_invalid_values_raise_route53_style_errors(record_type: str, raw: str, message_part: str) -> None:
    with pytest.raises(ValueError) as error:
        normalize_values(record_type, [raw])
    message = str(error.value)
    assert message.startswith("Invalid Resource Record: ")
    assert message_part in message


def test_txt_string_of_255_characters_is_accepted() -> None:
    value = '"' + "x" * 255 + '"'
    assert normalize_values("TXT", [value]) == [value]


def test_several_values_keep_their_order() -> None:
    assert normalize_values("A", ["192.0.2.2", "192.0.2.1"]) == ["192.0.2.2", "192.0.2.1"]


@pytest.mark.parametrize(
    ("record_type", "values"),
    [
        ("A", ["192.0.2.1", " 192.0.2.1"]),
        ("AAAA", ["2001:db8::1", "2001:0DB8:0::1"]),  # the same address written differently
        ("NS", ["ns1.example.com", "NS1.example.com."]),  # names aren't case-sensitive
        ("TXT", ["hello", '"hello"']),
    ],
)
def test_duplicate_values_are_rejected(record_type: str, values: list[str]) -> None:
    with pytest.raises(ValueError, match="Duplicate Resource Record"):
        normalize_values(record_type, values)


def test_txt_values_differing_in_case_are_not_duplicates() -> None:
    assert len(normalize_values("TXT", ['"Hello"', '"hello"'])) == 2


def test_empty_value_is_rejected() -> None:
    with pytest.raises(ValueError, match="a value is empty"):
        normalize_values("A", ["192.0.2.1", "   "])
