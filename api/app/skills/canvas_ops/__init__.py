from app.skills.canvas_ops.get_state import register_canvas_get_state_skill


def register_canvas_ops_skills():
    register_canvas_get_state_skill()


__all__ = ["register_canvas_ops_skills"]
