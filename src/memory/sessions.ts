const SESSION_RETENTION_DAYS = 30

/**
 * Build a formatted session entry from a trajectory.
 */
export function formatSessionEntry(
  timestamp: string,
  turns: Array<{ role: string; content: string; tools?: string[] }>
): string {
  const lines: string[] = [`## ${timestamp}\n`]
  for (const turn of turns) {
    lines.push(`${turn.role}: ${turn.content}`)
    if (turn.tools) {
      for (const tool of turn.tools) {
        lines.push(`→ ${tool}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

/**
 * Generate a timestamp for session logging.
 */
export function sessionTimestamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * Get the session date string for file naming.
 */
export function sessionDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Build a grep-friendly search command snippet.
 */
export function searchCommand(query: string, person?: string): string {
  const path = person
    ? `.agents/memory/Sessions/${person}/`
    : `.agents/memory/Sessions/`
  return `rg "${query}" ${path} | reason --prompt "goal: find relevant sessions" --prompt - --structure '{"results": [{"file":"","snippet":""}]}'`
}
