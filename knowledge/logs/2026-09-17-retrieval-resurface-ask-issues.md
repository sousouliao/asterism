# Unified Retrieval, Resurface, and Ask issues

Date: 2026-09-17

## Outcome

- 响应用户推进下一阶段检索与唤醒功能的指令，完成 3 个纵向完整切片 GitHub Issue 的创建：
  1. **GitHub #39**: `feat(retrieval): unified search engine with memory awareness and match explanation`
     - 范围：将 `why_saved` 与 `note` 纳入检索流与 embedding，提供统一检索管道抽象与 Match Explanation 匹配理由展示。
  2. **GitHub #40**: `feat(memory): resurface inactive stars and contextual memory streams`
     - 范围：主页沉睡记忆唤醒卡片流（Worth Remembering / Missing Context），纯端侧可解释推荐与用户显式反馈（Dismiss / Useful）。由 #39 阻塞。
  3. **GitHub #41**: `feat(ask): private and grounded repository Q&A (Ask Asterism)`
     - 范围：基于统一检索的自然语言意图问答，严格限定个人库，附带可追溯证据链与引用标签。由 #39 阻塞。
- 三个 issue 均打上 `ready-for-agent` 标签。
- 同步更新了 `knowledge/state/BACKLOG.md` 与 `knowledge/state/PROGRESS.md`，确立当前第一执行目标为 #39。

## Scope discipline

严格遵循一个 Issue 一个完整功能的原则：
- #39 负责底层检索多路召回与记忆融合，不混入主页大改或对话式 LLM；
- #40 独立负责主页记忆唤醒体验，消费底层客观与主观时间信号；
- #41 独立负责意图自然语言问答与证据链组装。
三个功能边界清晰、层层递进，既有独立的业务闭环，又避免了单一巨型 PR 带来的交付与回归风险。
