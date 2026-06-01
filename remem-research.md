# AI Engineer Memory Systems: Research Analysis

> Research date: 2026-05-30
> Subjects: Devin AI, OpenCLAW, Hermes Agent, Mem0, Claude Code, OpenCode
> Updated: 2026-05-31

---

## 1. Why Memory Matters for AI Engineers

An AI coding agent is fundamentally a stateful system, not a stateless LLM call. Memory is what separates it from a chatbot:

| Stateless LLM | AI Engineer with Memory |
|---|---|
| Starts fresh every session | Remembers user preferences and project conventions |
| Repeats the same mistakes | Learns from history |
| No context continuity | Maintains project mental model across sessions |
| Always a "beginner" | Gets better over time |

---

## 2. Devin AI (Cognition)

### 2.1 Architecture: Perceive → Plan → Memory → Act Loop

```
while not task_finished:
    perception = env.observe()
    plan = llm.plan(perception)
    action = executor.run(plan)
    feedback = env.evaluate(action)
    memory.store(plan, action, feedback)
```

### 2.2 Three-Layer Memory

| Layer | Content | Persistence |
|---|---|---|
| L1 Working Memory | Current task: AST, dependency graph, open files, conversation history | Session-level, cleared after task |
| L2 Episodic Memory | Past projects, task patterns, problem-solving traces | Cross-session |
| L3 Semantic Memory | General programming paradigms, best practices, framework knowledge | Longest-lived, cross-project |

### 2.3 Key Design Decisions

- **Learning from experience**: Episodic memories consolidate into semantic memory — specific solutions abstract into general best practices.
- **Multi-agent shared memory**: Influenced later frameworks (OpenDevin, AgentVerse, LangGraph) to extend memory to shared semantic stores across agents.
- **Memory-aware planning**: Planner queries memory before task decomposition to reuse prior plans.

### 2.4 Limitations

- Internal details not publicly disclosed. Architecture reconstructed from third-party analysis.
- Episodic-to-semantic consolidation mechanism has no reproducible implementation.
- Working memory interaction with context windows is opaque.

---

## 3. OpenCLAW

### 3.1 Philosophy: "Text > Brain" — File-First

All memory must be traceable to disk files. Rejects black-box vector databases.

Rationale:
1. **Full transparency** — Memory is Markdown files, viewable/editable in any text editor
2. **Low maintenance** — Filesystem naturally supports version control
3. **Hybrid search performance** — SQLite indexing + BM25 keyword + vector similarity

### 3.2 Three-Layer File Architecture

```
~/.openclaw/workspace/
├── atoms/              # One Markdown file per memory fragment (UUID + timestamp)
│   └── 3f8e1a2c-20230415-143022.md
├── collections/        # Symlink-based topic grouping
│   └── cli_preferences/ → ../atoms/3f8e1a2c-...
└── memory_index.db     # SQLite: documents, terms, vectors tables
```

YAML metadata header per atom:

```yaml
---
type: user_preference
source: chat_session_20230415
timestamp: 1681569022
tags: [bash, cli_tools]
---
Prefers Bash CLI over GUI…
```

### 3.3 Memory Lifecycle

| Stage | Window | Format |
|---|---|---|
| Short-term | Last 7 days | Full atomic files |
| Mid-term | >30 days | Merged daily summaries |
| Cold storage | >90 days | Compressed archives in object storage |

### 3.4 Search: Hybrid BM25 + Vector

- BM25 for exact queries ("show last week's meeting notes")
- Vector cosine similarity for semantic queries ("find docs similar to this proposal")
- 3.2x faster than pure vector search at 100K documents, 17% accuracy improvement

### 3.5 Active Memory

Runs as a sub-agent **before** the main agent's reasoning loop:
1. Every user interaction triggers semantic analysis
2. Extracts all potentially relevant memories
3. Prioritizes and injects at prompt top
4. Agent begins reasoning with full context

### 3.6 ClawMem — Third-Party Extension Layer

| Component | Function |
|---|---|
| QMD | Multi-signal retrieval: BM25 + vector + RRF + query expansion + cross-encoder reranking |
| SAME | Composite scoring: recency decay, confidence, content-type half-lives, co-activation |
| MAGMA | Intent classification: multi-graph traversal (semantic, temporal, causal) |
| A-MEM | Self-evolving memory notes with keywords, tags, causal links |
| Engram | Pattern extraction with deduplication and frequency-based scoring |

Hooks lifecycle: `before_prompt_build` → `agent_end` → `before_compaction` → `session_start`

### 3.7 Tradeoffs

**Pros**: Full transparency, rich plugin ecosystem, Active Memory reduces cold start.
**Cons**: Filesystem I/O bottleneck at scale, no native cross-session evolution, no hard capacity constraints → memory bloat.

---

## 4. Hermes Agent (Nous Research)

### 4.1 Philosophy: Constraint-Driven Cognitive Architecture

Inspired by **cognitive science and CPU cache hierarchy**. Core belief: **storage limits are a feature, not a bug** — they force curation and prevent context pollution.

### 4.2 Five-Layer Hierarchy

```
Layer 5: Theory of Mind (Honcho)     ← Psychological modeling, unlimited
       ↓
Layer 4: Procedural (Skills)        ← ~/.hermes/skills/*.md, reusable workflows
       ↓
Layer 3: Semantic Memory            ← MEMORY.md (~2200 chars) + USER.md (~1375 chars)
       ↓
Layer 2: Episodic Memory            ← SQLite + FTS5, full history, on-demand retrieval
       ↓
Layer 1: Working Memory             ← LLM Context Window, current session
```

**Data flows upward** (raw → refined → executable → psychological model).
**Queries flow downward** (highest-confidence layer first).

### 4.3 Two Core Files

| File | Capacity | Purpose |
|---|---|---|
| MEMORY.md | ~2200 chars / ~800 tokens | Agent's notebook: environment facts, conventions, lessons |
| USER.md | ~1375 chars / ~500 tokens | User profile: preferences, communication style, behavior patterns |

Key design: No `read` operation — both files are always injected into system prompt at session start.

### 4.4 Frozen Snapshot Pattern

```
Session start → load MEMORY.md + USER.md snapshot into system prompt
During session → new info written to disk, but system prompt unchanged
Next session → fresh snapshot loaded
```

Why: Updating system prompt mid-session invalidates the **prefix cache**, dramatically increasing API costs. Achieves ~92% cache hit rate.

### 4.5 Nudge Engine

Every ~10 turns, prompts the agent to self-reflect:
- Distill knowledge from task execution into memory
- Extract repeated patterns into skill files
- Background review, non-blocking to user

### 4.6 Skill System (Procedural Memory)

| Aspect | Detail |
|---|---|
| Format | Markdown files with version control |
| Trigger | Detected repeated tasks → auto-extract as standardized skill templates |
| Optimization | Failure → evolution → mutated variants → A/B testing |
| Security | Security scan + auto-rollback, rejects malicious writes |
| Effect | >60% improvement in subsequent execution efficiency |

### 4.7 Three-Phase Context Compression

1. Save worth-keeping info to memory
2. Protect head-3 + tail-4 messages, summarize middle
3. Trigger session split if needed

### 4.8 Tradeoffs

**Pros**: Hard constraints prevent bloat, frozen snapshot protects cache, complete learning loop (execute → evaluate → extract → optimize), safe skill mutation.
**Cons**: Strict char limits may lose edge information, skill system requires repetitions, 5-layer architecture adds complexity.

---

## 5. Mem0: Memory Layer Perspective

### 5.1 Positioning

Unlike the three agent-focused systems, Mem0 is a **general-purpose memory layer** — a drop-in component for any agent framework.

| Dimension | Devin / OpenCLAW / Hermes | Mem0 |
|---|---|---|
| Role | Complete agent system | Memory infrastructure component |
| Integration | Built-in / plugin | API / MCP / Provider interface |
| Optimization | Task completion | Memory efficiency + accuracy |

### 5.2 2026 Architecture: Single-Pass ADD-only + Multi-Signal Retrieval

**1. Single-pass ADD-only**: One LLM call per turn, no UPDATE/DELETE. Memories accumulate without overwriting. Retrieval-time scoring handles quality.

**2. Agent-generated facts as first-class**: Agent confirmations and actions stored with equal weight to user facts — critical for AI engineer scenarios.

**3. Entity linking**: Entities extracted at `add()` time, linked across memories for retrieval boosting. Replaces standalone graph DB but sacrifices graph traversal.

**4. Multi-signal retrieval fusion**: Three parallel scoring channels — semantic similarity (cosine), keyword matching (BM25), entity matching — fused via Reciprocal Rank Fusion.

### 5.3 2026 Benchmarks

| Benchmark | Score | Avg Tokens/Query | P50 Latency |
|---|---|---|---|
| LoCoMo (1540 Q, 4 categories) | **92.5** | ~6,956 | 0.88s |
| LongMemEval (500 Q, 6 categories) | **94.4** | ~6,787 | 1.09s |
| BEAM (1M) | **64.1** | ~6,719 | 1.00s |
| BEAM (10M) | **48.6** | ~6,914 | 1.05s |

Full-context baseline consumes **~26K tokens/query** vs Mem0's **~6.9K** — a **4x savings** at competitive accuracy.

### 5.4 Multi-Scope Memory Model

| Scope | Semantics |
|---|---|
| `user_id` | Cross-session persistence per user |
| `agent_id` | Per agent instance |
| `run_id` / `session_id` | Single conversation |
| `app_id` / `org_id` | Organizational sharing |

### 5.5 Proactive Memory Patterns

1. **Session-Start Scan**: Pre-fetch relevant memories at session open
2. **Context-Trigger Scan**: Monitor file references, errors, topic shifts → auto-retrieve
3. **Scheduled Reflection Scan**: Background post-session processing

### 5.6 Integration with Hermes

Hermes v0.7.0 includes Mem0 as one of 8 pluggable memory providers:

```
Pre-response: cached Mem0 results injected into system prompt (zero latency)
Post-response: (user message, reply) sent to Mem0 async for extraction
Between turns: background pre-fetch for next round
```

Three tools: `mem0_profile`, `mem0_search`, `mem0_conclude`

### 5.7 Open Problems (from Mem0's 2026 report)

- **Temporal abstraction**: BEAM 1M→10M drops ~25%, temporal queries hardest category
- **Cross-session structure evolution**: Most systems treat user change as replacement, not evolution
- **Memory staleness**: High-relevance memories becoming confidently wrong is harder than low-relevance decay
- **Cross-session identity**: Anonymous sessions, multi-device users break stable user_id assumption

### 5.8 Tradeoffs

**Pros**: Token-efficient (~25% of full-context), rich integration ecosystem (21 frameworks + 20 vector stores), multi-scope isolation, proactive memory patterns.
**Cons**: ADD-only leads to storage bloat, entity linking sacrifices graph traversal, cloud dependency for managed tier, benchmark disputes (third-party replication scores lower).

---

## 6. Cross-System Comparison

| Dimension | Devin | OpenCLAW | Hermes | Mem0 |
|---|---|---|---|---|
| Layers | 3 (working/episodic/semantic) | 3 (atom/collection/index) + lifecycle | 5 (working/episodic/semantic/procedural/ToM) | 2 (extract + retrieve) |
| Storage | Undisclosed | Markdown + SQLite | Markdown + SQLite | Vector store (pluggable) |
| Search | Implicit | BM25 + vector hybrid | FTS5 full-text | Semantic + BM25 + entity (fused) |
| Context injection | In-loop | Active Memory sub-agent | Session-start frozen snapshot | Via integration |
| Capacity constraints | Unknown | None | Strict (2200/1375 chars) | ADD-only (no constraint) |
| Cache-aware | Unknown | No | Yes (frozen snapshot) | No |
| Self-evolution | Yes (undisclosed) | Via plugins | Nudge + skill evolution | ADD-only |
| Skills | Unknown | Via plugins | Built-in | No |
| Open source | No | Yes (MIT) | Yes | Yes (Apache 2.0) |

### Core Philosophy Differences

| | Devin | OpenCLAW | Hermes |
|---|---|---|---|
| Metaphor | Growing engineer | Filesystem + search engine | Cognitive architecture + CPU cache |
| Primary goal | Maximize agent capability | Maximize transparency | Optimize cost-benefit ratio |
| Memory as | Experience accumulation | File index | Constrained curation |

---

## 7. Initial Design Proposal (before base-agent analysis)

### 7.1 Principles

1. **File as ground truth** (from OpenCLAW) — Markdown storage, git-trackable
2. **Hard constraints drive curation** (from Hermes) — capacity limits force quality
3. **Layered storage & access** (all) — hot/warm/cold tiering
4. **Cache-aware design** (from Hermes) — system prompt frozen mid-session
5. **Active evolution** (all) — automatic fact extraction and skill distillation

### 7.2 Four-Layer Architecture

| Layer | Content | Capacity | Persistence |
|---|---|---|---|
| L1 Working | Current task context | Dynamic (context window) | Session-level |
| L2 Episodic | Conversation history, tool traces, errors | Unlimited | Cross-session, time-decay |
| L3 Semantic | Project conventions, preferences, lessons | ~4K chars MEMORY.md + ~2K USER.md | Cross-session |
| L4 Procedural | Reusable workflows, skill templates | ~50 skills | Cross-session, versioned |

### 7.3 Key Innovations

- **Tiered context injection**: Always-injected (frozen snapshot) + on-demand (search) + background (project config)
- **Active consolidation**: L2 → L3 fact extraction, pattern detection → L4 skill creation
- **Contradiction detection**: Compare timestamps, deprecate old entries
- **Prefix cache warm-up**: Same system prompt across sessions maintains cache hit rate

---

## 8. Base Agent Integration Analysis

### 8.1 Claude Code's Existing Memory

| Layer | Name | Write | Capacity | Retrieval |
|---|---|---|---|---|
| L0 | CLAUDE.md | Manual | ~200 lines recommended | Loaded every session |
| L1 | Auto Memory | AI auto-write | MEMORY.md index 200 lines / 25KB | Sonnet side query (non-vector), max 5 files |
| L2 | Auto Dream | Background fork agent | Same as L1, needs ≥24h + ≥5 sessions | Scheduled consolidation |
| L3 | KAIROS | Always-on daemon (unreleased) | Time-constrained | Periodic tick signals |

**Four memory types (closed taxonomy):** user (private), feedback (private→team), project (team-biased), reference (usually team)

**Key rule**: Do not store what code alone can tell you (patterns, git history, architecture) — prevents memory-code drift.

**Auto Dream phases**: Orient → Gather → Consolidate → Prune

**Key limitations**:
- Keyword-only search (no semantic). "port conflicts" won't match "docker-compose port mapping"
- Max 5 topic files per query out of potentially hundreds
- 200-line index hard cap — old entries silently evicted
- Locked inside Claude Code — no export, no migration
- No procedural/skill memory
- No version history

### 8.2 OpenCode's Memory Ecosystem

OpenCode has **no built-in memory system**. Entirely community-plugin driven.

| Solution | Storage | Search | Key Feature |
|---|---|---|---|
| opencode-mem | SQLite + USearch | Vector search | Web UI, auto-capture, dedup |
| Muninn | ChromaDB | MCP tools + symbol index | Symbol search (functions, classes) |
| opencode-agent-memory | Markdown files + YAML | Inject to system prompt | Letta-style self-editing blocks |
| Lore | SQLite FTS5 + distillation | 3-tier recall | Best recall (~85%), 3-stage distillation |
| harness-memory | SQLite WASM | 4-layer activation engine | Human review, 73% token savings |

### 8.3 Integration Strategy

**Claude Code path**: Fuse L3 (semantic memory via Auto Memory), build L2 (vector search) and L4 (skills) ourselves via hooks/MCP.

**OpenCode path**: Build full L2+L3+L4 stack via MCP since OpenCode has no built-in memory.

**Golden rule**: Leverage base agent strengths, fill their gaps.

| Layer | Claude Code | OpenCode |
|---|---|---|
| L1 Working | ✅ Reuse built-in | ✅ Reuse context window |
| L2 Episodic | 🔶 Add vector retrieval | 🔶 Build from scratch via MCP |
| L3 Semantic | ✅ Fuse Auto Memory | 🔶 Build Markdown files + injection |
| L4 Procedural | 🔶 Add skills layer | 🔶 Build Markdown skills |

---

## 9. Final Conclusions

### 9.1 Key Takeaways from Each System

| System | Best lesson | Pitfall to avoid |
|---|---|---|
| Devin AI | Memory-driven growth; closed-loop learning | Closed source, unreproducible |
| OpenCLAW | File-as-truth philosophy; Active Memory | No hard constraints → bloat + token waste |
| Hermes | Constrained curation; frozen snapshot; Nudge-driven skill evolution | Overly strict limits may lose edge info; no vector search |
| Mem0 | Token-efficient multi-signal retrieval; rich ecosystem | ADD-only bloat; heavy dependencies; benchmark disputes |

### 9.2 Recommended Approach

1. **L2 episodic: use Sessions/ as flat Markdown files** — no database, ripgrep + `reason` CLI for search
2. **L3 semantic: MEMORY.md + TEAM.md + USER.md** — always injected, frozen snapshot, capacity-capped
3. **L4 skills: `.agents/skills/`** — auto-extracted from repeated patterns
4. **Post-processing via ACP** — second agent call after main task to extract facts
5. **Dream consolidation** — scheduled ACP call for expiry, merge, and trim

All decisions documented in `remem-plan.md`.
