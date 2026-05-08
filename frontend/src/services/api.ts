import axios from 'axios'
import type { LearningGoal, GoalDetail, Roadmap, DailyPlan, JournalEntry, DailyQuestion, LearningStats } from '../types'

const http = axios.create({ baseURL: 'http://localhost:8000/api', timeout: 90000 })

// 学习目标
export const getGoals = () => http.get<LearningGoal[]>('/goals').then(r => r.data)
export const getGoal = (id: number) => http.get<GoalDetail>(`/goals/${id}`).then(r => r.data)
export const createGoal = (data: { title: string; description: string }) =>
  http.post<GoalDetail>('/goals', data).then(r => r.data)
export const updateGoal = (id: number, data: Partial<LearningGoal>) =>
  http.put<LearningGoal>(`/goals/${id}`, data).then(r => r.data)
export const deleteGoal = (id: number) => http.delete(`/goals/${id}`)

// 学习路线
export const getRoadmap = (goalId: number) =>
  http.get<Roadmap>(`/goals/${goalId}/roadmap`).then(r => r.data)
export const generateRoadmap = (goalId: number) =>
  http.post<Roadmap>(`/goals/${goalId}/roadmap/generate`).then(r => r.data)
export const learnTopic = (goalId: number, topicDay: number) =>
  http.post(`/goals/${goalId}/roadmap/learn/${topicDay}`).then(r => r.data)

// 每日规划
export const getPlans = (goalId: number, date?: string) =>
  http.get<DailyPlan>(`/goals/${goalId}/plans`, { params: { date } }).then(r => r.data)
export const generatePlan = (goalId: number) =>
  http.post<DailyPlan>(`/goals/${goalId}/plans/generate`).then(r => r.data)
export const completePlan = (planId: number) =>
  http.put(`/plans/${planId}/complete`).then(r => r.data)

// 学习日志
export const getJournal = (goalId: number, date?: string) =>
  http.get<JournalEntry>(`/goals/${goalId}/journal`, { params: { date } }).then(r => r.data)
export const saveJournal = (goalId: number, data: { content: string; reflection: string; duration_minutes: number }) =>
  http.post<JournalEntry>(`/goals/${goalId}/journal`, data).then(r => r.data)
export const getJournalHistory = (goalId: number) =>
  http.get<JournalEntry[]>(`/goals/${goalId}/journal/history`).then(r => r.data)

// 每日问答
export const getQuestions = (goalId: number, date?: string) =>
  http.get<DailyQuestion[]>(`/goals/${goalId}/questions`, { params: { date } }).then(r => r.data)
export const generateQuestions = (goalId: number) =>
  http.post<DailyQuestion[]>(`/goals/${goalId}/questions/generate`).then(r => r.data)
export const submitAnswer = (questionId: number, answer: string) =>
  http.post(`/questions/${questionId}/answer`, { answer }).then(r => r.data)

// 问答历史
export const getQuestionsHistory = (goalId: number) =>
  http.get(`/goals/${goalId}/questions/history`).then(r => r.data)

// 知识图谱
export const getKnowledgeGraph = (goalId: number) =>
  http.get<{ nodes: any[]; edges: any[] }>(`/goals/${goalId}/knowledge-graph`).then(r => r.data)

// 内容导出
export const exportRoadmap = (goalId: number) =>
  http.get(`/goals/${goalId}/export/roadmap`, { responseType: 'blob' }).then(r => r.data)
export const exportPlan = (goalId: number, date?: string) =>
  http.get(`/goals/${goalId}/export/plan`, { params: { date }, responseType: 'blob' }).then(r => r.data)
export const exportJournal = (goalId: number) =>
  http.get(`/goals/${goalId}/export/journal`, { responseType: 'blob' }).then(r => r.data)
export const exportAll = (goalId: number) =>
  http.get(`/goals/${goalId}/export/all`, { responseType: 'blob' }).then(r => r.data)

// AI 学习搭子
export const chatWithBuddy = (goalId: number, data: { message: string; context: string; chat_history: { role: string; content: string }[] }) =>
  http.post<{ reply: string }>(`/goals/${goalId}/chat`, data).then(r => r.data)

export function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 学习统计
export const getStats = (goalId: number) =>
  http.get<LearningStats>(`/goals/${goalId}/stats`).then(r => r.data)
export const getHeatmap = (goalId: number) =>
  http.get(`/goals/${goalId}/heatmap`).then(r => r.data)
