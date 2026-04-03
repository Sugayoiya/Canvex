---
name: generate-shot-image
description: >
  根据分镜描述和角色/场景信息，合成图片生成提示词并调用生图工具。
  当用户要求"生成分镜图片"、"画分镜"或"generate shot image"时使用。
skill_kind: generate_shot_image
skill_tier: capability
require_prior_kind:
  - create_storyboard
default_require_prior_kind: []
supports_skip: true
is_read_only: false
is_destructive: false
timeout: 120
max_result_size_chars: 5000
---

# 分镜生图 Generate Shot Image

## When to Use

- 用户说"生成分镜图片"、"画分镜"、"生成镜头画面"
- User says "generate shot image", "draw storyboard", "create shot visual"
- 已有分镜数据（含画面描述），需要生成对应的图片
- 可以批量生成，也可以针对单个镜头

## Workflow

1. 获取分镜数据和上下文：
   - 读取目标镜头的 description、characters、scene 信息
   - 可选：`get_characters(project_id)` 获取角色外貌细节
   - 可选：`get_scenes(project_id)` 获取场景细节
   - 可选：`get_style_templates(project_id)` 获取视觉风格
2. 合成图片生成提示词（prompt）：
   - 将角色外貌、场景细节、画面描述、风格要求合并
   - 提示词用英文效果更佳
   - 包含：角色外貌特征、表情、姿势、服装、场景环境、光线、色调
3. 调用 `generate_image(prompt, aspect_ratio)` 生成图片
   - aspect_ratio 默认为项目设定的画幅比例
4. 使用 `update_shot(shot_id, "image_url", url)` 将生成的图片 URL 关联到镜头

## Output Format

返回操作结果：

```json
{
  "shot_id": "镜头ID",
  "image_url": "生成的图片URL",
  "prompt_used": "使用的提示词"
}
```

## Tips

- 提示词应包含：外貌特征、表情、姿势、服装、背景环境、光线、色调
- 如果有角色设定图，在提示词中引用以保持一致性
- 中文描述可以翻译为英文提示词以获得更好的生成效果
- aspect_ratio 使用项目设定值（如 "16:9"、"9:16"）
- 特写镜头着重描述面部细节和表情
- 远景镜头着重描述环境和人物在场景中的位置关系
- 避免在提示词中包含文字内容（AI生图不擅长文字渲染）
