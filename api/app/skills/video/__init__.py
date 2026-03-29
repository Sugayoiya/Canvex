"""VIDEO skill category — video generation."""


def register_video_skills():
    from app.skills.video.generate_video import register_generate_video_skill

    register_generate_video_skill()
