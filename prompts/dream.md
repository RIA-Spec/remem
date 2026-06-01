# Dream Consolidation

Scheduled background consolidation — a reflective pass over memory files.

## Trigger

- ≥ 24 hours since last run
- ≥ 5 new sessions accumulated since last run

## Prompt

You are performing a Dream — a reflective consolidation of memory files.

Current memory state:
MEMORY.md ({{memory_usage}}/5000 chars, {{memory_lines}}/200 lines):
{{memory_content}}

TEAM.md ({{team_usage}}/3000 chars, {{team_lines}}/100 lines):
{{team_content}}

People/ overview:
{{people_summary}}
(Each person: name + entry count)

Read recent Sessions first, then execute four phases:

Phase 1 — Expiry check
- Flag P3/P4 entries unconfirmed for >60 days
- Flag completed milestones with residual entries
- Output candidate deletion list

Phase 2 — New information extraction
- Scan cross-session patterns for consolidatable knowledge
- When capacity is tight, prefer replacing low-value entries

Phase 3 — Merge and deduplicate
- Merge semantically duplicate entries, keep the more complete one
- Resolve contradictions: keep newest, annotate old entry with deprecation reason
- Compress People/ entries that exceed reasonable length

Phase 4 — Trim and enforce limits
- Ensure MEMORY.md stays within 200 lines / 5000 chars
- Ensure TEAM.md stays within 100 lines / 3000 chars
- Delete candidates from Phase 1 if over capacity

Output JSON:
{
  "memory_updates": [
    { "action": "delete|merge|keep", "content": "...", "reason": "..." }
  ],
  "team_updates": [
    { "action": "delete|merge|keep", "content": "...", "reason": "..." }
  ],
  "people_updates": [
    { "name": "alice", "action": "add|merge", "content": "..." }
  ],
  "skill_candidates": [
    { "name": "...", "steps": [...], "confidence": 0-1 }
  ]
}
