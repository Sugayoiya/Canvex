---
name: extract-characters
description: >
  从剧本或故事文本中提取角色列表，返回结构化角色数据（名称、描述、性别、年龄、性格）。
  当用户要求"提取角色"、"分析人物"或"extract characters"时使用。
---

# 角色提取 Extract Characters

## When to Use

- 用户说"提取角色"、"分析人物"、"角色列表"
- User says "extract characters", "analyze characters"
- 已有剧本或故事文本，需要从中识别所有角色
- 前置条件：项目中存在剧本内容

## Workflow

1. 使用 `get_script(episode_id)` 获取剧本文本
   - 如果用户直接提供了文本，跳过此步
2. 分析文本，识别所有角色，提取以下信息：
   - **name**: 角色名称
   - **description**: 外貌描述（从文本中推断）
   - **gender**: 性别（从对话和描述推断，不确定时填"未知"）
   - **age**: 年龄（从描述推断，不确定时填"未知"）
   - **personality**: 性格特征（从行为和对话推断）
3. 使用 `save_characters(project_id, characters_json)` 保存提取结果

## Output Format

JSON 数组，每个元素：

```json
{
  "name": "角色名",
  "description": "外貌和特征描述",
  "gender": "男/女/未知",
  "age": "年龄或年龄段",
  "personality": "性格特征描述"
}
```

## Tips

- 重点关注有对话的角色，无台词的路人可忽略
- 性别和年龄优先从文本上下文推断，无法确定时填"未知"
- 外貌描述应尽量详细，便于后续生成角色图片
- 性格特征从角色的行为、对话语气、与他人互动中推断
- 如果文本很长（>8000字），优先处理前8000字中出现的角色
