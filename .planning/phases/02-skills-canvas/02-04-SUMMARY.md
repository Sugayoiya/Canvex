---
phase: 02-skills-canvas
plan: 04
subsystem: ai-skills
tags: [skills, script, storyboard, pydantic, llm, json-parser]

requires:
  - phase: 02-01
    provides: "Provider infrastructure (get_provider_manager, Message, set_ai_call_context)"
  - phase: 02-03
    provides: "Shared parse_llm_json utility, extract skill patterns with partial degradation"
provides:
  - "script.split_clips skill — story → numbered clip segments"
  - "script.convert_screenplay skill — clip narrative → formatted screenplay"
  - "storyboard.plan skill — screenplay → shot plan list"
  - "storyboard.detail skill — shot plan → enriched shots with camera/composition"
  - "Registry integrity check with duplicate key detection"
affects: [02-08, canvas-nodes, agent-tool-calling]

tech-stack:
  added: []
  patterns: ["Pydantic strict validators for LLM structured output", "Partial degradation: keep valid items + warnings", "Sequential number re-normalization after validation"]

key-files:
  created:
    - api/app/skills/script/__init__.py
    - api/app/skills/script/split_clips.py
    - api/app/skills/script/convert_screenplay.py
    - api/app/skills/storyboard/__init__.py
    - api/app/skills/storyboard/plan.py
    - api/app/skills/storyboard/detail.py
  modified:
    - api/app/skills/register_all.py

key-decisions:
  - "Hardcoded prompts in skills (no PromptTemplateService) — keeps skills self-contained"
  - "Pydantic models with strict field_validators for all structured LLM outputs"
  - "Partial degradation: return valid items + warnings instead of full failure on validation errors"
  - "Auto-renumber sequential IDs (clip_number, shot_number) if LLM returns non-sequential values"

patterns-established:
  - "SCRIPT/STORYBOARD skill pattern: system prompt → provider.generate() → parse_llm_json → Pydantic validate → partial degrade → SkillResult"
  - "Pydantic field_validator for positive IDs and non-empty required strings"

requirements-completed: [REQ-03]

duration: 2min
completed: 2026-03-27
---

# Phase 02 Plan 04: SCRIPT & STORYBOARD Skills Summary

**4 new skills (split_clips, convert_screenplay, storyboard.plan, storyboard.detail) with Pydantic validation, partial degradation, and registry integrity checks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T17:18:10Z
- **Completed:** 2026-03-27T17:20:32Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created script.split_clips skill: story → numbered clip segments via LLM with ClipSegment Pydantic model
- Created script.convert_screenplay skill: clip narrative → formatted screenplay text
- Created storyboard.plan skill: screenplay → shot plan list with ShotPlan Pydantic model
- Created storyboard.detail skill: shot plan → enriched shots with DetailedShot Pydantic model (camera, composition, lighting, video_prompt)
- Wired all 4 new skills into register_all_skills() with startup-time duplicate key detection
- Total registered skills: 13 (text×2, extract×2, script×2, storyboard×2, canvas×1, asset×1, visual×3)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create script.split_clips + script.convert_screenplay** - `3e82932` (feat)
2. **Task 2: Create storyboard.plan + storyboard.detail + wire registrations** - `030333c` (feat)

## Files Created/Modified
- `api/app/skills/script/__init__.py` - Script skills registration
- `api/app/skills/script/split_clips.py` - Story → clips splitting skill with ClipSegment validation
- `api/app/skills/script/convert_screenplay.py` - Clip → screenplay conversion skill
- `api/app/skills/storyboard/__init__.py` - Storyboard skills registration
- `api/app/skills/storyboard/plan.py` - Screenplay → shot plan skill with ShotPlan validation
- `api/app/skills/storyboard/detail.py` - Shot plan → detailed shots skill with DetailedShot validation
- `api/app/skills/register_all.py` - Added script + storyboard registrations and duplicate key detection

## Decisions Made
- Hardcoded prompts adapted from parent project's StoryToScriptService/ScriptToStoryboardService
- Used shared parse_llm_json utility consistently (not inline regex)
- Pydantic models with strict constraints (positive IDs, non-empty content)
- Auto-renumber sequential IDs when LLM returns non-sequential values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 core pipeline skills available for canvas node wiring (02-08)
- Registry integrity verified: 13 skills, no duplicates
- Skills follow identical invocation pattern for agent tool-calling (Phase 03)

## Self-Check: PASSED

---
*Phase: 02-skills-canvas*
*Completed: 2026-03-27*
