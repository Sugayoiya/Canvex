from app.skills.extract.characters import register_extract_characters_skill
from app.skills.extract.scenes import register_extract_scenes_skill


def register_extract_skills():
    register_extract_characters_skill()
    register_extract_scenes_skill()


__all__ = ["register_extract_skills"]
