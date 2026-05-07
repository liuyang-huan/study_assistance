export interface LearningGoal {
  id: number
  title: string
  description: string
  status: 'active' | 'completed' | 'paused'
  skill_level: string | null
  created_at: string
  updated_at: string
}

export interface RoadmapPhase {
  phase: number
  title: string
  duration_days: number
  topics: Topic[]
}

export interface Topic {
  day: number
  title: string
  resources: string[]
  exercises: string[]
}

export interface Roadmap {
  id: number
  goal_id: number
  content: {
    phases: RoadmapPhase[]
  }
  version: number
  is_active: boolean
  created_at: string
}

export interface JournalEntry {
  id: number
  goal_id: number
  date: string
  content: string
  reflection: string
  duration_minutes: number
  created_at: string
}

export interface DailyPlan {
  id: number
  goal_id: number
  date: string
  plan_content: {
    tasks: PlanTask[]
    note: string
  }
  is_adjusted: boolean
  completed: boolean
  created_at: string
}

export interface PlanTask {
  title: string
  duration_min: number
  detail: string
}

export interface DailyQuestion {
  id: number
  goal_id: number
  date: string
  question: string
  expected_answer: string
  difficulty: 'easy' | 'medium' | 'hard'
  status: 'pending' | 'answered' | 'skipped'
  created_at: string
}

export interface UserAnswer {
  id: number
  question_id: number
  answer: string
  ai_evaluation: string | null
  score: number | null
  created_at: string
}

export interface GoalDetail extends LearningGoal {
  roadmap: Roadmap | null
  today_plan: DailyPlan | null
  today_questions: DailyQuestion[]
  today_journal: JournalEntry | null
}

export interface PhaseProgress {
  phase: number
  title: string
  total_days: number
  completed_days: number
  percent: number
}

export interface LearningStats {
  total_study_days: number
  streak: number
  studied_today: boolean
  total_minutes: number
  completed_plans: number
  total_questions: number
  answered_questions: number
  avg_score: number
  score_trend: { date: string; score: number }[]
  phase_progress: PhaseProgress[]
  overall_percent: number
  current_phase: PhaseProgress | null
  study_trend: { date: string; minutes: number }[]
  topics_covered: { date: string; type: string; content: string; reflection?: string; score?: number }[]
}
