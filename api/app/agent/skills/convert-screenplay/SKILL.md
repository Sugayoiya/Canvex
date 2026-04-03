---
name: convert-screenplay
description: >
  将叙事片段转换为标准剧本格式，包含场景标题、角色对话、动作描述和镜头指示。
  当用户要求"转换剧本"、"生成剧本"或"convert screenplay"时使用。
skill_kind: convert_screenplay
skill_tier: capability
require_prior_kind:
  - split_clips
default_require_prior_kind: []
supports_skip: false
is_read_only: false
is_destructive: false
timeout: 120
max_result_size_chars: 50000
---

# 剧本转换 Convert Screenplay

## When to Use

- 用户说"转换剧本"、"生成剧本"、"写成剧本格式"
- User says "convert screenplay", "screenplay format", "write as script"
- 有叙事文本片段，需要转为标准剧本格式
- 通常接在 split-clips 之后执行

## Workflow

1. 获取输入内容：
   - 如果在 pipeline 中，由 split-clips 输出的 clip content 传入
   - 否则用户直接提供文本
2. 可选地获取上下文信息增强效果：
   - `get_characters(project_id)` 获取角色信息
   - `get_scenes(project_id)` 获取场景信息
3. 将叙事内容转换为标准剧本格式：
   - **场景标题**: `INT/EXT. 地点 - 时间`（如 `INT. 公寓客厅 - 夜晚`）
   - **动作描述**: 大写描述角色动作和场景变化
   - **角色对话**: 角色名（居中大写）+ 对话内容
   - **镜头指示**: 必要时加入镜头提示（如"特写"、"推镜头"）
4. 使用 `save_screenplay(episode_id, screenplay_text)` 保存剧本

## Output Format

标准剧本纯文本格式：

```
INT. 公寓客厅 - 夜晚

一盏昏暗的台灯照亮凌乱的书桌。李明坐在桌前，翻看着手中的照片。

                    李明
          （低声自语）
    这张照片...是什么时候拍的？

门突然被推开，小雪冲了进来。
```

## Tips

- 场景标题用 INT（室内）或 EXT（室外）开头
- 动作描述用现在时态，简洁有力
- 对话要自然，符合角色性格
- 如果有角色上下文信息，确保对话风格与角色设定一致
- 每个场景切换时加入新的场景标题
- 不要添加原文中没有的情节
