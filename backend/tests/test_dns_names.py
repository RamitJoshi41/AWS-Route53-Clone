import pytest

from dns_names import check_host_name, normalize_record_name, normalize_zone_name


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("example.com", "example.com."),
        ("example.com.", "example.com."),
        ("Example.COM", "example.com."),
        ("  example.com  ", "example.com."),
        ("my-site.co.uk", "my-site.co.uk."),
        ("a1.b2", "a1.b2."),
        ("xn--bcher-kva.example", "xn--bcher-kva.example."),  # Punycode is plain ASCII
    ],
)
def test_valid_names_are_normalized(raw: str, expected: str) -> None:
    assert normalize_zone_name(raw) == expected


@pytest.mark.parametrize(
    ("raw", "message_part"),
    [
        ("", "Domain name is empty."),
        ("   ", "Domain name is empty."),
        (".", "Domain name is empty."),
        ("a..b", "DomainLabelEmpty (Domain label is empty) encountered with 'a..b'"),
        (".example.com", "DomainLabelEmpty"),
        ("example.com..", "DomainLabelEmpty"),
        ("localhost", "at least two labels"),
        ("-bad.com", "Domain label '-bad' is invalid"),
        ("bad-.com", "Domain label 'bad-' is invalid"),
        ("under_score.com", "Domain label 'under_score' is invalid"),
        ("spa ce.com", "is invalid"),
        ("bücher.de", "non-ASCII"),
        ("a" * 64 + ".com", "longer than 63 characters"),
        (".".join(["a" * 63] * 4), "longer than 253 characters"),  # 255 characters
    ],
)
def test_invalid_names_raise_a_clear_message(raw: str, message_part: str) -> None:
    with pytest.raises(ValueError) as error:
        normalize_zone_name(raw)
    assert message_part in str(error.value)


def test_name_at_the_length_limits_is_accepted() -> None:
    longest = ".".join(["a" * 63, "b" * 63, "c" * 63, "d" * 61])  # 253 characters
    assert len(longest) == 253
    assert normalize_zone_name(longest) == longest + "."


# --- Record names and host names ------------------------------------------------

ZONE = "example.com."


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("example.com", "example.com."),  # the zone apex
        ("WWW.Example.com.", "www.example.com."),
        ("a.b.example.com", "a.b.example.com."),
        ("_dmarc.example.com", "_dmarc.example.com."),  # underscores are allowed in records
        ("_sip._tcp.example.com", "_sip._tcp.example.com."),
        ("*.example.com", "*.example.com."),  # wildcard
        ("*.dev.example.com", "*.dev.example.com."),
    ],
)
def test_record_names_are_normalized(raw: str, expected: str) -> None:
    assert normalize_record_name(raw, ZONE) == expected


@pytest.mark.parametrize(
    ("raw", "message_part"),
    [
        ("www.other.com", "RRSet with DNS name www.other.com. is not permitted in zone example.com."),
        ("notexample.com", "is not permitted in zone"),  # a suffix, but not a subdomain
        ("com", "is not permitted in zone"),
        ("www.*.example.com", "Domain label '*' is invalid"),  # wildcard only as the first label
        ("w*.example.com", "is invalid"),
        ("a..example.com", "DomainLabelEmpty"),
        ("sp ace.example.com", "is invalid"),
        ("", "Domain name is empty."),
    ],
)
def test_invalid_record_names_raise(raw: str, message_part: str) -> None:
    with pytest.raises(ValueError) as error:
        normalize_record_name(raw, ZONE)
    assert message_part in str(error.value)


@pytest.mark.parametrize("host", ["localhost", "mail.example.com", "mail.example.com.", "_x.acm-validations.aws."])
def test_valid_host_names(host: str) -> None:
    check_host_name(host)


@pytest.mark.parametrize("host", ["", "a..b", "-bad.com", "*.example.com", "has space.com"])
def test_invalid_host_names(host: str) -> None:
    with pytest.raises(ValueError):
        check_host_name(host)
