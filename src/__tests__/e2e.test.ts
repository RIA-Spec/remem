import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  ensureStructure, readMemory, appendMemory, appendSession,
  writePeople, readPeople, memoryFilePath,
} from '../memory/fs.js'
import { formatSessionEntry } from '../memory/sessions.js'
import { Orchestrator } from '../orchestrator.js'
import type { ExtractResult, DreamResult, InitResult } from '../memory/types.js'

function freshDir() {
  const d = mkdtempSync(join(tmpdir(), 'remem-e2e-'))
  return { tmpDir: d, cwd: d }
}

describe('Remem', () => {
  it('initializes memory from enterprise sources', async () => {
    const { tmpDir, cwd } = freshDir()
    try {
      await ensureStructure(cwd)
      const orch = new Orchestrator({ cwd })

      const init: InitResult = {
        memory_content: '- [P1] Use pnpm\n- [P1] TypeScript strict mode\n',
        team_content: '- [P1] Alice → auth\n- [P1] Bob → frontend\n',
        people: { alice: '- Domain: auth\n- Prefers: detailed PRs\n' },
      }
      await orch.applyInitResult(init)

      expect(await readMemory('MEMORY.md', cwd)).toContain('pnpm')
      expect(await readMemory('TEAM.md', cwd)).toContain('Alice')
      expect(await readPeople('alice', cwd)).toContain('detailed PRs')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('runs full post-processing flow: session + extract + write', async () => {
    const { tmpDir, cwd } = freshDir()
    try {
      await ensureStructure(cwd)
      const orch = new Orchestrator({ cwd })

      // Simulate a trajectory from ACP
      const trajectory = formatSessionEntry('2026-06-01 10:00', [
        { role: 'user', content: 'Fix login bug', tools: ['read auth/login.ts', 'grep "bug" src/'] },
        { role: 'ai', content: 'Found the issue. Missing null check.', tools: ['edit auth/login.ts L42'] },
      ])

      // Step 1: Write session
      await orch.writeSession('alice', '2026-06-01', trajectory)
      const sessionFile = join(cwd, '.agents', 'memory', 'Sessions', 'alice', '2026-06-01.md')
      expect(readFileSync(sessionFile, 'utf-8')).toContain('Fix login bug')
      expect(readFileSync(sessionFile, 'utf-8')).toContain('→ edit auth/login.ts L42')

      // Step 2: Apply extraction result
      const extract: ExtractResult = {
        project_facts: [{ content: 'Use pnpm for package management', priority: 'P1' }],
        team_facts: [{ content: 'Alice owns auth module', priority: 'P1' }],
        person_insights: [{ name: 'alice', content: '- Expert: auth, API\n- Prefers: explanatory PRs' }],
        skill_candidates: [],
        contradictions: [],
      }
      const { written, skipped } = await orch.applyExtractResult(extract)
      expect(written.length).toBe(3)
      expect(skipped.length).toBe(0)

      // Verify files
      expect(await readMemory('MEMORY.md', cwd)).toContain('pnpm')
      expect(await readMemory('TEAM.md', cwd)).toContain('Alice owns auth')
      expect(await readPeople('alice', cwd)).toContain('explanatory PRs')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('respects capacity limits and skips writes when full', async () => {
    const { tmpDir, cwd } = freshDir()
    try {
      await ensureStructure(cwd)
      const orch = new Orchestrator({ cwd })

      // Fill MEMORY.md to capacity
      for (let i = 0; i < 200; i++) {
        await appendMemory('MEMORY.md', `Entry ${i}`, 'P4', cwd)
      }

      const extract: ExtractResult = {
        project_facts: [{ content: 'Important new convention', priority: 'P1' }],
        team_facts: [],
        person_insights: [],
        skill_candidates: [],
        contradictions: [],
      }
      const { written, skipped } = await orch.applyExtractResult(extract)
      expect(written.length).toBe(0)
      expect(skipped.length).toBe(1)
      expect(skipped[0]).toContain('Important new convention')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('consolidates memory via dream: expiry + merge + trim', async () => {
    const { tmpDir, cwd } = freshDir()
    try {
      await ensureStructure(cwd)
      await appendMemory('MEMORY.md', 'Old stale temp note', 'P4', cwd)
      await appendMemory('MEMORY.md', 'Important convention to keep', 'P1', cwd)

      const orch = new Orchestrator({ cwd })
      const dream: DreamResult = {
        memory_updates: [
          { action: 'delete', content: 'stale temp note', reason: 'P4, >60 days' },
        ],
        team_updates: [],
        people_updates: [],
        skill_candidates: [],
      }
      await orch.applyDreamResult(dream)

      const content = await readMemory('MEMORY.md', cwd)
      expect(content).not.toContain('stale temp note')
      expect(content).toContain('Important convention')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('fires lifecycle hooks during post-processing', async () => {
    const { tmpDir, cwd } = freshDir()
    try {
      await ensureStructure(cwd)
      const events: string[] = []
      const orch = new Orchestrator({
        cwd,
        hooks: {
          onSessionWrite: () => { events.push('session_write') },
          onExtractApply: () => { events.push('extract_apply') },
        },
      })

      await orch.writeSession('bob', '2026-06-01', '## test\nuser: hello\n')
      await orch.applyExtractResult({
        project_facts: [{ content: 'Fact', priority: 'P1' }],
        team_facts: [], person_insights: [], skill_candidates: [], contradictions: [],
      })

      expect(events).toEqual(['session_write', 'session_write', 'extract_apply', 'extract_apply'])
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
