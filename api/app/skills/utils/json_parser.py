"""Robust JSON parser for LLM outputs.

Pipeline: strip markdown fences → find JSON substring → parse → unwrap key.
Raises LLMJsonParseError with raw_output for diagnostics.
"""
import json
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


class LLMJsonParseError(Exception):
    """Raised when LLM output cannot be parsed as valid JSON."""

    def __init__(self, message: str, raw_output: str = ""):
        super().__init__(message)
        self.raw_output = raw_output


def parse_llm_json(raw: str, *, wrapper_key: str | None = None) -> Any:
    """Parse JSON from LLM output with multiple recovery strategies.

    Args:
        raw: Raw LLM output string (may include markdown fences, extra text).
        wrapper_key: If provided and result is a dict containing this key,
                     unwrap and return only that value.

    Returns:
        Parsed JSON value (list, dict, etc.).

    Raises:
        LLMJsonParseError: When no valid JSON can be extracted.
    """
    # Step 1: Strip markdown fences (```json ... ```)
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", raw, re.DOTALL)
    text = match.group(1).strip() if match else raw.strip()

    # Step 2: Try direct parse
    parsed = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Step 3: Recover JSON substring — find first [ or { and scan backwards from end
        json_match = re.search(r"[\[{]", text)
        if json_match:
            start = json_match.start()
            for end in range(len(text), start, -1):
                try:
                    parsed = json.loads(text[start:end])
                    break
                except json.JSONDecodeError:
                    continue

    if parsed is None:
        raise LLMJsonParseError(
            f"No valid JSON found in LLM output ({len(raw)} chars)",
            raw_output=raw[:500],
        )

    # Step 4: Unwrap wrapper key if present
    if wrapper_key and isinstance(parsed, dict) and wrapper_key in parsed:
        parsed = parsed[wrapper_key]

    return parsed
