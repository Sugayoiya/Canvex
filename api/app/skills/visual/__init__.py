"""VISUAL skill category — image prompt generation and image generation."""


def register_visual_skills():
    from app.skills.visual.character_prompt import register_character_prompt_skill
    from app.skills.visual.scene_prompt import register_scene_prompt_skill
    from app.skills.visual.generate_image import register_generate_image_skill

    register_character_prompt_skill()
    register_scene_prompt_skill()
    register_generate_image_skill()
