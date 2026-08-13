// UT：ProfileService / 弱点印象 / 练习侧重 / 术语清单 / 提问记录与进展
import { section, check, eq, FakeVault } from '../harness';
import { ProfileService } from '../../src/services/ProfileService';
import { WeakImpressionService, PracticeFocusService, QuestionLogService, ProgressService } from '../../src/services/QuestionLogService';
import { TermListService } from '../../src/services/TermService';
import { todayStr } from '../../src/utils/date';

export async function run(): Promise<void> {
  section('UT: ProfileService');
  const vEmpty = new FakeVault();
  const p0 = await new ProfileService(vEmpty.asService()).load();
  eq('档案缺失时用默认值', p0.stage, 'G10');
  check('默认科目齐全', Object.keys(p0.subjects).length === 5);

  const profileMd = '---\nstage: "G11"\nielts_target: 7.5\nielts_focus: "Writing"\noxbridge_enabled: true\noxbridge_direction: "工程"\nindependent_minutes: 25\nsubjects:\n  Maths: "IG+AS / AS主导 / 目标A*"\n  CS: "IG+AS / IG主导 / 目标A* / Python"\n---\n\n# 学习档案\n正文内容\n';
  const v1 = new FakeVault({ seed: { 'StudyCoach/档案.md': profileMd } });
  const ps = new ProfileService(v1.asService());
  const p1 = await ps.load();
  eq('阶段解析', p1.stage, 'G11');
  eq('紧凑科目串解析', [p1.subjects.Maths?.bias, p1.subjects.CS?.language], ['AS主导', 'Python']);
  eq('独立思考门槛', p1.independent_minutes, 25);
  const injected = ps.formatForInjection(p1);
  check('注入含牛剑方向', injected.includes('工程'));
  check('注入含雅思目标', injected.includes('7.5'));
  p1.stage = 'G12';
  await ps.save(p1);
  const p2 = await ps.load();
  eq('保存往返：阶段更新', p2.stage, 'G12');
  check('保存保留正文', v1.files['StudyCoach/档案.md'].includes('正文内容'));
  eq('保存往返：科目偏重不丢', p2.subjects.Maths?.bias, 'AS主导');

  section('UT: 弱点印象与练习侧重（含科目过滤）');
  const v2 = new FakeVault({ seed: {
    'StudyCoach/记录/弱点印象.md': '# 弱点印象\n\n| 日期 | 科目 | 描述 | 证据数 | 状态 |\n|------|------|------|--------|------|\n',
    'StudyCoach/记录/练习侧重.md': '# 练习侧重\n\n| 日期 | 科目 | 描述 | 状态 |\n|------|------|------|------|\n',
  } });
  const wis = new WeakImpressionService(v2.asService());
  const pfs = new PracticeFocusService(v2.asService());
  await wis.append('Physics', '力学整体偏弱');
  await wis.append('Econ', '宏观部分模糊');
  eq('印象追加解析', (await wis.load()).length, 2);
  eq('无科目参数全量注入（精练/雅思）', (await wis.pendingForInjection()).length, 2);
  eq('Physics 会话只注入物理印象', (await wis.pendingForInjection('Physics')).map(i => i.subject), ['Physics']);
  await pfs.append('Physics', '实验题成功率不高');
  await pfs.append('Econ', '问答题口语化');
  await pfs.append('通用', '解释题省略因果连接词');
  eq('侧重追加解析', (await pfs.load()).length, 3);
  const phyFocus = await pfs.activeForInjection('Physics');
  eq('Physics 注入物理+通用，不含 Econ', phyFocus.map(f => f.subject).sort(), ['Physics', '通用']);
  eq('Econ 注入 Econ+通用', (await pfs.activeForInjection('Econ')).length, 2);
  v2.files['StudyCoach/记录/练习侧重.md'] += `| ${todayStr()} | Maths | 已缓解的旧条目 | 已缓解 |\n`;
  eq('已缓解不再注入（Maths 只剩通用条目）', (await pfs.activeForInjection('Maths')).map(f => f.desc), ['解释题省略因果连接词']);
  check('印象不进复查体系（无复查日期字段）', !JSON.stringify(await wis.load()).includes('reviewDate'));

  section('UT: 术语清单与模式 E 状态流转');
  const v3 = new FakeVault({ seed: { 'StudyCoach/记录/术语清单.md': [
    '# 术语清单', '',
    '| Term (EN) | 科目 | 教材原文定义 | 必要成分拆解 | 我漏掉过的成分 | 我用错的口语词 | 状态 |',
    '|-----------|------|-------------|-------------|--------------|--------------|------|',
    '| Opportunity cost | Econ | 原文 | ①next best ②forgone | 漏① | / | 未稳定 |',
    '| Work done | Physics | 原文 | ①force ②distance ③方向 | 漏③ | / | 观察中 |',
    '| Density | Physics | 原文 | ①mass ②volume | / | / | 已稳定 |',
  ].join('\n') + '\n' } });
  const tls = new TermListService(v3.asService());
  eq('术语解析条数', (await tls.load()).length, 3);
  eq('抽查题源不含已稳定', (await tls.drillPool()).map(t => t.term).sort(), ['Opportunity cost', 'Work done']);
  eq('未稳定通过一次 → 观察中', await tls.applyDrillResult('Opportunity cost', true), '观察中');
  eq('观察中再通过 → 已稳定', await tls.applyDrillResult('Opportunity cost', true), '已稳定');
  eq('回抽不过 → 未稳定', await tls.applyDrillResult('Opportunity cost', false), '未稳定');
  eq('观察中不过 → 未稳定', await tls.applyDrillResult('Work done', false), '未稳定');
  check('不存在的术语返回 null', await tls.applyDrillResult('不存在', true) === null);

  section('UT: 提问记录与学习进展');
  const v4 = new FakeVault({ seed: {
    'StudyCoach/记录/提问记录.md': '# 提问记录\n\n| 日期 | 科目 | 考点(EN) | 困惑类型 | 求助深度 |\n|------|------|---------|---------|---------|\n',
  } });
  const ql = new QuestionLogService(v4.asService());
  await ql.appendTag({ date: todayStr(), subject: 'Physics', topic: 'Moments', confusion: '卡在某步', depth: '问一句就懂', selfRating: '4' });
  check('提问记录追加一行', v4.files['StudyCoach/记录/提问记录.md'].includes('Moments'));
  check('自评落第 6 列', v4.files['StudyCoach/记录/提问记录.md'].includes('| 4 |'));

  const v5 = new FakeVault();
  const prog = new ProgressService(v5.asService());
  await prog.append('Maths', '学到 differentiation', todayStr());
  await prog.append('Maths', '练了链式法则', todayStr());
  const content = v5.files['StudyCoach/记录/进展/Maths.md'];
  check('进展文件自动创建并带标题', content.startsWith('# Maths 学习进展'));
  eq('进展条目追加', content.split('\n').filter(l => l.startsWith('- ')).length, 2);
  const summary = await prog.recentSummary(['Maths', 'Physics']);
  check('recentSummary 只含有记录的科目', summary.includes('Maths') && !summary.includes('Physics'));

  section('UT: 表格感知追加（appendTableRow）');
  // 表后有空行：新行仍插入表格最后一行紧后方，不脱离表格
  const v6 = new FakeVault({ seed: { 'a.md': '# 台账\n\n| 列1 | 列2 |\n|---|---|\n| r1 | x |\n\n' } });
  await v6.appendTableRow('a.md', '| r2 | y |');
  const a1 = v6.files['a.md'];
  check('表后空行：新行紧贴最后表格行', a1.includes('| r1 | x |\n| r2 | y |\n\n'));
  // 表后有空行+补记段落：新行进表格，补记保留在下方
  const v7 = new FakeVault({ seed: { 'b.md': '| 列1 |\n|---|\n| r1 |\n\n手动补记一行\n' } });
  await v7.appendTableRow('b.md', '| r2 |');
  const b1 = v7.files['b.md'];
  check('表后补记：新行仍进表格', b1.includes('| r1 |\n| r2 |\n'));
  check('补记内容保留且在新行之后', b1.indexOf('手动补记一行') > b1.indexOf('| r2 |'));
  // 无表格：退化为普通 append
  const v8 = new FakeVault({ seed: { 'c.md': '# 标题\n正文\n' } });
  await v8.appendTableRow('c.md', '| r1 |');
  check('无表格退化为末尾追加', v8.files['c.md'].endsWith('| r1 |\n'));
}
