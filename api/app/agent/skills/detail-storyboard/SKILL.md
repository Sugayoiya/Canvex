---
name: detail-storyboard
description: >
  为已有的分镜规划添加摄影细节：景别、运镜、构图、光线和视觉提示词。
  当用户要求"细化分镜"、"添加镜头细节"或"storyboard detail"时使用。
---

# 分镜细化 Detail Storyboard

## When to Use

- 用户说"分镜细化"、"细化镜头"、"添加镜头细节"
- User says "storyboard detail", "shot detail", "enrich storyboard"
- 已有分镜规划（来自 create-storyboard），需要补充摄影专业细节
- 这是可选步骤，适合需要高质量视觉效果的项目

## Workflow

1. 获取现有分镜数据：
   - 如果在 pipeline 中，由 create-storyboard 输出传入
   - 否则从项目数据获取已有的分镜列表
2. 可选地获取视觉风格参考：
   - `get_style_templates(project_id)` 获取项目风格模板
3. 为每个镜头补充以下摄影细节：
   - **shot_type**: 景别（特写/中景/远景/全景/大特写）
   - **camera_move**: 运镜方式（推/拉/摇/移/固定/跟随/升降）
   - **composition**: 构图描述（三分法/对称/对角线/框架等）
   - **lighting**: 光线描述（自然光/逆光/侧光/顶光/柔光等）
   - **video_prompt**: 视觉提示词（综合描述，用于视频生成）
4. 使用 `save_shot_details(shot_id, details_json)` 保存每个镜头的细化数据

## Output Format

JSON 数组，每个元素必须包含 shot_number 以对应原分镜：

```json
{
  "shot_number": 1,
  "shot_type": "中景",
  "camera_move": "缓慢推进",
  "composition": "三分法构图，主角位于右侧三分线",
  "lighting": "暖色侧光，营造温馨氛围",
  "video_prompt": "中景镜头缓推，温暖侧光下角色坐在窗边..."
}
```

## Tips

- shot_number 必须与原分镜一一对应
- shot_type 常用值：大特写、特写、近景、中景、全景、远景、鸟瞰
- camera_move 常用值：固定、推、拉、摇、移、升、降、跟、手持、环绕
- video_prompt 应综合所有信息，写成完整的视觉描述句
- 情绪高潮点适合用特写+推镜头
- 场景建立镜头适合用远景/全景+固定或缓慢摇移
- 如果有风格模板，在 video_prompt 中融入风格关键词
