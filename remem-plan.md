# Remem — Re in Act Memory System for AI Engineers

> Date: 2026-05-31
> Stack: TypeScript + `@mcpc-tech/acp-ai-provider`
> Base agents: Claude Code / OpenCode (via ACP)
> CLI: `remem`
> Spec: re-in-act.org

---

## 1. Architecture Overview

```
User request
    │
    ▼
┌──────────────────────────────────────────────────┐
│               Orchestration Layer (us)            │
│                                                   │
│  1. Preload L3 facts (MEMORY.md / USER.md /      │
│     TEAM.md → inject into context)                │
│  2. Call Agent via ACP (Claude Code / OpenCode)  │
│  3. Agent returns trajectory                      │
│  4. Post-processing:                              │
│     ├─ Write Sessions/ (L2, append-only)          │
│     ├─ Second ACP call to run                     │
│     │  extract-facts prompt → structured facts    │
│     ├─ Based on facts:                            │
│     │   ├─ Write MEMORY.md / TEAM.md (capped)     │
│     │   ├─ Write People/ (uncapped)               │
│     │   └─ Detect skill patterns (≥3 occurrences) │
│  5. Scheduled Dream (background consolidation)    │
└──────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────┐
│       ACP Provider (@mcpc-tech/acp-ai-provider)   │
│       → Claude Code / OpenCode                   │
└──────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
.agents/
├── memory/                         ← L3 semantic memory
│   ├── MEMORY.md                   ─ Project facts (always injected, 5K chars / 200 lines)
│   ├── TEAM.md                     ─ Organization facts (always injected, 3K chars / 100 lines)
│   ├── USER.md                     ─ Current user preferences (always injected, 2K chars / 80 lines)
│   ├── People/                     ─ Per-person knowledge (lazy loaded, uncapped)
│   │   ├── alice.md
│   │   └── bob.md
│   └── Sessions/                   ─ Episodic memory (on-demand search, uncapped)
│       ├── alice/
│       │   ├── 2026-05-30.md
│       │   └── 2026-05-31.md
│       └── bob/
│           ├── 2026-05-29.md
│           └── 2026-05-31.md
└── skills/                         ─ L4 procedural memory (lazy loaded)
    ├── db-migration/
    │   └── SKILL.md
    └── deploy/
        └── SKILL.md
```

---

## 3. CLAUDE.md and AGENTS.md

### File relationship

```markdown
<!-- CLAUDE.md (Claude Code entry) -->
@AGENTS.md
```

```markdown
<!-- AGENTS.md (cross-tool standard entry) -->

## Bash Tools

When using `bash`, long command output can pollute the context window.
If output is noisier than needed, pipe through `reason` to extract
only what is relevant:

```bash
<cmd> | reason --prompt "goal: ..." --prompt - --structure '{...}'
```

See re-in-act.org for the spec.

## Memory

At the start of each session, read the following files for project context:

- `.agents/memory/MEMORY.md` — project facts and conventions
- `.agents/memory/TEAM.md` — team topology and workflow
- `.agents/memory/USER.md` — current user preferences

## Session Search

Sessions are organized by person, then by date:

```
.agents/memory/Sessions/<person>/<date>.md
```

Use `reason` CLI with rg/grep to search:

```bash
rg "<query>" .agents/memory/Sessions/ | reason --prompt "goal: find relevant sessions" --prompt - --structure '{"results": [{"file":"","snippet":""}]}'
```

## People

When you need to understand a specific team member, read from `.agents/memory/People/`.
```

### AGENTS.md size note

| Tool | Limit | Actual |
|---|---|---|
| Codex | 32 KiB hard limit (silent truncation) | Our AGENTS.md is ~10-20 lines, well under |
| Claude Code | No hard limit | Same |

---

## 4. Context Injection Strategy

### Always-injected (L3a / L3b / L3d)

Three files are read and injected at session start, **frozen for the entire session**:

| File | Cap | Write policy | On full |
|---|---|---|---|
| `MEMORY.md` | 5,000 chars / 200 lines | Check before write | Return error + current entries, AI decides replacement |
| `TEAM.md` | 3,000 chars / 100 lines | Same | Same |
| `USER.md` | 2,000 chars / 80 lines | Same | Same |

**Frozen snapshot mechanism** (inspired by Hermes):

```
Session start → read latest content → snapshot → inject into context
During session → post-processing writes to disk → snapshot unchanged
Next session → read latest → new snapshot
```

### Lazy loaded (uncapped)

| Content | Load trigger |
|---|---|
| `People/*.md` | Person mentioned or task touches their domain |
| `Sessions/` | Agent runs session search |
| `skills/` | Task matches skill description |

### USER.md identity

The AI engineer is a background service, not a human user:

- USER.md is the **AI engineer's own identity**, no dynamic switching
- People/ stores the AI engineer's **knowledge of other team members**
- Current user detection: `$AI_USER` → `git config user.name`

---

## 5. L2 Episodic Memory (Sessions/)

### Write

Each ACP call appends the trajectory to:

```
.agents/memory/Sessions/{person_name}/{date}.md
```

One file per person per day, append mode.

### Retention

- Last 1 month retained in `.agents/memory/Sessions/`
- Older sessions archived to object storage
- Archived files can be deleted locally; pulled from object storage on demand

### Format

Keep key action traces, not full conversation:

```markdown
## 2026-05-31 14:00

user: Add debounce to user list search
→ read UserList.tsx
→ grep "debounce" src/
ai: Currently onChange directly calls setState. Recommend lodash.debounce(300ms)
→ edit UserList.tsx (L45-L60)
user: OK, use lodash debounce
→ edit UserList.tsx (L45-L60)
ai: Done. Uses lodash.debounce(300ms)
```

Tool calls prefixed with `→` for easy grepping.

### Search

Search method is defined in AGENTS.md. The Agent follows those instructions at runtime. See AGENTS.md Session Search section.

---

## 6. L3 Semantic Memory

### 6.1 Operations

The Agent may edit `.agents/memory/` files freely — `read` + `edit` / `write` / `bash`, whatever it prefers.

One rule: **check capacity before writing to context-injected files**.

For MEMORY.md / TEAM.md / USER.md:

- Check current size before writing
- If full, do not silently discard: merge old entries to make room, or flag for Dream to handle

### 6.2 Capacity management

```
Agent tries to add "Use pnpm, not npm" to MEMORY.md:

→ If under limit: append
→ If full: return
{
  "success": false,
  "error": "MEMORY.md is full (198/200 lines). Replace or remove entries first.",
  "current_entries": [
    "- [P1] Use pnpm",
    "- [P2] TypeScript strict mode",
    ...
  ],
  "usage": "198/200 lines"
}
```

Priority labels `[P0]`-`[P4]` guide AI decisions but are not hard rules:

| Label | Meaning | Expected retention |
|---|---|---|
| `[P0]` | Do not delete (security/compliance) | Permanent |
| `[P1]` | Important convention | Long-term |
| `[P2]` | Regular fact | Medium |
| `[P3]` | Temporary/phase-specific | Until done |
| `[P4]` | Observation/unverified | May be dropped anytime |

### 6.3 Security scan

Content written to MEMORY.md / TEAM.md / USER.md is scanned for:

- Prompt injection attempts
- Role hijacking
- Unreasonable system directives

Matches are rejected and logged.

---

## 7. L4 Procedural Memory (Skills)

### Directory

```
.agents/skills/<skill-name>/
  └── SKILL.md
```

Follows standard SKILL.md format: YAML frontmatter + Markdown steps.

### Auto-extraction trigger

When the same operation pattern repeats ≥3 times, the Agent flags it for user confirmation:

```
Detected 3 occurrences of:
  1. prisma migrate dev --name <name>
  2. Review generated SQL
  3. prisma generate
  4. Run tests

Save as skill? (y/n)
```

On confirmation, creates `.agents/skills/<name>/SKILL.md`.

### Execution

The Agent reads SKILL.md and judges each step's applicability at runtime.

---

## 8. Post-Processing Flow (After ACP Call)

```
Input: ACP trajectory (full conversation + tool calls), written to temp file

Step 1 — Write Sessions
  trajectory → append to Sessions/{person_name}/{date}.md
  Zero filtering, append-only

Step 2 — Extract facts
  Orchestrator makes a second ACP call with `prompts/extract-facts.md`
  → Agent reads trajectory file → outputs structured JSON facts
  → Orchestrator receives result

Step 3 — Write MEMORY.md / TEAM.md
  Process project_facts and team_facts only
  Strategy A: check capacity, write if room, skip+flag if full

Step 4 — Contradiction detection
  Process contradictions
  For each: compare timestamps of existing vs new
  Keep newest, annotate old entry with deprecation reason and date
  Write to MEMORY.md or TEAM.md

Step 5 — Write People/
  Process person_insights only
  Strategy B: write directly to People/{name}.md
  No capacity limits, lenient

Step 6 — Stage skill candidates
  Process skill_candidates
  Accumulate pattern count, flag for confirmation at ≥3
```

### Write strategy comparison

| | Strategy A (context-injected) | Strategy B (lazy loaded) |
|---|---|---|
| Target files | MEMORY.md, TEAM.md, USER.md | People/, Sessions/, skills/ |
| Capacity check | Strict, reject if full | None |
| Pre-write validation | Capacity + security scan | Security scan only |
| Principle | Quality first | Quantity first |

---

## 9. Initialization

On first deployment, the orchestrator calls the Agent via ACP with `prompts/init-memory.md`.

Given a list of source file paths (org charts, wikis, READMEs, etc.), the Agent reads each one and produces the first drafts of MEMORY.md, TEAM.md, and People/{name}.md.

---

## 10. Dream (Background Consolidation)

### Trigger

- ≥ 24 hours since last run
- ≥ 5 new sessions accumulated

### Four phases

Orchestrator calls the Agent via ACP with `prompts/dream.md`.
The Agent reads current memory files and recent sessions, then executes:

| Phase | Operation |
|---|---|
| **Expiry check** | Flag P3/P4 entries unconfirmed for >60 days; flag completed milestones |
| **New info extraction** | Cross-session pattern scanning for consolidatable knowledge |
| **Merge & dedup** | Merge duplicates, resolve contradictions, compress People/ |
| **Trim** | Enforce MEMORY.md (200 lines / 5K chars) and TEAM.md (100 lines / 3K chars) limits |

### Runtime

Scheduled by orchestrator. Dream process:

- Read: full access to L2 Sessions/
- Write: `.agents/memory/` and `.agents/skills/` only

---

## 11. Relationship with Claude Code Auto Memory

| Dimension | Claude Code Auto Memory | Our memory system |
|---|---|---|
| Storage | `~/.claude/projects/<hash>/memory/` | `.agents/memory/` (project root) |
| Write | Claude Code internal | ACP post-processing |
| Trigger | During Claude Code execution | After ACP call |
| Read | Claude Code only | Standard files, any tool can read |
| Sync | **No sync** | Independent, content may differ |

**No sync.** The two systems can cross-validate — different observations of the same work provide complementary perspectives.

---

## 12. Phase Order

| Phase | Content | Deliverable | Depends on |
|---|---|---|---|
| **P1** | Initialization | ACP call with init-memory.md | None |
| **P2** | Directory skeleton + AGENTS.md | `.agents/memory/{MEMORY,TEAM,USER}.md`, AGENTS.md with rules | None |
| **P3** | Sessions auto-write | ACP post-processing Step 1 | P2 |
| **P4** | Fact extraction | ACP post-processing Step 2, call Agent with extract-facts.md | P2 |
| **P5** | Fact write logic | Post-processing Steps 3-6, orchestration writes from JSON | P4 |
| **P6** | Security scan | Pre-write scan for MEMORY.md/TEAM.md/USER.md | P5 |
| **P7** | People auto-extraction | Post-processing Step 5 | P4 |
| **P8** | Skill detection | Pattern recognition + user confirmation flow | P4 |
| **P9** | Dream consolidation | Scheduled ACP call with dream.md | P1-P8 |

---

## 13. Dependencies

| Dependency | Purpose | Source |
|---|---|---|
| `@mcpc-tech/acp-ai-provider` | ACP-based Agent calls | npm |
| `ai` (Vercel AI SDK) | LLM calls | npm |
| `@one-agent/reason` | Re in Act CLI (Agent session search) | npm |
| ripgrep (optional) | Fast text search for Agent, falls back to grep | System tool |

No other external dependencies. All data stored as Markdown files, zero databases.
