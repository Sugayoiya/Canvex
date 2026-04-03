from app.skills.descriptor import SkillCategory, SkillDescriptor


def make_descriptor(**overrides) -> SkillDescriptor:
    base = {
        "name": "t",
        "display_name": "t",
        "description": "t",
        "category": SkillCategory.TEXT,
        "input_schema": {},
    }
    base.update(overrides)
    return SkillDescriptor(**base)


def test_skill_kind():
    descriptor = make_descriptor()
    assert descriptor.skill_kind == ""

    descriptor = make_descriptor(skill_kind="extract_characters")
    assert descriptor.skill_kind == "extract_characters"


def test_require_prior_kind():
    first = make_descriptor()
    second = make_descriptor(require_prior_kind=["split_clips"])

    assert first.require_prior_kind == []
    assert second.require_prior_kind == ["split_clips"]
    assert first.require_prior_kind is not second.require_prior_kind


def test_default_require_prior_kind():
    first = make_descriptor()
    second = make_descriptor(default_require_prior_kind=["split_clips"])

    assert first.default_require_prior_kind == []
    assert second.default_require_prior_kind == ["split_clips"]
    assert first.default_require_prior_kind is not second.default_require_prior_kind


def test_supports_skip():
    descriptor = make_descriptor()
    assert descriptor.supports_skip is False

    descriptor = make_descriptor(supports_skip=True)
    assert descriptor.supports_skip is True


def test_skill_tier():
    descriptor = make_descriptor()
    assert descriptor.skill_tier == "capability"

    assert make_descriptor(skill_tier="workflow").skill_tier == "workflow"
    assert make_descriptor(skill_tier="meta").skill_tier == "meta"


def test_safety_metadata():
    descriptor = make_descriptor()

    assert descriptor.is_read_only is False
    assert descriptor.is_destructive is False
    assert descriptor.timeout == 120
    assert descriptor.max_result_size_chars == 50000


def test_backward_compat():
    descriptor = SkillDescriptor(
        name="t",
        display_name="t",
        description="t",
        category=SkillCategory.TEXT,
        input_schema={},
    )

    assert descriptor.name == "t"


def test_mutable_default_isolation():
    first = make_descriptor()
    second = make_descriptor()

    first.require_prior_kind.append("split_clips")

    assert first.require_prior_kind == ["split_clips"]
    assert second.require_prior_kind == []
