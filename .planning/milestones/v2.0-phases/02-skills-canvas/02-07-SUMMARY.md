---
phase: 02-skills-canvas
plan: "07"
subsystem: skills/visual
tags: [visual, image-generation, gemini, skill, llm-prompt]
dependency_graph:
  requires: [02-01]
  provides: [visual.character_prompt, visual.scene_prompt, visual.generate_image, GeminiImageProvider]
  affects: [register_all, image-pipeline]
tech_stack:
  added: [google.genai (Imagen API)]
  patterns: [skill-descriptor, fail-open-logging, content-safety-handling]
key_files:
  created:
    - api/app/skills/visual/__init__.py
    - api/app/skills/visual/character_prompt.py
    - api/app/skills/visual/scene_prompt.py
    - api/app/skills/visual/generate_image.py
    - api/app/services/ai/model_providers/gemini_image.py
  modified:
    - api/app/skills/register_all.py
decisions:
  - "Prompt skills use sync execution mode (lightweight LLM call, no Celery needed)"
  - "Image generation skill uses async_celery execution mode (long-running Imagen API call)"
  - "GeminiImageProvider simplified from parent — Imagen API only, no multimodal/reference image support"
  - "ContentBlockedError mapped to user-facing '内容安全策略拦截' message"
metrics:
  duration: "~2min"
  completed: "2026-03-27T17:14:01Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 07: VISUAL Skills + GeminiImageProvider Summary

**One-liner:** Three VISUAL skills (character_prompt, scene_prompt, generate_image) with Gemini Imagen provider for text-to-image generation

## What Was Built

### Task 1: visual.character_prompt + visual.scene_prompt skills

Created two LLM-based prompt generation skills that convert structured character/scene data into detailed image generation prompts:

- **visual.character_prompt** — Takes character name + data (description, gender, age, personality), generates detailed visual appearance prompt via LLM. Sync execution mode.
- **visual.scene_prompt** — Takes scene name + data (description, location, time_of_day, mood), generates detailed scene description prompt via LLM. Sync execution mode.

Both skills follow the established pattern from extract.characters: SkillDescriptor + handler function + register function. Both integrate with `set_ai_call_context` + `log_ai_call` for traceability, and use `get_provider_manager()` for LLM provider resolution.

### Task 2: GeminiImageProvider + visual.generate_image skill

- **GeminiImageProvider** (`api/app/services/ai/model_providers/gemini_image.py`) — Simplified Imagen provider using `google.genai` async SDK (`client.aio.models.generate_images`). Saves generated images to `UPLOAD_DIR/generated/` with deterministic URL contract `/api/v1/files/generated/{filename}`. Content safety handling via `ContentBlockedError` + `TransientError` for rate limits.

- **visual.generate_image** — Async Celery skill that orchestrates image generation. Takes prompt + aspect_ratio + model, calls GeminiImageProvider, logs via AICallLog, returns URL + filename. Separate catch for `ContentBlockedError` with user-facing Chinese message.

- **register_all.py** — Updated to call `register_visual_skills()`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4235f1e | feat(02-07): add visual.character_prompt and visual.scene_prompt skills |
| 2 | 662a837 | feat(02-07): add GeminiImageProvider and visual.generate_image skill |

## Verification Results

- All 3 VISUAL skills register successfully (9 total skills in registry)
- Descriptors have correct names, categories, execution modes
- GeminiImageProvider class has `generate_image` async method using genai SDK
- `register_all_skills()` includes visual skills in full registration

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all skills are fully implemented with real provider integration.

## Self-Check: PASSED
