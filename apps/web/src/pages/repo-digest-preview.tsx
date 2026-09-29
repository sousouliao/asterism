import type { StarredRepoRecord } from '@asterism/db';
import { Button, useTheme } from '@asterism/ui';
import { useState } from 'react';
import {
  type DigestIconType,
  RepoAiDigest,
  type RepoAiDigestData,
} from '../components/repo-digest/repo-ai-digest';
import { RepoInspector } from '../components/repo-inspector';
import { RepoInspectorProvider, useRepoInspector } from '../contexts/repo-inspector-context';
import { previewRepo } from '../fixtures/preview-repo';
import { changeInterfaceLanguage } from '../i18n';

// 样例数据：真实场景下的三款代表性开源项目
const SAMPLES: Record<
  'streamdown' | 'zustand' | 'ruff',
  { repo: StarredRepoRecord; digest: RepoAiDigestData }
> = {
  streamdown: {
    repo: {
      repoId: 'preview-streamdown',
      starredAt: '2026-03-15T00:00:00Z',
      repo: previewRepo({
        githubId: 201,
        fullName: 'lobehub/streamdown',
        name: 'streamdown',
        owner: 'lobehub',
        description:
          'Headless streaming markdown parser and components for AI and LLMs. Zero CSS, block splitting, smooth reveal animation.',
        language: 'TypeScript',
        topics: ['markdown', 'streaming', 'llm', 'ai', 'react'],
        stargazers: 1200,
        forks: 85,
        pushedAt: '2026-03-20T00:00:00Z',
      }),
    },
    digest: {
      definition:
        '专为 AI 和大语言模型设计的无头（Headless）流式 Markdown 解析与平滑渐进渲染组件库。',
      painPoint:
        '解决传统 Markdown 渲染器在流式生成（Chunk Token）时频繁重绘导致的页面跳动、闪烁与文本撕裂问题。',
      scenarios: 'AI 对话气泡、LLM 智能助手、代码块打字机渐进动画等需要实时流式输出的界面。',
    },
  },
  zustand: {
    repo: {
      repoId: 'preview-zustand',
      starredAt: '2025-11-10T00:00:00Z',
      repo: previewRepo({
        githubId: 202,
        fullName: 'pmndrs/zustand',
        name: 'zustand',
        owner: 'pmndrs',
        description:
          'Bear necessities for state management in React. Small, fast, and scalable bearbones state-management solution.',
        language: 'TypeScript',
        topics: ['react', 'state-management', 'flux'],
        stargazers: 47000,
        forks: 1400,
        pushedAt: '2026-03-28T00:00:00Z',
      }),
    },
    digest: {
      definition: '基于简化 Flux 原则的极简、极速、无样板代码的现代化 React 状态管理库。',
      painPoint:
        '消除了 Redux 繁复的 Action/Reducer 模板，并绕过了 React Context Provider 导致的子树无谓全量重渲染。',
      scenarios:
        '中大型 Web 应用的全局状态树、跨组件共享数据通信、支持与 React 外部无缝绑定的 Store。',
    },
  },
  ruff: {
    repo: {
      repoId: 'preview-ruff',
      starredAt: '2025-08-20T00:00:00Z',
      repo: previewRepo({
        githubId: 203,
        fullName: 'astral-sh/ruff',
        name: 'ruff',
        owner: 'astral-sh',
        description: 'An extremely fast Python linter and code formatter, written in Rust.',
        language: 'Rust',
        topics: ['python', 'linter', 'formatter', 'rust', 'tooling'],
        stargazers: 35000,
        forks: 1100,
        pushedAt: '2026-03-29T00:00:00Z',
      }),
    },
    digest: {
      definition: '采用 Rust 构建的极致极速 Python 代码静态检查器（Linter）与代码格式化工具。',
      painPoint:
        '彻底终结了 Python 传统生态中 Flake8/Black/isort 等多工具启动慢、配置割裂、规则相互冲突的历史包袱。',
      scenarios:
        '现代大型 Python 项目、需要毫秒级响应的本地 Git 预提交钩子（pre-commit）与企业级 CI/CD 流水线。',
    },
  },
};

export function RepoDigestPreviewPage() {
  return (
    <RepoInspectorProvider>
      <RepoDigestPreviewContent />
    </RepoInspectorProvider>
  );
}

function RepoDigestPreviewContent() {
  const { theme, setTheme } = useTheme();
  const { requestOpen } = useRepoInspector();

  // 当前演示状态
  const [activeSample, setActiveSample] = useState<'streamdown' | 'zustand' | 'ruff'>('streamdown');
  const [digestStatus, setDigestStatus] = useState<
    'idle' | 'generating' | 'completed' | 'unconfigured' | 'error'
  >('idle');
  const [iconType, setIconType] = useState<DigestIconType>('lightbulb');

  const currentSample = SAMPLES[activeSample] ?? SAMPLES.streamdown;

  const handleOpenInspector = () => {
    requestOpen(currentSample.repo, {
      sourceKey: 'preview',
      sourceName: 'Demo Preview',
      records: [currentSample.repo],
    });
  };

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* 顶部控制台 */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-section-title font-semibold text-foreground">
                Phase C · 单仓库核心速读（思维导图 / 头脑风暴图标走查）
              </h1>
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              基于 Asterism 真实设计 Token、Glass 材质与组件，直观验证思维导图与脑力相关图标方案
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 切换主题 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 text-xs font-normal"
            >
              主题：{theme === 'dark' ? '暗色 (Dark)' : '明亮 (Light)'}
            </Button>

            {/* 切换语言 */}
            <div className="flex rounded-md border border-border">
              <button
                type="button"
                onClick={() => void changeInterfaceLanguage('zh-CN')}
                className="px-2.5 py-1 text-caption font-medium hover:bg-accent rounded-l-md"
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => void changeInterfaceLanguage('en')}
                className="border-l border-border px-2.5 py-1 text-caption font-medium hover:bg-accent rounded-r-md"
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* 状态与图标切换栏 */}
        <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
          {/* 仓库样本选择 */}
          <div className="flex items-center gap-1.5 text-caption">
            <span className="text-muted-foreground">测试仓库：</span>
            {(['streamdown', 'zustand', 'ruff'] as const).map((key) => (
              <Button
                key={key}
                type="button"
                variant={activeSample === key ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveSample(key)}
                className="h-7 text-xs font-normal"
              >
                {SAMPLES[key].repo.repo.name}
              </Button>
            ))}
          </div>

          {/* 图标方案选择 */}
          <div className="flex flex-wrap items-center gap-1.5 text-caption">
            <span className="text-muted-foreground font-medium">思维导图 / 头脑风暴方案：</span>
            <Button
              type="button"
              variant={iconType === 'network' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('network')}
              className="h-7 text-xs font-normal"
              title="网络节点拓扑（经典思维导图）"
            >
              Network (思维导图/节点拓扑)
            </Button>
            <Button
              type="button"
              variant={iconType === 'workflow' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('workflow')}
              className="h-7 text-xs font-normal"
              title="工作流/分支树"
            >
              Workflow (思维分支)
            </Button>
            <Button
              type="button"
              variant={iconType === 'brain-circuit' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('brain-circuit')}
              className="h-7 text-xs font-normal"
              title="大脑与神经网络（头脑风暴/AI深度思考）"
            >
              BrainCircuit (头脑风暴/神经回路)
            </Button>
            <Button
              type="button"
              variant={iconType === 'brain-cog' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('brain-cog')}
              className="h-7 text-xs font-normal"
              title="大脑齿轮运转（思维推演）"
            >
              BrainCog (思维运转)
            </Button>
            <Button
              type="button"
              variant={iconType === 'brain' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('brain')}
              className="h-7 text-xs font-normal"
              title="纯净大脑轮廓"
            >
              Brain (大脑)
            </Button>
            <Button
              type="button"
              variant={iconType === 'waypoints' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('waypoints')}
              className="h-7 text-xs font-normal"
              title="思维路径点"
            >
              Waypoints (思维路径)
            </Button>
            <Button
              type="button"
              variant={iconType === 'lightbulb' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('lightbulb')}
              className="h-7 text-xs font-normal"
              title="灵感火花"
            >
              Lightbulb (灵感火花)
            </Button>
            <Button
              type="button"
              variant={iconType === 'scantext' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIconType('scantext')}
              className="h-7 text-xs font-normal"
              title="文本扫描提炼"
            >
              ScanText (扫描提炼)
            </Button>
          </div>

          {/* 状态选择 */}
          <div className="flex items-center gap-1.5 text-caption">
            <span className="text-muted-foreground">卡片状态：</span>
            <Button
              type="button"
              variant={digestStatus === 'idle' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDigestStatus('idle')}
              className="h-7 text-xs font-normal"
            >
              未生成 (Idle)
            </Button>
            <Button
              type="button"
              variant={digestStatus === 'generating' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDigestStatus('generating')}
              className="h-7 text-xs font-normal"
            >
              生成中 (Generating)
            </Button>
            <Button
              type="button"
              variant={digestStatus === 'completed' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDigestStatus('completed')}
              className="h-7 text-xs font-normal"
            >
              已提炼 (Completed)
            </Button>
            <Button
              type="button"
              variant={digestStatus === 'unconfigured' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDigestStatus('unconfigured')}
              className="h-7 text-xs font-normal"
            >
              未配 Key (Unconfigured)
            </Button>
            <Button
              type="button"
              variant={digestStatus === 'error' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDigestStatus('error')}
              className="h-7 text-xs font-normal"
            >
              生成失败 (Error)
            </Button>
          </div>
        </div>
      </header>

      {/* 主展示区 */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6">
        {/* 说明面板 */}
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-drawer-title font-semibold text-foreground">
                开发者核心 3 要素速读卡片设计规范
              </h2>
              <p className="mt-1 text-caption text-muted-foreground">
                去繁就简，聚焦「一句话定位、解决痛点、适用场景」三大黄金要素，杜绝强行对标与幻觉
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleOpenInspector}
              className="gap-1.5 text-caption font-medium"
            >
              <span>在 Quick Look 抽屉中查看</span>
            </Button>
          </div>

          {/* 就地嵌入预览 */}
          <div className="mt-5 rounded-lg border border-border/80 bg-background/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-micro font-mono uppercase tracking-wider text-muted-foreground">
                当前组件渲染预览（针对 {currentSample.repo.repo.fullName}）
              </span>
            </div>

            <RepoAiDigest
              status={digestStatus}
              iconType={iconType}
              data={digestStatus === 'completed' ? currentSample.digest : null}
              onGenerate={() => {
                setDigestStatus('generating');
                setTimeout(() => setDigestStatus('completed'), 1200);
              }}
              onRegenerate={() => {
                setDigestStatus('generating');
                setTimeout(() => setDigestStatus('completed'), 1000);
              }}
              onConfigureKey={() => alert('引导前往设置页配置 DeepSeek 或 OpenAI 密钥')}
            />
          </div>
        </section>

        {/* 方案深度解析区 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
            <h3 className="text-body font-semibold text-foreground flex items-center gap-1.5">
              <span>🎯</span> 为什么聚焦于核心 3 要素？
            </h3>
            <p className="text-caption text-muted-foreground leading-relaxed">
              避免模型自由发散导致生成冗长废话。开发者扫读时最关心的只有三个核心问题：是什么、解决什么原生痛点、什么具体场景用。砍掉容易产生幻觉的强行对标，卡片更紧凑高效。
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
            <h3 className="text-body font-semibold text-foreground flex items-center gap-1.5">
              <span>⚡</span> 成本与 Token 极低控制
            </h3>
            <p className="text-caption text-muted-foreground leading-relaxed">
              裁剪 README 核心章节（过滤代码、徽章与贡献者名单）+ 元数据，单次生成仅需约 400
              Tokens。在 DeepSeek 上单次生成成本仅 0.0008 元。
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
            <h3 className="text-body font-semibold text-foreground flex items-center gap-1.5">
              <span>💾</span> 按需触发 + 本地持久化缓存
            </h3>
            <p className="text-caption text-muted-foreground leading-relaxed">
              不全量跑批，用户点击才生成。生成后持久化在本地客户端，二次查看 0
              延迟秒开，支持手动重新生成。
            </p>
          </div>
        </section>
      </main>

      {/* 挂载全局 Inspector 抽屉支持真机走查 */}
      <RepoInspector />
    </div>
  );
}
