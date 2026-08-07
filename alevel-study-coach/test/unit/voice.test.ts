// UT：语音基础工具（WAV 编码 / 阿里云签名 / TTS 分句 / Token 解析）
import { section, check, eq } from '../harness';
import { encodeWav, percentEncode, hmacSha1Base64, buildAliyunSignature, uuidHex, splitForTts } from '../../src/voice/audioUtils';
import { fetchAliyunToken } from '../../src/voice/AliyunNls';

export async function run(): Promise<void> {
  section('UT: encodeWav');
  const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
  const wav = encodeWav(pcm, 16000);
  const v = new DataView(wav);
  eq('WAV 总长（44 头 + PCM）', wav.byteLength, 44 + pcm.length * 2);
  eq('RIFF 标记', String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), 'RIFF');
  eq('WAVE 标记', String.fromCharCode(v.getUint8(8), v.getUint8(9), v.getUint8(10), v.getUint8(11)), 'WAVE');
  eq('采样率 16k', v.getUint32(24, true), 16000);
  eq('单声道', v.getUint16(22, true), 1);
  eq('16bit', v.getUint16(34, true), 16);
  eq('data 长度', v.getUint32(40, true), pcm.length * 2);
  eq('PCM 数据原样', new Int16Array(wav, 44)[3], 32767);

  section('UT: percentEncode（阿里云 RFC3986）');
  eq('空格', percentEncode('a b'), 'a%20b');
  eq('波浪号不转义', percentEncode('a~b'), 'a~b');
  eq('星号转义', percentEncode('a*b'), 'a%2Ab');
  eq('感叹号转义', percentEncode('a!b'), 'a%21b');
  eq('括号转义', percentEncode("a'(b)"), 'a%27%28b%29');
  eq('斜杠转义', percentEncode('/'), '%2F');

  section('UT: hmacSha1Base64 / buildAliyunSignature');
  // RFC 2202 测试向量：key="key", data="The quick brown fox jumps over the lazy dog"
  eq('HMAC-SHA1 标准向量', await hmacSha1Base64('key', 'The quick brown fox jumps over the lazy dog'), '3nybhbi3iqa8ino29wqQcBydtNk=');
  const sig1 = await buildAliyunSignature({ B: '2', A: '1' }, 'secret');
  const sig2 = await buildAliyunSignature({ A: '1', B: '2' }, 'secret');
  eq('参数顺序不影响签名（排序）', sig1, sig2);
  const sig3 = await buildAliyunSignature({ A: '1', B: '2' }, 'other');
  check('不同密钥签名不同', sig1 !== sig3);
  check('签名是 base64', /^[A-Za-z0-9+/]+=*$/.test(sig1));

  section('UT: uuidHex');
  const id = uuidHex();
  eq('32 位 hex', id.length, 32);
  check('纯 hex 字符', /^[0-9a-f]{32}$/.test(id));
  check('两次不同', uuidHex() !== uuidHex());

  section('UT: splitForTts');
  const s1 = splitForTts('Hello there. How are you? I am fine!');
  check('按标点切分并合并短句', s1.length >= 1 && s1.join(' ').includes('How are you?'));
  const s2 = splitForTts('```json\n{"a":1}\n```\nOnly text.');
  check('代码围栏被剥离', s2.length === 1 && !s2[0].includes('json'));
  const s3 = splitForTts('a'.repeat(400), 180);
  check('超长截断', s3.length >= 3 && s3.every(x => x.length <= 180));
  eq('空内容返回空数组', splitForTts('**_#').length, 0);

  section('UT: fetchAliyunToken（fake fetcher）');
  let capturedUrl = '';
  const okFetcher = async (url: string) => {
    capturedUrl = url;
    return { status: 200, text: JSON.stringify({ Token: { Id: 'tk-123', ExpireTime: 9999999999 } }) };
  };
  const tk = await fetchAliyunToken('AKID', 'SECRET', okFetcher);
  eq('Token 解析', tk.token, 'tk-123');
  eq('过期时间解析', tk.expireTime, 9999999999);
  check('请求带签名参数', capturedUrl.includes('Signature=') && capturedUrl.includes('AccessKeyId=AKID') && capturedUrl.includes('Action=CreateToken'));
  const failFetcher = async () => ({ status: 403, text: JSON.stringify({ Message: 'InvalidAccessKeyId' }) });
  let errMsg = '';
  try {
    await fetchAliyunToken('AKID', 'SECRET', failFetcher);
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }
  check('失败时抛错带原因', errMsg.includes('InvalidAccessKeyId'));
}
