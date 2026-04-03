# Phase 13: SkillDescriptor Enhancement + Pipeline Fix - Research

**Researched:** 2026-04-03
**Domain:** Python dataclass extension, YAML frontmatter parsing, metadata-driven tool filtering
**Confidence:** HIGH

## Summary

Phase 13 focuses on three interconnected workstreams: (1) extending the `SkillDescriptor` Python dataclass with dependency declarations, tiered classification, and Claude Code-style safety metadata; (2) extending SKILL.md YAML frontmatter with matching fields and upgrading `SkillLoader` to parse them; (3) refactoring `tool_middleware.py` from hardcoded tool-name sets to metadata-driven dynamic filtering. Additionally, 4 redundant SkillRegistry handlers are deprecated/removed.

PIPE-01/02/04 are ALL DEFERRED to Phase 14 per user decision D-07. The effective scope is DESC-01 through DESC-08 only. This significantly reduces risk — the phase is purely additive metadata + refactoring of the filtering layer, with no runtime behavior changes to the pipeline execution path.

**Primary recommendation:** Extend SkillDescriptor with backward-compatible defaults, mirror fields in SKILL.md YAML frontmatter, upgrade SkillMeta from NamedTuple to dataclass, refactor `get_tools_for_context()` to read tool metadata instead of hardcoded name sets, and remove 4 deprecated handler registrations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Parallel extension — SkillDescriptor (Python dataclass) and SKILL.md (YAML frontmatter) get the same new fields; two runtime mechanisms stay separate. SkillLoader parses frontmatter into SkillDescriptor-compatible internal representation
- **D-02:** SkillDescriptor new fields: `skill_kind: str`, `require_prior_kind: list[str]`, `default_require_prior_kind: list[str]`, `supports_skip: bool`, `skill_tier: str`, `is_read_only: bool`, `is_destructive: bool`, `timeout: int`, `max_result_size_chars: int`
- **D-03:** SKILL.md YAML frontmatter extended with same-name fields; SkillLoader parses and generates SkillMeta (upgraded to hold all new fields)
- **D-04:** Deprecate 4 SkillRegistry handlers: `visual.generate_image`, `video.generate_video`, `canvas.get_state`, `asset.get_project_info`
- **D-05:** Reason: Agent chat uses `ai_tools.py` @tool directly; Canvas nodes call Provider directly; `context_tools.py` has equivalent @tools
- **D-06:** SkillRegistry/SkillDescriptor infrastructure retained — Phase 14 ArtifactStore and Phase 16 Admin management still need it
- **D-07:** PIPE-01/02/04 ALL deferred to Phase 14 with ArtifactStore + ToolInterceptor
- **D-09:** Metadata-driven tool filtering — use `skill_tier` + session context (has_canvas/has_episode) to decide exposed tools, replacing hardcoded sets in tool_middleware.py
- **D-10:** Target ≤10-14 tools per context window; filtering logic reads tool metadata instead of tool names
- **D-11:** Phase 13 annotation-only — `is_read_only`/`is_destructive`/`timeout`/`max_result_size_chars` as descriptive fields in system prompt; no runtime enforcement
- **D-12:** Claude Code annotation model — Agent sees tool safety markers in system prompt and judges whether to ask confirmation
- **D-13:** `skill_kind` values are fine-grained operation types (like OpenStoryline `node_kind`), not coarse business entities
- **D-14:** "14 skills annotated" = 10 SKILL.md frontmatter + 4 @tool code annotations (deprecated SkillRegistry handlers excluded)

### Claude's Discretion
- SKILL.md frontmatter YAML field naming (snake_case vs kebab-case)
- SkillLoader internal upgrade from SkillMeta NamedTuple to dataclass
- tool_middleware refactoring code organization (extract to separate module or keep inline)
- Each SKILL.md's specific skill_kind / require_prior_kind values (infer from body content)

### Deferred Ideas (OUT OF SCOPE)
- ToolInterceptor auto-run missing dependencies + ArtifactStore — Phase 14
- PIPE-01/02/04 Pipeline fixes — Phase 14
- Safety metadata runtime enforcement (timeout cutoff, max_result_size_chars truncation, is_destructive confirmation dialog) — later Phase
- SkillRegistry full refactoring (whether to merge with SkillLoader) — Phase 14+ evaluation
- Canvas node execution via Agent Skill path (AGENT_CHAT_FOR_CANVAS flag) — v3.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DESC-01 | SkillDescriptor supports `skill_kind` field | Direct dataclass field addition with `""` default; mirrors OpenStoryline `NodeMeta.node_kind` |
| DESC-02 | SkillDescriptor supports `require_prior_kind` field | `list[str]` with `field(default_factory=list)`; for auto mode upstream dependency declaration |
| DESC-03 | SkillDescriptor supports `default_require_prior_kind` field | Same pattern as DESC-02; for default/skip mode dependencies |
| DESC-04 | SkillDescriptor supports `supports_skip` boolean | `bool = False` default; enables skip mode in future ToolInterceptor |
| DESC-05 | SkillDescriptor supports Claude Code-style metadata: `is_read_only`, `is_destructive`, `timeout`, `max_result_size_chars` | 4 fields with safe defaults; annotation-only in Phase 13 |
| DESC-06 | SkillDescriptor supports `skill_tier` with 3 values | `str = "capability"` with `workflow` / `capability` / `meta` values; drives dynamic tool filtering |
| DESC-07 | Existing 14 skills annotated with new fields | 10 SKILL.md frontmatter extensions + 4 @tool code annotations via metadata dict or wrapper |
| DESC-08 | SkillToolset dynamically filters skills based on session context (max ~10 tools) | Refactor `tool_middleware.py` from hardcoded name sets to metadata-driven `skill_tier` + context signals |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python dataclasses | stdlib | SkillDescriptor extension | Already used; zero dependency |
| PyYAML | 6.x (installed) | SKILL.md frontmatter parsing | Already used by SkillLoader via `yaml.safe_load` |
| LangChain Core | 0.3.x (installed) | `@tool` decorator, `StructuredTool.metadata` | Already the agent framework; metadata dict is the standard extension point |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typing / typing_extensions | stdlib | Type hints for new fields | For `Literal` type on skill_tier if desired |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python dataclass for SkillDescriptor | Pydantic BaseModel | Pydantic adds validation but SkillDescriptor is already a dataclass; migration is unnecessary churn |
| NamedTuple for SkillMeta | dataclass | NamedTuple is immutable but lacks defaults on trailing fields; dataclass is the clear upgrade path |
| YAML frontmatter for SKILL.md | TOML frontmatter | YAML already established; changing format breaks existing parsing |

## Architecture Patterns

### Recommended Changes Structure
```
api/app/skills/descriptor.py          # Extend SkillDescriptor dataclass
api/app/skills/register_all.py        # Remove 4 deprecated registrations
api/app/skills/visual/                 # Mark deprecated (or delete)
api/app/skills/video/                  # Mark deprecated (or delete)
api/app/skills/canvas_ops/             # Mark deprecated (or delete)
api/app/skills/asset/                  # Mark deprecated (or delete)
api/app/agent/skill_loader.py          # Upgrade SkillMeta → dataclass, parse new fields
api/app/agent/skills/*/SKILL.md        # Add new YAML frontmatter fields (×10)
api/app/agent/tool_middleware.py        # Refactor to metadata-driven filtering
api/app/agent/context_builder.py       # Inject safety metadata into system prompt
api/app/agent/tools/__init__.py        # Update tool metadata attachment
api/tests/test_skill_registration.py   # Update test expectations
```

### Pattern 1: SkillDescriptor Extension with Backward-Compatible Defaults
**What:** Add new fields to `SkillDescriptor` dataclass with safe defaults so existing code continues to work without modification.
**When to use:** DESC-01 through DESC-06
**Example:**
```python
@dataclass
class SkillDescriptor:
    # ... existing fields ...
    
    # Phase 13: Dependency declarations (OpenStoryline NodeMeta pattern)
    skill_kind: str = ""
    require_prior_kind: list[str] = field(default_factory=list)
    default_require_prior_kind: list[str] = field(default_factory=list)
    supports_skip: bool = False
    
    # Phase 13: Classification
    skill_tier: str = "capability"  # "workflow" | "capability" | "meta"
    
    # Phase 13: Safety metadata (Claude Code pattern, annotation-only)
    is_read_only: bool = False
    is_destructive: bool = False
    timeout: int = 120
    max_result_size_chars: int = 50000
```

### Pattern 2: SkillMeta Upgrade from NamedTuple to Dataclass
**What:** Replace the 3-field `SkillMeta(NamedTuple)` with a richer dataclass that holds all frontmatter fields.
**When to use:** DESC-03, DESC-07
**Example:**
```python
@dataclass
class SkillMeta:
    name: str
    description: str
    path: Path
    # Phase 13 new fields with defaults for backward compat
    skill_kind: str = ""
    require_prior_kind: list[str] = field(default_factory=list)
    default_require_prior_kind: list[str] = field(default_factory=list)
    supports_skip: bool = False
    skill_tier: str = "capability"
    is_read_only: bool = False
    is_destructive: bool = False
    timeout: int = 120
    max_result_size_chars: int = 50000
```

### Pattern 3: SKILL.md YAML Frontmatter Extension
**What:** Add new fields to existing `---` YAML blocks. Use snake_case to match Python fields.
**When to use:** DESC-07
**Example:**
```yaml
---
name: extract-characters
description: >
  从剧本或故事文本中提取角色列表...
skill_kind: extract_characters
skill_tier: capability
require_prior_kind: []
default_require_prior_kind: []
supports_skip: false
is_read_only: false
is_destructive: false
timeout: 120
max_result_size_chars: 50000
---
```

### Pattern 4: LangChain @tool Metadata Annotation
**What:** Attach Phase 13 metadata to LangChain `@tool` functions via the `metadata` parameter on `StructuredTool`, or by setting `tool.metadata` after creation.
**When to use:** DESC-07 (annotating 4 @tools: generate_image, generate_video, read_skill, read_resource)
**Example:**
```python
TOOL_METADATA = {
    "generate_image": {
        "skill_kind": "generate_shot_image",
        "skill_tier": "capability",
        "is_read_only": False,
        "is_destructive": False,
        "timeout": 120,
        "max_result_size_chars": 5000,
    },
    # ...
}

def attach_tool_metadata(tools: list) -> list:
    """Attach Phase 13 metadata to @tool objects."""
    for t in tools:
        meta = TOOL_METADATA.get(t.name, {})
        if meta:
            t.metadata = {**(t.metadata or {}), **meta}
    return tools
```

### Pattern 5: Metadata-Driven Dynamic Tool Filtering
**What:** Replace hardcoded name sets with metadata queries on tool objects.
**When to use:** DESC-08
**Example:**
```python
def get_tools_for_context(
    all_tools: list,
    *,
    has_canvas: bool = False,
    has_episode: bool = False,
) -> list:
    selected = []
    for t in all_tools:
        meta = getattr(t, "metadata", None) or {}
        tier = meta.get("skill_tier", "capability")
        
        # Always include meta-tier tools (read_skill, read_resource)
        if tier == "meta":
            selected.append(t)
            continue
        
        # Context-based filtering for capability tools
        kind = meta.get("skill_kind", "")
        # ... filter based on context signals ...
    
    return selected[:14]  # hard cap
```

### Pattern 6: System Prompt Safety Injection
**What:** Extend `build_system_prompt_fragment()` to include safety metadata from SkillMeta.
**When to use:** DESC-05, DESC-11/D-12
**Example:**
```python
def build_system_prompt_fragment(self) -> str:
    lines = ["## 可用技能\n"]
    for m in self._metadata.values():
        safety = ""
        if m.is_read_only:
            safety += " [只读]"
        if m.is_destructive:
            safety += " [⚠️ 破坏性操作]"
        lines.append(f"- **{m.name}**: {m.description}{safety}")
    return "\n".join(lines)
```

### Anti-Patterns to Avoid
- **Breaking backward compat:** All new SkillDescriptor fields MUST have defaults. Existing instantiations must not break.
- **Mixing runtime enforcement with annotation:** Phase 13 is annotation-only per D-11. Do NOT add timeout enforcement or result truncation logic.
- **Over-engineering the filtering:** Keep the metadata-driven filter simple. The goal is to replace hardcoded sets, not build a full query engine.
- **Modifying deprecated handlers:** Don't refactor the 4 deprecated handler files. Just remove their registration calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | PyYAML `yaml.safe_load` (already used) | Edge cases in YAML parsing; library handles them |
| Tool metadata attachment | Custom tool wrapper class | LangChain `StructuredTool.metadata` dict | Native extension point; no wrapping needed |
| Dataclass defaults for list fields | `default=[]` | `field(default_factory=list)` | Mutable default trap in Python dataclasses |

## Common Pitfalls

### Pitfall 1: Mutable Default Arguments in Dataclass
**What goes wrong:** Using `require_prior_kind: list[str] = []` shares the same list across instances.
**Why it happens:** Python dataclass gotcha with mutable defaults.
**How to avoid:** Always use `field(default_factory=list)` for list/dict defaults.
**Warning signs:** Multiple descriptors sharing the same list reference; mutation in one affects all.

### Pitfall 2: NamedTuple → Dataclass Migration Breaking Unpacking
**What goes wrong:** `SkillMeta` is currently a NamedTuple. Code may rely on tuple unpacking: `name, desc, path = meta`.
**Why it happens:** NamedTuple supports positional unpacking; dataclass does not by default.
**How to avoid:** Search all usages of `SkillMeta` before migration. Replace any tuple unpacking with attribute access. Current usage analysis shows `SkillMeta` is accessed via `.name`, `.description`, `.path` attributes only — no tuple unpacking found.
**Warning signs:** `TypeError: cannot unpack` at runtime.

### Pitfall 3: YAML Frontmatter Field Type Mismatch
**What goes wrong:** YAML `safe_load` auto-converts `true`/`false` to Python `bool`, but `120` stays `int`. If a field is expected as `str` but YAML returns `int`, type errors ensue.
**Why it happens:** YAML type inference doesn't match Python annotations.
**How to avoid:** Explicit type coercion in `_parse_frontmatter()`: `int(fm.get("timeout", 120))`, `bool(fm.get("is_read_only", False))`.
**Warning signs:** Unexpected type in SkillMeta attributes.

### Pitfall 4: Tool Filtering Regression — Exposing Too Many/Few Tools
**What goes wrong:** After refactoring `get_tools_for_context()`, some tools go missing or the count exceeds 14.
**Why it happens:** Metadata not attached correctly; filter logic doesn't cover all cases.
**How to avoid:** Write explicit tests for each context scenario (canvas-only, episode-only, both, neither). Verify tool count in each scenario.
**Warning signs:** Agent errors like "tool not found" or degraded LLM performance from too many tools.

### Pitfall 5: Forgetting to Update Test Expectations
**What goes wrong:** `test_skill_registration.py` still expects the 4 deprecated skills.
**Why it happens:** Test file references `EXPECTED_SKILLS` list including deprecated handlers.
**How to avoid:** Update `EXPECTED_SKILLS` list and `test_deleted_skills_not_registered` after removing registrations.
**Warning signs:** Test failures after handler deprecation.

### Pitfall 6: Deprecated Handler Files Left Importable
**What goes wrong:** Removing registration but leaving the Python files allows accidental re-import.
**Why it happens:** Only `register_all.py` is updated but handler files remain.
**How to avoid:** Either delete the handler files entirely OR add `# DEPRECATED: Phase 13` header + `raise ImportError` in registration function. Decision D-06 says keep SkillRegistry infrastructure but D-04 says deprecate these 4 specific handlers — safest to delete the handler files themselves.
**Warning signs:** Someone re-registers a deprecated handler in a future phase.

## Code Examples

### Current SkillDescriptor (before Phase 13)
```python
# Source: api/app/skills/descriptor.py (current)
@dataclass
class SkillDescriptor:
    name: str
    display_name: str
    description: str
    category: SkillCategory
    input_schema: dict[str, Any]
    output_schema: dict[str, Any] = field(default_factory=dict)
    triggers: list[str] = field(default_factory=list)
    execution_mode: str = "async_celery"
    celery_queue: str = "ai_generation"
    estimated_duration: str = "medium"
    requires_canvas: bool = False
    requires_project: bool = False
```

### Current SkillMeta (before Phase 13)
```python
# Source: api/app/agent/skill_loader.py (current)
class SkillMeta(NamedTuple):
    name: str
    description: str
    path: Path
```

### Current tool_middleware hardcoded sets (before Phase 13)
```python
# Source: api/app/agent/tool_middleware.py (current)
_ALWAYS_TOOLS = {
    "get_project_info", "get_episodes", "get_script",
    "get_characters", "get_scenes",
    "read_skill", "read_resource",
}
_CANVAS_TOOLS = {"get_canvas_state"}
_STORYBOARD_TOOLS = {
    "save_shot_plan", "save_shot_details", "update_shot",
    "generate_image", "generate_video",
    "get_style_templates",
}
_SCRIPT_TOOLS = {
    "save_characters", "save_scenes", "save_screenplay",
}
```

### Current SKILL.md frontmatter (before Phase 13)
```yaml
---
name: extract-characters
description: >
  从剧本或故事文本中提取角色列表...
---
```

### OpenStoryline NodeMeta Reference
```python
# Source: FireRed-OpenStoryline base_node.py
@dataclass
class NodeMeta:
    name: str
    description: str
    node_id: str
    node_kind: str
    require_prior_kind: List[str] = field(default_factory=list)
    default_require_prior_kind: List[str] = field(default_factory=list)
    next_available_node: List[str] = field(default_factory=list)
    priority: int = 5
```

## Skill Kind + Tier + Safety Annotation Map

The following table maps all 14 skills (10 SKILL.md + 4 @tools) to their recommended new field values:

### 10 SKILL.md Skills

| SKILL.md name | skill_kind | skill_tier | require_prior_kind | supports_skip | is_read_only | is_destructive | timeout | max_result_size_chars |
|---|---|---|---|---|---|---|---|---|
| split-clips | split_clips | capability | [] | false | false | false | 120 | 50000 |
| convert-screenplay | convert_screenplay | capability | [split_clips] | false | false | false | 120 | 50000 |
| extract-characters | extract_characters | capability | [] | true | false | false | 120 | 50000 |
| extract-scenes | extract_scenes | capability | [] | true | false | false | 120 | 50000 |
| create-storyboard | create_storyboard | capability | [convert_screenplay] | false | false | false | 120 | 50000 |
| detail-storyboard | detail_storyboard | capability | [create_storyboard] | true | false | false | 120 | 50000 |
| generate-shot-image | generate_shot_image | capability | [create_storyboard] | true | false | false | 120 | 5000 |
| generate-shot-video | generate_shot_video | capability | [generate_shot_image] | true | false | false | 120 | 5000 |
| refine-text | refine_text | capability | [] | false | false | false | 60 | 50000 |
| episode-pipeline | episode_pipeline | workflow | [] | false | false | false | 300 | 50000 |

### 4 @tool Functions (code annotations)

| @tool name | skill_kind | skill_tier | is_read_only | is_destructive | timeout | max_result_size_chars |
|---|---|---|---|---|---|---|
| generate_image | generate_image | capability | false | false | 120 | 5000 |
| generate_video | generate_video | capability | false | false | 120 | 5000 |
| read_skill | read_skill | meta | true | false | 10 | 100000 |
| read_resource | read_resource | meta | true | false | 10 | 100000 |

### Context Tools (read-only, annotated for filtering)

| @tool name | skill_tier | is_read_only | suggested context_group |
|---|---|---|---|
| get_project_info | meta | true | always |
| get_episodes | meta | true | always |
| get_characters | meta | true | always |
| get_scenes | meta | true | always |
| get_script | meta | true | always |
| get_canvas_state | meta | true | canvas |
| get_style_templates | meta | true | episode |

### Mutation Tools (write, annotated for filtering)

| @tool name | skill_tier | is_read_only | is_destructive | suggested context_group |
|---|---|---|---|---|
| save_characters | capability | false | false | script |
| save_scenes | capability | false | false | script |
| save_screenplay | capability | false | true | script |
| save_shot_plan | capability | false | true | episode |
| save_shot_details | capability | false | false | episode |
| update_shot | capability | false | false | episode |

## Dynamic Tool Filtering Strategy

The refactored `get_tools_for_context()` should use a two-phase approach:

### Phase A: Tier-Based Always-Include
- All `meta` tier tools are always included (read_skill, read_resource, context query tools)
- This replaces `_ALWAYS_TOOLS` set

### Phase B: Context-Based Capability Selection
- `has_episode=True`: include storyboard mutation tools + AI generation tools
- `has_episode=False`: include script mutation tools (save_characters, save_scenes, save_screenplay)
- `has_canvas=True`: include canvas-related tools (get_canvas_state already meta)

### Metadata-to-Context Mapping
Instead of hardcoded name sets, each tool's metadata includes a `context_group` field (or it's inferred from skill_tier + skill_kind):
- `always` → always included
- `canvas` → only when has_canvas
- `episode` → only when has_episode
- `script` → only when NOT has_episode (mutually exclusive with episode)

This preserves the existing ≤14 tool count while making the logic data-driven.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| SkillRegistry holds all skills | SKILL.md + SkillLoader for reasoning; SkillRegistry only for infra skills | Phase 12.1 (2026-04-02) | 4 handlers remain in registry; 10 skills in SKILL.md |
| Hardcoded tool name sets | Metadata-driven filtering (Phase 13 target) | Phase 13 | More maintainable; new tools auto-categorized |
| SkillMeta as NamedTuple | SkillMeta as dataclass (Phase 13 target) | Phase 13 | Extensible with defaults |

## Open Questions

1. **Delete vs deprecate handler files?**
   - What we know: D-04 says "deprecate or remove registration." D-06 says keep SkillRegistry infrastructure.
   - What's unclear: Whether to physically delete the 4 handler Python files or just remove their registration.
   - Recommendation: Delete the 4 handler files and their `__init__.py` registration wrappers. Keep `SkillRegistry` class and `register_all.py` intact (just remove the import/call lines). This is cleanest — dead code invites confusion.

2. **context_group as explicit metadata or inferred?**
   - What we know: Tools need context-based filtering; current approach uses hardcoded name sets.
   - What's unclear: Whether to add an explicit `context_group` field to metadata or infer from skill_kind/skill_tier.
   - Recommendation: Use explicit `context_group` field in metadata — simpler to read, simpler to test, easier for future phases to extend.

3. **How to annotate @tool functions that aren't SKILL.md?**
   - What we know: LangChain `@tool` decorator creates `StructuredTool` objects. These have a `metadata` dict property.
   - What's unclear: Best pattern for attaching metadata — at declaration time vs post-hoc.
   - Recommendation: Define a `TOOL_METADATA` dict mapping tool name → metadata, then call `attach_tool_metadata()` in `get_all_tools()` to set `tool.metadata` on each StructuredTool before returning. This avoids modifying each @tool decorator call site.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (installed via uv) |
| Config file | api/pyproject.toml or implicit |
| Quick run command | `cd api && uv run pytest tests/test_skill_registration.py -x` |
| Full suite command | `cd api && uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DESC-01 | SkillDescriptor has skill_kind field | unit | `uv run pytest tests/test_descriptor_fields.py::test_skill_kind -x` | ❌ Wave 0 |
| DESC-02 | SkillDescriptor has require_prior_kind | unit | `uv run pytest tests/test_descriptor_fields.py::test_require_prior_kind -x` | ❌ Wave 0 |
| DESC-03 | SkillDescriptor has default_require_prior_kind | unit | `uv run pytest tests/test_descriptor_fields.py::test_default_require_prior_kind -x` | ❌ Wave 0 |
| DESC-04 | SkillDescriptor has supports_skip | unit | `uv run pytest tests/test_descriptor_fields.py::test_supports_skip -x` | ❌ Wave 0 |
| DESC-05 | Safety metadata fields present | unit | `uv run pytest tests/test_descriptor_fields.py::test_safety_metadata -x` | ❌ Wave 0 |
| DESC-06 | skill_tier field with 3-tier classification | unit | `uv run pytest tests/test_descriptor_fields.py::test_skill_tier -x` | ❌ Wave 0 |
| DESC-07 | All 14 skills annotated | integration | `uv run pytest tests/test_skill_annotations.py -x` | ❌ Wave 0 |
| DESC-08 | Dynamic tool filtering based on metadata | unit | `uv run pytest tests/test_tool_middleware.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest tests/test_descriptor_fields.py tests/test_skill_registration.py -x`
- **Per wave merge:** `cd api && uv run pytest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `api/tests/test_descriptor_fields.py` — covers DESC-01 through DESC-06 (dataclass field existence + defaults)
- [ ] `api/tests/test_skill_annotations.py` — covers DESC-07 (all 14 skills have metadata)
- [ ] `api/tests/test_tool_middleware.py` — covers DESC-08 (metadata-driven filtering scenarios)
- [ ] Update `api/tests/test_skill_registration.py` — remove expectations for deprecated handlers

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found in the Canvex project root. The workspace-level rule `aspect-ratio-feature.mdc` applies to aspect ratio features only and is not relevant to Phase 13.

The `CLAUDE.md` at the Short-Drama-Studio root provides project structure and conventions:
- Backend uses FastAPI + SQLAlchemy async + Pydantic
- Use `model_dump(exclude_unset=True)` + `setattr` for CRUD
- Database initialized via `metadata.create_all()` on startup (no Alembic)
- `_auto_migrate_columns()` handles column additions in development
- Tests via pytest (backend)

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** — Direct reading of all 20+ canonical reference files listed in CONTEXT.md
- **OpenStoryline NodeMeta** — `base_node.py` NodeMeta dataclass and `node_manager.py` NodeManager implementation
- **Canvex optimization plan** — `.cursor/plans/canvex_agent_优化规划_3c790983.plan.md`

### Secondary (MEDIUM confidence)
- **Python dataclasses documentation** — Standard library patterns for field defaults and inheritance
- **LangChain StructuredTool.metadata** — Known pattern from LangChain docs for attaching custom metadata to tools

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns derive directly from existing codebase + OpenStoryline reference
- Pitfalls: HIGH — identified from direct code analysis of current implementation

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain, no external API dependencies)
