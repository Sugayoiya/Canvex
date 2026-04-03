---
name: split-clips
description: >
  将故事文本按情节转折点拆分为若干编号片段（Clip），每段包含标题、内容和摘要。
  当用户要求"分段"、"拆分故事"或"split clips"时使用。
skill_kind: split_clips
skill_tier: capability
require_prior_kind: []
default_require_prior_kind: []
supports_skip: false
is_read_only: true
is_destructive: false
timeout: 120
max_result_size_chars: 50000
---

# 剧本分段 Split Clips

## When to Use

- 用户说"分段"、"拆分片段"、"拆分故事"
- User says "split clips", "split story", "divide into segments"
- 有一段完整的故事文本，需要拆分为可独立拍摄的片段
- 这通常是 episode pipeline 的第一步

## Workflow

1. 获取故事文本：
   - 如果在 pipeline 中，文本由上游传入
   - 否则使用 `get_script(episode_id)` 获取
2. 分析文本结构，按以下原则拆分：
   - 按情节转折点划分
   - 每段保持叙事完整性
   - 目标片段数约为 10（可由用户指定）
3. 为每个片段生成：
   - **clip_number**: 序号（从1开始，连续递增）
   - **title**: 简短标题（概括该段主要事件）
   - **content**: 该段原文内容
   - **summary**: 该段摘要（1-2句话）

## Output Format

JSON 数组，每个元素：

```json
{
  "clip_number": 1,
  "title": "片段标题",
  "content": "片段原文内容...",
  "summary": "该段摘要"
}
```

## Tips

- clip_number 必须从1开始连续递增，不能跳号
- 每个片段应有完整的叙事弧（起承转合中至少包含一个转折）
- 拆分点优先选择：场景切换、时间跳跃、情节转折
- content 保留原文，不要改写
- summary 用1-2句话概括该段核心事件
- 如果文本较短（<500字），可以只拆成2-3段
