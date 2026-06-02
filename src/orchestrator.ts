import { readMemory, checkCapacity, appendMemory, appendSession, writePeople, memoryFilePath } from './memory/fs.js'
import type { ExtractResult, DreamResult, InitResult } from './memory/types.js'

export interface LifecycleEvent {
  phase: string
  action: string
  timestamp: string
  data?: Record<string, unknown>
}

export type LifecycleHook = (event: LifecycleEvent) => void | Promise<void>

export interface OrchestratorConfig {
  cwd?: string
  hooks?: {
    onPreload?: LifecycleHook
    onSessionWrite?: LifecycleHook
    onExtractApply?: LifecycleHook
    onDreamApply?: LifecycleHook
    onInitApply?: LifecycleHook
    onError?: LifecycleHook
  }
}

function ts(): string {
  return new Date().toISOString()
}

export class Orchestrator {
  private config: OrchestratorConfig

  constructor(config: OrchestratorConfig = {}) {
    this.config = config
  }

  private async emit(event: LifecycleEvent): Promise<void> {
    const map: Record<string, keyof typeof this.config.hooks> = {
      preload: 'onPreload',
      session_write: 'onSessionWrite',
      extract_apply: 'onExtractApply',
      dream_apply: 'onDreamApply',
      init_apply: 'onInitApply',
      error: 'onError',
    }
    const key = map[event.phase]
    if (key && this.config.hooks?.[key]) {
      await this.config.hooks[key]!(event)
    }
  }

  async preloadContext(): Promise<Record<string, string>> {
    await this.emit({ phase: 'preload', action: 'start', timestamp: ts() })
    try {
      const files = ['MEMORY.md', 'TEAM.md', 'USER.md']
      const result: Record<string, string> = {}
      for (const f of files) {
        result[f] = await readMemory(f, this.config.cwd)
      }
      await this.emit({ phase: 'preload', action: 'end', timestamp: ts(), data: result })
      return result
    } catch (e) {
      await this.emit({ phase: 'error', action: 'preload_failed', timestamp: ts(), data: { error: String(e) } })
      throw e
    }
  }

  async writeSession(person: string, date: string, content: string): Promise<void> {
    await this.emit({ phase: 'session_write', action: 'start', timestamp: ts(), data: { person, date } })
    try {
      await appendSession(person, date, content, this.config.cwd)
      await this.emit({ phase: 'session_write', action: 'end', timestamp: ts(), data: { person, date, size: content.length } })
    } catch (e) {
      await this.emit({ phase: 'error', action: 'session_write_failed', timestamp: ts(), data: { person, date, error: String(e) } })
      throw e
    }
  }

  async applyExtractResult(result: ExtractResult): Promise<{ written: string[]; skipped: string[] }> {
    await this.emit({ phase: 'extract_apply', action: 'start', timestamp: ts(), data: { factCount: result.project_facts.length + result.team_facts.length } })
    try {
      const written: string[] = []
      const skipped: string[] = []

      for (const fact of result.project_facts) {
        const cap = await checkCapacity('MEMORY.md', this.config.cwd)
        if (cap.success) {
          await appendMemory('MEMORY.md', fact.content, fact.priority, this.config.cwd)
          written.push(`MEMORY.md: ${fact.content.slice(0, 40)}`)
        } else {
          skipped.push(`MEMORY.md (full): ${fact.content.slice(0, 40)}`)
        }
      }

      for (const fact of result.team_facts) {
        const cap = await checkCapacity('TEAM.md', this.config.cwd)
        if (cap.success) {
          await appendMemory('TEAM.md', fact.content, fact.priority, this.config.cwd)
          written.push(`TEAM.md: ${fact.content.slice(0, 40)}`)
        } else {
          skipped.push(`TEAM.md (full): ${fact.content.slice(0, 40)}`)
        }
      }

      for (const insight of result.person_insights) {
        await writePeople(insight.name, insight.content, this.config.cwd)
        written.push(`People/${insight.name}.md: ${insight.content.slice(0, 40)}`)
      }

      await this.emit({ phase: 'extract_apply', action: 'end', timestamp: ts(), data: { written, skipped } })
      return { written, skipped }
    } catch (e) {
      await this.emit({ phase: 'error', action: 'extract_apply_failed', timestamp: ts(), data: { error: String(e) } })
      throw e
    }
  }

  async applyDreamResult(result: DreamResult): Promise<void> {
    await this.emit({ phase: 'dream_apply', action: 'start', timestamp: ts(), data: { updateCount: result.memory_updates.length + result.team_updates.length + result.people_updates.length } })
    try {
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
      await this.emit({ phase: 'dream_apply', action: 'end', timestamp: ts() })
    } catch (e) {
      await this.emit({ phase: 'error', action: 'dream_apply_failed', timestamp: ts(), data: { error: String(e) } })
      throw e
    }
  }

  async applyInitResult(result: InitResult): Promise<void> {
    await this.emit({ phase: 'init_apply', action: 'start', timestamp: ts() })
    try {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(memoryFilePath('MEMORY.md', this.config.cwd), result.memory_content, 'utf-8')
      await writeFile(memoryFilePath('TEAM.md', this.config.cwd), result.team_content, 'utf-8')
      for (const [name, content] of Object.entries(result.people)) {
        await writePeople(name, content, this.config.cwd)
      }
      await this.emit({ phase: 'init_apply', action: 'end', timestamp: ts() })
    } catch (e) {
      await this.emit({ phase: 'error', action: 'init_apply_failed', timestamp: ts(), data: { error: String(e) } })
      throw e
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
