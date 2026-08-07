// 阿里云智能语音（NLS）：Token 获取 + 一句话识别（ASR）+ 语音合成（TTS）
// 全链路走浏览器原生 WebSocket / requestUrl，iPad 兼容（不用 Node API）。
import { buildAliyunSignature, uuidHex } from './audioUtils';

const TOKEN_URL = 'https://nls-meta.cn-shanghai.aliyuncs.com/';
const WS_URL = 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1';

/** HTTP 传输抽象：插件内传 requestUrl 适配器，测试传 fake */
export type HttpFetcher = (url: string) => Promise<{ status: number; text: string }>;

export interface AliyunTokenResult {
  token: string;
  expireTime: number; // unix 秒
}

/** 获取 NLS Token（CreateToken RPC，HMAC-SHA1 签名） */
export async function fetchAliyunToken(accessKeyId: string, accessKeySecret: string, fetcher: HttpFetcher): Promise<AliyunTokenResult> {
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: 'CreateToken',
    Format: 'JSON',
    RegionId: 'cn-shanghai',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: uuidHex(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2019-02-28',
  };
  const Signature = await buildAliyunSignature(params, accessKeySecret);
  const qs = [...Object.entries(params), ['Signature', Signature] as [string, string]]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const res = await fetcher(`${TOKEN_URL}?${qs}`);
  let j: { Token?: { Id?: string; ExpireTime?: number }; Message?: string } = {};
  try {
    j = JSON.parse(res.text) as typeof j;
  } catch {
    throw new Error(`阿里云 Token 响应解析失败（HTTP ${res.status}）`);
  }
  if (!j.Token?.Id) throw new Error(`阿里云 Token 获取失败：${j.Message ?? res.text.slice(0, 80)}`);
  return { token: j.Token.Id, expireTime: j.Token.ExpireTime ?? 0 };
}

interface NlsMessage {
  header: { name: string; status?: number; status_text?: string };
  payload?: { result?: string };
}

export interface AsrOptions {
  token: string;
  appKey: string;
  wsUrl?: string;
  /** 诊断日志回调（插件传入 voiceLog）：记录握手与每一帧响应 */
  onLog?: (stage: string, detail: string) => void;
}

/**
 * 一句话识别：16kHz 单声道 PCM → 文本。
 * 流程：StartRecognition → 分块发二进制（100ms 音频/块，轻微节流）→ StopRecognition → RecognitionCompleted。
 */
export function aliyunAsr(pcm: ArrayBuffer, cfg: AsrOptions): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const log = cfg.onLog ?? ((): void => {});
    const ws = new WebSocket(`${cfg.wsUrl ?? WS_URL}?token=${encodeURIComponent(cfg.token)}`);
    const taskId = uuidHex();
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error('识别超时（60 秒）')), 60000);

    const finish = (err: Error | null, result = ''): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try { ws.close(); } catch { /* 已关闭 */ }
      if (err) reject(err);
      else resolve(result);
    };

    ws.onopen = (): void => {
      const msg = JSON.stringify({
        header: {
          message_id: uuidHex(), task_id: taskId, namespace: 'SpeechRecognizer',
          name: 'StartRecognition', appkey: cfg.appKey,
          payload: { format: 'pcm', sample_rate: 16000, enable_intermediate_result: false, enable_punctuation_prediction: true, enable_inverse_text_normalization: true },
        },
      });
      // 握手诊断：记录 appKey 实际值与帧内容，定位「Missing message appkey」类网关报错
      log('ASR 握手', `appKey=${JSON.stringify(cfg.appKey)} len=${msg.length} contains=${msg.includes('"appkey"')}`);
      log('ASR 握手帧', msg);
      ws.send(msg);
    };

    ws.onmessage = (ev: MessageEvent): void => {
      if (typeof ev.data !== 'string') return;
      log('ASR 收到帧', ev.data.length > 300 ? ev.data.slice(0, 300) + '…' : ev.data);
      let m: NlsMessage;
      try {
        m = JSON.parse(ev.data) as NlsMessage;
      } catch {
        return;
      }
      if (m.header.name === 'RecognitionStarted') sendAudio();
      else if (m.header.name === 'RecognitionCompleted') finish(null, m.payload?.result ?? '');
      else if (m.header.name === 'TaskFailed') finish(new Error(`识别失败：${m.header.status_text ?? m.header.status ?? ''}`));
    };

    ws.onerror = (): void => finish(new Error('识别连接失败（检查网络与 Token）'));

    /** 分块发送 PCM：3200 字节/块（100ms 音频），块间 20ms 节流避免被限流 */
    const sendAudio = (): void => {
      const bytes = new Uint8Array(pcm);
      const CHUNK = 3200;
      let i = 0;
      const pump = (): void => {
        if (settled || ws.readyState !== WebSocket.OPEN) return;
        if (i >= bytes.length) {
          ws.send(JSON.stringify({ header: { message_id: uuidHex(), task_id: taskId, namespace: 'SpeechRecognizer', name: 'StopRecognition' } }));
          return;
        }
        ws.send(bytes.slice(i, i + CHUNK));
        i += CHUNK;
        window.setTimeout(pump, 20);
      };
      pump();
    };
  });
}

/**
 * 语音合成：文本 → 音频（mp3，16kHz）。按句调用，配合播放器实现可打断的按句播报。
 */
export function aliyunTts(text: string, cfg: { token: string; appKey: string; voice?: string; wsUrl?: string }): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const ws = new WebSocket(`${cfg.wsUrl ?? WS_URL}?token=${encodeURIComponent(cfg.token)}`);
    ws.binaryType = 'arraybuffer';
    const taskId = uuidHex();
    const chunks: ArrayBuffer[] = [];
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error('合成超时（30 秒）')), 30000);

    const finish = (err: Error | null): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try { ws.close(); } catch { /* 已关闭 */ }
      if (err) reject(err);
      else {
        const total = chunks.reduce((n, c) => n + c.byteLength, 0);
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { out.set(new Uint8Array(c), off); off += c.byteLength; }
        resolve(out.buffer);
      }
    };

    ws.onopen = (): void => {
      ws.send(JSON.stringify({
        header: { message_id: uuidHex(), task_id: taskId, namespace: 'SpeechSynthesizer', name: 'StartSynthesis', appkey: cfg.appKey },
        payload: { voice: cfg.voice ?? 'annie', format: 'mp3', sample_rate: 16000, volume: 50, speech_rate: 0, pitch_rate: 0, text },
      }));
    };

    ws.onmessage = (ev: MessageEvent): void => {
      if (typeof ev.data !== 'string') {
        chunks.push(ev.data as ArrayBuffer);
        return;
      }
      let m: NlsMessage;
      try {
        m = JSON.parse(ev.data) as NlsMessage;
      } catch {
        return;
      }
      if (m.header.name === 'SynthesisCompleted') finish(null);
      else if (m.header.name === 'TaskFailed') finish(new Error(`合成失败：${m.header.status_text ?? m.header.status ?? ''}`));
    };

    ws.onerror = (): void => finish(new Error('合成连接失败（检查网络与 Token）'));
  });
}
