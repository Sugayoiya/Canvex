from app.skills.register_all import register_all_skills
from app.skills.registry import skill_registry

EXPECTED_SKILLS = [
    "text.llm_generate", "text.refine",
    "extract.characters", "extract.scenes",
    "script.split_clips", "script.convert_screenplay",
    "storyboard.plan", "storyboard.detail",
    "visual.character_prompt", "visual.scene_prompt", "visual.generate_image",
    "canvas.get_state", "asset.get_project_info",
]


def test_all_skills_registered():
    register_all_skills()
    registered = skill_registry.list_names()
    for skill_name in EXPECTED_SKILLS:
        assert skill_name in registered, f"Missing skill: {skill_name}"


def test_skill_descriptors_valid():
    register_all_skills()
    for name in EXPECTED_SKILLS:
        descriptor = skill_registry.get_descriptor(name)
        assert descriptor.name == name
        assert descriptor.category is not None
        assert descriptor.input_schema is not None
        assert isinstance(descriptor.input_schema, dict)


def test_no_duplicate_skills():
    register_all_skills()
    names = skill_registry.list_names()
    assert len(names) == len(set(names)), f"Duplicate skills detected: {[n for n in names if names.count(n) > 1]}"


def test_minimum_skill_count():
    register_all_skills()
    assert skill_registry.skill_count >= len(EXPECTED_SKILLS), (
        f"Expected at least {len(EXPECTED_SKILLS)} skills, got {skill_registry.skill_count}"
    )
