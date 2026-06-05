import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

export interface MemoryLimits {
  maxChars: number
  maxLines: number
}

export const LIMITS: Record<string, MemoryLimits> = {
  'MEMORY.md': { maxChars: 5000, maxLines: 200 },
  'TEAM.md':   { maxChars: 3000, maxLines: 100 },
  'SOUL.md':   { maxChars: 2000, maxLines: 80 },
}

export interface WriteResult {
  success: boolean
  error?: string
  currentEntries?: string[]
  usage?: string
}

export interface MemoryUsage {
  chars: number
  lines: number
  limitChars: number
  limitLines: number
}

export function agentsDir(cwd?: string): string {
  return join(cwd || process.cwd(), '.agents')
}

export function memoryDir(cwd?: string): string {
  return join(agentsDir(cwd), 'memory')
}

export function memoryFilePath(filename: string, cwd?: string): string {
  return join(memoryDir(cwd), filename)
}

export function peopleDir(cwd?: string): string {
  return join(memoryDir(cwd), 'People')
}

export function peopleFilePath(name: string, cwd?: string): string {
  return join(peopleDir(cwd), `${name}.md`)
}

export function sessionsDir(cwd?: string): string {
  return join(memoryDir(cwd), 'Sessions')
}

export function personSessionsDir(person: string, cwd?: string): string {
  return join(sessionsDir(cwd), person)
}

export function sessionFilePath(person: string, date: string, cwd?: string): string {
  return join(personSessionsDir(person, cwd), `${date}.md`)
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

export async function ensureStructure(cwd?: string): Promise<void> {
  const dirs = [
    agentsDir(cwd),
    memoryDir(cwd),
    peopleDir(cwd),
    sessionsDir(cwd),
    join(agentsDir(cwd), 'skills'),
  ]
  await Promise.all(dirs.map(d => ensureDir(d)))

  // Ensure default memory files exist
  for (const name of ['MEMORY.md', 'TEAM.md', 'SOUL.md']) {
    const path = memoryFilePath(name, cwd)
    if (!existsSync(path)) {
      await writeFile(path, '', 'utf-8')
    }
  }
}

export async function readMemory(filename: string, cwd?: string): Promise<string> {
  const path = memoryFilePath(filename, cwd)
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

export async function readPeople(name: string, cwd?: string): Promise<string> {
  const path = peopleFilePath(name, cwd)
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

export async function getUsage(filename: string, cwd?: string): Promise<MemoryUsage> {
  const content = await readMemory(filename, cwd)
  const chars = content.length
  const lines = chars === 0 ? 0 : content.split('\n').length
  const limit = LIMITS[filename]
  if (!limit) throw new Error(`Unknown memory file: ${filename}`)
  return {
    chars,
    lines,
    limitChars: limit.maxChars,
    limitLines: limit.maxLines,
  }
}

export async function checkCapacity(filename: string, cwd?: string): Promise<WriteResult> {
  const usage = await getUsage(filename, cwd)
  const limit = LIMITS[filename]
  if (!limit) throw new Error(`Unknown memory file: ${filename}`)

  if (usage.lines >= limit.maxLines || usage.chars >= limit.maxChars) {
    const content = await readMemory(filename, cwd)
    const entries = content
      .split('\n')
      .filter(l => l.startsWith('- ['))
      .map(l => l.trim())
    return {
      success: false,
      error: `${filename} is full (${usage.lines}/${limit.maxLines} lines, ${usage.chars}/${limit.maxChars} chars). Replace or remove entries first.`,
      currentEntries: entries,
      usage: `${usage.lines}/${limit.maxLines} lines`,
    }
  }

  return { success: true }
}

export async function appendMemory(
  filename: string,
  entry: string,
  priority: string,
  cwd?: string
): Promise<WriteResult> {
  const cap = await checkCapacity(filename, cwd)
  if (!cap.success) return cap

  const path = memoryFilePath(filename, cwd)
  const date = new Date().toISOString().slice(0, 10)
  const line = `- [${priority}] ${date}: ${entry}\n`
  await writeFile(path, line, { flag: 'a', encoding: 'utf-8' })
  return { success: true }
}

export async function appendSession(
  person: string,
  date: string,
  content: string,
  cwd?: string
): Promise<void> {
  const dir = personSessionsDir(person, cwd)
  await ensureDir(dir)
  const path = sessionFilePath(person, date, cwd)
  await writeFile(path, content, { flag: 'a', encoding: 'utf-8' })
}

export async function writePeople(
  name: string,
  content: string,
  cwd?: string
): Promise<void> {
  const path = peopleFilePath(name, cwd)
  await ensureDir(dirname(path))
  await writeFile(path, content, 'utf-8')
}

export async function listPeople(cwd?: string): Promise<string[]> {
  const dir = peopleDir(cwd)
  try {
    const files = await readdir(dir)
    return files.filter(f => f.endsWith('.md')).map(f => f.slice(0, -3))
  } catch {
    return []
  }
}

export async function listSessionPersons(cwd?: string): Promise<string[]> {
  const dir = sessionsDir(cwd)
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}
