# A-Level Study Coach (Obsidian Plugin)

> 中文版本：[README.zh.md](./README.zh.md)

An **assistive** A-Level study coach for Obsidian: learning stays offline-first — open the plugin
only when you need help: an unclear concept, a problem you're stuck on, or essay grading.
Every request is logged so weaknesses surface over time. Targets: A-Level all A*, IELTS 7.5+.

Product design: `docs/产品设计.md` (v0.3). Prompt system from the chat-2 coach pack;
tech base simplified-forked from AI Study Buddy.

## Feature Overview

### Coach Sessions

| Feature | Description |
|---|---|
| Per-subject sessions | Each subject keeps its own session; switching saves/restores automatically; concluding closes it |
| Auto session start | A session opens instantly when you enter a subject — no button needed; sessions with no user input are never recorded |
| Opening mode menu | The opening is rendered locally from the prompt's ` ```opening ` fence (zero API call): Concept Drill A–G (blind write / decomposition / colloquial rewrite / logic chain / drill / **F concept relation map — chapter-level: includes learned + not-yet-learned concepts, the latter marked as preview with a short auto-explanation, mermaid with keyword edges** / **G keyword recall — reproduce the whole map from keywords**); Economics A–D; IELTS A–D. Reply with a letter to pick a mode, jump anytime, or let the AI guide by context |
| Concept map | After a chapter-level F map, a confirm card registers concepts to `记录/概念地图.md` (chapter/concept/status); preview/pending concepts are auto-injected into the drill prompt so they switch to detailed mastery when actually learned, and become “learned” after confirmation; the records center shows the ledger |
| Conclude flow | Conclude = self-review, scrutiny, error-log rows, session tagging; then auto-archive and auto-reopen a fresh session |
| Problem solving & correction (unified) | Being stuck on a new problem and correcting a wrong one share one flow: any problem request enters it (with your attempt → compare; stuck → first ask how far you got); attempt images auto-transcribed; three-tier baseline for the correct answer (official / model solution verified by you / pending); locate the divergence and guide the correction; after conclude, a confirm card registers to the wrong-answer ledger and unmastered entries are auto-injected into later sessions |
| Session extras | SSE streaming output, image attachments (vision models; more than 4 images are auto-batched for recognition with per-batch progress and resume-on-failure, transcripts merged into the session record), session-wide doc references, resume from history |
| Think-first timer | In-session countdown; sending is blocked before the threshold; finishing adds a "thinking credit" note to the next message |

### Context & Models

| Feature | Description |
|---|---|
| Global model selector | Top-bar dropdown applies to every AI call; the settings page manages models as a list per provider (add / test individually / set default / delete) |
| Context management | Usage shown under the input box ("x / y (n%)"); auto-compress threshold is configurable (default 80%); over-limit turns red with a "force compress" button; compression is long-running and always shows progress notices |

### Records & Review

| Feature | Description |
|---|---|
| Error log ledger | 13-column main table; recurrence auto +1; review in 7 days (3 if recurring); status flows unresolved → observing → resolved |
| 3-way routing | Specific losses → ledger; question-type habits → practice focus; vague claims → weakness impressions |
| Records center | One tab shows all ledgers: A-Level error log + IELTS grades + expression library + question log (data files stay separate — zero information loss) |
| Review reminders | The Review tab shows today's full due list in four queues: error-log points (per item: variant question / passed / recurred), term drills, expression sentence drills, wrong-answer follow-up (per-item "mastered after redo"); you can also practice offline — report results in natural language for batch parsing, or give per-item feedback directly; plus status-bar badge and one gentle daily notice |
| Quick capture | One natural-language sentence → AI suggests a category → accept / edit / discard |

### Weakness Analysis

| Feature | Description |
|---|---|
| Insight engine | Question hotspots × recurrence hotspots × expression-code trends × term/review backlogs; pure local stats; a suggestion needs ≥3 hits on one signal |
| Suggestion cards | Persisted under `建议/`; view/disagree feedback loop; study advice is generated once, only after consent (no schedules) |
| Weekly report | `周报/{ISO-week}.md` with six stat blocks (help, losses & recurrence, reviews, terms, IELTS, suggestions) |
| Advanced corner | Stage-based advanced-exam roadmap (G10 UKMT → G11 MAT/TMUA → G12 STEP/PAT/ESAT) with one-click thinking-problem sessions and auto timer |

### IELTS

| Feature | Description |
|---|---|
| Unified entry | Coach "IELTS Writing": A full grading / B paragraph commentary / C discussion & dispute / D targeted practice — freely mixed and switchable mid-session |
| Grade any note | Open any note (task + essay, images included); six-part output written to `## AI 批改`; re-grading archives the previous version for comparison |
| Score ledger | Every grade appends overall + TR/CC/LR/GRA to `雅思/批改记录.md` — your improvement trajectory |
| Expression library | High-score expressions auto-collected (deduplicated) with simplified SM-2 intervals 1→3→7→14→30→60 days and due sentence drills |
| Speaking training | Coach "IELTS Speaking": A full mock exam (Part 1→2→3) / B single-part focus / C free practice / D discussion & review; delayed & limited corrections, first-session calibration with staged targets (stepwise path to 7.5), evidence-based Band-7 scoring (ranges, no flattery); final scores go to `雅思/口语记录.md` alongside the writing trend, speaking mistakes to the existing wrong-answer ledger (SP/GR/VX), upgraded expressions to the library; voice pipeline (Aliyun NLS): 🎤 hold-to-talk ASR with auto-send, examiner replies read aloud sentence-by-sentence via TTS (interruptible), recordings normalized to 16k WAV (optionally saved); falls back to text mode when keys are unset; P-dimension pronunciation eval awaits P5c |

## Data Locations (all inside the vault, syncable via git / iCloud)

```
vault/StudyCoach/
├── 档案.md          # student profile (frontmatter, editable in settings)
├── 三年路线图.md    # 3-year roadmap
├── prompts/         # coach prompts (with ```opening fences), directly editable
├── 建议/            # weakness suggestion cards
├── 雅思/            # essays / speaking reports / grade ledger / speaking ledger / expression library
├── 周报/            # weekly reports (idempotent overwrite)
├── 记录/            # error log, wrong-answer ledger, concept map, question log, terms, practice focus, impressions, stats, progress, diary
└── 会话/            # session archives (only written if there was interaction)
```

## Installation

```bash
npm install
npm run build
./install.sh /path/to/your/vault
```

Then in Obsidian: Settings → Community plugins → enable **A-Level Study Coach** → configure the LLM
in plugin settings (OpenAI-compatible endpoint or native Anthropic; the API key stays on your machine).

## Development

```bash
npm run dev        # esbuild watch
npm run typecheck  # tsc --noEmit
npm test           # full UT + FVT suite (must stay green on every change)
```

Test suite (test/, obsidian isolated via FakeVault, runs directly in node):

| Layer | Scope |
|---|---|
| UT | utils / errorlog / services / insight / ielts / report: parsing, ledger rules, state machines, analysis thresholds, grading tolerance, report stats |
| FVT: session | Full help loop: injection → conclude → tagging + ledger → recurrence → archive & resume |
| FVT: dataflow | Cold-start 3-way routing, review flow, analysis cycle |
| FVT: ielts | Grading closed loop: write-back → scores ledger → expression dedup → trend weak spots |

## Known Limitations (by design)

- Term/expression drill modals are non-streaming (replies are short)
- No IELTS listening/reading features (offline-learning scope); speaking voice requires Aliyun keys (text mode otherwise); P-dimension pronunciation eval awaits P5c
- Reports/radar are plain-text stats; no chart libraries (kept lightweight)
- Prompt template updates never overwrite existing vault files (user edits win)
- Streaming relies on fetch; if a provider blocks browser CORS, use an OpenAI-compatible gateway
