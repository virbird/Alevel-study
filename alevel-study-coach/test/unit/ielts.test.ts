// UT：IeltsService（解析/笔记/趋势）与 ExpressionService（去重/调度/升降档）
import { section, check, eq, FakeVault } from '../harness';
import { IeltsService, parseIeltsResult, ESSAY_DIR, EXPR_LIB_PATH, GRADE_LEDGER_PATH } from '../../src/services/IeltsService';
import { ExpressionService, INTERVALS } from '../../src/services/ExpressionService';
import { toOpenAIUserContent, toAnthropicUserContent } from '../../src/llm/LlmClient';
import type { ChatOptions } from '../../src/llm/LlmClient';
import type { LlmClient } from '../../src/llm/LlmClient';
import { todayStr, addDays } from '../../src/utils/date';

const REPLY_OK = [
  '【1. 总分与分项评分】预测总分 6.5 ……',
  '【2. 逐段精批】……',
  '```json',
  '{"ieltsResult": {"task": 2, "overall": 6.5, "tr": 6.5, "cc": 6.0, "lr": 6.5, "gra": 6.0,',
  '  "expressions": [',
  '    {"expr": "a growing body of evidence", "type": "高分短语", "note": "引出证据"},',
  '    {"expr": "It is widely acknowledged that", "type": "高分句型", "note": "普遍观点开头"}',
  '  ]}}',
  '```',
].join('\n');

const EXPR_LIB_HEADER = '# 表达积累库\n\n| 表达 | 类型 | 来源 | 日期 | 间隔 | 下次 | 状态 |\n|------|------|------|------|------|------|------|\n';

export async function run(): Promise<void> {
  section('UT: parseIeltsResult');
  const ok = parseIeltsResult(REPLY_OK);
  eq('分数解析', ok.scores, { overall: 6.5, tr: 6.5, cc: 6.0, lr: 6.5, gra: 6.0 });
  eq('表达解析（2 条）', ok.expressions.map(e => e.expr), ['a growing body of evidence', 'It is widely acknowledged that']);
  check('正文剥离 JSON 块', !ok.reply.includes('ieltsResult') && ok.reply.includes('总分与分项评分'));
  const broken = parseIeltsResult('【1. 总分与分项评分】6.0……\n```json\n{坏的 JSON\n```');
  check('JSON 损坏：分数留空但正文保留', broken.scores.overall === null && broken.reply.includes('总分与分项评分'));
  const noJson = parseIeltsResult('只有正文没有 JSON');
  check('无 JSON：全文即正文', noJson.reply === '只有正文没有 JSON' && noJson.expressions.length === 0);

  section('UT: IeltsService 笔记与趋势');
  const v = new FakeVault();
  const svc = new IeltsService(v.asService());
  const path = await svc.createEssayNote(2, '教育类: Agree?');
  check('文件名清洗特殊字符', path.includes('task2') && !path.includes('?'));
  const note = v.files[path];
  check('模板含三小节骨架', note.includes('## 原文') && note.includes('## AI 批改') && note.includes('## 高分表达'));
  eq('原文提取（未粘贴时为空）', svc.extractEssay(note), '');
  const withEssay = note.replace('（在这里粘贴作文全文）', 'Some people believe that university education should be free for everyone. I partially agree with this view for the following reasons, which I will elaborate in this essay.');
  v.files[path] = withEssay;
  check('原文提取成功', svc.extractEssay(withEssay).startsWith('Some people believe'));
  eq('未批改时分数为空', (await svc.loadScores())[0].overall, null);
  // 手工写入分数模拟批改后
  v.files[path] = withEssay.replace('overall: ""', 'overall: 6.5').replace('lr: ""', 'lr: 5.5');
  const scores = await svc.loadScores();
  eq('趋势读取分数', [scores[0].overall, scores[0].lr], [6.5, 5.5]);
  eq('短板维度识别', svc.weakestDimension(scores[0]), 'LR');

  section('UT: ExpressionService 调度');
  const v2 = new FakeVault({ seed: { [EXPR_LIB_PATH]: EXPR_LIB_HEADER } });
  const es = new ExpressionService(v2.asService());
  const added = await es.appendAll([
    { expr: 'a growing body of evidence', type: '高分短语', note: '' },
    { expr: 'A Growing Body Of Evidence', type: '高分短语', note: '' }, // 大小写重复
    { expr: 'It is widely acknowledged that', type: '高分句型', note: '' },
  ], '2026-08-04-task2-教育类');
  eq('去重后入库 2 条', added, 2);
  eq('新表达间隔档 0、明天到期', (await es.load())[0].next, addDays(todayStr(), INTERVALS[0]));
  eq('新表达不在今日到期队列', (await es.due()).length, 0);
  // 手工制造一条今日到期（append 语义保证尾换行，直接拼接安全）
  await v2.append(EXPR_LIB_PATH, `| play a pivotal role | 高分短语 | 手工 | ${todayStr()} | 1 | ${todayStr()} | 学习中 |`);
  eq('到期表达入队', (await es.due()).map(r => r.expr), ['play a pivotal role']);
  // 通过 → 升档（1→2 档，下次 +7 天）
  const passed = await es.applyResult('play a pivotal role', true);
  eq('通过升档', passed?.interval, 2);
  eq('通过后下次 +7 天', passed?.next, addDays(todayStr(), INTERVALS[2]));
  // 不过 → 重置 1 天
  const failed = await es.applyResult('play a pivotal role', false);
  eq('不过重置到 1 天', [failed?.interval, failed?.next], [0, addDays(todayStr(), 1)]);
  // 封顶再通过 → 已掌握（[^\n] 限定单行，避免正则跨行吞行）
  v2.files[EXPR_LIB_PATH] = v2.files[EXPR_LIB_PATH].replace(/\| play a pivotal role \|[^\n]*/, `| play a pivotal role | 高分短语 | 手工 | ${todayStr()} | 5 | ${addDays(todayStr(), 60)} | 学习中 |`);
  const mastered = await es.applyResult('play a pivotal role', true);
  eq('间隔到顶再通过 → 已掌握', [mastered?.interval, mastered?.status], [5, '已掌握']);
  check('已掌握不再到期', (await es.due()).length === 0);
  check('不存在的表达返回 null', await es.applyResult('不存在', true) === null);
  check('抽查提示词含到期表达', es.buildDrillPrompt([{ expr: 'x', type: '高分词汇', source: '', date: '', interval: 0, next: '', status: '学习中' }]).includes('x'));

  section('UT: 多模态 content 构建');
  const imgs = [{ mimeType: 'image/png', data: 'QUJD', name: 'a.png' }];
  eq('无图时 content 为纯文本', toOpenAIUserContent('hello'), 'hello');
  const oai = toOpenAIUserContent('题目', imgs) as { type: string }[];
  eq('OpenAI 多模态结构', [oai[0].type, oai[1].type], ['text', 'image_url']);
  const ant = toAnthropicUserContent('题目', imgs) as { type: string }[];
  eq('Anthropic 多模态结构', [ant[0].type, ant[1].type], ['text', 'image']);

  section('UT: 笔记图片提取');
  const vImg = new FakeVault();
  vImg.binaries['notes/img1.png'] = new Uint8Array([1, 2, 3]);
  vImg.binaries['notes/sub/img2.jpg'] = new Uint8Array([4, 5, 6]);
  vImg.files['notes/my-essay.md'] = '---\ntitle: t\n---\n\n# 作文\n\n题目见图：![[img1.png]]\n\n第二张：![](sub/img2.jpg)\n\n丢了：![[ghost.png]]\n\n不支持：![[pic.bmp]]\n';
  const svcImg = new IeltsService(vImg.asService());
  const ext = await svcImg.extractNoteImages('notes/my-essay.md', vImg.files['notes/my-essay.md']);
  eq('成功加载 2 张图', ext.images.map(i => i.name), ['img1.png', 'img2.jpg']);
  eq('图片 base64 编码', ext.images[0].data, btoa(String.fromCharCode(1, 2, 3)));
  check('正文替换为位置标记', ext.text.includes('[图片: img1.png]') && ext.text.includes('[图片: img2.jpg]'));
  check('正文已去 frontmatter', !ext.text.includes('title: t'));
  eq('跳过清单（丢失+格式）', ext.skipped.sort(), ['ghost.png', 'pic.bmp']);
  check('标记中含跳过原因', ext.text.includes('[图片未找到: ghost.png]') && ext.text.includes('不支持的格式'));
  // 上限：5 张图只取前 4
  const vMany = new FakeVault();
  for (let i = 1; i <= 5; i++) vMany.binaries[`m/p${i}.png`] = new Uint8Array([i]);
  vMany.files['m/many.md'] = Array.from({ length: 5 }, (_, i) => `![[p${i + 1}.png]]`).join('\n');
  const extMany = await new IeltsService(vMany.asService()).extractNoteImages('m/many.md', vMany.files['m/many.md']);
  eq('图片上限 4 张', extMany.images.length, 4);
  eq('第 5 张进跳过清单', extMany.skipped, ['p5.png']);

  section('UT: gradeNote 任意笔记批改 + 台账');
  const vNote = new FakeVault({ seed: {
    'StudyCoach/prompts/ielts-writing.md': '你是资深雅思写作考官……',
    [GRADE_LEDGER_PATH]: '# 批改记录\n\n| 日期 | 笔记 | 总分 | TR | CC | LR | GRA |\n|------|------|------|----|----|----|----|\n',
    [ESSAY_DIR + '/2026-01-01-task2-legacy.md']: `---\ntask: "2"\ndate: "2026-01-01"\noverall: 6\ntr: 6\ncc: 6\nlr: 6\ngra: 6\n---\n\n# legacy\n`,
  } });
  vNote.binaries['w/q1.png'] = new Uint8Array([9]);
  vNote.files['w/essay1.md'] = '---\ntags: ielts\n---\n\n# 我的作文\n\n题目：![[q1.png]]\n\nSome people believe that university education should be free for everyone, while others think students should pay tuition fees for their higher education. I partly agree.';
  const svcNote = new IeltsService(vNote.asService());
  let captured: ChatOptions | null = null;
  const fakeLlm = { chat: async (opts: ChatOptions) => { captured = opts; return REPLY_OK; }, configured: true } as unknown as LlmClient;
  const aborter = new AbortController();
  const gres = await svcNote.gradeNote('w/essay1.md', fakeLlm, aborter.signal);
  eq('分数解析', gres.scores.overall, 6.5);
  check('取消信号透传给 LLM 请求', captured!.signal === aborter.signal);
  eq('图片随请求发送', captured!.messages[0].images?.length, 1);
  check('提问含图片位置提示', captured!.messages[0].content.includes('[图片: q1.png]') && captured!.messages[0].content.includes('图片'));
  const gradedNote = vNote.files['w/essay1.md'];
  check('批改回填到 ## AI 批改 小节', gradedNote.includes('## AI 批改') && gradedNote.includes('总分与分项评分'));
  check('frontmatter 未被破坏', gradedNote.startsWith('---') && gradedNote.includes('tags: ielts'));
  eq('台账追加一行', vNote.files[GRADE_LEDGER_PATH].split('\n').filter(l => l.startsWith(`| ${todayStr()}`)).length, 1);
  // 重复批改：小节替换不叠加，台账再追一行（重写提升轨迹）
  await svcNote.gradeNote('w/essay1.md', fakeLlm);
  eq('重复批改只有一个小节', vNote.files['w/essay1.md'].split('## AI 批改').length, 2);
  // 趋势合并：台账 + 旧作文目录
  const merged = await svcNote.loadScores();
  eq('趋势合并台账与旧笔记', merged.length, 3);
  check('台账条目指向原笔记', merged.some(s => s.file === 'w/essay1.md' && s.overall === 6.5));
  // 文字太少拦截（有图片则放行）
  vNote.files['w/short.md'] = '太短了。';
  let shortThrew = false;
  try { await svcNote.gradeNote('w/short.md', fakeLlm); } catch { shortThrew = true; }
  check('无文字且无图片才拦截', shortThrew);
  vNote.binaries['w/q2.png'] = new Uint8Array([7]);
  vNote.files['w/img-only.md'] = '如图：\n![[q2.png]]';
  const imgOnly = await svcNote.gradeNote('w/img-only.md', fakeLlm);
  check('文字少但有图片放行批改', imgOnly.imageCount === 1 && imgOnly.scores.overall === 6.5);

  section('UT: 任意文本图片提取（教练会话用）+ 按路径载图');
  const vText = new FakeVault();
  vText.binaries['attach/题目.png'] = new Uint8Array([1, 1]);
  vText.binaries['any/deep/手写.jpg'] = new Uint8Array([2, 2]);
  const svcText = new IeltsService(vText.asService());
  const msg = '这道题见图：![[题目.png]]，另外 ![](any/deep/手写.jpg)，丢了 ![[没有.png]]';
  const extText = await svcText.extractTextImages(msg);
  eq('basename 与精确路径都解析到', extText.images.map(i => i.name).sort(), ['手写.jpg', '题目.png']);
  check('标记替换与未找到提示', extText.text.includes('[图片: 题目.png]') && extText.text.includes('[图片未找到: 没有.png]'));
  const parts = await svcText.loadImageParts(['attach/题目.png', '不存在.png']);
  eq('按路径载图跳过缺失', parts.map(p => p.name), ['题目.png']);
  eq('载图 base64 正确', parts[0].data, btoa(String.fromCharCode(1, 1)));
}
