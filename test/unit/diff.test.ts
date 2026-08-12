// UT：wordDiff 词级 LCS diff
import { section, eq } from '../harness';
import { wordDiff } from '../../src/utils/diff';

export async function run(): Promise<void> {
  section('UT: wordDiff 边界与混合');
  eq('双空串', wordDiff('', ''), []);
  eq('全同合并为一段 same', wordDiff('a b c', 'a b c'), [{ type: 'same', text: 'a b c' }]);
  eq('全异', wordDiff('a', 'b'), [{ type: 'del', text: 'a' }, { type: 'add', text: 'b' }]);
  eq('混合：前同后异', wordDiff('the cat sat', 'the cat stood'), [
    { type: 'same', text: 'the cat' },
    { type: 'del', text: 'sat' },
    { type: 'add', text: 'stood' },
  ]);
  eq('纯新增', wordDiff('a', 'a b'), [{ type: 'same', text: 'a' }, { type: 'add', text: 'b' }]);
  eq('纯删除', wordDiff('a b', 'a'), [{ type: 'same', text: 'a' }, { type: 'del', text: 'b' }]);
}
