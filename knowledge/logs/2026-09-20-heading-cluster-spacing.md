# 2026-09-20 · 标题簇间距统一

## 目标

Settings 的 Ask 分区叠了两套标题（Ask Asterism 16px 才到说明，「生成连接」只有 2px），同页其它区块和导入导出也不在同一档。把「标题 + 说明」收成 4px 栅格上的同一簇。

## 变更

- `ui-ux.md` / `DESIGN.md` 写明标题簇：标题↔说明 xs（4px）、簇→正文 lg（16px）、内容页区块之间 2xl（24px）。禁止 `gap-0.5` 或把说明推到 `mb-4` 之外；区块标题必须用 `--text-section-title`。
- 新增 `SectionHeader`，Settings 去掉本地 `SectionTitle`。Ask 只留一层 h2，拿掉「生成连接」标题与重复说明，「添加连接」升到标题簇右侧。
- 设置行 / 连接偏好行改为 `gap-1`；账号去掉 `mb-4` + `gap-3` 叠距；导入导出两卡标题簇对齐；Resurface 改用同一组件。加载骨架镜像新节奏。

## 验证

- `settings` / `settings-ask-section` / `ai-connections-manager` / `resurface-section` 共 25 例通过。
- `detect.mjs --scope layout` 零发现。
- ego-browser（TaskSpace 17，`localhost:5173`，已登录，zh-CN）桌面 2304×1315 + 窄屏 375×812：
  - Settings 空连接：Ask 只剩一层 h2，标题↔说明 4px；空状态自带「添加连接」。
  - Settings 有连接（本地注入后还原）：「添加连接」在标题簇右侧；簇→列表 16px；无「生成连接」叠层标题。
  - 外观设置行标题↔说明 4px；账号标题→卡片 16px。
  - 导入导出两卡、洞察 Resurface 标题↔说明均为 4px。
  - 窄屏标题簇换行（操作落到说明下方），间距仍落在 4px 栅格。
