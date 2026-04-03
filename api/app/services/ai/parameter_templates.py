"""
Dify-style ParameterRule template engine.

Provides preset templates for common LLM parameters (temperature, top_p, etc.)
and a resolver that expands `use_template` references into full rule definitions.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

PARAMETER_RULE_TEMPLATES: dict[str, dict[str, Any]] = {
    "temperature": {
        "label": "Temperature",
        "type": "float",
        "help": "Controls randomness. Higher values produce more creative results.",
        "required": False,
        "default": 0.7,
        "min": 0.0,
        "max": 2.0,
        "precision": 1,
    },
    "top_p": {
        "label": "Top P",
        "type": "float",
        "help": "Nucleus sampling threshold.",
        "required": False,
        "default": 1.0,
        "min": 0.0,
        "max": 1.0,
        "precision": 2,
    },
    "max_tokens": {
        "label": "Max Tokens",
        "type": "int",
        "help": "Maximum number of tokens to generate.",
        "required": False,
        "default": 4096,
        "min": 1,
        "max": 1000000,
    },
    "frequency_penalty": {
        "label": "Frequency Penalty",
        "type": "float",
        "help": "Penalizes tokens based on their frequency in the text so far.",
        "required": False,
        "default": 0.0,
        "min": -2.0,
        "max": 2.0,
        "precision": 1,
    },
    "presence_penalty": {
        "label": "Presence Penalty",
        "type": "float",
        "help": "Penalizes tokens based on whether they appear in the text so far.",
        "required": False,
        "default": 0.0,
        "min": -2.0,
        "max": 2.0,
        "precision": 1,
    },
}

_TEMPLATE_FIELDS = ("label", "type", "help", "required", "default", "min", "max", "precision")


def resolve_parameter_rules(rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Expand use_template references in parameter rules.

    For each rule that contains a ``use_template`` key, the corresponding
    template values are used as the base.  Any fields explicitly set in the
    rule override the template defaults.

    Rules without ``use_template`` are returned as-is.
    """
    resolved: list[dict[str, Any]] = []
    for rule in rules:
        template_name = rule.get("use_template")
        if template_name and template_name in PARAMETER_RULE_TEMPLATES:
            base = deepcopy(PARAMETER_RULE_TEMPLATES[template_name])
            merged = {**base, **{k: v for k, v in rule.items() if v is not None}}
            merged["name"] = rule["name"]
            merged["use_template"] = template_name
            resolved.append(merged)
        else:
            resolved.append(deepcopy(rule))
    return resolved
