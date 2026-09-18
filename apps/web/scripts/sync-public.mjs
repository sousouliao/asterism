/**
 * Vite 只支持一个 `publicDir`，而已被 embedding 资产占用（`.cache/embedding-assets/*`）。
 * 仓库自有的静态资源（favicon、manifest 等）放在 `apps/web/public`，这里同步到真正被服务的
 * public 根目录；dev 与 build 都先跑本脚本，两边看到同一份文件。
 *
 * 只做覆盖复制，不碰目标目录里的 embedding 资产；因此从 `apps/web/public` 删掉的文件需要
 * 手动清理 `.cache` 里的旧副本（这类图标资源很少删）。
 */
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(scriptDirectory, '../../..');
const source = join(scriptDirectory, '../public');
const target = join(repositoryRoot, '.cache/embedding-assets/v1/public');

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });

console.log(
  `[sync-public] ${relative(repositoryRoot, source)} -> ${relative(repositoryRoot, target)}`,
);
