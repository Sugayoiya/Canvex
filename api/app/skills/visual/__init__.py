"""VISUAL skill category — image generation (kept for canvas node execution)."""


def register_visual_skills():
    from app.skills.visual.generate_image import register_generate_image_skill

    register_generate_image_skill()
