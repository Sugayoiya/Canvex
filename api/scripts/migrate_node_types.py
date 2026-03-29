"""One-time migration: convert old node_type values to new material types.

Run: cd api && uv run python scripts/migrate_node_types.py

Mapping:
  text-input, llm-generate, prompt-input, ai-text-generate, source-text, extract, output → text
  image-gen, ai-image-process, source-image → image
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text as sa_text
from app.core.database import AsyncSessionLocal

MIGRATION_MAP = {
    "text-input": "text",
    "llm-generate": "text",
    "prompt-input": "text",
    "ai-text-generate": "text",
    "source-text": "text",
    "extract": "text",
    "output": "text",
    "image-gen": "image",
    "ai-image-process": "image",
    "source-image": "image",
}

async def migrate():
    async with AsyncSessionLocal() as session:
        total = 0
        for old_type, new_type in MIGRATION_MAP.items():
            result = await session.execute(
                sa_text("UPDATE canvas_nodes SET node_type = :new WHERE node_type = :old"),
                {"new": new_type, "old": old_type},
            )
            if result.rowcount > 0:
                print(f"  {old_type} → {new_type}: {result.rowcount} rows")
                total += result.rowcount
        await session.commit()
    print(f"Migration complete. {total} rows updated.")

if __name__ == "__main__":
    asyncio.run(migrate())
