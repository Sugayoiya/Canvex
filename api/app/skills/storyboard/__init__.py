from app.skills.storyboard.plan import register_storyboard_plan_skill
from app.skills.storyboard.detail import register_storyboard_detail_skill


def register_storyboard_skills():
    register_storyboard_plan_skill()
    register_storyboard_detail_skill()


__all__ = ["register_storyboard_skills"]
