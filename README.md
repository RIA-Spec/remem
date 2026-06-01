# Remem

**Re** (in Act) + **Mem** (ory) — persistent memory system for **AI Engineers** running on Claude Code / OpenCode.

Built on the [Re in Act](https://re-in-act.org) spec and the `.agents/` standard.
Zero databases. All memory is plain Markdown files.

> An AI Engineer is more than a coding agent. It knows the codebase, the team, and past decisions — and gets better over time.

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
