// 测试基建：轻量断言 + FakeVault（隔离 obsidian，服务层全部可测）
import type { VaultService } from '../src/services/VaultService';

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}`);
  }
}

export function eq<T>(name: string, actual: T, expected: T): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) console.log(`        期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  check(name, ok);
}

export function section(title: string): void {
  console.log(`\n── ${title}`);
}

export function summary(): number {
  console.log(`\n════ 共 ${passed + failed} 项：通过 ${passed}，失败 ${failed}`);
  if (failures.length) console.log('失败项：\n' + failures.map(f => '  - ' + f).join('\n'));
  return failed;
}

export interface FakeVaultOptions {
  seed?: Record<string, string>;
  conflict?: boolean;
}

/**
 * FakeVault：实现服务层用到的 vault 接口（read/write/append/hasConflict/adapter）。
 * 所有数据在内存 map 中，测试结束可逐文件断言。
 */
export class FakeVault {
  files: Record<string, string>;
  conflict: boolean;

  constructor(opts: FakeVaultOptions = {}) {
    this.files = { ...(opts.seed ?? {}) };
    this.conflict = opts.conflict ?? false;
  }

  async read(p: string): Promise<string | null> {
    return this.files[p] ?? null;
  }

  async write(p: string, c: string): Promise<void> {
    this.files[p] = c;
  }

  async append(p: string, c: string): Promise<void> {
    // 与生产 VaultService.append 语义一致：保证行间分隔与尾换行
    const existing = this.files[p] ?? '';
    const sep = existing === '' || existing.endsWith('\n') ? '' : '\n';
    const suffix = c.endsWith('\n') ? '' : '\n';
    this.files[p] = existing + sep + c + suffix;
  }

  async hasConflict(): Promise<boolean> {
    return this.conflict;
  }

  get adapter() {
    const self = this;
    return {
      async exists(p: string): Promise<boolean> {
        return Object.keys(self.files).some(f => f === p || f.startsWith(p + '/'));
      },
      async list(p: string): Promise<{ files: string[]; folders: string[] }> {
        const prefix = p.endsWith('/') ? p : p + '/';
        return { files: Object.keys(self.files).filter(f => f.startsWith(prefix)), folders: [] };
      },
    };
  }

  /** 转型为服务层期望的 VaultService（鸭子类型足够） */
  asService(): VaultService {
    return this as unknown as VaultService;
  }
}
