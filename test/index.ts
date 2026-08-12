// 统一测试入口：UT + FVT 全量执行，任一失败退出码非 0
import { summary } from './harness';
import * as utUtils from './unit/utils.test';
import * as utErrorLog from './unit/errorlog.test';
import * as utServices from './unit/services.test';
import * as utInsight from './unit/insight.test';
import * as utIelts from './unit/ielts.test';
import * as utReport from './unit/report.test';
import * as utSse from './unit/sse.test';
import * as utWrongAnswer from './unit/wronganswer.test';
import * as utReviewFb from './unit/reviewfb.test';
import * as utConceptMap from './unit/conceptmap.test';
import * as utChapters from './unit/chapters.test';
import * as utSpeaking from './unit/speaking.test';
import * as utVoice from './unit/voice.test';
import * as utContext from './unit/context.test';
import * as utProfileL2 from './unit/profileL2.test';
import * as utReviewSheet from './unit/reviewsheet.test';
import * as utSvgChart from './unit/svgchart.test';
import * as utDiff from './unit/diff.test';
import * as fvtSession from './fvt/session.test';
import * as fvtDataflow from './fvt/dataflow.test';
import * as fvtIelts from './fvt/ielts.test';

async function main(): Promise<void> {
  console.log('════ A-Level Study Coach 测试套件（UT + FVT）');
  await utUtils.run();
  await utErrorLog.run();
  await utServices.run();
  await utInsight.run();
  await utIelts.run();
  await utReport.run();
  await utSse.run();
  await utWrongAnswer.run();
  await utReviewFb.run();
  await utConceptMap.run();
  await utChapters.run();
  await utSpeaking.run();
  await utVoice.run();
  await utContext.run();
  await utProfileL2.run();
  await utReviewSheet.run();
  await utSvgChart.run();
  await utDiff.run();
  await fvtSession.run();
  await fvtDataflow.run();
  await fvtIelts.run();
  const failed = summary();
  process.exit(failed === 0 ? 0 : 1);
}

void main();
