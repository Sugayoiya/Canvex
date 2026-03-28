from fastapi import APIRouter

from app.api.v1.agent import router as agent_router
from app.api.v1.auth import router as auth_router
from app.api.v1.billing import router as billing_router
from app.api.v1.canvas import router as canvas_router
from app.api.v1.logs import router as logs_router
from app.api.v1.skills import router as skills_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(skills_router)
api_router.include_router(logs_router)
api_router.include_router(canvas_router)
api_router.include_router(billing_router)
api_router.include_router(agent_router)
