// 跨平台录音：桌面 webm / iPad mp4 → 统一 16kHz 单声道 PCM/WAV（纯 Web API）
import { encodeWav } from './audioUtils';

export interface RecordingResult {
  pcm: Int16Array;       // 16kHz 单声道
  wav: ArrayBuffer;      // 可直接保存/上传
  seconds: number;
}

/** 任意容器音频（webm/mp4/wav…）→ 16kHz 单声道 PCM */
export async function blobToPcm16k(blob: Blob): Promise<{ pcm: Int16Array; seconds: number }> {
  const buf = await blob.arrayBuffer();
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(buf);
  } finally {
    void ctx.close();
  }
  const target = 16000;
  const len = Math.max(1, Math.ceil(decoded.duration * target));
  const off = new OfflineAudioContext(1, len, target);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const f32 = rendered.getChannelData(0);
  const pcm = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const v = Math.max(-1, Math.min(1, f32[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return { pcm, seconds: rendered.duration };
}

/**
 * 按住说话录音器：start() 开始，stop() 结束并返回统一格式。
 * 平台差异只存在于 MediaRecorder 容器（isTypeSupported 探测），
 * 落地前统一 decodeAudioData + 重采样，ASR 全链路通用。
 */
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前环境不支持录音');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e: BlobEvent): void => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.start(250);
  }

  /** 结束录音并转 16k WAV；释放麦克风 */
  async stop(): Promise<RecordingResult> {
    const rec = this.rec;
    if (!rec) throw new Error('录音未开始');
    const stopped = new Promise<void>(resolve => {
      rec.onstop = (): void => resolve();
    });
    rec.stop();
    await stopped;
    this.release();
    const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
    this.chunks = [];
    const { pcm, seconds } = await blobToPcm16k(blob);
    return { pcm, wav: encodeWav(pcm, 16000), seconds };
  }

  /** 放弃录音（不返回数据） */
  cancel(): void {
    try {
      if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    } catch { /* 已停止 */ }
    this.release();
    this.chunks = [];
  }

  private release(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.rec = null;
  }
}
