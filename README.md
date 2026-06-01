# Remem

**Re** (in Act) + **Mem** (ory) — persistent memory layer for AI coding agents on top of the [Re in Act](https://re-in-act.org) specification.

Built on the `.agents/` standard, with zero databases. All memory is plain Markdown files.

## Quick Start

```
git clone https://github.com/RIA-Spec/remem.git
cd remem
# See remem-plan.md for full implementation details
```

## Structure

```
.agents/memory/MEMORY.md   — Project facts (always injected, 5K chars / 200 lines)
.agents/memory/TEAM.md     — Organization facts (3K chars / 100 lines)
.agents/memory/USER.md     — Current user preferences (2K chars / 80 lines)
.agents/memory/People/     — Per-person knowledge (lazy loaded)
.agents/memory/Sessions/   — Episodic memory (on-demand search, uncapped)
.agents/skills/            — Procedural memory via standard SKILL.md
```

## Prompts

- `prompts/init-memory.md` — Bootstrap memory from enterprise sources
- `prompts/extract-facts.md` — Extract facts from ACP trajectory
- `prompts/dream.md` — Background consolidation (expiry, merge, trim)

## Tech Stack

- TypeScript + `@mcpc-tech/acp-ai-provider`
- Claude Code / OpenCode (via ACP)
- `reason` CLI (Re in Act)
- ripgrep (or grep)

## Spec

Memory system design follows the [Re in Act](https://re-in-act.org) open specification — see `remem-plan.md`.
