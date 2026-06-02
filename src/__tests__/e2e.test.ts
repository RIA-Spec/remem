import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  ensureStructure,
  readMemory,
  getUsage,
  checkCapacity,
  appendMemory,
  appendSession,
  writePeople,
  listPeople,
  readPeople,
  memoryFilePath,
  personSessionsDir,
  LIMITS,
} from '../memory/fs.js'

import { formatSessionEntry, searchCommand } from '../memory/sessions.js'
import { Orchestrator } from '../orchestrator.js'
import type { ExtractResult, DreamResult, InitResult } from '../memory/types.js'

function freshDir(): { tmpDir: string; cwd: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'remem-e2e-'))
  return { tmpDir, cwd: tmpDir }
}

describe('Remem E2E', () => {
  describe('P2: Directory Structure', () => {
    it('creates full .agents directory skeleton', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        expect(existsSync(join(cwd, '.agents', 'memory'))).toBe(true)
        expect(existsSync(join(cwd, '.agents', 'memory', 'People'))).toBe(true)
        expect(existsSync(join(cwd, '.agents', 'memory', 'Sessions'))).toBe(true)
        expect(existsSync(join(cwd, '.agents', 'skills'))).toBe(true)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('creates default empty memory files', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        expect(readFileSync(memoryFilePath('MEMORY.md', cwd), 'utf-8')).toBe('')
        expect(readFileSync(memoryFilePath('TEAM.md', cwd), 'utf-8')).toBe('')
        expect(readFileSync(memoryFilePath('USER.md', cwd), 'utf-8')).toBe('')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('L3: Semantic Memory Capacity', () => {
    it('tracks usage for empty files', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const usage = await getUsage('MEMORY.md', cwd)
        expect(usage.chars).toBe(0)
        expect(usage.lines).toBe(0) // empty file = 0 lines
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('reports correct limits per file', async () => {
      expect(LIMITS['MEMORY.md']).toEqual({ maxChars: 5000, maxLines: 200 })
      expect(LIMITS['TEAM.md']).toEqual({ maxChars: 3000, maxLines: 100 })
      expect(LIMITS['USER.md']).toEqual({ maxChars: 2000, maxLines: 80 })
    })

    it('appends entries and tracks usage', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const result = await appendMemory('MEMORY.md', 'Use pnpm, not npm', 'P1', cwd)
        expect(result.success).toBe(true)

        const usage = await getUsage('MEMORY.md', cwd)
        expect(usage.lines).toBe(2) // entry + trailing newline
        expect(usage.chars).toBeGreaterThan(0)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('rejects writes when over capacity', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)

        // Fill to exactly 200 lines
        const content = Array.from({ length: 200 }, (_, i) => `- [P4] 2026-05-31: Entry ${i}`).join('\n') + '\n'
        const { writeFileSync } = await import('node:fs')
        writeFileSync(memoryFilePath('MEMORY.md', cwd), content, 'utf-8')

        const result = await appendMemory('MEMORY.md', 'Overflow entry', 'P1', cwd)
        expect(result.success).toBe(false)
        expect(result.error).toContain('is full')
        expect(result.currentEntries).toBeDefined()
        expect(result.currentEntries!.length).toBe(200)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('reads and retrieves content correctly', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        await appendMemory('MEMORY.md', 'TypeScript strict mode', 'P1', cwd)
        await appendMemory('MEMORY.md', 'Use vitest for testing', 'P2', cwd)

        const content = await readMemory('MEMORY.md', cwd)
        expect(content).toContain('TypeScript strict mode')
        expect(content).toContain('vitest')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('L3: People/', () => {
    it('writes and reads a person file', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        await writePeople('alice', '- Domain: auth module\n- Prefers detailed PR descriptions', cwd)
        const content = await readPeople('alice', cwd)
        expect(content).toContain('auth module')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('lists all people', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        await writePeople('alice', '- Auth module', cwd)
        await writePeople('bob', '- Frontend', cwd)

        const people = await listPeople(cwd)
        expect(people).toContain('alice')
        expect(people).toContain('bob')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('writes large content with no capacity limit', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const longContent = '- '.repeat(3000) // 6000 chars
        await writePeople('alice', longContent, cwd)
        const content = await readPeople('alice', cwd)
        expect(content.length).toBeGreaterThan(5000)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('L2: Sessions/', () => {
    it('appends session content per person per day', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const content = formatSessionEntry('2026-05-31 14:00', [
          { role: 'user', content: 'Add debounce', tools: ['read UserList.tsx', 'grep debounce src/'] },
          { role: 'ai', content: 'Done', tools: ['edit UserList.tsx L45-L60'] },
        ])

        await appendSession('alice', '2026-05-31', content, cwd)
        await appendSession('alice', '2026-05-31', content, cwd)

        const sessionContent = readFileSync(
          join(personSessionsDir('alice', cwd), '2026-05-31.md'),
          'utf-8'
        )
        expect(sessionContent).toContain('Add debounce')
        expect(sessionContent).toContain('→ read UserList.tsx')
        const matches = sessionContent.match(/Add debounce/g)
        expect(matches!.length).toBe(2)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('separates sessions by person', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const content = formatSessionEntry('2026-05-31 14:00', [
          { role: 'user', content: 'Fix auth bug' },
        ])

        await appendSession('alice', '2026-05-31', content, cwd)
        await appendSession('bob', '2026-05-31', content, cwd)

        expect(existsSync(personSessionsDir('alice', cwd))).toBe(true)
        expect(existsSync(personSessionsDir('bob', cwd))).toBe(true)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('generates valid search command', () => {
      const cmdAll = searchCommand('port conflict')
      expect(cmdAll).toContain('rg')
      expect(cmdAll).toContain('.agents/memory/Sessions/')

      const cmdPerson = searchCommand('auth refactor', 'alice')
      expect(cmdPerson).toContain('Sessions/alice/')
    })
  })

  describe('L3: TEAM.md', () => {
    it('stores organization facts with capacity management', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        await appendMemory('TEAM.md', 'Alice → auth module', 'P1', cwd)
        await appendMemory('TEAM.md', 'Bob → frontend', 'P1', cwd)

        const content = await readMemory('TEAM.md', cwd)
        expect(content).toContain('Alice')
        expect(content).toContain('Bob')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('rejects when TEAM.md is full', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        for (let i = 0; i < 100; i++) {
          await appendMemory('TEAM.md', `Entry ${i}`, 'P4', cwd)
        }
        const result = await appendMemory('TEAM.md', 'Overflow', 'P1', cwd)
        expect(result.success).toBe(false)
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('Orchestrator: Post-Processing', () => {
    it('preloads context from memory files', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        await appendMemory('MEMORY.md', 'Use pnpm', 'P1', cwd)
        await appendMemory('TEAM.md', 'Alice → auth', 'P1', cwd)

        const orch = new Orchestrator({ cwd })
        const ctx = await orch.preloadContext()
        expect(ctx['MEMORY.md']).toContain('pnpm')
        expect(ctx['TEAM.md']).toContain('Alice')
        expect(ctx['USER.md']).toBe('')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('handles session writes via orchestrator', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const orch = new Orchestrator({ cwd })
        await orch.writeSession('alice', '2026-05-31', '## test session\nuser: hello\n→ read file\nai: done\n')

        const content = readFileSync(
          join(cwd, '.agents', 'memory', 'Sessions', 'alice', '2026-05-31.md'),
          'utf-8'
        )
        expect(content).toContain('hello')
        expect(content).toContain('→ read file')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('applies extract result to memory files', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const orch = new Orchestrator({ cwd })

        const extractResult: ExtractResult = {
          project_facts: [
            { content: 'Use pnpm for package management', priority: 'P1' },
            { content: 'TypeScript strict mode enabled', priority: 'P1' },
          ],
          team_facts: [
            { content: 'Alice owns auth module', priority: 'P1' },
          ],
          person_insights: [
            { name: 'alice', content: '- Domain: auth\n- Prefers: detailed PRs' },
          ],
          skill_candidates: [],
          contradictions: [],
        }

        const { written, skipped } = await orch.applyExtractResult(extractResult)
        expect(written.length).toBe(4)
        expect(skipped.length).toBe(0)

        const mem = await readMemory('MEMORY.md', cwd)
        expect(mem).toContain('pnpm')

        const team = await readMemory('TEAM.md', cwd)
        expect(team).toContain('Alice owns auth')

        const alice = await readPeople('alice', cwd)
        expect(alice).toContain('detailed PRs')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('skips writes when capacity is full', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const orch = new Orchestrator({ cwd })
        for (let i = 0; i < 200; i++) {
          await appendMemory('MEMORY.md', `Entry ${i}`, 'P4', cwd)
        }

        const extractResult: ExtractResult = {
          project_facts: [{ content: 'Important new fact', priority: 'P1' }],
          team_facts: [],
          person_insights: [],
          skill_candidates: [],
          contradictions: [],
        }

        const { written, skipped } = await orch.applyExtractResult(extractResult)
        expect(written.length).toBe(0)
        expect(skipped.length).toBe(1)
        expect(skipped[0]).toContain('Important new fact')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('Orchestrator: Dream', () => {
    it('applies dream result to memory files', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        await appendMemory('MEMORY.md', 'Old stale entry that should go', 'P4', cwd)
        await appendMemory('MEMORY.md', 'Important convention to keep', 'P1', cwd)

        const orch = new Orchestrator({ cwd })
        await orch.applyDreamResult({
          memory_updates: [
            { action: 'delete', content: 'stale entry', reason: 'P4, unconfirmed >60 days' },
          ],
          team_updates: [],
          people_updates: [],
          skill_candidates: [],
        })

        const content = await readMemory('MEMORY.md', cwd)
        expect(content).not.toContain('stale entry')
        expect(content).toContain('Important convention')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('applies people updates from dream', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        await writePeople('bob', '- Old note', cwd)

        const orch = new Orchestrator({ cwd })
        await orch.applyDreamResult({
          memory_updates: [],
          team_updates: [],
          people_updates: [
            { name: 'bob', action: 'merge', content: '- Old note\n- Domain: frontend\n- Prefers: short replies' },
          ],
          skill_candidates: [],
        })

        const content = await readPeople('bob', cwd)
        expect(content).toContain('frontend')
        expect(content).toContain('short replies')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('Orchestrator: Initialization', () => {
    it('writes initial memory from enterprise sources', async () => {
      const { tmpDir, cwd } = freshDir()
      try {
        await ensureStructure(cwd)
        const initResult: InitResult = {
          memory_content: '- [P1] Use pnpm\n- [P1] TypeScript strict mode\n- [P2] Vitest for testing\n',
          team_content: '- [P1] Alice → auth module\n- [P1] Bob → frontend\n',
          people: {
            alice: '- Domain: auth, API design\n- Prefers: detailed PR descriptions\n',
            bob: '- Domain: frontend, UI components\n- Prefers: concise replies\n',
          },
        }

        const orch = new Orchestrator({ cwd })
        await orch.applyInitResult(initResult)

        expect(await readMemory('MEMORY.md', cwd)).toContain('pnpm')
        expect(await readMemory('TEAM.md', cwd)).toContain('Alice')
        expect(await readPeople('alice', cwd)).toContain('API design')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })
})
