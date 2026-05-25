import axios from 'axios'
import type { LearningGoal, GoalDetail, Roadmap, DailyPlan, JournalEntry, DailyQuestion, LearningStats, Note, BookImport, TocEntry, BookSection, DocumentImportResult } from '../types'

const http = axios.create({ baseURL: '/api', timeout: 90000 })

export function getTeachingStyle(): string {
  return localStorage.getItem('teaching_style') || ''
}

// 学习目标
export const getGoals = () => http.get<LearningGoal[]>('/goals').then(r => r.data)
export const getGoalsProgress = () => http.get<{ goal_id: number; title: string; learned: number; total: number; percent: number }[]>('/goals/progress').then(r => r.data)
export const getGoal = (id: number) => http.get<GoalDetail>(`/goals/${id}`).then(r => r.data)
export const createGoal = (data: { title: string; description: string }) =>
  http.post<GoalDetail>('/goals', data).then(r => r.data)
export const updateGoal = (id: number, data: Partial<LearningGoal>) =>
  http.put<LearningGoal>(`/goals/${id}`, data).then(r => r.data)
export const deleteGoal = (id: number) => http.delete(`/goals/${id}`)

// 学习路线
export const getRoadmap = (goalId: number) =>
  http.get<Roadmap>(`/goals/${goalId}/roadmap`).then(r => r.data)
export const generateRoadmap = (goalId: number, teachingStyle: string = '') =>
  http.post<Roadmap>(`/goals/${goalId}/roadmap/generate`, null, { params: { teaching_style: teachingStyle || getTeachingStyle() } }).then(r => r.data)
export const learnTopic = (goalId: number, topicDay: number, teachingStyle: string = '') =>
  http.post(`/goals/${goalId}/roadmap/learn/${topicDay}`, null, { params: { teaching_style: teachingStyle || getTeachingStyle() } }).then(r => r.data)

// 每日规划
export const getPlans = (goalId: number, date?: string) =>
  http.get<DailyPlan>(`/goals/${goalId}/plans`, { params: { date } }).then(r => r.data)
export const generatePlan = (goalId: number, teachingStyle: string = '') =>
  http.post<DailyPlan>(`/goals/${goalId}/plans/generate`, null, { params: { teaching_style: teachingStyle || getTeachingStyle() } }).then(r => r.data)
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
export const generateQuestions = (goalId: number, teachingStyle: string = '') =>
  http.post<DailyQuestion[]>(`/goals/${goalId}/questions/generate`, null, { params: { teaching_style: teachingStyle || getTeachingStyle() } }).then(r => r.data)
export const submitAnswer = (questionId: number, answer: string, teachingStyle: string = '') =>
  http.post(`/questions/${questionId}/answer`, { answer }, { params: { teaching_style: teachingStyle || getTeachingStyle() } }).then(r => r.data)

// 问答历史
export const getQuestionsHistory = (goalId: number) =>
  http.get(`/goals/${goalId}/questions/history`).then(r => r.data)

// 知识图谱
export const getKnowledgeGraph = (goalId: number) =>
  http.get<{ nodes: any[]; edges: any[]; has_concepts: boolean }>(`/goals/${goalId}/knowledge-graph`).then(r => r.data)

export const generateConceptMap = (goalId: number) =>
  http.post<{ concepts: any[]; dependencies: any[] }>(`/goals/${goalId}/knowledge-graph/generate-concepts`).then(r => r.data)

// 内容导出
export const exportRoadmap = (goalId: number) =>
  http.get(`/goals/${goalId}/export/roadmap`, { responseType: 'blob' }).then(r => r.data)
export const exportPlan = (goalId: number, date?: string) =>
  http.get(`/goals/${goalId}/export/plan`, { params: { date }, responseType: 'blob' }).then(r => r.data)
export const exportJournal = (goalId: number) =>
  http.get(`/goals/${goalId}/export/journal`, { responseType: 'blob' }).then(r => r.data)
export const exportNotes = (goalId: number) =>
  http.get(`/goals/${goalId}/export/notes`, { responseType: 'blob' }).then(r => r.data)
export const exportAll = (goalId: number) =>
  http.get(`/goals/${goalId}/export/all`, { responseType: 'blob' }).then(r => r.data)

// AI 学习搭子
export const chatWithBuddy = (goalId: number, data: { message: string; context: string; chat_history: { role: string; content: string }[]; teaching_style?: string }) =>
  http.post<{ reply: string }>(`/goals/${goalId}/chat`, { ...data, teaching_style: data.teaching_style || getTeachingStyle() }).then(r => r.data)

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

// 已学习主题
export const getLearnedTopics = (goalId: number) =>
  http.get<{ learned_days: number[] }>(`/goals/${goalId}/learned`).then(r => r.data.learned_days)
export const markTopicLearned = (goalId: number, topicDay: number) =>
  http.post(`/goals/${goalId}/learned/${topicDay}`)
export const markTopicsUpTo = (goalId: number, topicDay: number) =>
  http.post<{ learned_days: number[] }>(`/goals/${goalId}/learned/up-to/${topicDay}`)

// 学习笔记
export const getNotes = (goalId: number, topicTitle?: string) =>
  http.get<Note[]>(`/goals/${goalId}/notes`, { params: topicTitle ? { topic_title: topicTitle } : {} }).then(r => r.data)
export const saveNote = (goalId: number, data: { topic_title: string; content: string }) =>
  http.post<Note>(`/goals/${goalId}/notes`, data).then(r => r.data)
export const deleteNote = (goalId: number, noteId: number) =>
  http.delete(`/goals/${goalId}/notes/${noteId}`)

// 文档导入
export const importDocument = async (file: File, onProgress?: (pct: number) => void): Promise<DocumentImportResult> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await http.post<DocumentImportResult>('/documents/import', formData, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
    timeout: 300000,
  })
  return response.data
}

export const uploadDocument = async (goalId: number, file: File, onProgress?: (pct: number) => void): Promise<BookImport> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await http.post<BookImport>(`/goals/${goalId}/documents/upload`, formData, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
    timeout: 300000,
  })
  return response.data
}

export const getDocumentStatus = (goalId: number) =>
  http.get<BookImport>(`/goals/${goalId}/documents/status`).then(r => r.data)

export const getDocumentToc = (goalId: number) =>
  http.get<TocEntry[]>(`/goals/${goalId}/documents/toc`).then(r => r.data)

export const getDocumentSections = (goalId: number) =>
  http.get<BookSection[]>(`/goals/${goalId}/documents/sections`).then(r => r.data)

// 翻译纠错
export const updateSectionTranslation = (goalId: number, sectionId: number, data: { content_translated: string; title_translated?: string }) =>
  http.put(`/goals/${goalId}/documents/sections/${sectionId}/translation`, data).then(r => r.data)

export const uploadImage = async (file: File): Promise<{ url: string }> => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await http.post('/upload/image', formData)
  return response.data
}
