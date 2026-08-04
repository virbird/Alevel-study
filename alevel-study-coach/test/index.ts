// 统一测试入口：UT + FVT 全量执行，任一失败退出码非 0
import { summary } from './harness';
import * as utUtils from './unit/utils.test';
import * as utErrorLog from './unit/errorlog.test';
import * as utServices from './unit/services.test';
import * as utInsight from './unit/insight.test';
import * as utIelts from './unit/ielts.test';
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
  await fvtSession.run();
  await fvtDataflow.run();
  await fvtIelts.run();
  const failed = summary();
  process.exit(failed === 0 ? 0 : 1);
}

void main();
