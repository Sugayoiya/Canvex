---
name: extract-scenes
description: >
  从剧本或故事文本中提取场景列表，返回结构化场景数据（名称、描述、地点、时间、氛围）。
  当用户要求"提取场景"、"分析场景"或"extract scenes"时使用。
---

# 场景提取 Extract Scenes

## When to Use

- 用户说"提取场景"、"分析场景"、"场景列表"
- User says "extract scenes", "analyze scenes"
- 已有剧本或故事文本，需要从中识别所有场景
- 前置条件：项目中存在剧本内容

## Workflow

1. 使用 `get_script(episode_id)` 获取剧本文本
   - 如果用户直接提供了文本，跳过此步
2. 分析文本，识别所有场景/地点，提取以下信息：
   - **name**: 场景名称（简短描述性名称）
   - **description**: 场景详细描述
   - **location**: 具体地点（如"城市街道"、"公寓客厅"）
   - **time_of_day**: 时间段（如"白天"、"夜晚"、"黄昏"）
   - **mood**: 氛围（如"紧张"、"温馨"、"压抑"）
3. 使用 `save_scenes(project_id, scenes_json)` 保存提取结果

## Output Format

JSON 数组，每个元素：

```json
{
  "name": "场景名称",
  "description": "场景详细描述",
  "location": "具体地点",
  "time_of_day": "时间段",
  "mood": "氛围描述"
}
```

## Tips

- 同一地点在不同时间出现算不同场景（如"公园-白天"和"公园-夜晚"）
- 从对话和叙述中推断氛围，考虑剧情紧张度
- 地点描述要具体到能生成对应画面的程度
- 如果场景在文中反复出现，只提取一次，但描述要覆盖所有出现时的细节
