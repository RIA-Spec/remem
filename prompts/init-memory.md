# Initialize Memory

Extract initial memory from existing enterprise sources on first deployment.

## Trigger

Before first session. Given a list of source file paths (org charts, wikis, READMEs, historical docs).

## Prompt

Extract initial memory from the following source files to produce a concise first draft.

Sources:
{{source_paths}}
(Read each file sequentially.)

Capacity limits:
  MEMORY.md: 5000 chars / 200 lines
  TEAM.md:   3000 chars / 100 lines
  People/*:  no hard limit, but keep concise

Requirements:

1. MEMORY.md — Project facts
   - Tech stack and major frameworks
   - Code conventions and architectural principles
   - Build/test/deploy commands
   - Known pitfalls
   - Only what matters. Less is more.

2. TEAM.md — Organization facts
   - Team members with roles and domains (one line each)
   - Workflow and release cadence
   - Key historical decisions
   - External system entry points

3. People/{name}.md — One per person
   - Domain and responsibilities
   - Known technical preferences
   - Keep under 50 lines each

Principle: Source material may be verbose and messy. Distill ruthlessly.
Every fact should earn its place. When in doubt, leave it out.

Output JSON:
{
  "memory_content": "Full content for MEMORY.md (Markdown)",
  "team_content": "Full content for TEAM.md (Markdown)",
  "people": {
    "alice": "Content for People/alice.md",
    "bob": "Content for People/bob.md"
  }
}
