"""Verify SkillRegistry after Phase 13 handler deprecation.

Post-cleanup, all remaining SkillRegistry handlers are deprecated.
Reasoning skills continue to load from SKILL.md via SkillLoader instead.
"""
from app.skills.register_all import register_all_skills
from app.skills.registry import skill_registry

EXPECTED_SKILLS = []


def test_all_skills_registered():
    register_all_skills()
    registered = skill_registry.list_names()
    assert registered == []


def test_skill_descriptors_valid():
    register_all_skills()
    assert skill_registry.skill_count == 0


def test_no_duplicate_skills():
    register_all_skills()
    names = skill_registry.list_names()
    assert len(names) == len(set(names)), f"Duplicate skills detected: {[n for n in names if names.count(n) > 1]}"


def test_minimum_skill_count():
    register_all_skills()
    assert skill_registry.skill_count == 0


def test_deleted_skills_not_registered():
    """Verify deprecated and migrated skills are no longer in SkillRegistry."""
    register_all_skills()
    names = skill_registry.list_names()
    deleted_skills = [
        "text.llm_generate", "text.refine",
        "extract.characters", "extract.scenes",
        "script.split_clips", "script.convert_screenplay",
        "storyboard.plan", "storyboard.detail",
        "visual.character_prompt", "visual.scene_prompt",
        "visual.generate_image", "canvas.get_state",
        "asset.get_project_info", "video.generate_video",
    ]
    for skill_name in deleted_skills:
        assert skill_name not in names, f"Deleted skill still registered: {skill_name}"
