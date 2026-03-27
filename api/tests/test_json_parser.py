import pytest
from app.skills.utils.json_parser import parse_llm_json, LLMJsonParseError


def test_parse_plain_json():
    result = parse_llm_json('{"key": "value"}')
    assert result == {"key": "value"}


def test_parse_markdown_fenced_json():
    raw = '```json\n{"characters": [{"name": "Alice"}]}\n```'
    result = parse_llm_json(raw)
    assert result["characters"][0]["name"] == "Alice"


def test_parse_json_with_surrounding_text():
    raw = 'Here is the result:\n{"items": [1, 2, 3]}\nDone.'
    result = parse_llm_json(raw)
    assert result["items"] == [1, 2, 3]


def test_parse_json_array():
    raw = '[{"id": 1}, {"id": 2}]'
    result = parse_llm_json(raw)
    assert len(result) == 2
    assert result[0]["id"] == 1


def test_parse_invalid_json_raises():
    with pytest.raises(LLMJsonParseError):
        parse_llm_json("This is not JSON at all")


def test_parse_empty_string_raises():
    with pytest.raises(LLMJsonParseError):
        parse_llm_json("")


def test_parse_fenced_json_without_lang_tag():
    """Fence without json language tag should still parse."""
    raw = '```\n{"nested": true}\n```'
    result = parse_llm_json(raw)
    assert result["nested"] is True


def test_parse_with_wrapper_key():
    raw = '{"characters": [{"name": "Bob"}], "meta": "info"}'
    result = parse_llm_json(raw, wrapper_key="characters")
    assert isinstance(result, list)
    assert result[0]["name"] == "Bob"


def test_parse_error_preserves_raw_output():
    raw = "totally not json content here"
    with pytest.raises(LLMJsonParseError) as exc_info:
        parse_llm_json(raw)
    assert exc_info.value.raw_output != ""
