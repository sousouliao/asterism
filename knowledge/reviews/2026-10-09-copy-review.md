# Asterism 中文文案对照表 · 第二版（已落地）

日期：2026-10-09。本版取代上一版。逐项复核中文资源 551 条，结合登录、筛选、同步、仓库详情、语义搜索、洞察、导入导出、批量整理、问答、AI 连接和速读的实际用途。历史资源键不代表当前生产界面一定使用，开发专用样本另行标记。已按本版更新中英文语言资源；功能、用户内容和上游 README 不变。中文更新 186 条，英文更新 182 条。

## 判断标准

1. 面向熟悉 GitHub 和模型服务的开发者。“不用术语”针对没有帮助的内部表达，不能牺牲准确名称。Star、Fork、Topic、README、Provider、API Key、OAuth、JSON、CSV、Markdown、模型 ID、语义搜索、重建索引保留。
2. 保留已有产品概念：仓库、集合、个人记忆、收藏原因、笔记、洞察、Ask Asterism、导入 / 导出。它们不因“可以换个说法”而改名。
3. 只修改准确性、动作清晰度、层级、冗余或恢复指引存在明确问题的文案。避免幼稚口吻、夸张承诺和刻意的中文替换。
4. 中文功能名优先 2–4 字；品牌和准确技术名称保留。不能为凑字数删掉必要对象、范围或快捷键。普通说明不超过 20 字；长提示按用户已同意的口径拆短句。插值长度不可预测，检查时按一个插值项计。
5. 同一动作保留动词与对象。“重建索引”不同于首次准备，“生成速读”不同于阅读 README，“导入 / 导出”包含完整备份与非恢复文件导出。
6. 错误说明只给已知原因和真实可用的下一步。授权继续披露完整 Star 目录、个人记忆按需发送、API Key 存储与转发边界。

## 阅读依据及应用

实际读过：Steve Krug 官网第 4 章完整节选；第二版第 1、2、5 章公开预览；Robin Williams 第四版第 1–5 章公开预览及出版社第三版重复 / 对比节选。没有读取两书全文。

- [Krug 第 4 章原文节选](https://sensible.com/downloads/DMMT-Revisited-sample-chapter.pdf)：入口应让用户能确定选择的结果；帮助只给当下必要的信息。
- [第 2 章预览](https://www.oreilly.com/library/view/dont-make-me/0321344758/ch02.html)、[第 5 章预览](https://www.oreilly.com/library/view/dont-make-me/0321344758/ch05.html)：按扫读组织内容，删掉多余文字。
- [亲密性预览](https://www.oreilly.com/library/view/the-non-designers-design/9780133966350/ch02.html)、[对齐预览](https://www.oreilly.com/library/view/the-non-designers-design/9780133966350/ch03.html)、[出版社重复与对比节选](https://www.pearson.de/media/muster/ext/9780321563071.pdf)：相关内容成组，重复建立一致性，对比建立层级。

应用到文案：标题说明功能，说明补充收益或后果；同一对象使用同一名称；错误、成功和等待各表达自己的状态。2–4 字、20 字是用户的要求，不是两本书规定。

## 撤回上一版的修改

| 上一版建议 | 本版结论 | 判断理由 |
| --- | --- | --- |
| Star → 收藏 | 保留 Star | GitHub 的准确名称；Star 数还可能是所有用户的数量，不能混淆成本人的收藏。 |
| Provider → AI 服务 | 保留 Provider | 开发者设置模型服务时能直接识别这个字段。 |
| API Key → 密钥 | 保留 API Key | 与 Provider 控制台、接入文档一致，降低填错值的风险。 |
| Topic → 主题 | 保留 Topic | 与 GitHub 仓库元数据一致；避免和集合的主题混淆。 |
| Fork → 分支 | 保留 Fork | Fork 不等于 Git branch。 |
| README → 说明文件 | 保留 README | 明确对应仓库文件，不泛化。 |
| 语义搜索 → 含义搜索 | 保留语义搜索 | 是成熟、准确的功能名；说明解释收益即可。 |
| 重建索引 → 重新准备 | 保留重建索引 | 维护操作应明确，不能混成首次启用。 |
| 导入 / 导出 → 数据备份 | 保留导入 / 导出 | CSV、Markdown 不用于恢复，入口要覆盖实际用途。 |
| 个人记忆 → 收藏记录 | 保留个人记忆 | 已有产品概念，且名称本身为四字，不需要重命名。 |
| 模型 ID → 模型名称 | 保留模型 ID | 接口需要的标识不一定等于模型显示名。 |
| 停止生成 → 停止回答 | 保留停止生成 | 与生成中状态一致，动作准确。 |
| 应用到 N 个仓库 → 确认整理 | 保留原范围 | 确认前应知道受影响仓库数量。 |
| 正在生成速读 → 正在阅读仓库说明 | 撤回 | 必须区分 AI 生成与 README 加载。 |

## 已核对的事实及边界

- “活跃”只是 `archived=false`，改为“未归档”。
- “未重温”只由 Star 时间计算，没有访问记录，改为“收藏已 {{duration}}”。
- 个人记忆仍作为产品名称保留；统计数据是收藏原因或笔记非空的记录数，不改成“有笔记”，也不把它称为全部基础记录数。
- “热门 Topic”按本人 Star 库频次计算，改为“常见 Topic”，避免暗示 GitHub 全站热度。
- 用户已同意“开源，可自行部署”及限定收藏数据存储、披露 AI 出网的登录说明。
- 长授权描述不删除派生向量存储、整份目录、按需个人记忆、API Key 本地存储和 Provider 转发等关键事实。
- 技术名称、动态仓库名、对象明确的确认动作和读屏标签不按四字机械截断。

## 完整对照表

每条资源均列出原文和建议。保留不是遗漏：原文准确、熟悉或无需换名。开发专用文案不在本次生产文案修改范围。


### app

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `app.name` | Asterism | Asterism | 保留：名称或状态清楚，无需替换。 |
| `app.tagline` | 你的私人开源软件记忆库。 | 你的私人开源软件记忆库。 | 保留：名称或状态清楚，无需替换。 |

### auth

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `auth.loading` | 正在检查登录态… | 正在确认登录状态… | 压缩冗余，保留操作、对象与必要后果。 |
| `auth.signInWithGitHub` | 使用 GitHub 登录 | 使用 GitHub 登录 | 保留：名称或状态清楚，无需替换。 |
| `auth.signOut` | 退出登录 | 退出登录 | 保留：名称或状态清楚，无需替换。 |
| `auth.signedInAs` | 已登录：{{name}} | 已登录：{{name}} | 保留：名称或状态清楚，无需替换。 |
| `auth.signedOut` | 尚未登录。 | 尚未登录。 | 保留：名称或状态清楚，无需替换。 |

### actions

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `actions.toggleLanguage` | 切换语言 | 切换语言 | 保留：名称或状态清楚，无需替换。 |

### languageNames

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `languageNames.english` | English | English | 保留：名称或状态清楚，无需替换。 |
| `languageNames.simplifiedChinese` | 简体中文 | 简体中文 | 保留：名称或状态清楚，无需替换。 |
| `languageNames.currentShort` | 中 | 中 | 保留：名称或状态清楚，无需替换。 |

### common

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `common.cancel` | 取消 | 取消 | 保留：名称或状态清楚，无需替换。 |
| `common.save` | 保存 | 保存 | 保留：名称或状态清楚，无需替换。 |
| `common.saving` | 保存中 | 保存中 | 保留：名称或状态清楚，无需替换。 |
| `common.edit` | 编辑 | 编辑 | 保留：名称或状态清楚，无需替换。 |
| `common.done` | 完成 | 完成 | 保留：名称或状态清楚，无需替换。 |
| `common.delete` | 删除 | 删除 | 保留：名称或状态清楚，无需替换。 |
| `common.deleting` | 删除中 | 删除中 | 保留：名称或状态清楚，无需替换。 |
| `common.retry` | 重试 | 重试 | 保留：名称或状态清楚，无需替换。 |
| `common.close` | 关闭 | 关闭 | 保留：名称或状态清楚，无需替换。 |
| `common.actions` | 操作 | 操作 | 保留：名称或状态清楚，无需替换。 |

### loading

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `loading.page` | 正在加载页面… | 正在加载页面… | 保留：名称或状态清楚，无需替换。 |
| `loading.repositories` | 正在加载仓库… | 正在加载仓库… | 保留：名称或状态清楚，无需替换。 |
| `loading.collections` | 正在加载集合… | 正在加载集合… | 保留：名称或状态清楚，无需替换。 |
| `loading.collection` | 正在加载集合详情… | 正在加载集合详情… | 保留：名称或状态清楚，无需替换。 |
| `loading.dashboard` | 正在加载洞察… | 正在加载洞察… | 保留：名称或状态清楚，无需替换。 |
| `loading.charts` | 正在加载图表… | 正在加载图表… | 保留：名称或状态清楚，无需替换。 |
| `loading.importExport` | 正在加载备份数据… | 正在加载备份数据… | 保留：名称或状态清楚，无需替换。 |

### theme

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `theme.light` | 浅色 | 浅色 | 保留：名称或状态清楚，无需替换。 |
| `theme.dark` | 深色 | 深色 | 保留：名称或状态清楚，无需替换。 |
| `theme.system` | 跟随系统 | 跟随系统 | 保留：名称或状态清楚，无需替换。 |
| `theme.toggle` | 切换主题 | 切换主题 | 保留：名称或状态清楚，无需替换。 |

### login

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `login.brandTagline` | 记住那些<br>曾对你重要的软件。 | 记住那些<br>曾对你重要的软件。 | 保留：名称或状态清楚，无需替换。 |
| `login.brandSubtitle` | 把 GitHub Stars 同步为由你掌控、私密且可检索的个人记忆。 | 同步 GitHub Stars。记下收藏原因。 | 压缩冗余，保留操作、对象与必要后果。 |
| `login.features.tagging` | 用集合整理 Star | 用集合整理 Star | 保留：名称或状态清楚，无需替换。 |
| `login.features.search` | 按仓库名称和描述搜索 | 按仓库名称和描述搜索 | 保留：名称或状态清楚，无需替换。 |
| `login.features.insights` | Star 仓库的可视化洞察 | 查看 Star 洞察 | 压缩冗余，保留操作、对象与必要后果。 |
| `login.features.privacy` | 自托管、开源、隐私优先 | 开源，可自行部署 | 压缩冗余，保留操作、对象与必要后果。 |
| `login.getStarted` | 开始使用 | 开始使用 | 保留：名称或状态清楚，无需替换。 |
| `login.connectPrompt` | 连接你的 GitHub 账号以同步 Star 仓库。 | 连接 GitHub，同步 Star 仓库。 | 压缩冗余，保留操作、对象与必要后果。 |
| `login.continueWithGitHub` | 使用 GitHub 继续 | 使用 GitHub 登录 | 明确点击后的登录动作。 |
| `login.minimalPermissions` | 仅需最小权限 | 仅需最小权限 | 保留：名称或状态清楚，无需替换。 |
| `login.scopesTitle` | 我们仅请求以下只读权限： | 仅读取以下公开信息： | 压缩冗余，保留操作、对象与必要后果。 |
| `login.scopeStars` | 你的 Star 仓库列表 | 你的 Star 仓库列表 | 保留：名称或状态清楚，无需替换。 |
| `login.scopeMetadata` | 公开仓库的元数据 | 公开仓库的元数据 | 保留：名称或状态清楚，无需替换。 |
| `login.scopeProfile` | 你的公开资料信息 | 你的公开资料 | 压缩冗余，保留操作、对象与必要后果。 |
| `login.privacyNote` | 无写权限，无私有仓库。数据留在你自己的服务器上。 | 不修改 GitHub 数据。不读取私有仓库。收藏数据存在你自己的服务器。使用 AI 时会发送相关内容。 | 压缩冗余，保留操作、对象与必要后果。 |

### nav

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `nav.browse` | 浏览 | 浏览 | 保留：名称或状态清楚，无需替换。 |
| `nav.collections` | 集合 | 集合 | 保留：名称或状态清楚，无需替换。 |
| `nav.dashboard` | 洞察 | 洞察 | 保留：名称或状态清楚，无需替换。 |
| `nav.importExport` | 导入 / 导出 | 导入 / 导出 | 保留两个实际操作，不能统称备份。 |
| `nav.settings` | 设置 | 设置 | 保留：名称或状态清楚，无需替换。 |

### topbar

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `topbar.searchPlaceholder` | 搜索仓库… | 搜索仓库… | 保留：名称或状态清楚，无需替换。 |
| `topbar.sync` | 同步 | 同步 | 保留：名称或状态清楚，无需替换。 |
| `topbar.openMenu` | 打开菜单 | 打开菜单 | 保留：名称或状态清楚，无需替换。 |
| `topbar.account` | 账号 | 账号 | 保留：名称或状态清楚，无需替换。 |
| `topbar.clearSearch` | 清除搜索 | 清除搜索 | 保留：名称或状态清楚，无需替换。 |

### filters

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `filters.language` | 语言 | 语言 | 保留：名称或状态清楚，无需替换。 |
| `filters.allLanguages` | 全部语言 | 全部语言 | 保留：名称或状态清楚，无需替换。 |
| `filters.topic` | Topic | Topic | 保留：开发者熟悉的准确名称。 |
| `filters.allTopics` | 全部 Topic | 全部 Topic | 保留：名称或状态清楚，无需替换。 |
| `filters.searchLanguages` | 搜索语言… | 搜索语言… | 保留：名称或状态清楚，无需替换。 |
| `filters.searchTopics` | 搜索 Topic… | 搜索 Topic… | 保留：名称或状态清楚，无需替换。 |
| `filters.searchCollections` | 搜索集合… | 搜索集合… | 保留：名称或状态清楚，无需替换。 |
| `filters.noResults` | 没有匹配项 | 没有匹配项 | 保留：名称或状态清楚，无需替换。 |
| `filters.showingTopResults` | 显示前 {{count}} 个常用选项，搜索可查看更多。 | 显示前 {{count}} 个常用选项。搜索可查看更多。 | 压缩冗余，保留操作、对象与必要后果。 |
| `filters.collections` | 集合 | 集合 | 保留：名称或状态清楚，无需替换。 |
| `filters.allCollections` | 全部集合 | 全部集合 | 保留：名称或状态清楚，无需替换。 |
| `filters.stars` | Star 数 | Star 数 | 保留：名称或状态清楚，无需替换。 |
| `filters.anyStars` | 不限 Star | 不限 Star | 保留：名称或状态清楚，无需替换。 |
| `filters.minStars` | {{value}}+ Star | {{value}}+ Star | 保留：名称或状态清楚，无需替换。 |
| `filters.pushed` | 更新时间 | 更新时间 | 保留：名称或状态清楚，无需替换。 |
| `filters.anyTime` | 不限时间 | 不限时间 | 保留：名称或状态清楚，无需替换。 |
| `filters.pushedWithin` | 近 {{value}} 天 | 近 {{value}} 天 | 保留：名称或状态清楚，无需替换。 |
| `filters.status` | 状态 | 状态 | 保留：名称或状态清楚，无需替换。 |
| `filters.statusAll` | 全部 | 全部 | 保留：名称或状态清楚，无需替换。 |
| `filters.statusActive` | 活跃 | 未归档 | 仅表示未归档，不能承诺活跃。 |
| `filters.statusArchived` | 已归档 | 已归档 | 保留：名称或状态清楚，无需替换。 |
| `filters.more` | 更多筛选 | 更多筛选 | 保留：名称或状态清楚，无需替换。 |
| `filters.sort` | 排序 | 排序 | 保留：名称或状态清楚，无需替换。 |
| `filters.sortStarred` | 最近收藏 | 最近收藏 | 保留：名称或状态清楚，无需替换。 |
| `filters.sortPushed` | 最近更新 | 最近更新 | 保留：名称或状态清楚，无需替换。 |
| `filters.sortStars` | Star 最多 | Star 最多 | 保留：名称或状态清楚，无需替换。 |
| `filters.sortName` | 名称（A–Z） | 名称（A–Z） | 保留：名称或状态清楚，无需替换。 |
| `filters.clear` | 清除筛选 | 清除筛选 | 保留：名称或状态清楚，无需替换。 |

### sync

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `sync.syncing` | 同步中… | 同步中… | 保留：名称或状态清楚，无需替换。 |
| `sync.success` | Star 列表已更新：当前 {{count}} 个，本次移入历史 {{historyCount}} 个 | Star 列表已更新。当前 {{count}} 个，移入历史 {{historyCount}} 个。 | 压缩冗余，保留操作、对象与必要后果。 |
| `sync.error` | 同步失败，请重试。 | 同步失败，请重试。 | 保留：名称或状态清楚，无需替换。 |
| `sync.noToken` | GitHub 会话已过期，请重新登录后再同步。 | GitHub 授权已过期。请重新连接后再同步。 | 压缩冗余，保留操作、对象与必要后果。 |
| `sync.reconnectAction` | 重新连接 GitHub | 重新连接 GitHub | 保留：名称或状态清楚，无需替换。 |
| `sync.reconnecting` | 连接中… | 连接中… | 保留：名称或状态清楚，无需替换。 |
| `sync.reconnectTitle` | GitHub 连接已过期 | GitHub 连接已过期 | 保留：名称或状态清楚，无需替换。 |
| `sync.reconnectDescription` | 重新连接后即可继续同步 Star。 | 重新连接后即可继续同步 Star。 | 保留：名称或状态清楚，无需替换。 |
| `sync.reconnectError` | 无法发起 GitHub 重新连接。 | 无法连接 GitHub，请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `sync.progress` | 正在同步 GitHub Stars… | 正在同步 GitHub Stars… | 保留：名称或状态清楚，无需替换。 |

### embeddings

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `embeddings.prepareTitle` | 按含义查找仓库 | 语义搜索 | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.discoveryDescription` | 即使搜索词不同，也能找到含义相关的仓库。 | 用不同说法，也能找到相关仓库。 | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.prepareDescription` | 一次下载约 120 MB。仓库元数据和你的 Memory 仅在当前浏览器处理，只有派生向量会写入受 RLS 保护的个人数据库。 | 首次下载约 120 MB。仓库元数据和个人记忆在本机处理。只将派生向量存入私人数据库。 | 保留下载成本、本机处理与派生向量存储边界。 |
| `embeddings.prepareAction` | 启用 | 启用 | 保留：名称或状态清楚，无需替换。 |
| `embeddings.prepareDismiss` | 暂不 | 暂不 | 保留：名称或状态清楚，无需替换。 |
| `embeddings.preparing` | 正在准备语义搜索 | 正在准备语义搜索… | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.checking` | 正在检查搜索准备状态… | 正在检查搜索状态… | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.downloading` | 正在下载并缓存搜索模型… | 正在下载搜索模型… | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.backfilling` | 正在准备第 {{completed}} / {{total}} 个仓库… | 正在准备仓库：{{completed}} / {{total}} | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.modelProgress` | 搜索模型下载进度 | 搜索模型下载进度 | 保留：名称或状态清楚，无需替换。 |
| `embeddings.backfillProgress` | 仓库准备进度 | 仓库准备进度 | 保留：名称或状态清楚，无需替换。 |
| `embeddings.backend` | 正在本地使用 {{backend}} 运行 | 本机运行方式：{{backend}} | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.degradedTitle` | 此设备尚未准备好智能搜索 | 语义搜索暂不可用 | 压缩冗余，保留操作、对象与必要后果。 |
| `embeddings.degradedDescription` | 关键词搜索仍可使用。可在此设备资源更充足时重试准备。 | 关键词搜索仍可使用。稍后可重试准备。 | 压缩冗余，保留操作、对象与必要后果。 |

### browse

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `browse.title` | 全部仓库 | 全部仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.count` | {{total}} 个 Star 仓库 | {{total}} 个 Star 仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.viewMode` | 仓库视图模式 | 视图切换 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.viewGrid` | 卡片视图 | 卡片视图 | 保留：名称或状态清楚，无需替换。 |
| `browse.viewList` | 列表视图 | 列表视图 | 保留：名称或状态清楚，无需替换。 |
| `browse.openDetails` | 打开 {{repo}} 的详情 | 打开 {{repo}} 的详情 | 保留：名称或状态清楚，无需替换。 |
| `browse.openOnGitHub` | 在 GitHub 打开 {{repo}} | 在 GitHub 打开 {{repo}} | 保留：名称或状态清楚，无需替换。 |
| `browse.moreContextLabel` | 还有 {{count}} 个集合或 Topic | 还有 {{count}} 个集合或 Topic | 保留：名称或状态清楚，无需替换。 |
| `browse.inCollections_one` | 已加入 {{count}} 个集合 | 已加入 {{count}} 个集合 | 保留：名称或状态清楚，无需替换。 |
| `browse.inCollections_other` | 已加入 {{count}} 个集合 | 已加入 {{count}} 个集合 | 保留：名称或状态清楚，无需替换。 |
| `browse.hasNote` | 已有笔记 | 已有笔记 | 保留：名称或状态清楚，无需替换。 |
| `browse.archived` | 已归档 | 已归档 | 保留：名称或状态清楚，无需替换。 |
| `browse.unstarred` | 已取消 Star | 已取消 Star | 保留：名称或状态清楚，无需替换。 |
| `browse.libraryView` | 资料库范围 | 资料库范围 | 保留：名称或状态清楚，无需替换。 |
| `browse.currentStars` | 当前 Star | 当前 Star | 保留：名称或状态清楚，无需替换。 |
| `browse.history` | 历史 | 历史 | 保留：名称或状态清楚，无需替换。 |
| `browse.historyEmptyTitle` | 还没有历史仓库 | 还没有历史仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.historyEmptyDescription` | 取消 Star 的仓库会保留在这里，笔记与集合也会继续保留。 | 取消 Star 的仓库保留在这里。笔记与集合也会保留。 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.currentEmptyTitle` | 当前没有 Star 仓库 | 当前没有 Star 仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.currentEmptyDescription` | 曾收藏的仓库仍保留在历史中。 | 曾收藏的仓库仍保留在历史中。 | 保留：名称或状态清楚，无需替换。 |
| `browse.stars` | Star 数 | Star 数 | 保留：开发者熟悉的准确名称。 |
| `browse.forks` | Fork 数 | Fork 数 | 保留：开发者熟悉的准确名称。 |
| `browse.updated` | 更新于 {{time}} | 更新于 {{time}} | 保留：名称或状态清楚，无需替换。 |
| `browse.updatedShort` | 更新于 | 更新于 | 保留：名称或状态清楚，无需替换。 |
| `browse.updatedCompact` | 更新 {{time}} | 更新 {{time}} | 保留：名称或状态清楚，无需替换。 |
| `browse.starred` | 收藏于 {{time}} | 收藏于 {{time}} | 保留：名称或状态清楚，无需替换。 |
| `browse.starredShort` | 收藏于 | 收藏于 | 保留：名称或状态清楚，无需替换。 |
| `browse.starredCompact` | 收藏 {{time}} | 收藏 {{time}} | 保留：名称或状态清楚，无需替换。 |
| `browse.emptyTitle` | 还没有 Star 仓库 | 还没有 Star 仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.emptyDescription` | 同步你的 GitHub Star 即可开始。我们会拉取你所有的 Star 仓库并在此整理。 | 同步 GitHub Stars，即可开始。 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.syncAction` | 同步 GitHub Stars | 同步 GitHub Stars | 保留：名称或状态清楚，无需替换。 |
| `browse.errorTitle` | 无法加载仓库 | 无法加载仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.errorDescription` | 加载你的仓库时出现问题。 | 请重试加载。 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.retry` | 重试 | 重试 | 保留：名称或状态清楚，无需替换。 |
| `browse.noResultsTitle` | 没有匹配的仓库 | 没有匹配的仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.noResultsDescription` | 试试调整筛选条件或搜索关键词。 | 试试调整筛选条件或搜索关键词。 | 保留：名称或状态清楚，无需替换。 |
| `browse.semanticSectionLabel` | 语义相关 | 语义相关 | 保留：名称或状态清楚，无需替换。 |
| `browse.matchReasons.whySaved` | 命中收藏原因 | 收藏原因匹配 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.matchReasons.note` | 命中笔记 | 笔记匹配 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.matchReasons.name` | 命中仓库名称 | 名称匹配 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.matchReasons.description` | 命中仓库描述 | 描述匹配 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.matchReasons.topic` | 命中主题：{{topic}} | Topic 匹配：{{topic}} | 与 Topic 筛选名称一致。 |
| `browse.matchReasons.semanticRepo` | 与仓库内容语义相近 | 与仓库内容语义相近 | 保留：名称或状态清楚，无需替换。 |
| `browse.matchReasons.additionalMatches` | 其他命中条件 | 更多匹配 | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.matchReasons.details` | 查看匹配详情：{{reason}} | 匹配详情：{{reason}} | 压缩冗余，保留操作、对象与必要后果。 |
| `browse.table.label` | 仓库列表 | 仓库列表 | 保留：名称或状态清楚，无需替换。 |
| `browse.table.repository` | 仓库 | 仓库 | 保留：名称或状态清楚，无需替换。 |
| `browse.table.language` | 语言 | 语言 | 保留：名称或状态清楚，无需替换。 |
| `browse.table.stars` | Star 数 | Star 数 | 保留：名称或状态清楚，无需替换。 |
| `browse.table.activity` | 动态 | 动态 | 保留：名称或状态清楚，无需替换。 |

### drawer

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `drawer.title` | 仓库详情 | 仓库详情 | 保留：名称或状态清楚，无需替换。 |
| `drawer.stars` | {{value}} Star | {{value}} Star | 保留：名称或状态清楚，无需替换。 |
| `drawer.forks` | {{value}} Fork | {{value}} Fork | 保留：名称或状态清楚，无需替换。 |
| `drawer.starLabel` | Star | Star | 保留：开发者熟悉的准确名称。 |
| `drawer.forkLabel` | Fork | Fork | 保留：开发者熟悉的准确名称。 |
| `drawer.relatedStars` | 相关收藏 | 相关收藏 | 保留：名称或状态清楚，无需替换。 |
| `drawer.relatedStarsDescription` | 在你的收藏库中与此仓库双向相关。 | 查找与你当前查看的仓库相关的收藏。 | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.openRelatedStar` | 打开相关仓库 {{repo}} | 打开相关仓库 {{repo}} | 保留：名称或状态清楚，无需替换。 |
| `drawer.searchCollections` | 搜索集合… | 搜索集合… | 保留：名称或状态清楚，无需替换。 |
| `drawer.collections` | 集合 | 集合 | 保留：名称或状态清楚，无需替换。 |
| `drawer.noCollections` | 还没有集合，请到「集合」页面创建。 | 还没有集合。请到集合页创建。 | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.memory` | 个人记忆 | 个人记忆 | 保留产品概念，已有四字名称。 |
| `drawer.whySaved` | 为什么收藏它 | 收藏原因 | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.whySavedPlaceholder` | 它为什么值得你记住？ | 当时为什么收藏它？ | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.note` | 笔记 | 笔记 | 保留：名称或状态清楚，无需替换。 |
| `drawer.notePlaceholder` | 补充细节、判断或提醒… | 补充细节、判断或提醒… | 保留：名称或状态清楚，无需替换。 |
| `drawer.notRecordedYet` | 尚未记录 | 尚未记录 | 保留：名称或状态清楚，无需替换。 |
| `drawer.noNoteYet` | 还没有笔记 | 还没有笔记 | 保留：名称或状态清楚，无需替换。 |
| `drawer.savedFromGitHub` | 通过 GitHub Stars 收藏于 {{time}} | 通过 GitHub Stars 收藏于 {{time}} | 保留：名称或状态清楚，无需替换。 |
| `drawer.savedFromGitHubWithoutTime` | 来自 GitHub Stars | 来自 GitHub Stars | 保留：名称或状态清楚，无需替换。 |
| `drawer.saveMemory` | 保存记忆 | 保存记忆 | 保留：名称或状态清楚，无需替换。 |
| `drawer.openOnGitHub` | 在 GitHub 打开 | 在 GitHub 打开 | 保留：名称或状态清楚，无需替换。 |
| `drawer.position` | {{current}} / {{total}} | {{current}} / {{total}} | 保留：名称或状态清楚，无需替换。 |
| `drawer.outsideSequence` | 不在当前结果中 | 不在当前结果中 | 保留：名称或状态清楚，无需替换。 |
| `drawer.previous` | 上一个仓库（K） | 上一个仓库（K） | 保留：名称或状态清楚，无需替换。 |
| `drawer.next` | 下一个仓库（J） | 下一个仓库（J） | 保留：名称或状态清楚，无需替换。 |
| `drawer.readReadme` | 阅读 README | 阅读 README | 保留：名称或状态清楚，无需替换。 |
| `drawer.addCollection` | 加入集合 | 加入集合 | 保留：名称或状态清楚，无需替换。 |
| `drawer.memorySaveError` | 无法保存这条记忆，两个字段的草稿仍为你保留。 | 保存失败，草稿已保留。请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.collectionUpdateError` | 无法更新此集合，已保留服务器状态。 | 集合修改失败，已恢复原状态。请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.unsavedTitle` | 要保存这条记忆的更改吗？ | 保存更改 | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.unsavedDescription` | 你的个人上下文还有未保存的更改。 | 收藏原因或笔记有未保存的更改。 | 压缩冗余，保留操作、对象与必要后果。 |
| `drawer.continueEditing` | 继续编辑 | 继续编辑 | 保留：名称或状态清楚，无需替换。 |
| `drawer.discardAndContinue` | 放弃更改 | 放弃更改 | 保留：名称或状态清楚，无需替换。 |
| `drawer.saveAndContinue` | 保存更改 | 保存更改 | 保留：名称或状态清楚，无需替换。 |

### readme

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `readme.backToBrowse` | 返回浏览 | 返回浏览 | 保留：名称或状态清楚，无需替换。 |
| `readme.backToCollection` | 返回 {{name}} | 返回 {{name}} | 保留：名称或状态清楚，无需替换。 |
| `readme.openOnGitHub` | 在 GitHub 打开 | 在 GitHub 打开 | 保留：名称或状态清楚，无需替换。 |
| `readme.loading` | 正在加载 README… | 正在加载 README… | 保留：名称或状态清楚，无需替换。 |
| `readme.outline` | 目录 | 目录 | 保留：名称或状态清楚，无需替换。 |
| `readme.outlineLabel` | README 目录 | README 目录 | 保留：名称或状态清楚，无需替换。 |
| `readme.closeOutline` | 关闭 README 目录 | 关闭 README 目录 | 保留：名称或状态清楚，无需替换。 |
| `readme.documentLabel` | {{repo}} 的 README | {{repo}} 的 README | 保留：名称或状态清楚，无需替换。 |
| `readme.notFoundTitle` | 此仓库没有 README | 此仓库没有 README | 保留：名称或状态清楚，无需替换。 |
| `readme.notFoundDescription` | 该仓库位于你的资料库中，但 GitHub 未返回 README。 | GitHub 未返回 README。 | 压缩冗余，保留操作、对象与必要后果。 |
| `readme.notInLibraryTitle` | 仓库不在你的资料库中 | 仓库尚未同步 | 压缩冗余，保留操作、对象与必要后果。 |
| `readme.notInLibraryDescription` | README 工作区仅适用于已同步到 Star 资料库的仓库。 | 只能阅读已同步仓库的 README。 | 压缩冗余，保留操作、对象与必要后果。 |
| `readme.rateLimitedTitle` | 已达到 GitHub 速率限制 | 请求过于频繁 | 压缩冗余，保留操作、对象与必要后果。 |
| `readme.rateLimitedDescription` | 请重新连接 GitHub，或前往 GitHub 继续查看。 | 重新连接 GitHub，或前往查看。 | 压缩冗余，保留操作、对象与必要后果。 |
| `readme.reconnectTitle` | 需要重新连接 GitHub | 需要重新连接 GitHub | 保留：名称或状态清楚，无需替换。 |
| `readme.reconnectDescription` | 重新连接 GitHub 后，再尝试加载此 README。 | 重新连接 GitHub 后再试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `readme.errorTitle` | 无法加载此 README | 无法加载此 README | 保留：名称或状态清楚，无需替换。 |
| `readme.errorDescription` | 请求暂时失败，你在 Asterism 中的位置不会改变。 | 请重试，或前往 GitHub 查看。 | 压缩冗余，保留操作、对象与必要后果。 |
| `readme.retry` | 重试 | 重试 | 保留：名称或状态清楚，无需替换。 |
| `readme.checkAgain` | 再次检查 | 再次检查 | 保留：名称或状态清楚，无需替换。 |
| `readme.corpusLab.title` | README corpus 实验室 | README corpus 实验室 | 开发样本，保留，不纳入生产改写。 |
| `readme.corpusLab.fixture` | 样本 | 样本 | 开发样本，保留，不纳入生产改写。 |
| `readme.corpusLab.themeLight` | 浅色 | 浅色 | 开发样本，保留，不纳入生产改写。 |
| `readme.corpusLab.themeDark` | 深色 | 深色 | 开发样本，保留，不纳入生产改写。 |
| `readme.corpusLab.skeleton` | 骨架屏 | 骨架屏 | 开发样本，保留，不纳入生产改写。 |
| `readme.corpusLab.skeletonLabel` | 正在加载 README corpus 样本 | 正在加载 README corpus 样本 | 开发样本，保留，不纳入生产改写。 |
| `readme.corpusLab.documentLabel` | {{title}} 文档 | {{title}} 文档 | 开发样本，保留，不纳入生产改写。 |

### collections

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `collections.title` | 集合 | 集合 | 保留：名称或状态清楚，无需替换。 |
| `collections.subtitle` | {{total}} 个集合 · 按项目或主题分组仓库 | {{total}} 个集合 · 按项目或主题分组仓库 | 保留：名称或状态清楚，无需替换。 |
| `collections.create` | 新建集合 | 新建集合 | 保留：名称或状态清楚，无需替换。 |
| `collections.createTitle` | 新建集合 | 新建集合 | 保留：名称或状态清楚，无需替换。 |
| `collections.editTitle` | 编辑集合 | 编辑集合 | 保留：名称或状态清楚，无需替换。 |
| `collections.repoCount` | {{value}} 个仓库 | {{value}} 个仓库 | 保留：名称或状态清楚，无需替换。 |
| `collections.nameLabel` | 名称 | 名称 | 保留：名称或状态清楚，无需替换。 |
| `collections.namePlaceholder` | 例如：Web 开发栈 | 例如：Web 开发栈 | 保留：名称或状态清楚，无需替换。 |
| `collections.descriptionLabel` | 描述 | 描述 | 保留：名称或状态清楚，无需替换。 |
| `collections.descriptionPlaceholder` | 这个集合是关于什么的？ | 用一句话介绍这个集合 | 压缩冗余，保留操作、对象与必要后果。 |
| `collections.emptyTitle` | 还没有集合 | 还没有集合 | 保留：名称或状态清楚，无需替换。 |
| `collections.emptyDescription` | 按项目或主题把 Star 仓库分组，便于更快找到它们。 | 按项目或主题分组，方便查找仓库。 | 压缩冗余，保留操作、对象与必要后果。 |
| `collections.searchPlaceholder` | 搜索集合… | 搜索集合… | 保留：名称或状态清楚，无需替换。 |
| `collections.noResults` | 没有匹配的集合。 | 没有匹配的集合。 | 保留：名称或状态清楚，无需替换。 |
| `collections.deleteTitle` | 删除「{{name}}」？ | 删除「{{name}}」？ | 保留：名称或状态清楚，无需替换。 |
| `collections.deleteDescription` | 仅删除该集合，不影响你的仓库与 Star。 | 仅删除集合。仓库与 Star 不受影响。 | 压缩冗余，保留操作、对象与必要后果。 |
| `collections.duplicateName` | 已存在同名集合。 | 已存在同名集合，请换一个名称。 | 压缩冗余，保留操作、对象与必要后果。 |
| `collections.saveError` | 无法保存此集合，你的修改仍在。请重试或取消。 | 保存失败，修改已保留。请重试或取消。 | 压缩冗余，保留操作、对象与必要后果。 |
| `collections.deleteError` | 无法删除此集合，请重试或取消。 | 删除失败，请重试或取消。 | 压缩冗余，保留操作、对象与必要后果。 |

### collectionDetail

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `collectionDetail.back` | 返回集合列表 | 返回集合 | 压缩冗余，保留操作、对象与必要后果。 |
| `collectionDetail.repoCount` | {{count}} 个仓库 | {{count}} 个仓库 | 保留：名称或状态清楚，无需替换。 |
| `collectionDetail.emptyTitle` | 集合内暂无仓库 | 还没有仓库 | 压缩冗余，保留操作、对象与必要后果。 |
| `collectionDetail.emptyDescription` | 可在 Browse 页打开仓库详情面板，将仓库加入此集合。 | 在浏览页打开仓库详情，加入此集合。 | 压缩冗余，保留操作、对象与必要后果。 |
| `collectionDetail.notFoundTitle` | 未找到集合 | 未找到集合 | 保留：名称或状态清楚，无需替换。 |
| `collectionDetail.notFoundDescription` | 该集合可能已被删除，或你没有访问权限。 | 集合可能已删除，或你无权查看。 | 压缩冗余，保留操作、对象与必要后果。 |

### dashboard

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `dashboard.title` | 洞察 | 洞察 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.subtitle` | Star 仓库的可视化概览 | 查看 Star 分布与收藏趋势 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.totalStars` | Star 总数 | Star 总数 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.languages` | 语言数 | 语言数 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.collectedRepos` | 已加入集合 | 已加入集合 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.collections` | 集合数 | 集合数 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.memoriesCount` | 个人记忆 | 个人记忆 | 统计有内容的个人记忆；保留产品名称。 |
| `dashboard.activeRate` | 活跃状态 | 未归档 | 数据按归档状态计算。 |
| `dashboard.createCollectionPrompt` | 建立集合，让 Star 更有序 | 整理 Star | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.createCollectionDescription` | 创建专属集合，按领域、技术栈或用途结构化分类你的开源资产。 | 按领域、技术栈或用途整理仓库。 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.goToCollections` | 前往集合 | 前往集合 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.archiveStatus` | 活跃 {{active}} · 归档 {{archived}} | 未归档 {{active}} · 已归档 {{archived}} | 与筛选的状态术语一致。 |
| `dashboard.reposCount` | {{count}} 个 | {{count}} 个 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.languageDistribution` | 语言分布 | 语言分布 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.starredTrend` | 收藏趋势 | 收藏趋势 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.topTopics` | 热门 Topic | 常见 Topic | 表示个人库频次，不是全站热门。 |
| `dashboard.archiveAndTags` | 活跃状态与集合 | 归档与集合 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.topCollections` | 集合使用 Top 5 | 常用集合 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.noData` | 数据不足 | 数据不足 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.noCollections` | 还没有使用中的集合 | 还没有仓库加入集合 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.emptyTitle` | 暂无 Star 可分析 | 暂无 Star 可分析 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.emptyDescription` | 同步 GitHub Stars 后即可查看洞察。 | 同步 GitHub Stars 后即可查看洞察。 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.errorTitle` | 无法加载洞察 | 无法加载洞察 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.errorDescription` | 加载数据时出错，请稍后重试。 | 请稍后重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.resurface.title` | 记忆唤醒 | 重温收藏 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.resurface.description` | 让沉睡的 Star 带着曾经记录的上下文重新出现。 | 回看以前的 Star 和个人记忆。 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.resurface.loadError` | 个人记忆加载失败，暂时无法唤醒任何内容。 | 个人记忆加载失败，请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.resurface.worthRemembering` | 值得重温 | 值得重温 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.missingContext` | 待补全记忆 | 补写原因 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.resurface.reasons.anniversary_one` | {{count}} 年前的今天收藏 | {{count}} 年前的今天收藏 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.reasons.anniversary_other` | {{count}} 年前的今天收藏 | {{count}} 年前的今天收藏 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.reasons.dormant` | 已沉睡 {{duration}} 未重温 | 收藏已 {{duration}} | 没有重温行为数据，陈述收藏时长。 |
| `dashboard.resurface.reasons.noted` | 记录过笔记 | 记录过笔记 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.reasons.repoQuiet` | 仓库已 {{duration}} 未更新 | 仓库已 {{duration}} 未更新 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.reasons.missingWhySaved` | 尚未记录收藏原因 | 尚未记录收藏原因 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.reasons.notedWithoutReason` | 有笔记，但缺少收藏原因 | 有笔记，但缺少收藏原因 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.reasons.highValue` | {{value}} Star | {{value}} Star | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.echoWhySaved` | 收藏原因 | 收藏原因 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.echoNote` | 你的笔记 | 你的笔记 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.addWhySaved` | 补写收藏原因 | 补写原因 | 压缩冗余，保留操作、对象与必要后果。 |
| `dashboard.resurface.useful` | 很有用 | 很有用 | 保留：名称或状态清楚，无需替换。 |
| `dashboard.resurface.dismiss` | 暂不提醒 | 暂不提醒 | 保留：名称或状态清楚，无需替换。 |

### importExport

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `importExport.title` | 导入 / 导出 | 导入 / 导出 | 保留：名称或状态清楚，无需替换。 |
| `importExport.subtitle` | 备份或迁移集合与个人记忆 | 备份或迁移集合与个人记忆 | 保留：名称或状态清楚，无需替换。 |
| `importExport.exportTitle` | 导出数据 | 导出数据 | 保留：名称或状态清楚，无需替换。 |
| `importExport.exportDescription` | 根据文件的后续用途选择导出格式。 | 按用途选择导出格式。 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.importTitle` | 恢复备份 | 恢复备份 | 保留：名称或状态清楚，无需替换。 |
| `importExport.importDescription` | 为当前账号已同步的仓库恢复集合与个人记忆，不会新增 Star 或仓库。 | 仅恢复已同步仓库的集合和个人记忆。不新增仓库或 Star。 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.format.json` | JSON | JSON | 保留：名称或状态清楚，无需替换。 |
| `importExport.format.csv` | CSV | CSV | 保留：名称或状态清楚，无需替换。 |
| `importExport.format.markdown` | Markdown | Markdown | 保留：名称或状态清楚，无需替换。 |
| `importExport.formatDescription.json` | 完整的 Asterism 备份，包含仓库、集合、成员关系与个人记忆，之后可恢复到 Asterism。 | 完整备份，含集合关系和个人记忆。可导入 Asterism 恢复。 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.formatDescription.csv` | 适合用电子表格处理的仓库清单，仅包含仓库元数据，无法恢复到 Asterism。 | 仓库元数据清单，可用表格处理。不能用于恢复。 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.formatDescription.markdown` | 按集合整理的可读归档，包含仓库链接与个人记忆，无法恢复到 Asterism。 | 含仓库链接、集合和个人记忆。适合阅读，不能恢复。 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.downloadFormat` | 下载 {{format}} | 下载 {{format}} | 保留：名称或状态清楚，无需替换。 |
| `importExport.uploadPrompt` | 选择 Asterism JSON 备份 | 选择 Asterism JSON 备份 | 保留：名称或状态清楚，无需替换。 |
| `importExport.uploadHint` | 或拖拽到此处 · Asterism 导出（.json） | 或拖入导出的 JSON 文件 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.restoring` | 正在恢复备份… | 正在恢复备份… | 保留：名称或状态清楚，无需替换。 |
| `importExport.emptyTitle` | 暂无可导出数据 | 暂无可导出数据 | 保留：名称或状态清楚，无需替换。 |
| `importExport.emptyDescription` | 请先同步 Star，再导出集合与个人记忆。 | 请先同步 Star，再导出数据。 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.invalidFile` | 请上传 JSON 文件 | 请上传 JSON 文件 | 保留：名称或状态清楚，无需替换。 |
| `importExport.importSuccess` | 导入完成 | 导入完成 | 保留：名称或状态清楚，无需替换。 |
| `importExport.importSummary` | {{collections}} 个集合、{{collectionRepos}} 条成员关系、{{memories}} 条个人记忆 | 集合 {{collections}} 个。集合关系 {{collectionRepos}} 条。个人记忆 {{memories}} 条。 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.importSkipped` | 部分项已跳过 | 部分项已跳过 | 保留：名称或状态清楚，无需替换。 |
| `importExport.importPartial` | 导入完成但存在错误 | 部分导入失败 | 压缩冗余，保留操作、对象与必要后果。 |
| `importExport.importFailed` | 导入失败 | 导入失败 | 保留：名称或状态清楚，无需替换。 |
| `importExport.errors.INVALID_JSON` | JSON 文件无效 | JSON 文件无效 | 保留：名称或状态清楚，无需替换。 |
| `importExport.errors.INVALID_SCHEMA` | 无法识别的导出格式 | 无法识别的导出格式 | 保留：名称或状态清楚，无需替换。 |
| `importExport.errors.UNSUPPORTED_VERSION` | 不支持的导出版本 | 不支持的导出版本 | 保留：名称或状态清楚，无需替换。 |

### bulk

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `bulk.select` | 选择仓库 | 选择仓库 | 保留：名称或状态清楚，无需替换。 |
| `bulk.modeTitle` | 正在选择仓库 | 选择仓库 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.toolbarLabel` | 仓库选择控件 | 批量选择 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.selectRepo` | 选择 {{repo}} | 选择 {{repo}} | 保留：名称或状态清楚，无需替换。 |
| `bulk.deselectRepo` | 取消选择 {{repo}} | 取消选择 {{repo}} | 保留：名称或状态清楚，无需替换。 |
| `bulk.selectedCount` | 已选择 {{count}} 个 | 已选择 {{count}} 个 | 保留：名称或状态清楚，无需替换。 |
| `bulk.hiddenSelectedCount` | {{count}} 个已被筛选隐藏 | {{count}} 个所选仓库被筛选隐藏 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.selectAll` | 全选 {{count}} 个仓库 | 全选 {{count}} 个仓库 | 保留：名称或状态清楚，无需替换。 |
| `bulk.selectAllFiltered` | 全选当前筛选的 {{count}} 个 | 全选当前筛选的 {{count}} 个 | 保留：名称或状态清楚，无需替换。 |
| `bulk.addAll` | 添加全部 {{count}} 个仓库 | 添加全部 {{count}} 个仓库 | 保留：名称或状态清楚，无需替换。 |
| `bulk.addAllFiltered` | 添加当前筛选的 {{count}} 个 | 添加当前筛选的 {{count}} 个 | 保留：名称或状态清楚，无需替换。 |
| `bulk.deselectAll` | 取消选择全部 {{count}} 个仓库 | 取消选择全部 {{count}} 个仓库 | 保留：名称或状态清楚，无需替换。 |
| `bulk.deselectAllFiltered` | 取消选择当前筛选的 {{count}} 个 | 取消选择当前筛选的 {{count}} 个 | 保留：名称或状态清楚，无需替换。 |
| `bulk.clear` | 清空 | 清空 | 保留：名称或状态清楚，无需替换。 |
| `bulk.organize` | 批量整理 | 批量整理 | 保留：名称或状态清楚，无需替换。 |
| `bulk.moreActions` | 更多操作 | 更多操作 | 保留：名称或状态清楚，无需替换。 |
| `bulk.export.action` | 导出 | 导出 | 保留：名称或状态清楚，无需替换。 |
| `bulk.export.title` | 导出所选仓库 | 导出所选 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.export.description` | 导出选中的 {{count}} 个仓库及其最新的集合与个人记忆，不会改动任何数据。 | 导出 {{count}} 个仓库及集合、个人记忆。原数据不变。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.export.download` | 下载 {{format}} | 下载 {{format}} | 保留：名称或状态清楚，无需替换。 |
| `bulk.export.error` | 无法生成导出文件。你的选择仍保留在此处；请重试。 | 导出失败，选择已保留。请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.export.retry` | 重试 | 重试 | 保留：名称或状态清楚，无需替换。 |
| `bulk.export.formatDescription.json` | 可恢复的部分备份，重新导入会合并这些仓库的集合、成员关系与个人记忆，不会删除其它内容。 | 所选仓库的备份，含集合和个人记忆。导入时合并，不删除其他内容。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.export.formatDescription.csv` | 适合用电子表格处理的所选仓库清单，仅含元数据，无法恢复到 Asterism。 | 所选仓库的元数据清单。可用表格处理，不能恢复。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.export.formatDescription.markdown` | 所选仓库的可读归档，包含其集合与个人记忆，无法恢复到 Asterism。 | 含所选仓库的集合和个人记忆。适合阅读，不能恢复。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.dialogTitle` | 整理所选仓库 | 批量整理 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.dialogDescription` | 确认固定的 {{count}} 个仓库范围，然后选择集合变更。 | 已选 {{count}} 个仓库。选择要加入或移出的集合。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.collections` | 集合 | 集合 | 保留：名称或状态清楚，无需替换。 |
| `bulk.noCollections` | 请先创建集合，再使用批量整理。 | 请先创建集合，再批量整理。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.actionFor` | {{name}} 的变更 | {{name}} 的操作 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.noChange` | 不更改 | 不更改 | 保留：名称或状态清楚，无需替换。 |
| `bulk.add` | 添加 | 添加 | 保留：名称或状态清楚，无需替换。 |
| `bulk.remove` | 移除 | 移除 | 保留：名称或状态清楚，无需替换。 |
| `bulk.confirm` | 应用到 {{count}} 个仓库 | 应用到 {{count}} 个仓库 | 保留具体受影响范围。 |
| `bulk.applying` | 正在应用变更… | 整理中… | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.createError` | 无法创建批量操作。你的选择和变更仍保留在此处；请重试或取消。 | 整理失败，选择和修改已保留。请重试或取消。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.actionError` | 无法更新批量操作，已保存的进度未改变；请重试。 | 操作失败，已保存的进度不变。请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.retry` | 重试失败变更 | 重试失败项 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.continue` | 继续 | 继续 | 保留：名称或状态清楚，无需替换。 |
| `bulk.endOperation` | 结束操作 | 结束操作 | 保留：名称或状态清楚，无需替换。 |
| `bulk.terminalExplanation` | 仓库或目标已不再归你所有或不可用，这些变更无法原样重试。 | 部分仓库或集合已不可用。这些修改无法重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.status.running` | 正在应用整理变更 | 正在整理… | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.status.needsAttention` | 批量整理需要处理 | 部分未完成 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.status.completed` | 批量整理已完成 | 整理完成 | 压缩冗余，保留操作、对象与必要后果。 |
| `bulk.result.success` | {{count}} 项成功 | {{count}} 项成功 | 保留：名称或状态清楚，无需替换。 |
| `bulk.result.pending` | {{count}} 项待处理 | {{count}} 项待处理 | 保留：名称或状态清楚，无需替换。 |
| `bulk.result.retryable` | {{count}} 项可重试 | {{count}} 项可重试 | 保留：名称或状态清楚，无需替换。 |
| `bulk.result.terminal` | {{count}} 项已终止 | {{count}} 项无法重试 | 压缩冗余，保留操作、对象与必要后果。 |

### ask

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `ask.openMenu` | 打开 Ask Asterism | 打开 Ask Asterism | 保留：名称或状态清楚，无需替换。 |
| `ask.title` | Ask Asterism | Ask Asterism | 保留：名称或状态清楚，无需替换。 |
| `ask.description` | 就你保存过的项目提问；回答只依据你的个人收藏。 | 回答仅依据你的个人收藏。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.placeholder` | Ask Asterism… | Ask Asterism… | 保留：名称或状态清楚，无需替换。 |
| `ask.questionLabel` | 你的问题 | 你的问题 | 保留：名称或状态清楚，无需替换。 |
| `ask.submit` | 提问 | 提问 | 保留：名称或状态清楚，无需替换。 |
| `ask.submitNow` | 立即提问 | 立即提问 | 保留：名称或状态清楚，无需替换。 |
| `ask.emptyHint` | 用日常语言提问即可，会同时检索你的 Memory 笔记与仓库元数据。 | 描述你的需求，查找相关 Star。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.speakerYou` | 我 | 我 | 保留：名称或状态清楚，无需替换。 |
| `ask.speakerAsterism` | Asterism | Asterism | 保留：名称或状态清楚，无需替换。 |
| `ask.needsSetupTitle` | Ask 需要配置 Provider key | 配置 API Key | 直接说明缺少 API Key；不为四字限制隐去关键配置。 |
| `ask.needsSetupDescription` | 回答由你自己的 OpenAI 兼容 key（OpenAI / DeepSeek）基于个人收藏生成；key 只保存在此浏览器。 | 支持 OpenAI、DeepSeek。填写 API Key 后即可提问。API Key 只存于此浏览器。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.openSettings` | 打开设置 | 打开设置 | 保留：名称或状态清楚，无需替换。 |
| `ask.switchModel` | 切换模型 | 切换模型 | 保留：名称或状态清楚，无需替换。 |
| `ask.setupModel` | 配置模型 | 配置模型 | 保留：名称或状态清楚，无需替换。 |
| `ask.manageConnections` | 管理连接… | 管理连接… | 保留：名称或状态清楚，无需替换。 |
| `ask.recalling` | 正在检索你的收藏… | 正在检索你的收藏… | 保留：名称或状态清楚，无需替换。 |
| `ask.generating` | 正在生成回答… | 正在生成回答… | 保留：名称或状态清楚，无需替换。 |
| `ask.filtering` | 正在筛选你的收藏… | 正在筛选你的收藏… | 保留：名称或状态清楚，无需替换。 |
| `ask.searching` | 正在检索你的收藏… | 正在检索你的收藏… | 保留：名称或状态清楚，无需替换。 |
| `ask.expanding` | 正在读取仓库详情… | 正在读取仓库详情… | 保留：名称或状态清楚，无需替换。 |
| `ask.budgetExhausted` | 已经找到一部分证据，但这次先停在这里。想继续深入可以再点一次。 | 已找到部分证据。点击“继续深入”查找更多。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.continueExploring` | 继续深入 | 继续深入 | 保留：名称或状态清楚，无需替换。 |
| `ask.stopGenerating` | 停止生成 | 停止生成 | 保留：名称或状态清楚，无需替换。 |
| `ask.expandThread` | 展开对话 | 展开对话 | 保留：名称或状态清楚，无需替换。 |
| `ask.collapseThread` | 收起对话 | 收起对话 | 保留：名称或状态清楚，无需替换。 |
| `ask.resetThread` | 开启新对话 | 新建对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.notFound` | 你的收藏库中未找到匹配的项目。 | 你的收藏库中未找到匹配的项目。 | 保留：名称或状态清楚，无需替换。 |
| `ask.errorRetryable` | 回答生成失败，请检查网络后重试。 | 回答生成失败，请检查网络后重试。 | 保留：名称或状态清楚，无需替换。 |
| `ask.errorTimeout` | Provider 响应超时，请重试。 | Provider 响应超时，请重试。 | 保留：名称或状态清楚，无需替换。 |
| `ask.errorInvalidKey` | Provider 拒绝了这个 API key，请在设置中检查。 | API Key 被拒绝。请在设置中检查。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.errorProviderRejected` | Provider 拒绝了请求，请在设置中检查模型名。 | Provider 拒绝请求。请在设置中检查模型 ID。 | 保留 Provider 和模型 ID；不承诺请求拒绝的具体原因。 |
| `ask.provider.deepseek` | DeepSeek | DeepSeek | 保留：名称或状态清楚，无需替换。 |
| `ask.provider.openai` | OpenAI | OpenAI | 保留：名称或状态清楚，无需替换。 |
| `ask.provider.groq` | Groq | Groq | 保留：名称或状态清楚，无需替换。 |
| `ask.provider.openrouter` | OpenRouter | OpenRouter | 保留：名称或状态清楚，无需替换。 |
| `ask.commands.history` | /history 历史会话 | /history 历史对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.commands.historyDesc` | 查看并继续最近 7 天的会话 | 查看并继续最近 7 天的对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.commands.new` | /new 新对话 | /new 新建对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.commands.newDesc` | 开启全新会话，保存当前对话 | 保存当前对话，开始新对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.title` | 历史会话 | 历史对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.sessionCount_one` | {{count}} 场会话 | {{count}} 次对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.sessionCount_other` | {{count}} 场会话 | {{count}} 次对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.backToChat` | 返回当前对话 | 返回对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.clearAll` | 清空全部 | 清空全部 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.clearAllConfirmTitle` | 清空所有历史会话？ | 清空历史 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.clearAllConfirmDesc` | 这会清除本地保存的所有问答记录，此操作不可撤销。 | 删除此浏览器的全部问答记录。删除后无法恢复。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.confirmClear` | 确认清空 | 清空记录 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.cancel` | 取消 | 取消 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.searchPlaceholder` | 搜索历史会话… (Esc 返回) | 搜索历史对话…（Esc 返回） | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.emptyTitle` | 暂无历史会话 | 还没有历史对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.emptyDescription` | 最近 7 天的问答分析将保存在这里。 | 这里保留最近 7 天的问答记录。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.noResultsTitle` | 未找到匹配会话 | 未找到对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.noResultsDescription` | 尝试其他关键词或按 Esc 返回当前对话。 | 换个关键词，或按 Esc 返回。 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.activeBadge` | 当前 | 当前 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.deleteAria` | 删除此条会话 | 删除这次对话 | 压缩冗余，保留操作、对象与必要后果。 |
| `ask.history.turnCount_one` | {{count}} 轮 | {{count}} 轮 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.turnCount_other` | {{count}} 轮 | {{count}} 轮 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.recommendationCount_one` | {{count}} 个推荐 | {{count}} 个推荐 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.recommendationCount_other` | {{count}} 个推荐 | {{count}} 个推荐 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.justNow` | 刚刚 | 刚刚 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.minutesAgo` | {{count}} 分钟前 | {{count}} 分钟前 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.hoursAgo` | {{count}} 小时前 | {{count}} 小时前 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.yesterday` | 昨天 | 昨天 | 保留：名称或状态清楚，无需替换。 |
| `ask.history.daysAgo` | {{count}} 天前 | {{count}} 天前 | 保留：名称或状态清楚，无需替换。 |

### settings

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `settings.title` | 设置 | 设置 | 保留：名称或状态清楚，无需替换。 |
| `settings.appearance` | 外观 | 外观 | 保留：名称或状态清楚，无需替换。 |
| `settings.theme` | 主题 | 主题 | 保留：名称或状态清楚，无需替换。 |
| `settings.themeDescription` | 在跟随系统、浅色与深色之间选择。 | 选择跟随系统、浅色或深色。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.language` | 语言 | 语言 | 保留：名称或状态清楚，无需替换。 |
| `settings.languageDescription` | 切换界面语言。 | 切换界面语言。 | 保留：名称或状态清楚，无需替换。 |
| `settings.search` | 搜索 | 搜索 | 保留：名称或状态清楚，无需替换。 |
| `settings.semanticSearch` | 语义搜索 | 语义搜索 | 成熟技术名称；用说明解释收益。 |
| `settings.semanticSearchDescription` | 按含义查找仓库；仓库元数据和你的 Memory 在本地处理，只有派生向量会写入你自己的私有数据库。 | 按含义查找仓库。仓库元数据和个人记忆在本机处理。只将派生向量存入私人数据库。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.enableSemanticSearch` | 启用语义搜索 | 启用语义搜索 | 保留：名称或状态清楚，无需替换。 |
| `settings.preparingSearch` | 正在准备 {{progress}}% | 正在准备 {{progress}}% | 保留：名称或状态清楚，无需替换。 |
| `settings.searchReady` | 已就绪 | 已就绪 | 保留：名称或状态清楚，无需替换。 |
| `settings.searchNeedsAttention` | 需要处理 | 需要处理 | 保留：名称或状态清楚，无需替换。 |
| `settings.semanticSearchNeedsRepositories` | 先同步 Star 仓库，再启用语义搜索。 | 先同步 Star 仓库，再启用语义搜索。 | 保留：名称或状态清楚，无需替换。 |
| `settings.rebuildSearch` | 重建索引 | 重建索引 | 准确说明维护动作。 |
| `settings.rebuildSearchPending` | 重建中 | 重建中 | 保留：名称或状态清楚，无需替换。 |
| `settings.retrySearchPending` | 重试中 | 重试中 | 保留：名称或状态清楚，无需替换。 |
| `settings.clearSearchModel` | 清理模型 | 清理模型 | 保留：名称或状态清楚，无需替换。 |
| `settings.clearSearchModelTitle` | 清理语义搜索模型？ | 清理语义搜索模型？ | 保留：名称或状态清楚，无需替换。 |
| `settings.clearSearchModelDescription` | 这会移除本地模型和派生的搜索索引。关键词搜索不受影响，你之后仍可重新启用语义搜索。 | 删除本地模型及已保存的搜索索引。关键词搜索不受影响。以后可重新启用语义搜索。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.searchActionError` | 无法更新搜索设置，请重试。 | 无法更新搜索设置，请重试。 | 保留：名称或状态清楚，无需替换。 |
| `settings.account` | 账号 | 账号 | 保留：名称或状态清楚，无需替换。 |
| `settings.connectedVia` | 通过 GitHub OAuth 连接 | 通过 GitHub OAuth 连接 | 保留：名称或状态清楚，无需替换。 |
| `settings.ask` | Ask Asterism | Ask Asterism | 保留：名称或状态清楚，无需替换。 |
| `settings.askDescription` | 配置你自己的 OpenAI 兼容 key，即可基于个人收藏回答问题；key 只保存在此浏览器。 | 使用你的 API Key 回答问题。API Key 只存于此浏览器。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.askConfigured` | 已就绪 | 已就绪 | 保留：名称或状态清楚，无需替换。 |
| `settings.askNotConfigured` | 未配置 | 未配置 | 保留：名称或状态清楚，无需替换。 |
| `settings.askConsentTitle` | 允许 Ask 向 {{provider}} 发送上下文 | 数据授权 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.askConsentDescription` | 作答时，Asterism 会把你的问题和整份收藏库目录（名称、语言、topics、描述）发送给 {{provider}}。私有 Memory 笔记只在助手展开某个仓库时按需发送。你的 key 只保存在此浏览器，且仅随本次请求转发。 | 作答时向 {{provider}} 发送问题。每次发送完整 Star 目录。目录含名称、语言、Topics 和描述。启用“包含笔记”后，按需发送。内容包括收藏原因和笔记。API Key 只存于此浏览器。请求时转发给所选 Provider。 | 完整目录与按需笔记区分，并保留 API Key 边界。 |
| `settings.askConsentConfirm` | 我了解，保存 | 同意保存 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.title` | 生成连接 | AI 连接 | 连接承载问答和速读，名称覆盖用途。 |
| `settings.ai.description` | 自带 OpenAI 兼容 key。key 只保存在此浏览器，且只转发给你选择的 Provider。 | 使用你自己的 API Key。仅保存在此浏览器。只转发给所选 Provider。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.addConnection` | 添加连接 | 添加连接 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.emptyTitle` | 还没有连接 | 还没有连接 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.emptyDescription` | 连接一个 AI Provider，即可为你的收藏启用 Ask Asterism 问答。 | 连接 Provider。为 Star 启用问答。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.test` | 测试 | 测试 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.enable` | 启用 | 启用 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.disable` | 禁用 | 禁用 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.createTitle` | 添加连接 | 添加连接 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.editTitle` | 编辑连接 | 编辑连接 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.saveError` | 无法保存此连接，你的修改仍在。请重试或取消。 | 保存失败，修改已保留。请重试或取消。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.deleteTitle` | 删除「{{name}}」？ | 删除「{{name}}」？ | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.deleteDescription` | 将删除该连接及其存储的 key，任何使用它的偏好设置都会被清除。 | 删除连接及其 API Key。相关偏好设置也会清除。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.deleteError` | 无法删除此连接，请重试或取消。 | 删除失败，请重试或取消。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testError` | 无法连接该 Provider，请检查 key 与模型后重试。 | 连接失败。请检查 API Key 和模型 ID。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.settingsError` | 无法保存你的偏好设置，请重试。 | 偏好保存失败，请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.lifecycleError` | 无法更改此连接的状态，请重试。 | 状态修改失败，请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.loadError` | 无法加载你的生成连接。 | 连接加载失败，请重试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.adapters.deepseek` | DeepSeek | DeepSeek | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.adapters.openai` | OpenAI | OpenAI | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.adapters.groq` | Groq | Groq | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.adapters.openrouter` | OpenRouter | OpenRouter | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.status.valid` | 有效 | 有效 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.status.invalid` | 无效 | 无效 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.status.untested` | 未测试 | 未测试 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.status.disabled` | 已禁用 | 已禁用 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.activeConnectionLabel` | 活跃连接 | 当前连接 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.activeConnectionNone` | 无 | 无 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.modelLabel` | 模型 | 模型 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.modelPlaceholder` | 例如：deepseek-chat | 例如：deepseek-chat | 保留：输入格式与实际配置一致。 |
| `settings.ai.modelHint` | 固定为该连接通过测试时使用的模型。 | 使用该连接测试通过的模型。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.modelSelectHint` | Ask Asterism 问答使用的默认模型；也可在底部输入框实时切换。 | 问答默认使用此模型。也可在输入框切换。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.modelUntested` | 测试连接后设定模型 | 测试连接后设定模型 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testConnection` | 测试连接 | 测试连接 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testingConnection` | 测试中… | 测试中… | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.retest` | 重新测试 | 重新测试 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testConnectionDescription` | 测试连通性并发现可用模型 | 检查连接，获取可用模型。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testSuccessModels` | 连接测试通过，已发现 {{count}} 个可用模型 | 连接测试通过，已发现 {{count}} 个可用模型 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testMustPassBeforeAdd` | 添加前请先测试连接有效性 | 测试通过后才能添加。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.discoveredModelsCount` | 已发现 {{count}} 个可用模型 | 已发现 {{count}} 个可用模型 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.discoverModels` | 发现模型 | 获取模型 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.discoveringModels` | 发现中… | 获取中… | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.discoveredModels` | 已发现的模型 | 可用模型 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.chooseDiscoveredModel` | 选择已发现的模型 | 选择模型 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.discoveryUnavailable` | 此连接无法发现模型，请手动输入模型 ID。 | 无法获取模型。请手动输入模型 ID。 | 保留模型 ID，给出真实恢复路径。 |
| `settings.ai.manualModelHint` | 选择已发现的模型，或手动输入模型 ID。 | 选择可用模型，或输入模型 ID。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.digestModelLabel` | 速读使用模型 | 速读模型 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.digestModelDescription` | 单仓库核心速读默认使用的 AI 模型。 | 选择仓库速读使用的模型。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.digestModelPlaceholder` | 选择速读模型 | 选择速读模型 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.digestModelEmpty` | 暂无可用模型，请先添加并测试通过 AI 连接 | 请先添加连接，并通过测试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.includeNotesLabel` | 在 Ask 上下文中包含笔记 | 包含笔记 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.includeNotesDescription` | 开启后，只有助手展开某个仓库时才会把私密笔记发送给 {{provider}}。同意出网后，Ask 始终会发送整份收藏目录（名称、语言、topics、描述）。 | 按需向 {{provider}} 发送个人记忆。内容包括收藏原因和笔记。关闭后仍发送完整 Star 目录。目录含名称、语言、Topics 和描述。 | 开关只控制个人记忆，不控制 Star 目录。 |
| `settings.ai.includeNotesUnavailable` | 请先添加并验证一个有效的 AI 连接，再包含私密笔记。 | 请先添加连接，并通过测试。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.toggleOff` | 关 | 关 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.toggleOn` | 开 | 开 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.providerLabel` | Provider | Provider | 保留：开发者熟悉的准确名称。 |
| `settings.ai.nameLabel` | 名称 | 名称 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.namePlaceholder` | 例如：我的 DeepSeek | 例如：我的 DeepSeek | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.apiKeyLabel` | API key | API Key | 仅规范大小写，保留 API Key。 |
| `settings.ai.apiKeyPlaceholder` | sk-•••••••••••••••• | sk-•••••••••••••••• | 保留：输入格式与实际配置一致。 |
| `settings.ai.apiKeyKeep` | 留空则保留当前 key | 留空保留原 API Key | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.apiKeyHint` | 仅保存在此浏览器；只转发给你选择的 Provider。 | 仅保存在此浏览器。只转发给所选 Provider。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testTitle` | 测试「{{name}}」 | 测试「{{name}}」 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testDescription` | 发送一个最小请求，确认 key 与模型可用。 | 发送一次请求。检查 API Key 和模型是否可用。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testValid` | 连接有效，返回了预期的格式。 | 测试通过，返回内容可用。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testInvalid` | Provider 拒绝了请求，或返回了非预期的格式。 | 请求被拒绝，或返回内容不可用。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.lastTest` | 最近测试：{{model}} · {{result}} · {{date}} | 最近测试：{{model}} · {{result}} · {{date}} | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.unknownModel` | 未知模型 | 未知模型 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.unknownTestTime` | 未知时间 | 未知时间 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testPassedShort` | 已通过 | 已通过 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testReasons.unauthorized` | Provider 拒绝了该凭据。 | API Key 被拒绝，请检查。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testReasons.blocked` | 实例安全策略阻止了该接口地址。 | 安全策略阻止了此接口地址。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testReasons.format` | Provider 返回的响应无法用于 Ask。 | 返回内容无法用于 Ask。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.testReasons.network` | 无法连接 Provider，或 Provider 返回了上游错误。 | 无法连接，或 Provider 服务出错。 | 压缩冗余，保留操作、对象与必要后果。 |
| `settings.ai.runTest` | 开始测试 | 开始测试 | 保留：名称或状态清楚，无需替换。 |
| `settings.ai.testing` | 测试中… | 测试中… | 保留：名称或状态清楚，无需替换。 |

### digest

| 键 | 原文案 | 新文案 | 判断 |
| --- | --- | --- | --- |
| `digest.title` | 仓库核心速读 | 仓库速读 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.compactTitle` | 核心速读 | 仓库速读 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.subtitle` | 提炼一句话定位、核心痛点与适用场景 | 了解主要功能、解决的问题与适用场景。 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.generate` | 生成速读 | 生成速读 | 保留：名称或状态清楚，无需替换。 |
| `digest.regenerate` | 重新生成 | 重新生成 | 保留：名称或状态清楚，无需替换。 |
| `digest.generating` | 正在提炼 README 核心要点… | 正在提炼 README 核心要点… | 生成动作与 README 对象准确，保留。 |
| `digest.unconfiguredHint` | 配置 AI 密钥后即可一键生成结构化速读 | 配置 API Key，即可生成速读。 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.goToConfigure` | 前往配置 | 打开设置 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.copy` | 复制 | 复制 | 保留：名称或状态清楚，无需替换。 |
| `digest.copied` | 已复制 | 已复制 | 保留：名称或状态清楚，无需替换。 |
| `digest.definitionLabel` | 一句话定位： | 主要功能： | 把营销式定位改为实际功能。 |
| `digest.painPointLabel` | 核心痛点： | 解决问题： | 去掉营销词，保留问题维度。 |
| `digest.scenariosLabel` | 适用场景： | 适用场景： | 保留：名称或状态清楚，无需替换。 |
| `digest.copyDefinition` | 【一句话定位】 | 【主要功能】 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.copyPainPoint` | 【核心解决痛点】 | 【解决问题】 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.copyScenarios` | 【最佳适用场景】 | 【适用场景】 | 压缩冗余，保留操作、对象与必要后果。 |
| `digest.error` | 速读生成失败，请重试 | 速读生成失败，请重试 | 保留：名称或状态清楚，无需替换。 |

## 实施记录

用户授权实施第二版后，已同步中英文资源及受影响的测试断言。登录卖点按契约保留 Insights / 洞察 名称，中文落为“查看 Star 洞察”。没有新增翻译键或修改组件结构、业务逻辑。相关 11 个测试文件共 88 项测试通过；语言键、插值变量、中文新文案长度及局部 Biome 检查通过。
