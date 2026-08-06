// UT：线下练习反馈解析（parseReviewFeedback）
import { section, check, eq } from '../harness';
import { parseReviewFeedback } from '../../src/ui/MainView';

export async function run(): Promise<void> {
  section('UT: parseReviewFeedback');
  const reply = '好的，已整理。\n```json\n{"reviewFeedback": {"terms": [{"name": "ceteris paribus", "pass": true}, {"name": "effervescence", "pass": false}], "expressions": [{"name": "inverse relationship", "pass": true}], "points": [{"topic": "moments", "pass": true}]}}\n```';
  const fb = parseReviewFeedback(reply);
  eq('术语条数', fb.terms.length, 2);
  eq('术语 pass 判定', [fb.terms[0].pass, fb.terms[1].pass], [true, false]);
  eq('表达条数', fb.expressions.length, 1);
  eq('失分点 topic', fb.points[0].topic, 'moments');

  // 字段名容差：term / expr / result='fail'
  const reply2 = '```json\n{"reviewFeedback": {"terms": [{"term": "osmosis", "result": "fail"}], "expressions": [{"expr": "quantity demanded", "result": "pass"}]}}\n```';
  const fb2 = parseReviewFeedback(reply2);
  eq('term 字段容差', fb2.terms[0]?.name, 'osmosis');
  eq('result=fail 判定为未通过', fb2.terms[0]?.pass, false);
  eq('expr 字段容差', fb2.expressions[0]?.name, 'quantity demanded');
  eq('result=pass 判定为通过', fb2.expressions[0]?.pass, true);

  // 无 JSON / 空内容不报错
  const fb3 = parseReviewFeedback('没有任何 json 的普通文本');
  check('无 JSON 返回空结构', fb3.terms.length === 0 && fb3.expressions.length === 0 && fb3.points.length === 0 && fb3.wrongs.length === 0);

  // 错题队列解析
  const reply4 = '```json\n{"reviewFeedback": {"wrongs": [{"topic": "moments", "pass": true}, {"topic": "moles", "pass": false}]}}\n```';
  const fb4 = parseReviewFeedback(reply4);
  eq('错题条数', fb4.wrongs.length, 2);
  eq('错题 pass 判定', [fb4.wrongs[0].pass, fb4.wrongs[1].pass], [true, false]);
}
