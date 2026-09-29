import { describe, expect, it } from 'vitest';
import { buildRepoDigestPrompt, cleanReadmeForDigest, parseRepoDigest } from './digest-prompt';

describe('cleanReadmeForDigest', () => {
  it('handles empty or null content safely', () => {
    expect(cleanReadmeForDigest(null)).toBe('');
    expect(cleanReadmeForDigest(undefined)).toBe('');
    expect(cleanReadmeForDigest('')).toBe('');
  });

  it('strips scripts, styles, svgs, and html comments', () => {
    const raw = `
      <!-- This is a comment -->
      <script>alert(1);</script>
      <style>body { color: red; }</style>
      <svg><circle r="10"/></svg>
      <h1>Streamdown</h1>
      <p>Headless streaming markdown parser.</p>
    `;
    const cleaned = cleanReadmeForDigest(raw);
    expect(cleaned).not.toContain('alert');
    expect(cleaned).not.toContain('color: red');
    expect(cleaned).not.toContain('circle');
    expect(cleaned).not.toContain('comment');
    expect(cleaned).toContain('Streamdown');
    expect(cleaned).toContain('Headless streaming markdown parser.');
  });

  it('strips markdown badges and images', () => {
    const raw = `
      # Project
      [![Build](https://img.shields.io/badge/build-passing.svg)](https://github.com)
      ![Logo](https://example.com/logo.png)
      Real content starts here.
    `;
    const cleaned = cleanReadmeForDigest(raw);
    expect(cleaned).not.toContain('img.shields.io');
    expect(cleaned).not.toContain('logo.png');
    expect(cleaned).toContain('Real content starts here.');
  });

  it('strips low-value tail sections like License and Contributing', () => {
    const raw = `
      # Core Library
      Awesome feature description.

      ## Contributing
      Please open a PR.

      ## License
      MIT License
    `;
    const cleaned = cleanReadmeForDigest(raw);
    expect(cleaned).toContain('Awesome feature description.');
    expect(cleaned).not.toContain('Please open a PR.');
    expect(cleaned).not.toContain('MIT License');
  });

  it('truncates content cleanly within maxChars', () => {
    const longText = 'A'.repeat(5000);
    const cleaned = cleanReadmeForDigest(longText, 1000);
    expect(cleaned.length).toBeLessThanOrEqual(1000);
  });
});

describe('buildRepoDigestPrompt', () => {
  it('constructs prompt conforming to writing-for-agents specifications', () => {
    const prompt = buildRepoDigestPrompt({
      fullName: 'lobehub/streamdown',
      description: 'Headless streaming markdown parser',
      language: 'TypeScript',
      topics: ['markdown', 'streaming', 'react'],
      readme: '# Streamdown\nSmooth reveal animations for LLM tokens.',
      targetLocale: 'zh-CN',
    });

    expect(prompt.system).toContain('Extract a 3-point technical summary');
    expect(prompt.system).toContain('Output Format:');
    expect(prompt.system).toContain('definition');
    expect(prompt.system).toContain('painPoint');
    expect(prompt.system).toContain('scenarios');
    expect(prompt.system).toContain('Simplified Chinese (zh-CN)');

    expect(prompt.user).toContain('Target Language: zh-CN');
    expect(prompt.user).toContain('Name: lobehub/streamdown');
    expect(prompt.user).toContain('Smooth reveal animations');
  });
});

describe('parseRepoDigest', () => {
  it('parses valid raw JSON', () => {
    const json = JSON.stringify({
      definition: '无头流式 Markdown 解析器',
      painPoint: '解决流式生成时频繁重绘导致的页面跳动',
      scenarios: 'AI 对话气泡与 LLM 文本渐进渲染',
    });
    const result = parseRepoDigest(json);
    expect(result).toEqual({
      definition: '无头流式 Markdown 解析器',
      painPoint: '解决流式生成时频繁重绘导致的页面跳动',
      scenarios: 'AI 对话气泡与 LLM 文本渐进渲染',
    });
  });

  it('parses JSON wrapped in markdown code blocks', () => {
    const text = `
Here is your summary:
\`\`\`json
{
  "definition": "Rust 高性能 Python 静态检查器",
  "painPoint": "消除了传统多工具启动慢与配置割裂问题",
  "scenarios": "大型 Python 工程与 pre-commit 流水线"
}
\`\`\`
Hope this helps!
    `;
    const result = parseRepoDigest(text);
    expect(result).toEqual({
      definition: 'Rust 高性能 Python 静态检查器',
      painPoint: '消除了传统多工具启动慢与配置割裂问题',
      scenarios: '大型 Python 工程与 pre-commit 流水线',
    });
  });

  it('returns null for invalid or incomplete JSON', () => {
    expect(parseRepoDigest(null)).toBeNull();
    expect(parseRepoDigest('not json')).toBeNull();
    expect(parseRepoDigest('{"definition": "test"}')).toBeNull();
  });
});
