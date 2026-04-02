---
name: generate-shot-video
description: >
  根据分镜描述和已有图片，合成视频生成提示词并调用生视频工具。
  当用户要求"生成分镜视频"、"镜头动起来"或"generate shot video"时使用。
---

# 分镜生视频 Generate Shot Video

## When to Use

- 用户说"生成分镜视频"、"镜头动起来"、"生成视频"
- User says "generate shot video", "animate shot", "create video"
- 已有分镜数据和对应的图片，需要生成动态视频
- 建议先执行 generate-shot-image 获取静态图片

## Workflow

1. 获取分镜数据：
   - 读取镜头的画面描述、摄影细节（如有）
   - 获取该镜头已生成的图片 URL（作为视频首帧）
2. 合成视频生成提示词：
   - 基于画面描述，添加动态元素：
     - 角色动作（走动、转身、说话等）
     - 镜头运动（推拉摇移等）
     - 环境动态（风吹、光影变化等）
   - 如果有 detail-storyboard 生成的 camera_move 信息，融入提示词
3. 调用 `generate_video(prompt, aspect_ratio, image_url)` 生成视频
   - image_url: 用该镜头的静态图片作为参考帧
   - aspect_ratio: 与图片保持一致

## Output Format

返回操作结果：

```json
{
  "shot_id": "镜头ID",
  "video_url": "生成的视频URL",
  "prompt_used": "使用的视频提示词"
}
```

## Tips

- 视频提示词侧重描述"动态变化"而非静态画面
- 运镜提示要明确：camera slowly pushes in / camera pans left
- 人物动作要简单清晰，避免复杂的多人交互
- 环境动态能增加画面生动感：微风吹动头发、光影流动
- 视频时长一般为3-5秒，一个动作足矣
- 如果没有已生成的图片，先执行 generate-shot-image
- 用英文写视频提示词效果更好
