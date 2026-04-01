---
phase: 02-skills-canvas
plan: 03
subsystem: ai
tags: [llm, text-generation, extraction, pydantic, json-parser, skills]

requires:
  - phase: 02-01
    provides: "ProviderManager with env-only credential lookup, AIProviderBase, Message, set_ai_call_context"
provides:
  - "text.llm_generate skill with real LLM provider integration"
  - "text.refine skill for text polishing via LLM"
  - "extract.characters skill with Pydantic validation and partial degradation"
  - "extract.scenes skill with Pydantic validation and partial degradation"
  - "Shared json_parser utility for robust LLM JSON output parsing"
affects: [02-04, 02-05, canvas-execution]

tech-stack:
  added: []
  patterns: ["LLM skill handler pattern: set_ai_call_context → get_provider → generate → parse/validate", "Partial degradation: validate each item, keep valid, collect warnings", "Shared json_parser: strip fences → JSON substring recovery → wrapper unwrap"]

key-files:
  created:
    - api/app/skills/text/refine.py
    - api/app/skills/utils/__init__.py
    - api/app/skills/utils/json_parser.py
  modified:
    - api/app/skills/text/llm_generate.py
    - api/app/skills/text/__init__.py
    - api/app/skills/extract/characters.py
    - api/app/skills/extract/scenes.py

key-decisions:
  - "Hardcoded prompts in skills (no PromptTemplateService) per CONTEXT.md decision"
  - "Shared json_parser utility for all LLM JSON parsing across skills"
  - "Partial degradation pattern: return valid items + warnings instead of full failure"

patterns-established:
  - "LLM skill handler: set_ai_call_context before provider call, catch ValueError for config errors, Exception for runtime errors"
  - "Extract skill output: Pydantic model validation per-item with partial degradation and warnings list"
  - "parse_llm_json: centralized robust JSON parsing for LLM outputs"

requirements-completed: [REQ-03]

duration: 4min
completed: 2026-03-27
---

# Phase 02 Plan 03: TEXT & EXTRACT Skills LLM Integration Summary

**4 skills upgraded from placeholders to real LLM-backed handlers with shared json_parser, Pydantic validation, and partial degradation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T17:11:32Z
- **Completed:** 2026-03-27T17:16:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Upgraded text.llm_generate from placeholder to real provider.generate() call with provider/model override
- Created text.refine skill for AI-powered text polishing with configurable style
- Created shared json_parser utility: markdown fence stripping, JSON substring recovery, wrapper key unwrap
- Upgraded extract.characters and extract.scenes with Pydantic models and partial degradation pattern
- All 4 skills set ai_call_context before provider invocation for billing/tracing

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade text.llm_generate + create text.refine** - `ea73cdf` (feat)
2. **Task 2: Upgrade extract skills + shared json_parser** - `e330e05` (feat)

## Files Created/Modified
- `api/app/skills/text/llm_generate.py` - Upgraded from placeholder to real LLM call with provider/model override
- `api/app/skills/text/refine.py` - New text polishing skill using LLM
- `api/app/skills/text/__init__.py` - Updated to register both text skills
- `api/app/skills/utils/__init__.py` - New utils package
- `api/app/skills/utils/json_parser.py` - Shared robust JSON parser for LLM outputs
- `api/app/skills/extract/characters.py` - Upgraded with real LLM, ExtractedCharacter Pydantic model, partial degradation
- `api/app/skills/extract/scenes.py` - Upgraded with real LLM, ExtractedScene Pydantic model, partial degradation

## Decisions Made
- Hardcoded prompts in skills (no PromptTemplateService) per CONTEXT.md guidance — keeps skills self-contained
- Created shared json_parser utility to avoid duplicated JSON parsing logic across extract skills
- Partial degradation pattern: return valid items with warnings instead of failing on first invalid item

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all placeholder responses replaced with real LLM calls.

## Next Phase Readiness
- 4 upgraded skills ready: text.llm_generate, text.refine, extract.characters, extract.scenes
- All skills follow the established LLM handler pattern (set_ai_call_context → get_provider → generate)
- json_parser utility available for any future skills that parse structured LLM output

---
*Phase: 02-skills-canvas*
*Completed: 2026-03-27*
