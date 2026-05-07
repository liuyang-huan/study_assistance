import axios from 'axios'
import type { LearningGoal, GoalDetail, Roadmap, DailyPlan, JournalEntry, DailyQuestion } from '../types'

const http = axios.create({ baseURL: '/api' })

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
