---
phase: 12-ai-call-convergence
plan: 05-topology
subsystem: ai
tags: [architecture, topology, provider-convergence, gemini-merge]
completed: 2026-04-02
---

# AI 调用拓扑图 — 重构后全景

> Phase 12 最终架构文档。记录所有 AI 调用路径、类继承关系、方法签名。

## 调用拓扑 (Mermaid)

```mermaid
flowchart TD
    subgraph callers ["调用方 (Skills & Agent)"]
        direction TB

        subgraph llm_skills ["LLM Skills ×10 — .generate()"]
            S1["text.llm_generate"]
            S2["text.refine"]
            S3["script.convert_screenplay"]
            S4["script.split_clips"]
            S5["extract.characters"]
            S6["extract.scenes"]
            S7["storyboard.plan"]
            S8["storyboard.detail"]
            S9["visual.character_prompt"]
            S10["visual.scene_prompt"]
        end

        subgraph media_skills ["Media Skills ×2"]
            S11["visual.generate_image\n→ .generate_image()"]
            S12["video.generate_video\n→ .generate_video()"]
        end

        AGT["agent_service.py\nresolve_pydantic_model()"]
    end

    subgraph pm_layer ["ProviderManager (单例)"]
        direction TB
        GP_PUB["get_provider()\n公开入口 #1"]
        RAK["resolve_api_key()\n公开入口 #2\n(仅 Agent 用)"]
        GP_RETRY["get_provider_with_retry()\n含自动 key 轮换"]

        subgraph internal ["内部方法"]
            RK["_resolve_key()\nDB 凭证链\nteam→personal→system"]
            AUTO["_auto_select()\nprovider=auto 时"]
        end

        subgraph infra ["基础设施"]
            KR["KeyRotator\n.next_key() 轮询健康 key"]
            CC["CredentialCache (Redis)\n缓存 key 元数据"]
            KHM["KeyHealthManager (Redis)\nerror_count / last_used_at"]
        end
    end

    subgraph providers ["Provider 实例"]
        direction TB

        subgraph gemini_cls ["GeminiProvider (gemini.py)"]
            GM_INIT["__init__(api_key, model)\n→ genai.Client"]
            GM_GEN[".generate() — 文本"]
            GM_STREAM[".stream_generate() — 流式文本"]
            GM_IMG[".generate_image() — Imagen 图片"]
            GM_VID[".generate_video() — Veo 视频"]
            GM_LIST[".list_models()"]
        end

        subgraph openai_cls ["OpenAIProvider"]
            OA_GEN[".generate()"]
            OA_STREAM[".stream_generate()"]
        end

        subgraph deepseek_cls ["DeepSeekProvider"]
            DS_GEN[".generate()"]
            DS_STREAM[".stream_generate()"]
        end
    end

    subgraph pydantic_ai ["PydanticAI (第三方 SDK)"]
        PA_GOOGLE["GoogleModel\n+ GoogleProvider(api_key)"]
        PA_OPENAI["OpenAIModel\n+ OpenAIProvider(api_key)"]
    end

    subgraph db ["数据层"]
        APC["AIProviderConfig\n(owner_type, provider_name)"]
        APK["AIProviderKey\n(api_key_encrypted, is_active)"]
    end

    %% 调用关系
    S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 & S9 & S10 --> GP_PUB
    S11 & S12 --> GP_PUB
    AGT --> RAK

    GP_PUB --> RK
    GP_RETRY --> GP_PUB
    RAK --> RK
    GP_PUB --> AUTO

    RK --> CC
    RK --> KR
    KR --> KHM
    RK --> APK
    RK --> APC

    GP_PUB -->|"构造实例"| gemini_cls
    GP_PUB -->|"构造实例"| openai_cls
    GP_PUB -->|"构造实例"| deepseek_cls

    RAK -->|"裸 api_key"| PA_GOOGLE
    RAK -->|"裸 api_key"| PA_OPENAI
```

## 类继承与方法签名

```
AIProviderBase (ABC)                          ← base.py
└── LLMProviderBase (ABC)                     ← llm_provider_base.py
    ├── GeminiProvider                        ← gemini.py
    │   ├── __init__(api_key, model="gemini-2.5-flash")
    │   │   └── self.client = genai.Client(api_key=api_key)
    │   ├── generate(messages, temperature, max_tokens) → str
    │   ├── stream_generate(messages, ...) → AsyncGenerator[str]
    │   ├── generate_image(prompt, aspect_ratio, model, n) → dict       ★ 合并自 GeminiImageProvider
    │   ├── generate_video(prompt, image_bytes, ..., model) → dict      ★ 合并自 GeminiVideoProvider
    │   ├── list_models() → list[AIModelEntity]
    │   └── get_provider_entity() → ProviderEntity
    │
    ├── OpenAIProvider                        ← openai_provider.py
    │   ├── __init__(api_key, model="gpt-4o")
    │   ├── generate(messages, ...) → str
    │   ├── stream_generate(messages, ...) → AsyncGenerator[str]
    │   ├── list_models() → list[AIModelEntity]
    │   └── get_provider_entity() → ProviderEntity
    │
    └── DeepSeekProvider                      ← deepseek.py
        ├── __init__(api_key, model="deepseek-chat")
        ├── generate(messages, ...) → str
        ├── stream_generate(messages, ...) → AsyncGenerator[str]
        ├── list_models() → list[AIModelEntity]
        └── get_provider_entity() → ProviderEntity
```

```
ProviderManager (单例)                         ← provider_manager.py
├── get_provider(provider, model, *, team_id, user_id, db)
│   → (AIProviderBase, owner_desc, key_id)                   ✅ 公开入口 #1
├── get_provider_with_retry(provider, model, *, ..., max_retries)
│   → (AIProviderBase, owner_desc, key_id)                   ✅ 公开 (含 key 轮换)
├── resolve_api_key(provider, *, team_id, user_id, db)
│   → (api_key, owner_desc, key_id)                          ✅ 公开入口 #2 (仅 Agent)
├── _resolve_key(provider_name, team_id, user_id, db)
│   → (api_key, owner_desc, key_id)                          🔒 内部 — 凭证链
├── _auto_select(model, team_id, user_id, db)
│   → (AIProviderBase, owner_desc, key_id)                   🔒 内部 — provider=auto
├── get_configured_providers() → list[str]
└── get_all_provider_entities() → list[ProviderEntity]

KeyRotator                                     ← provider_manager.py
├── next_key(provider_name, keys) → key_obj
└── invalidate_pool(key_id)

KeyHealthManager (Redis)                       ← key_health.py
├── report_success(key_id)
├── report_error(key_id, error_type, message)
├── get_health(key_id) → dict
├── set_health(key_id, data)
└── reset_errors(key_id)

CredentialCache (Redis)                        ← credential_cache.py
├── get_cached(provider, chain) → dict | None
└── set_cached(provider, owner_type, owner_id, data)
```

## 调用路径总结

| 调用方 | 入口方法 | 拿到什么 | 最终调用 |
|---|---|---|---|
| 10 个 LLM Skill | `pm.get_provider("gemini")` | `GeminiProvider` 实例 | `.generate(messages)` |
| `visual.generate_image` | `pm.get_provider("gemini")` | `GeminiProvider` 实例 | `.generate_image(prompt, ...)` |
| `video.generate_video` | `pm.get_provider("gemini")` | `GeminiProvider` 实例 | `.generate_video(prompt, ...)` |
| `agent_service` (PydanticAI) | `pm.resolve_api_key("gemini")` | 裸 `api_key` 字符串 | `GoogleModel(model, GoogleProvider(api_key))` |

## 凭证解析链

```
_resolve_key(provider, team_id, user_id)
│
├─ 1. Redis CredentialCache 命中？
│     └─ 是 → DB 单行 SELECT by key_id → 解密 → 返回
│
├─ 2. DB 凭证链遍历 (team → personal → system)
│     ├─ AIProviderConfig WHERE owner_type + owner_id
│     ├─ KeyRotator.next_key() 选健康 key
│     │   └─ KeyHealthManager.get_health(key_id) — Redis 查询
│     ├─ 解密 api_key_encrypted (Fernet)
│     ├─ 写入 CredentialCache (仅元数据，不存明文 key)
│     └─ 返回 (api_key, owner_desc, key_id)
│
└─ 3. 全部未命中 → raise ValueError
```

## 已删除的旧代码

| 已删除 | 原因 |
|---|---|
| `gemini_image.py` / `GeminiImageProvider` | 合并入 `GeminiProvider.generate_image()` |
| `gemini_video.py` / `GeminiVideoProvider` | 合并入 `GeminiProvider.generate_video()` |
| `resolve_llm_provider()` (provider_manager.py) | 所有 skill 统一用 `pm.get_provider()` |
| `provider.api_key` 属性访问 | 不再暴露裸 key，Agent 走 `resolve_api_key()` |

## 文件索引

| 文件 | 角色 |
|---|---|
| `api/app/services/ai/base.py` | `AIProviderBase` 抽象基类 |
| `api/app/services/ai/llm_provider_base.py` | `LLMProviderBase` — LLM 公共抽象 |
| `api/app/services/ai/model_providers/gemini.py` | `GeminiProvider` — 统一文本/图片/视频 |
| `api/app/services/ai/model_providers/openai_provider.py` | `OpenAIProvider` |
| `api/app/services/ai/model_providers/deepseek.py` | `DeepSeekProvider` |
| `api/app/services/ai/provider_manager.py` | `ProviderManager` + `KeyRotator` + 生命周期函数 |
| `api/app/services/ai/key_health.py` | `KeyHealthManager` — Redis 健康状态 |
| `api/app/services/ai/credential_cache.py` | `CredentialCache` — Redis 凭证缓存 |
| `api/app/services/ai/errors.py` | `ContentBlockedError`, `TransientError` |
| `api/app/agent/agent_service.py` | `resolve_pydantic_model()` — PydanticAI 集成 |
| `api/app/skills/*/` | 12 个 Skill handler |
| `api/tests/test_provider_convergence.py` | 收敛集成测试 |
