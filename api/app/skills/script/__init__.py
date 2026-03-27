from app.skills.script.split_clips import register_split_clips_skill
from app.skills.script.convert_screenplay import register_convert_screenplay_skill


def register_script_skills():
    register_split_clips_skill()
    register_convert_screenplay_skill()


__all__ = ["register_script_skills"]
