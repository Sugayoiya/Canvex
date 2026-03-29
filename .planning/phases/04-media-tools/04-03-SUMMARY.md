---
phase: 04-media-tools
plan: 03
subsystem: ai-providers, skills
tags: [video-generation, provider-auto-select, gemini-veo, skill-registration]
dependency_graph:
  requires: [02-skills-canvas]
  provides: [video.generate_video skill, GeminiVideoProvider, provider auto-select]
  affects: [canvas-execution, agent-toolset]
tech_stack:
  added: [google.genai Veo API]
  patterns: [provider auto-select, async Celery video skill, polling long-running operation]
key_files:
  created:
    - api/app/services/ai/model_providers/gemini_video.py
    - api/app/skills/video/__init__.py
    - api/app/skills/video/generate_video.py
  modified:
    - api/app/services/ai/provider_manager.py
    - api/app/skills/register_all.py
decisions:
  - "Provider auto-select iterates [gemini, openai, deepseek] priority order"
  - "Video skill uses media_processing Celery queue (not ai_generation)"
  - "GeminiVideoProvider polls Veo operation with 5s interval, 10min timeout"
metrics:
  duration: "~2 min"
  completed: "2026-03-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 04 Plan 03: Provider Auto-Select + Video Generation Skill Summary

Provider auto-select fix for `get_provider("auto")` iterating configured providers by priority, plus GeminiVideoProvider wrapping Veo API and `video.generate_video` skill registered for async Celery execution on `media_processing` queue.

## Task Results

### Task 1: Provider "auto" fix + GeminiVideoProvider
- **Commit:** `fe0e9c9`
- **What:** Added auto-selection logic to `ProviderManager.get_provider()` — when `provider == "auto"`, iterates `["gemini", "openai", "deepseek"]` and returns first with configured API key. Created `GeminiVideoProvider` wrapping Veo API with async polling (5s intervals, 10min max), saves .mp4 to `UPLOAD_DIR/generated/`, graceful error handling for unavailable models.
- **Files:** `provider_manager.py` (modified), `gemini_video.py` (created)

### Task 2: video.generate_video skill + registration
- **Commit:** `0fb525e`
- **What:** Created `video.generate_video` skill following `visual.generate_image` pattern. Category `VIDEO`, queue `media_processing`, estimated duration `long`. Supports `prompt`, `image_url` (first frame download via httpx), `aspect_ratio`, `duration_seconds`. Returns `PROVIDER_NOT_CONFIGURED` when Gemini key missing. Registered in `register_all_skills()`.
- **Files:** `video/__init__.py` (created), `video/generate_video.py` (created), `register_all.py` (modified)

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `GeminiVideoProvider` imports successfully
- `ProviderManager` imports successfully with auto-select logic
- `video.generate_video` skill registered with `SkillCategory.VIDEO`, `media_processing` queue, `async_celery` mode

## Known Stubs

None — all data paths are wired to actual provider implementations.

## Self-Check: PASSED
