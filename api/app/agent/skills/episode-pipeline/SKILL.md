---
name: episode-pipeline
description: >
  剧集创作全流程编排：依次执行分段→剧本转换→分镜规划→（可选）分镜细化。
  当用户要求"完整创作流程"、"从故事到分镜"或"episode pipeline"时使用。
skill_kind: episode_pipeline
skill_tier: workflow
require_prior_kind: []
default_require_prior_kind: []
supports_skip: false
is_read_only: false
is_destructive: false
timeout: 300
max_result_size_chars: 50000
---

# 剧集流水线 Episode Pipeline

## ⚠️ Recursion Guard

This is a meta-skill that composes other skills. Do NOT call `read_skill("episode-pipeline")`
from within this pipeline. Maximum nesting depth: 3 levels of read_skill calls.
If you've already called read_skill 3 times in this conversation turn, execute the
remaining steps using your own knowledge without further read_skill calls.

## When to Use

- 用户说"完整创作流程"、"从故事到分镜"、"一键生成"
- User says "episode pipeline", "full workflow", "story to storyboard"
- 有一段故事原文，希望一步到位完成分段→剧本→分镜的全流程
- 这是一个编排技能，按顺序调用其他技能

## Workflow

按以下顺序依次执行：

### Step 1: 故事分段
1. `read_skill("split-clips")` 获取分段技能指令
2. 按指令执行：将故事文本拆分为编号片段
3. 记录输出的 clips 数组

### Step 2: 剧本转换
1. `read_skill("convert-screenplay")` 获取剧本转换技能指令
2. 按指令执行：将每个片段转换为标准剧本格式
3. 合并所有片段的剧本文本
4. 使用 `save_screenplay(episode_id, screenplay_text)` 保存

### Step 3: 分镜规划
1. `read_skill("create-storyboard")` 获取分镜规划技能指令
2. 按指令执行：将剧本拆解为镜头序列
3. 使用 `save_shot_plan(episode_id, shots_json)` 保存

### Step 4 (可选): 分镜细化
- 仅当用户明确要求细化、或项目需要高质量视觉效果时执行
- 此步骤已是第4次技能调用，直接根据自身知识执行
- 为每个镜头补充景别、运镜、构图、光线细节

## Output Format

报告每步执行状态：

```
Pipeline 执行报告：
✅ Step 1 - 分段完成：共 N 个片段
✅ Step 2 - 剧本转换完成：共 M 字
✅ Step 3 - 分镜规划完成：共 K 个镜头
⏭️ Step 4 - 分镜细化：跳过（用户未要求）
```

## Tips

- 每一步的输出是下一步的输入，确保数据正确传递
- 如果某一步失败，报告错误并停止，不要继续执行后续步骤
- 分段数量和镜头数量可以让用户指定，否则使用默认值
- 全流程耗时较长，建议告知用户预计时间
- 如果故事文本很短（<200字），可以跳过分段步骤直接转换剧本
