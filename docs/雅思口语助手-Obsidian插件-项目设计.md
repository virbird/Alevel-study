# 雅思口语训练助手 Obsidian 插件 — 项目设计文档

> 一个类似 GPT-Live 的雅思口语练习助手，以 Obsidian 插件形式实现，利用国内大模型与语音服务 API。
> 本文档用于项目讨论与迭代，包含产品定义、架构设计、模块细节、风险对策与实施路线。

---

## 0. 背景与选型结论

### 0.1 技术选型背景（讨论摘要）

- 整体思路：实时语音对话 + AI 考官角色扮演 + 结构化评分反馈。
- 语音链路（ASR/TTS/VAD）均可本地实现；发音评估本地可达音素级纠错水平，但精度与维度（韵律、重音、升降调）弱于商业 API。
- 国内可用的语音评测服务：
  - **阿里云「智能科教内容生成平台」语音评测**：支持音标/单词/句子/段落/口语作文等题型，评分维度含完整性、准确性、流利性、韵律性，精确到音素；另有基于大模型的"口语评价"接口（白名单）。
  - **讯飞 ISE（智能口语评测）**：行业最权威，考试级，评分维度齐全。
- 国内大模型侧：豆包（实时语音大模型 API）、通义千问（App 内置"雅思口语专家"工具 + 百炼平台"英语口语练习搭子"）、讯飞星火（ISE + 星火 API）均有雅思口语相关能力。
- 载体选型结论（Chrome 插件 vs Obsidian 插件 vs PWA）：
  - **iPad 上 Chrome 不支持任何扩展** → Chrome 插件路线直接出局。
  - Obsidian 插件实现更方便（无 MV3 Service Worker 保活问题、`requestUrl` 自带 CORS 豁免）、练习记录天然沉淀为 Markdown 笔记。
  - 核心逻辑设计为平台无关，未来可复用到 PWA 版本。

### 0.2 产品定位

- **桌面**（Mac/Win/Linux）：完整功能。
- **iPad**（Obsidian Mobile）：完整功能，录音格式做兼容处理。
- `manifest.json` 声明 `isDesktopOnly: false`，全程禁用 Node.js API。

---

## 1. 产品定义

### 1.1 核心功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 模拟考试模式 | 完整走 Part 1 → Part 2（1min 准备 + 2min 陈述）→ Part 3 流程 | P0 |
| 自由陪练模式 | 选一个话题和 AI 考官自由对话，不限时 | P0 |
| 语音交互 | 按键说话（MVP）→ VAD 自动断句（进阶） | P0 |
| 发音评分 | 句子级 + 单词级评分（讯飞 ISE / 阿里云语音评测） | P1 |
| 考后报告 | LLM 生成雅思四维评分 + 改进建议，写入 Markdown 笔记 | P0 |
| 错词/表达库 | 把评分低的词、语法错误自动沉淀成可复习的笔记 | P1 |
| 题库管理 | 内置题库 + 用户自定义题目（Markdown 文件即题库） | P1 |
| 历史统计 | 练习次数、时长、分数趋势 | P2 |

---

## 2. 总体架构

```
┌────────────────────────────────────────────────────────┐
│                     UI 层 (Obsidian)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ PracticeView │ │ SettingsTab  │ │ ReportModal    │  │
│  │ (侧边栏主界面)│ │ (API配置等)  │ │ (考后报告预览)  │  │
│  └──────┬───────┘ └──────────────┘ └────────────────┘  │
└─────────┼──────────────────────────────────────────────┘
          │ 事件/状态订阅
┌─────────▼──────────────────────────────────────────────┐
│                  核心引擎层 (平台无关)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ ExamSession │  │ExamStateMachine│ │ ScoringEngine │  │
│  │ (会话编排)   │  │ (Part1/2/3流程)│ │ (评分聚合)     │  │
│  └──────┬──────┘  └──────────────┘  └───────────────┘  │
└─────────┼──────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────┐
│                    服务适配层 (Provider)                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────────┐  │
│  │ ASR    │ │ LLM    │ │ TTS    │ │PronunciationEval│  │
│  │Provider│ │Provider│ │Provider│ │ Provider         │  │
│  └────┬───┘ └────┬───┘ └───┬────┘ └────────┬────────┘  │
│       │          │         │               │            │
│    讯飞/阿里   通义/豆包/  讯飞/阿里      讯飞ISE/       │
│    /豆包      DeepSeek    /豆包         阿里云语音评测   │
└────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────┐
│                   基础设施层                             │
│  AudioRecorder(跨平台录音) │ AudioPlayer │ requestUrl封装 │
│  VaultWriter(笔记读写)     │ SessionStore(历史存储)      │
└────────────────────────────────────────────────────────┘
```

**核心设计原则**：核心引擎层和服务适配层**不依赖任何 Obsidian API**（除注入的 `requestUrl`），未来可以直接复用到 PWA 版本。

---

## 3. 目录结构

```
obsidian-ielts-coach/
├── manifest.json
├── package.json
├── esbuild.config.mjs
├── tsconfig.json
├── src/
│   ├── main.ts                    # 插件入口：注册 View/命令/设置
│   ├── settings.ts                # 设置数据模型 + SettingsTab
│   │
│   ├── ui/
│   │   ├── PracticeView.ts        # 侧边栏主界面 (ItemView)
│   │   ├── components/
│   │   │   ├── RecordButton.ts    # 按住说话按钮（含波形动画）
│   │   │   ├── ChatTranscript.ts  # 对话字幕流
│   │   │   ├── Part2Timer.ts      # Part2 准备/陈述计时器
│   │   │   └── ScoreCard.ts       # 单句评分卡片（词级高亮）
│   │   └── ReportModal.ts         # 考后报告弹窗
│   │
│   ├── core/
│   │   ├── ExamSession.ts         # 会话编排器（核心）
│   │   ├── ExamStateMachine.ts    # Part1/2/3 状态机
│   │   ├── ScoringEngine.ts       # 评分聚合与雅思分数映射
│   │   ├── QuestionBank.ts        # 题库加载与抽题
│   │   └── types.ts               # 全局类型定义
│   │
│   ├── providers/
│   │   ├── types.ts               # Provider 接口定义
│   │   ├── llm/
│   │   │   ├── QwenProvider.ts    # 通义千问 (百炼 OpenAI 兼容接口)
│   │   │   ├── DoubaoProvider.ts  # 豆包 (火山方舟)
│   │   │   └── index.ts           # 工厂函数
│   │   ├── asr/
│   │   │   ├── XfyunAsrProvider.ts    # 讯飞语音听写
│   │   │   └── AliyunAsrProvider.ts   # 阿里云一句话识别
│   │   ├── tts/
│   │   │   ├── XfyunTtsProvider.ts
│   │   │   └── AliyunTtsProvider.ts
│   │   └── eval/
│   │       ├── XfyunIseProvider.ts    # 讯飞 ISE 发音评测
│   │       └── AliyunEvalProvider.ts  # 阿里云语音评测
│   │
│   ├── audio/
│   │   ├── AudioRecorder.ts       # 跨平台录音（桌面webm/iPad mp4）
│   │   ├── AudioPlayer.ts         # TTS 播放队列（支持打断）
│   │   └── audioUtils.ts          # 重采样、WAV编码、格式转换
│   │
│   ├── storage/
│   │   ├── VaultWriter.ts         # 生成练习笔记/错词笔记
│   │   ├── SessionStore.ts        # 历史会话 JSON 存储
│   │   └── templates.ts           # Markdown 笔记模板
│   │
│   └── prompts/
│       ├── examiner.ts            # 考官角色 Prompt（分阶段）
│       └── report.ts              # 考后报告生成 Prompt
│
├── data/
│   └── question-bank.json         # 内置题库（当季常考题）
└── styles.css
```

---

## 4. 关键模块设计

### 4.1 Provider 接口（服务适配层）

所有外部服务抽象成接口，方便切换国内厂商：

```typescript
// providers/types.ts

export interface LlmProvider {
  /** 流式对话，onDelta 逐字回调用于实时显示字幕 */
  chat(messages: ChatMessage[], onDelta?: (text: string) => void): Promise<string>;
}

export interface AsrProvider {
  /** 识别一段完整音频（MVP 用非流式，够用） */
  transcribe(audio: ArrayBuffer, format: AudioFormat): Promise<AsrResult>;
}

export interface TtsProvider {
  /** 合成语音，返回可播放的音频数据 */
  synthesize(text: string, voice: VoiceConfig): Promise<ArrayBuffer>;
}

export interface PronunciationEvalProvider {
  /** 发音评测：音频 + 参考文本（ASR识别结果回传） */
  evaluate(audio: ArrayBuffer, refText: string): Promise<PronunciationResult>;
}

export interface PronunciationResult {
  overall: number;          // 总分 0-100
  pronunciation: number;    // 发音准确度
  fluency: number;          // 流利度
  integrity: number;        // 完整度
  words: WordScore[];       // 词级得分（用于UI高亮）
}

export interface WordScore {
  word: string;
  score: number;
  phonemes?: { phone: string; score: number }[];
}
```

**网络层统一封装**：所有 HTTP 调用走 Obsidian 的 `requestUrl()`（自带 CORS 豁免，桌面/移动端一致）。讯飞 WebSocket 接口（ASR/ISE 都是 WS 协议）用原生 `WebSocket`，鉴权签名（HMAC-SHA256）用 Web Crypto API 计算，**不用 Node crypto**，保证 iPad 兼容。

### 4.2 考试状态机

```typescript
// core/ExamStateMachine.ts

export type ExamPhase =
  | "idle"
  | "part1"          // 3-4个日常话题问答，约4-5分钟
  | "part2_prep"     // 发Cue Card，60秒准备
  | "part2_speak"    // 1-2分钟个人陈述
  | "part2_followup" // 考官1-2个简短追问
  | "part3"          // 围绕Part2主题的深度讨论，4-5分钟
  | "finished";

export interface ExamContext {
  phase: ExamPhase;
  topicSet: TopicSet;          // 本次抽到的题组（Part1话题+Part2卡片+Part3问题）
  turnCount: number;           // 当前阶段轮次
  startedAt: number;
  phaseStartedAt: number;
  transcript: TurnRecord[];    // 全部对话记录
}

export class ExamStateMachine {
  /** 由 ExamSession 在每轮用户回答后调用，决定是否切换阶段 */
  advance(ctx: ExamContext): PhaseTransition {
    switch (ctx.phase) {
      case "part1":
        // 规则：每个话题2-3轮，共3个话题，或时长超过5分钟 → 进入 part2_prep
        ...
      case "part2_prep":
        // 60秒倒计时结束（UI计时器触发）→ part2_speak
        ...
      case "part2_speak":
        // 用户说满2分钟被打断，或主动结束 → part2_followup
        ...
      // ...
    }
  }
}
```

**设计要点**：阶段切换由**代码规则**控制（轮次 + 计时），而不是让 LLM 自己决定——LLM 只负责在给定阶段内扮演考官。这样流程稳定可控，Prompt 也更简单。

### 4.3 会话编排器（核心流水线）

```typescript
// core/ExamSession.ts —— 一轮交互的完整流程

async handleUserSpeech(audio: RecordedAudio): Promise<void> {
  // 1. ASR 识别（同时保留原始音频）
  const asr = await this.asrProvider.transcribe(audio.data, audio.format);
  this.emit("user-transcript", asr.text);

  // 2. 并行：发音评测（不阻塞对话） + LLM 考官回复
  const evalPromise = this.evalProvider
    .evaluate(audio.data, asr.text)      // 用ASR结果做refText
    .catch(() => null);                   // 评测失败不影响对话

  const reply = await this.llmProvider.chat(
    buildExaminerMessages(this.ctx, asr.text),
    (delta) => this.emit("examiner-delta", delta)  // 流式字幕
  );

  // 3. TTS 合成并播放（按句切分，边合成边播，降低首响延迟）
  await this.speakBySentence(reply);

  // 4. 评测结果回填到该轮记录（UI异步刷新评分卡片）
  const evalResult = await evalPromise;
  this.ctx.transcript.push({
    role: "user", text: asr.text, eval: evalResult, audioRef: audio.path
  });

  // 5. 状态机推进
  const transition = this.stateMachine.advance(this.ctx);
  if (transition.changed) this.handlePhaseChange(transition);
}
```

**延迟优化关键点**：发音评测和 LLM 回复**并行**执行；TTS 按句切分流水线播放。目标：用户说完 → 考官开口 ≤ 2.5 秒（国内 API 链路的现实值）。

### 4.4 跨平台录音模块

这是 iPad 兼容的核心难点：

```typescript
// audio/AudioRecorder.ts

export class AudioRecorder {
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
    });
    // 桌面(Chromium): audio/webm;codecs=opus
    // iPad(WKWebView): audio/mp4 (AAC) —— MediaRecorder.isTypeSupported 探测
    const mimeType = pickSupportedMimeType();
    this.recorder = new MediaRecorder(this.stream, { mimeType });
    ...
  }

  async stop(): Promise<RecordedAudio> {
    // 统一转成 16kHz 16bit 单声道 WAV：
    // Blob → AudioContext.decodeAudioData → OfflineAudioContext 重采样 → WAV编码
    // 讯飞/阿里的 ASR 和评测接口都接受 PCM/WAV，一次转换全链路通用
    return { data: wavBuffer, format: "wav_16k_mono", path: savedPath };
  }
}
```

**统一策略**：不管平台录出什么容器格式，落地前都用 `AudioContext.decodeAudioData` 解码 + `OfflineAudioContext` 重采样成 **16kHz 单声道 WAV**。这一步纯 Web API，桌面和 iPad 行为一致，且是国内所有语音 API 的最大公约数格式。

### 4.5 题库设计

题库就是 Vault 里的 Markdown 文件，用户可自己编辑扩充：

```markdown
<!-- IELTS/QuestionBank/Work and Study.md -->
---
type: ielts-topic-set
season: 2026-05~08
tags: [ielts/part1, ielts/part2]
---

## Part 1: Work or Study
- Do you work or are you a student?
- Why did you choose this major/job?
- What do you like most about it?

## Part 2 Cue Card
Describe a time when you learned a new skill.
You should say:
- what the skill was
- why you learned it
- how you learned it
- and explain how you felt about learning it

## Part 3
- What skills do young people need to learn today?
- Is it better to learn from teachers or by yourself?
```

`QuestionBank.ts` 扫描指定文件夹（默认 `IELTS/QuestionBank/`），解析 frontmatter + 标题结构建立索引。插件首次启动时把内置 `question-bank.json` 释放成这些 Markdown 文件。

### 4.6 考后报告与笔记沉淀

考试结束后，`ScoringEngine` 汇总数据 → LLM 生成报告 → `VaultWriter` 写入笔记：

```markdown
<!-- IELTS/Practice/2026-08-07 Mock Test - Work and Study.md -->
---
type: ielts-practice
date: 2026-08-07
mode: mock-exam
topic: Work and Study
band_estimate: 6.0
fluency: 6.0
lexical: 5.5
grammar: 6.0
pronunciation: 6.5   # 来自讯飞ISE均分映射
duration: 13m24s
---

# 模拟考试报告 2026-08-07

## 总评 Band 6.0
> （LLM 生成的考官总评，中英对照）

## 各维度分析
### Fluency & Coherence — 6.0
- 平均语速 96 wpm，Part 2 出现 3 次超过 3 秒的停顿
- ...

## 逐轮回顾
### Part 1 · Q2: Why did you choose this major?
**你的回答**：I choose it because... ⚠️
**发音评分**：82/100（`comfortable` 68分 → /ˈkʌmftəbl/）
**更好的表达**：I chose it because...
🎧 [录音](file:///.../rec-part1-q2.wav)

## 待复习
- [ ] chose vs choose（时态） #ielts/grammar
- [ ] comfortable 发音 #ielts/pronunciation
- [ ] 高分替换：very tired → exhausted #ielts/vocab
```

**设计要点**：
- frontmatter 里的结构化分数 → 可用 Dataview 做分数趋势看板
- 待复习条目带标签 → 可配合 Spaced Repetition 插件复习
- 每轮录音文件保存到 attachment 目录，笔记内可回放

### 4.7 设置页

```typescript
interface IeltsCoachSettings {
  // LLM
  llmProvider: "qwen" | "doubao";
  llmApiKey: string;
  llmModel: string;              // 如 qwen-plus / doubao-pro-32k

  // 语音服务
  asrProvider: "xfyun" | "aliyun";
  ttsProvider: "xfyun" | "aliyun";
  ttsVoice: string;              // 英音/美音音色
  evalProvider: "xfyun" | "aliyun" | "off";
  xfyunAppId: string; xfyunApiKey: string; xfyunApiSecret: string;
  aliyunAppKey: string; aliyunToken: string;

  // 行为
  examinerAccent: "british" | "american";
  autoPlayTts: boolean;
  showSubtitles: boolean;        // 练习时是否显示字幕（防依赖）
  targetBand: number;            // 目标分，影响Part3追问深度

  // 存储
  practiceFolder: string;        // 默认 "IELTS/Practice"
  questionBankFolder: string;    // 默认 "IELTS/QuestionBank"
  saveRecordings: boolean;
}
```

API Key 存在插件 `data.json`（Obsidian 惯例），设置页加"密钥仅保存在本地 Vault"的提示；如果用户 Vault 走第三方同步，提醒注意泄露风险。

---

## 5. UI 设计（PracticeView 侧边栏）

```
┌─────────────────────────────┐
│ 🎓 IELTS Coach   [模考|陪练] │
│─────────────────────────────│
│ Part 2 · Speaking  ⏱ 1:23   │  ← 阶段指示 + 计时
│─────────────────────────────│
│                             │
│  🧑‍🏫 Describe a time when   │  ← 考官消息（Cue Card 卡片样式）
│     you learned a new skill │
│                             │
│  🗣 Last year I decided to  │  ← 用户消息 + 词级评分高亮
│     learn `swimming`(92)    │     绿≥85 黄70-84 红<70
│     because I was afraid... │
│     📊 87 · 发音85 流利89    │
│                             │
│─────────────────────────────│
│        ┌───────────┐        │
│        │  🎤 按住说话 │        │  ← 主按钮（录音时显示波形）
│        └───────────┘        │
│  [跳过] [重说] [结束考试]     │
└─────────────────────────────┘
```

交互细节：
- **按住说话**（PointerEvent，兼容 iPad 触摸）；进阶版加 VAD 自动模式开关
- 考官说话时点击主按钮可**打断**（停止 TTS 播放队列）
- Part 2 准备阶段：显示 Cue Card + 60 秒倒计时 + 一个可输入 notes 的小文本框（模拟真实考试的草稿纸）
- 结束后弹 `ReportModal` 预览报告 → 确认写入笔记

注册的 Obsidian 命令：
- `开始模拟考试` / `开始自由陪练（选话题）` / `打开练习面板` / `查看分数趋势`

---

## 6. 考官 Prompt 设计（分阶段模板）

```typescript
// prompts/examiner.ts
export function buildExaminerSystemPrompt(ctx: ExamContext, s: Settings): string {
  return `You are a certified IELTS speaking examiner with a ${s.examinerAccent} accent style.
You are conducting ${ctx.phase} of a mock speaking test.

Current topic set: ${ctx.topicSet.title}
Questions you may use: ${currentPhaseQuestions(ctx)}
Turns so far in this phase: ${ctx.turnCount}

Rules:
- Speak naturally like a real examiner: occasional "Alright", "I see", "Let's move on".
- Ask ONE question at a time. Never explain or teach during the exam.
- ${phaseSpecificRules(ctx.phase)}
- Keep each response under 40 words (it will be spoken aloud).
- Never break character. Never mention you are an AI.`;
}
```

阶段规则示例（`phaseSpecificRules`）：
- **part1**: "Ask a natural follow-up if the answer is short (<15 words), otherwise move to the next question."
- **part2_followup**: "Ask exactly one brief question about their talk, then thank them."
- **part3**: "Ask abstract, society-level questions. Challenge their opinion once per topic if target band ≥ 6.5."

关键约束：**每次回复 <40 词**——因为要 TTS 播报，考官话太长体验很差。

---

## 7. 技术风险与对策

| 风险 | 对策 |
|------|------|
| iPad `MediaRecorder` 输出 mp4/AAC | 统一用 `decodeAudioData` 转 16k WAV，已在架构中处理 |
| 讯飞 WS 签名需要 crypto | 用 Web Crypto API（`crypto.subtle`），全平台可用 |
| 讯飞 ISE 对开放式回答（无固定 refText）的评分偏差 | 用 ASR 结果作为 refText（评"你说的话说得清不清楚"）；说明文档中告知用户此评分侧重发音清晰度而非内容 |
| LLM/TTS 链路延迟 >3s 冷场 | 流式 LLM + 按句 TTS 流水线；考官加过渡语（"Mm-hmm..."先播） |
| API Key 明文存储 | 设置页明确提示；文档建议为插件单独申请低额度 Key |
| Obsidian 移动端后台会中断录音 | 不做后台录音，UI 提示"练习时请保持 Obsidian 在前台" |
| 评测服务欠费/故障 | 评测失败静默降级，不阻塞对话主流程（已在编排器设计中体现） |

---

## 8. 实施路线图

### Milestone 1 — 文字版流程跑通（约 3-5 天）
- 插件骨架、PracticeView、设置页
- 考试状态机 + 题库加载
- 通义/豆包 LLM Provider（流式），**先用文字输入代替语音**
- 考后报告生成 + 笔记写入

### Milestone 2 — 语音闭环（约 5-7 天）
- AudioRecorder（桌面）+ WAV 转换
- 讯飞/阿里 ASR + TTS Provider
- 按住说话交互 + TTS 播放队列 + 打断
- **桌面端完整可用**

### Milestone 3 — iPad 兼容 + 发音评分（约 5 天）
- iPad 录音格式适配与真机测试
- 讯飞 ISE / 阿里云语音评测 Provider
- 词级评分 UI 高亮 + 报告中的发音分析

### Milestone 4 — 打磨（持续）
- VAD 自动断句模式
- 错词沉淀 + Spaced Repetition 联动
- Dataview 分数趋势模板
- 提交 Obsidian 社区插件市场（可选）

---

## 9. 开发环境与依赖

- **构建**：esbuild（Obsidian 官方 sample plugin 同款），TypeScript strict
- **零运行时依赖**目标：不引入大型 npm 包（音频处理用 Web API，签名用 Web Crypto），保证移动端体积和兼容性
- **调试**：桌面用 Obsidian 开发者控制台；iPad 端依赖日志面板输出调试
- **测试 Vault**：单独建一个测试 Vault，用 `hot-reload` 社区插件加速迭代

---

## 10. 附录：备选方案记录

### 10.1 完全本地化的语音链路（备选，未采用）

| 模块 | 本地方案 |
|------|---------|
| ASR | Whisper.cpp / Faster-Whisper / FunASR / Wav2Vec 2.0 |
| VAD | Silero-VAD / WebRTC VAD |
| TTS | Piper / Coqui TTS / MeloTTS / Fish Speech |
| 发音评估 | Montreal Forced Aligner (MFA) + Wav2Vec2 音素识别 + GOP 算法 |

局限：发音评估本地可达"单词级/音素级纠错"实用水平，但韵律、语调、连读评分难以达到商业 API 精度；且需要本地模型部署与 GPU 资源，与"Obsidian 插件零依赖"的形态冲突，故仅作为未来高级选项保留。

### 10.2 端到端实时语音（备选，未采用）

豆包实时语音大模型 API 提供端到端语音对话（ASR+LLM+TTS 一体），延迟最低。未采用原因：评分维度弱、无法拿到独立 ASR 文本用于笔记沉淀与词级评分。可作为未来"快速陪练模式"的可选通道。

### 10.3 PWA 网页版（远期选项）

与 Obsidian 插件共用核心引擎代码，覆盖所有平台浏览器（含 iPad Safari）。需要自建后端中转（密钥不暴露、解决 CORS）。当插件成熟后作为分享给他人的分发形态。
