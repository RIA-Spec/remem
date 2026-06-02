export interface ProjectFact {
  content: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
}

export interface TeamFact {
  content: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
}

export interface PersonInsight {
  name: string
  content: string
}

export interface SkillCandidate {
  description: string
  steps: string[]
  count: number
}

export interface Contradiction {
  existing: string
  new: string
}

export interface ExtractResult {
  project_facts: ProjectFact[]
  team_facts: TeamFact[]
  person_insights: PersonInsight[]
  skill_candidates: SkillCandidate[]
  contradictions: Contradiction[]
}

export interface MemoryUpdate {
  action: 'delete' | 'merge' | 'keep'
  content: string
  reason: string
}

export interface DreamResult {
  memory_updates: MemoryUpdate[]
  team_updates: MemoryUpdate[]
  people_updates: { name: string; action: string; content: string }[]
  skill_candidates: SkillCandidate[]
}

export interface InitResult {
  memory_content: string
  team_content: string
  people: Record<string, string>
}
