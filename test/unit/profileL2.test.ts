// UT：ProfileL2Service —— L2 弱点画像生成/证据回链/人工备注保留/新鲜度
import { section, check, FakeVault } from '../harness';
import { ProfileL2Service, PROFILE_L2_PATH } from '../../src/services/ProfileL2Service';
import { InsightEngine } from '../../src/services/InsightEngine';
import { ErrorLogService } from '../../src/services/ErrorLogService';
import { seedLog } from './errorlog.test';
import { todayStr, addDays } from '../../src/utils/date';

export async function run(): Promise<void> {
  section('UT: ProfileL2Service 弱点画像');
  const v = new FakeVault({ seed: { 'StudyCoach/记录/error-log.md': seedLog([
    `| 001 | ${todayStr()} | Maths | AS | Moments | 计算 | LK | 忘乘力臂 | 注明力臂 | | 2 | 未消除 | ${addDays(todayStr(), 7)} |`,
    `| 002 | ${todayStr()} | Maths | AS | Moments | 计算 | LK | 又忘力臂 | 注明力臂 | | 1 | 未消除 | ${addDays(todayStr(), 7)} |`,
  ]) } });
  const engine = new InsightEngine(v.asService());
  const p2 = new ProfileL2Service(v.asService(), engine);
  const entries = await new ErrorLogService(v.asService()).load();

  const content = await p2.generate(entries, [], []);
  check('按科目分节', content.includes('## Maths'));
  check('复发热点带证据 ID 回链', content.includes('复发 2 次（证据：001）'));
  check('高频失分码行', content.includes('LK ×2'));
  check('frontmatter updated', content.includes(`updated: ${todayStr()}`));

  // 人工备注保留
  v.files[PROFILE_L2_PATH] = content.replace('## 人工备注', '## 人工备注\n手写备注内容');
  const regen = await p2.generate(entries, [], []);
  check('人工备注重新生成时保留', regen.includes('手写备注内容'));

  check('当天生成=新鲜', await p2.isFresh());
  v.files[PROFILE_L2_PATH] = regen.replace(/updated: \d{4}-\d{2}-\d{2}/, 'updated: 2026-01-01');
  check('超 7 天=过期', !(await p2.isFresh()));

  const sec = await p2.loadSection('Maths');
  check('loadSection 读取科目节', sec.includes('复发热点'));
  check('loadSection 无该科目返回空', (await p2.loadSection('Physics')) === '');
}
