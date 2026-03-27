from app.skills.asset.get_project_info import register_asset_get_project_info_skill


def register_asset_skills():
    register_asset_get_project_info_skill()


__all__ = ["register_asset_skills"]
