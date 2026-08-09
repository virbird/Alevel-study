import type { Profile, SubjectKey } from '../types';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/markdown';
import { VaultService, ROOT } from './VaultService';

const PROFILE_PATH = `${ROOT}/档案.md`;

const DEFAULT_PROFILE: Profile = {
  stage: 'G10',
  subjects: {
    Maths: { level: 'IG+AS', bias: 'AS主导', target: 'A*' },
    Physics: { level: 'IG+AS', bias: 'IG主导', target: 'A*' },
    CS: { level: 'IG+AS', bias: 'IG主导', target: 'A*', language: 'Python' },
    Chemistry: { level: 'IG', bias: '纯 IG', target: 'A*' },
    Economics: { level: 'IG', bias: '纯 IG', target: 'A*' },
  },
  ielts: { target: 7.5, focus: 'Writing' },
  oxbridge: { enabled: true, direction: '待定' },
  independent_minutes: 15,
};

export class ProfileService {
  constructor(private vault: VaultService) {}

  async load(): Promise<Profile> {
    const content = await this.vault.read(PROFILE_PATH);
    if (!content) return DEFAULT_PROFILE;
    const { data } = parseFrontmatter(content);
    const subjects: Profile['subjects'] = {};
    const raw = (data.subjects ?? {}) as Record<string, string>;
    for (const [key, value] of Object.entries(raw)) {
      // frontmatter 里 subjects 用紧凑字符串："IG+AS / AS主导 / 目标A* / Python"
      const parts = String(value).split('/').map(s => s.trim()).filter(Boolean);
      subjects[key as SubjectKey] = {
        level: parts[0] ?? '',
        bias: parts[1]?.replace('目标', '') ?? '',
        target: parts.find(p => p.includes('目标'))?.replace('目标', '') ?? 'A*',
        language: parts[3],
      };
    }
    return {
      stage: String(data.stage ?? DEFAULT_PROFILE.stage),
      subjects: Object.keys(subjects).length ? subjects : DEFAULT_PROFILE.subjects,
      ielts: {
        target: Number(data.ielts_target) || DEFAULT_PROFILE.ielts.target,
        focus: String(data.ielts_focus ?? DEFAULT_PROFILE.ielts.focus),
      },
      oxbridge: {
        enabled: data.oxbridge_enabled !== false && data.oxbridge_enabled !== 'false',
        direction: String(data.oxbridge_direction ?? '待定'),
      },
      independent_minutes: Number(data.independent_minutes) || DEFAULT_PROFILE.independent_minutes,
    };
  }

  async save(profile: Profile): Promise<void> {
    const content = await this.vault.read(PROFILE_PATH);
    const body = content ? parseFrontmatter(content).body : '\n# 学习档案\n';
    const subjects: Record<string, string> = {};
    for (const [key, sp] of Object.entries(profile.subjects)) {
      if (!sp) continue;
      const parts = [sp.level, sp.bias, `目标${sp.target}`];
      if (sp.language) parts.push(sp.language);
      subjects[key] = parts.filter(Boolean).join(' / ');
    }
    const data: Record<string, unknown> = {
      stage: profile.stage,
      ielts_target: profile.ielts.target,
      ielts_focus: profile.ielts.focus,
      oxbridge_enabled: profile.oxbridge.enabled,
      oxbridge_direction: profile.oxbridge.direction,
      independent_minutes: profile.independent_minutes,
      subjects,
    };
    await this.vault.write(PROFILE_PATH, stringifyFrontmatter(data, body));
  }

  /** 注入教练 prompt 的学生档案段 */
  formatForInjection(profile: Profile): string {
    const lines: string[] = ['学生档案（插件自动注入，每次会话前由插件更新）：'];
    lines.push(`- 当前阶段：${profile.stage}`);
    for (const [key, sp] of Object.entries(profile.subjects)) {
      if (!sp) continue;
      lines.push(`- ${key}：${sp.level}，偏重 ${sp.bias}，目标 ${sp.target}${sp.language ? `，编程语言 ${sp.language}` : ''}`);
    }
    lines.push(`- 雅思目标：${profile.ielts.target}（主攻 ${profile.ielts.focus}）`);
    if (profile.oxbridge.enabled) {
      lines.push(`- 牛剑方向：${profile.oxbridge.direction}（仅在学生主动表示兴趣时展开）`);
    }
    lines.push(`- 独立思考门槛：${profile.independent_minutes} 分钟`);
    return lines.join('\n');
  }
}
