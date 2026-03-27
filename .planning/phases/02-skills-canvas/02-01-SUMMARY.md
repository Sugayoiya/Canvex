---
phase: "02"
plan: "01"
subsystem: ai-provider-infrastructure
tags: [ai, llm, provider, logging, abstraction]
dependency_graph:
  requires: []
  provides: [ai-provider-base, ai-call-logger, provider-manager, llm-providers]
  affects: [02-03, 02-04, 02-05, 02-06, 02-07]
tech_stack:
  added: [google-genai]
  patterns: [fail-open-logging, contextvar-propagation, init-subclass-wrapping, error-taxonomy, retry-on-transient]
key_files:
  created:
    - api/app/services/ai/base.py
    - api/app/services/ai/entities.py
    - api/app/services/ai/errors.py
    - api/app/services/ai/ai_call_logger.py
    - api/app/services/ai/llm_provider_base.py
    - api/app/services/ai/provider_manager.py
    - api/app/services/ai/model_providers/gemini.py
    - api/app/services/ai/model_providers/openai_provider.py
    - api/app/services/ai/model_providers/deepseek.py
  modified:
    - api/app/tasks/skill_task.py
    - api/app/core/config.py
    - api/pyproject.toml
    - api/app/services/ai/__init__.py
    - api/app/services/ai/model_providers/__init__.py
decisions:
  - Trimmed model whitelists to essential models per provider (3/3/2 instead of 15+)
  - Env-only credential lookup for Phase 02 (no DB/no throttling — deferred to later phases)
  - Added google-genai dependency to Canvex pyproject.toml
  - Added GROK_API_KEY to config for future parity
metrics:
  duration: "~5min"
  completed: "2026-03-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 5
---

# Phase 02 Plan 01: LLM Provider Infrastructure Summary

**One-liner:** Fail-open AICallLog + 3 LLM providers (Gemini/OpenAI/DeepSeek) with error taxonomy, 1-retry, 60s timeout, and ContextVar propagation into Celery workers.

## What Was Built

### Task 1: Base Abstractions + Fail-Open AICallLog Writer

- **`base.py`**: `Message(BaseModel)` with multimodal support + `AIProviderBase(ABC)` with generate/stream_generate
- **`entities.py`**: `ModelType(StrEnum)`, `AIModelEntity`, `ProviderEntity`, `infer_model_type()`
- **`errors.py`**: Error taxonomy — `TransientError`, `AuthError`, `RateLimitError`, `ValidationError`, `ContentBlockedError` — all with `retryable` flag for retry classification
- **`ai_call_logger.py`**: `set_ai_call_context()` sets ContextVar, `log_ai_call()` writes to AICallLog with fail-open try/except
- **`llm_provider_base.py`**: `LLMProviderBase` uses `__init_subclass__` to auto-wrap `generate()` with timing, logging, 1-retry on transient errors, and 60s timeout. Includes `_ai_logged` double-wrapping guard
- **`skill_task.py`**: Added `set_ai_call_context()` call after `SkillContext.from_dict()` for Celery worker ContextVar rehydration

### Task 2: 3 LLM Providers + ProviderManager

- **`gemini.py`**: `GeminiProvider(LLMProviderBase)` with trimmed whitelist (gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-image)
- **`openai_provider.py`**: `OpenAIProvider(LLMProviderBase)` with trimmed whitelist (gpt-4o, gpt-4o-mini, gpt-4.1-mini)
- **`deepseek.py`**: `DeepSeekProvider(LLMProviderBase)` with OpenAI-compatible API (deepseek-chat, deepseek-reasoner)
- **`provider_manager.py`**: `ProviderManager` with env-only credential lookup, `get_provider()`, `get_configured_providers()`, `get_all_provider_entities()`
- **`config.py`**: Added `GROK_API_KEY` field
- **`pyproject.toml`**: Added `google-genai>=1.14.0` dependency

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `df1bff0` | feat(02-01): port base abstractions + fail-open AICallLog writer |
| 2 | `818f970` | feat(02-01): port 3 LLM providers + ProviderManager |

## Verification Results

- All imports pass: `Message`, `AIProviderBase`, `ModelType`, `AIModelEntity`, `ProviderEntity`, `infer_model_type`, error taxonomy classes, `log_ai_call`, `set_ai_call_context`, `LLMProviderBase`, all 3 providers, `ProviderManager`
- FAIL-OPEN pattern confirmed in `ai_call_logger.py` (grep: "FAIL-OPEN")
- ContextVar rehydration confirmed in `skill_task.py` (grep: "set_ai_call_context")
- `ProviderManager.get_all_provider_entities()` returns all 3 providers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing google-genai dependency**
- **Found during:** Task 2 verification
- **Issue:** `google-genai` package not in Canvex's `pyproject.toml`, causing `ModuleNotFoundError`
- **Fix:** Added `google-genai>=1.14.0` to dependencies and ran `uv sync`
- **Files modified:** `api/pyproject.toml`, `api/uv.lock`
- **Commit:** included in `818f970`

## Known Stubs

None — all provider methods are fully wired to real SDK calls.

## Self-Check: PASSED

All created files exist, all commits verified.
