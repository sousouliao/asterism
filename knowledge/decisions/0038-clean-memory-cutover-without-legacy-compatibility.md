# ADR 0038 · Memory Foundation 采用无旧数据兼容的干净切换

- Status: Accepted
- Date: 2026-09-17
- Supersedes: ADR 0037 中迁移旧 Note 与兼容旧 JSON 导入的实现决定

## Context

Asterism 尚无需要保护的真实用户数据，维护者也没有需要迁移的旧 Note。继续实现 `notes → memories` 数据搬运、v1/v2 JSON 兼容与相关分支，会让首个 Memory 模型背负没有实际消费者的永久复杂度。

## Decision

- Memory Foundation 直接创建 `memories`，并删除 `notes` 表、旧查询与旧领域类型。
- 不迁移旧 Note 内容，也不提供旧 Notes JSON 的兼容导入。
- JSON 导入导出从 v3 Memory 格式开始；v1/v2 直接报告不支持。
- 既有 Star 的基础 Memory 由 `sync-stars` 的幂等 repair pass 补齐；该路径属于新模型完整性，不是兼容层。
- 不建立 feature flag、双写、旧接口 alias 或临时适配器。

## Consequences

- schema、数据访问与导入导出只有一套当前模型，代码与测试更直接。
- 尚未同步或尚未执行 repair 的 Star 可能暂时没有 Memory；下一次同步会补齐，且绝不覆盖已有 `why_saved` / `note`。
- 任何未来真实兼容需求都必须基于实际数据重新立项，不能预先恢复本次删除的分支。
