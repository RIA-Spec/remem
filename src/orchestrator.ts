import { readMemory, checkCapacity, appendMemory, appendSession, writePeople, sessionFilePath, memoryFilePath } from './memory/fs.js'
import type { ExtractResult, DreamResult, InitResult } from './memory/types.js'
import { sessionDate, sessionTimestamp } from './memory/sessions.js'

export interface OrchestratorConfig {
  cwd?: string
  trajectoryDir?: string
}

export class Orchestrator {
  private config: OrchestratorConfig

  constructor(config: OrchestratorConfig = {}) {
    this.config = config
  }

  /**
   * Step 1: Preload L3 facts for context injection.
   */
  async preloadContext(): Promise<Record<string, string>> {
    const files = ['MEMORY.md', 'TEAM.md', 'USER.md']
    const result: Record<string, string> = {}
    for (const f of files) {
      result[f] = await readMemory(f, this.config.cwd)
    }
    return result
  }

  /**
   * Step 2: Write trajectory to Sessions/ (from ACP call).
   */
  async writeSession(person: string, date: string, content: string): Promise<void> {
    await appendSession(person, date, content, this.config.cwd)
  }

  /**
   * Step 3: Process extract-facts result.
   */
  async applyExtractResult(result: ExtractResult): Promise<{ written: string[]; skipped: string[] }> {
    const written: string[] = []
    const skipped: string[] = []

    // Write project facts
    for (const fact of result.project_facts) {
      const cap = await checkCapacity('MEMORY.md', this.config.cwd)
      if (cap.success) {
        await appendMemory('MEMORY.md', fact.content, fact.priority, this.config.cwd)
        written.push(`MEMORY.md: ${fact.content.slice(0, 40)}`)
      } else {
        skipped.push(`MEMORY.md (full): ${fact.content.slice(0, 40)}`)
      }
    }

    // Write team facts
    for (const fact of result.team_facts) {
      const cap = await checkCapacity('TEAM.md', this.config.cwd)
      if (cap.success) {
        await appendMemory('TEAM.md', fact.content, fact.priority, this.config.cwd)
        written.push(`TEAM.md: ${fact.content.slice(0, 40)}`)
      } else {
        skipped.push(`TEAM.md (full): ${fact.content.slice(0, 40)}`)
      }
    }

    // Write people insights (no capacity limit)
    for (const insight of result.person_insights) {
      await writePeople(insight.name, insight.content, this.config.cwd)
      written.push(`People/${insight.name}.md: ${insight.content.slice(0, 40)}`)
    }

    return { written, skipped }
  }

  /**
   * Step 4: Apply Dream result.
   */
  async applyDreamResult(result: DreamResult): Promise<void> {
    for (const update of result.memory_updates) {
      if (update.action === 'delete') {
        await this.removeEntry('MEMORY.md', update.content)
      }
    }
    for (const update of result.team_updates) {
      if (update.action === 'delete') {
        await this.removeEntry('TEAM.md', update.content)
      }
    }
    for (const update of result.people_updates) {
      if (update.action === 'add' || update.action === 'merge') {
        await writePeople(update.name, update.content, this.config.cwd)
      }
    }
  }

  /**
   * Apply initialization result.
   */
  async applyInitResult(result: InitResult): Promise<void> {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(memoryFilePath('MEMORY.md', this.config.cwd), result.memory_content, 'utf-8')
    await writeFile(memoryFilePath('TEAM.md', this.config.cwd), result.team_content, 'utf-8')
    for (const [name, content] of Object.entries(result.people)) {
      await writePeople(name, content, this.config.cwd)
    }
  }

  private async removeEntry(filename: string, content: string): Promise<void> {
    const { readFile, writeFile } = await import('node:fs/promises')
    const path = memoryFilePath(filename, this.config.cwd)
    const current = await readFile(path, 'utf-8')
    const lines = current.split('\n')
    const filtered = lines.filter(l => !l.includes(content))
    await writeFile(path, filtered.join('\n'), 'utf-8')
  }
}
