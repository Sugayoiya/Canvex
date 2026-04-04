import json
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.agent_artifact import AgentArtifact

logger = logging.getLogger(__name__)

SUMMARY_TEMPLATES: dict[str, object] = {
    "save_characters": lambda p: f"已保存 {len(p.get('characters', []))} 个角色",
    "save_scenes": lambda p: f"已保存 {len(p.get('scenes', []))} 个场景",
    "save_screenplay": lambda p: f"剧本已保存，共 {len(p.get('content', ''))} 字",
    "save_shot_plan": lambda p: f"分镜计划已保存，共 {len(p.get('shots', []))} 个镜头",
    "save_shot_details": lambda _p: "镜头细节已保存",
    "update_shot": lambda _p: "镜头已更新",
    "generate_image": lambda p: f"图片已生成: {p.get('url', '')[:100]}",
    "generate_video": lambda p: f"视频已生成: {p.get('url', '')[:100]}",
}


def generate_summary(skill_kind: str, payload: dict) -> str:
    template = SUMMARY_TEMPLATES.get(skill_kind)
    if template:
        try:
            return template(payload)[:500]
        except Exception:
            pass
    return json.dumps(payload, ensure_ascii=False, default=str)[:500]


class ArtifactStoreService:
    @staticmethod
    async def save(
        session_id: str,
        skill_kind: str,
        summary: str,
        payload: dict,
        execution_log_id: str | None = None,
    ) -> AgentArtifact:
        async with AsyncSessionLocal() as db:
            artifact = AgentArtifact(
                session_id=session_id,
                skill_kind=skill_kind,
                summary=summary[:500],
                payload=payload,
                execution_log_id=execution_log_id,
            )
            db.add(artifact)
            await db.commit()
            await db.refresh(artifact)
            return artifact

    @staticmethod
    async def get_latest(session_id: str, skill_kind: str) -> AgentArtifact | None:
        async with AsyncSessionLocal() as db:
            stmt = (
                select(AgentArtifact)
                .where(
                    AgentArtifact.session_id == session_id,
                    AgentArtifact.skill_kind == skill_kind,
                )
                .order_by(AgentArtifact.created_at.desc())
                .limit(1)
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    @staticmethod
    async def get_latest_payload(session_id: str, skill_kind: str) -> dict | None:
        artifact = await ArtifactStoreService.get_latest(session_id, skill_kind)
        return artifact.payload if artifact else None

    @staticmethod
    async def list_session_artifacts(session_id: str) -> list[AgentArtifact]:
        async with AsyncSessionLocal() as db:
            stmt = (
                select(AgentArtifact)
                .where(AgentArtifact.session_id == session_id)
                .order_by(AgentArtifact.created_at.asc())
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())
