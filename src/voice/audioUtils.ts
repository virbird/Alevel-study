// 语音基础工具：WAV 编码、阿里云 RPC 签名、TTS 分句（纯函数，可单测）

/** 16bit 单声道 PCM → WAV（阿里 NLS ASR/评测的通用格式） */
export function encodeWav(pcm: Int16Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // 单声道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate（16bit 单声道）
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);
  return buffer;
}

/** 阿里云 RPC 规范编码（RFC3986：!'()* 也要转义，~ 不转义） */
export function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\*/g, '%2A')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/%7E/g, '~');
}

/** HMAC-SHA1 → base64（Web Crypto，桌面/iPad 全平台可用，不用 Node crypto） */
export async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) throw new Error('当前环境不支持 Web Crypto（无法签名阿里云请求）');
  const enc = new TextEncoder();
  const cryptoKey = await subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', cryptoKey, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** 阿里云 RPC API 签名（GET）：签名串 = GET&%2F&编码后的排序查询串 */
export async function buildAliyunSignature(params: Record<string, string>, accessKeySecret: string, method = 'GET'): Promise<string> {
  const sorted = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const stringToSign = `${method}&${percentEncode('/')}&${percentEncode(sorted)}`;
  return hmacSha1Base64(accessKeySecret + '&', stringToSign);
}

/** UUID（hex，无横线；阿里 NLS task_id 要求 32 位 hex） */
export function uuidHex(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

/**
 * TTS 分句：按标点切分、短句合并、超长截断（控制单次合成延迟）。
 * 先剥离代码围栏与 markdown 记号，避免把符号读出来。
 */
export function splitForTts(text: string, maxLen = 180): string[] {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>|`~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  const raw = clean.match(/[^.!?;。！？；]+[.!?;。！？；]*/g) ?? [clean];
  const out: string[] = [];
  for (let p of raw) {
    p = p.trim();
    if (!p) continue;
    while (p.length > maxLen) {
      out.push(p.slice(0, maxLen));
      p = p.slice(maxLen);
    }
    if (p && out.length && (out[out.length - 1].length + p.length + 1) <= maxLen) {
      out[out.length - 1] += ' ' + p;
    } else if (p) {
      out.push(p);
    }
  }
  return out;
}
