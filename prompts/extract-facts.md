# Extract Facts from Trajectory

Extract memorable facts from each ACP trajectory after execution completes.

## Trigger

After every ACP call. Runs as Step 2 of post-processing.

## Prompt

Extract noteworthy information from the trajectory file.

Trajectory: {{trajectory_path}}

Current memory state:
MEMORY.md ({{memory_usage}}/5000 chars, {{memory_lines}}/200 lines):
{{memory_content}}

TEAM.md ({{team_usage}}/3000 chars, {{team_lines}}/100 lines):
{{team_content}}

Claude Code Auto Memory (reference only, not synced):
{{claude_auto_memory_path}}
(If exists, read its directory for additional context.)

Requirements:

1. Project facts → MEMORY.md
   - Tech decisions, code conventions, architecture
   - Explicit user corrections (highest priority)
   - Do not store what code alone can tell you

2. Organization facts → TEAM.md
   - Who owns what domain
   - Workflow patterns and cadence
   - Important decisions with dates and rationale

3. Person insights → People/{name}.md
   - Domain expertise
   - Communication and collaboration preferences
   - Technical inclinations

4. Pattern detection → Skill candidates
   - Repeated operation sequences (≥3 occurrences)
   - Structured multi-step workflows

Output JSON:
{
  "project_facts": [{ "content": "...", "priority": "P1|P2|P3|P4" }],
  "team_facts": [{ "content": "...", "priority": "P1|P2|P3|P4" }],
  "person_insights": [{ "name": "alice", "content": "..." }],
  "skill_candidates": [{ "description": "...", "steps": [...], "count": 3 }],
  "contradictions": [{ "existing": "...", "new": "..." }]
}

Note: Do not force writes into full files. Flag capacity issues in output
and leave consolidation to the Dream process.
