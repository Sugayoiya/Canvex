from app.skills.text.llm_generate import register_text_skills as _reg_llm
from app.skills.text.refine import register_text_refine_skill as _reg_refine


def register_text_skills():
    _reg_llm()
    _reg_refine()


__all__ = ["register_text_skills"]
