---
name: create-storyboard
description: >
  根据剧本内容规划分镜序列，生成每个镜头的画面描述、出场角色、场景和台词。
  当用户要求"分镜规划"、"规划镜头"或"storyboard plan"时使用。
---

# 分镜规划 Create Storyboard

## When to Use

- 用户说"分镜规划"、"规划镜头"、"创建分镜"
- User says "storyboard plan", "plan shots", "create storyboard"
- 已有剧本文本，需要将其分解为具体的镜头序列
- 通常接在 convert-screenplay 之后执行

## Workflow

1. 获取剧本内容：
   - 如果在 pipeline 中，由 convert-screenplay 输出传入
   - 否则使用 `get_script(episode_id)` 获取
2. 可选地获取上下文信息：
   - `get_characters(project_id)` 获取角色列表
   - `get_scenes(project_id)` 获取场景列表
3. 逐场景分析剧本，规划镜头序列：
   - 每个重要动作或对话转换对应一个镜头
   - 确保 shot_number 从1开始连续递增
4. 使用 `save_shot_plan(episode_id, shots_json)` 保存分镜规划

## Output Format

JSON 数组，每个元素：

```json
{
  "shot_number": 1,
  "description": "镜头画面描述（详细描述画面中的内容）",
  "characters": ["角色A", "角色B"],
  "scene": "场景名称",
  "dialogue": "该镜头的对白内容（如有）"
}
```

## Tips

- shot_number 必须从1开始连续递增，绝对不能跳号
- description 要详细描述画面内容，便于后续生成图片
- characters 列出该镜头中出现的所有角色名称
- 一个对话轮次通常对应一个镜头（说话人+反应镜头）
- 大场景动作可以拆分为多个镜头（远景→中景→特写）
- 如果有角色和场景上下文，在描述中体现角色外貌和场景细节
- 每个场景切换时在 description 中明确标注新场景
