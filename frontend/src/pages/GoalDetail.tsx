import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getGoal, generateRoadmap, generatePlan, completePlan,
  generateQuestions, submitAnswer, saveJournal, getPlans, getQuestions,
  exportRoadmap, exportPlan, exportJournal, downloadBlob, learnTopic,
} from '../services/api'
import StatsPanel from '../components/StatsPanel'
import LearningModal from '../components/LearningModal'
import KnowledgeGraph from '../components/KnowledgeGraph'
import type { GoalDetail as GoalDetailType } from '../types'
import {
  ArrowLeft, Target, RefreshCw, Calendar, Sparkles, CheckCircle2,
  BookOpen, MessageCircle, Clock, BarChart3, Send, Loader2, PenLine,
  ChevronDown, ChevronUp, AlertCircle, Play, FileText, Brain, GitBranch,
  Download
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

export default function GoalDetail() {
  const { id } = useParams<{ id: string }>()
  const [goal, setGoal] = useState<GoalDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submittingQ, setSubmittingQ] = useState<number | null>(null)
  const [evaluations, setEvaluations] = useState<Record<number, any>>({})

  const [journalContent, setJournalContent] = useState('')
  const [journalReflection, setJournalReflection] = useState('')
  const [journalDuration, setJournalDuration] = useState(0)
  const [savingJournal, setSavingJournal] = useState(false)
  const [journalMsg, setJournalMsg] = useState('')

  const [planDate, setPlanDate] = useState(todayStr())
  const [planData, setPlanData] = useState<any>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  const [actionLoading, setActionLoading] = useState('')
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const pendingTopicRef = useRef<{ day: number; title: string } | null>(null)
  const [showGraph, setShowGraph] = useState(false)
  const [topicLoading, setTopicLoading] = useState<number | null>(null)

  // 新创建目标时自动生成路线和规划
  const [autoGenStage, setAutoGenStage] = useState<'idle' | 'roadmap' | 'plan' | 'done' | 'error'>('idle')
  const [autoGenError, setAutoGenError] = useState('')
  const autoGenTried = useRef(false)

  // 已学习的主题天数（localStorage 持久化，突破每日规划限制）
  const learnedKey = `learned-days-${id}`
  const [learnedDays, setLearnedDays] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(`learned-days-${id}`)
      return raw ? new Set(JSON.parse(raw)) : new Set<number>()
    } catch { return new Set<number>() }
  })

  const markLearned = (day: number) => {
    setLearnedDays(prev => {
      const next = new Set(prev)
      next.add(day)
      localStorage.setItem(learnedKey, JSON.stringify([...next]))
      return next
    })
  }

  const loadGoal = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await getGoal(+id)
      setGoal(data)
      if (data.today_journal) {
        setJournalContent(data.today_journal.content || '')
        setJournalReflection(data.today_journal.reflection || '')
        setJournalDuration(data.today_journal.duration_minutes || 0)
      }
    } catch (e) {
      setError('无法加载目标，请确保后端服务已启动')
    } finally {
      setLoading(false)
    }
  }

  const loadPlan = async (date: string) => {
    if (!id) return
    setLoadingPlan(true)
    try {
      const data = await getPlans(+id, date)
      setPlanData(data && Object.keys(data).length > 0 ? data : null)
    } catch (e) {
      setPlanData(null)
    } finally {
      setLoadingPlan(false)
    }
  }

  // 自动生成路线 + 规划（新创建目标时用）
  const startAutoGenerate = async () => {
    if (!id || autoGenTried.current) return
    autoGenTried.current = true
    setAutoGenStage('roadmap')
    setAutoGenError('')
    try {
      await generateRoadmap(+id)
      setAutoGenStage('plan')
      try {
        await generatePlan(+id)
        setAutoGenStage('done')
      } catch {
        setAutoGenError('今日规划生成失败，可稍后手动生成')
        setAutoGenStage('done')
      }
      await loadGoal()
      await loadPlan(todayStr())
    } catch (e: any) {
      setAutoGenStage('error')
      setAutoGenError(e?.response?.data?.detail || e?.message || 'AI 服务响应异常，请稍后重试')
    }
  }

  // 新创建目标检测：无路线时自动触发生成
  useEffect(() => {
    if (goal && !goal.roadmap && !loading && autoGenStage === 'idle') {
      startAutoGenerate()
    }
  }, [goal, loading])

  useEffect(() => { loadGoal(); loadPlan(planDate) }, [id])
  useEffect(() => { loadPlan(planDate) }, [planDate])

  const doAction = async (label: string, fn: () => Promise<void>) => {
    setActionLoading(label)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(`${label}失败，请稍后重试`)
    } finally {
      setActionLoading('')
    }
  }

  const handleGenerateRoadmap = () => doAction('生成路线', async () => {
    await generateRoadmap(+id!)
    await loadGoal()
  })

  const handleLearnTopic = async (topicDay: number, topicTitle: string) => {
    pendingTopicRef.current = { day: topicDay, title: topicTitle }
    setTopicLoading(topicDay)
    setModalLoading(true)
    setModalError('')
    setSelectedTask({
      title: topicTitle,
      duration_min: 30,
      detail: 'AI 正在生成学习材料...',
    })
    try {
      const materials = await learnTopic(+id!, topicDay)
      markLearned(topicDay)
      setModalLoading(false)
      setModalError('')
      // 验证 AI 返回的材料是否有效（非空对象）
      const m = materials.materials
      if (!m || typeof m !== 'object' || !(
        m.summary || m.content || m.example || m.practice ||
        (m.key_concepts?.length > 0) ||
        (m.learning_objectives?.length > 0) ||
        (m.examples?.length > 0) ||
        (m.practice_questions?.length > 0)
      )) {
        setModalError('AI 返回的学习材料为空，请重试')
        return
      }
      setSelectedTask({
        title: materials.title || topicTitle,
        duration_min: materials.duration_min || 30,
        detail: materials.detail || '',
        materials: m,
      })
    } catch (e: any) {
      setModalLoading(false)
      setModalError(e?.response?.data?.detail || e?.message || 'AI 服务响应异常，请稍后重试')
      // 保留 selectedTask 不清空，弹窗保持打开以显示错误和重试入口
    } finally {
      setTopicLoading(null)
    }
  }

  const handleGeneratePlan = () => doAction('生成规划', async () => {
    await generatePlan(+id!)
    await loadGoal()
    await loadPlan(todayStr())
  })

  const handleGenerateQuestions = () => doAction('生成问题', async () => {
    await generateQuestions(+id!)
    await loadGoal()
  })

  const handleSubmitAnswer = async (questionId: number) => {
    const ans = answers[questionId]?.trim()
    if (!ans) return
    setSubmittingQ(questionId)
    try {
      const result = await submitAnswer(questionId, ans)
      setEvaluations(prev => ({ ...prev, [questionId]: result.ai_evaluation || result }))
      setAnswers(prev => { const n = { ...prev }; delete n[questionId]; return n })
      await loadGoal()
    } catch (e) {
      console.error('提交失败', e)
    } finally {
      setSubmittingQ(null)
    }
  }

  const handleSaveJournal = async () => {
    if (!journalContent.trim() && !journalReflection.trim()) return
    setSavingJournal(true)
    setJournalMsg('')
    try {
      await saveJournal(+id!, { content: journalContent, reflection: journalReflection, duration_minutes: journalDuration })
      setJournalMsg('已保存')
      await loadGoal()
    } catch (e) {
      setJournalMsg('保存失败')
    } finally {
      setSavingJournal(false)
      setTimeout(() => setJournalMsg(''), 2000)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-12 w-48 rounded-xl animate-shimmer" />
        <div className="h-24 rounded-2xl animate-shimmer" />
        <div className="grid grid-cols-4 gap-3"><div className="h-20 rounded-xl animate-shimmer" /><div className="h-20 rounded-xl animate-shimmer" /><div className="h-20 rounded-xl animate-shimmer" /><div className="h-20 rounded-xl animate-shimmer" /></div>
      </div>
    )
  }
  if (!goal) {
    return <div className="text-center py-20 text-gray-400">
      <AlertCircle size={48} className="mx-auto mb-3 text-gray-300" />
      <p>目标不存在</p>
    </div>
  }

  const phases = goal.roadmap?.content?.phases || []
  const tasks = (planData || goal.today_plan)?.plan_content?.tasks || []
  const planNote = (planData || goal.today_plan)?.plan_content?.note || ''
  const currentPlan = planData || goal.today_plan
  const questions = goal.today_questions || []
  const isToday = planDate === todayStr()

  return (
    <div className="pb-12 animate-fade-in">
      {/* 顶部导航 + 标题 */}
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors">
          <ArrowLeft size={14} /> 返回首页
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Target size={20} className="text-white" />
              </span>
              {goal.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                goal.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                goal.status === 'completed' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                'bg-gray-100 text-gray-500 border border-gray-200'
              }`}>
                {goal.status === 'active' ? '进行中' : goal.status === 'completed' ? '已完成' : '已暂停'}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <RefreshCw size={11} />
                路线 v{goal.roadmap?.version || '-'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowGraph(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer bg-white transition-all">
              <GitBranch size={14} /> 知识图谱
            </button>
            <button onClick={handleGenerateRoadmap} disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 cursor-pointer bg-white transition-all">
              <RefreshCw size={14} className={actionLoading === '生成路线' ? 'animate-spin' : ''} />
              调整路线
            </button>
            <button onClick={handleGeneratePlan} disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 cursor-pointer transition-all shadow-md shadow-indigo-200">
              <Sparkles size={14} />
              生成今日规划
            </button>
          </div>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </motion.div>
      )}

      <StatsPanel goalId={+id!} />

      {/* 学习路线 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-500" />
            学习路线
            {goal.roadmap && <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-full">v{goal.roadmap.version}</span>}
          </h2>
          {phases.length > 0 && (
            <button onClick={() => exportRoadmap(+id!).then(b => downloadBlob(b, '学习路线.md'))}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-all">
              <Download size={12} /> 导出
            </button>
          )}
        </div>
        {phases.length === 0 ? (
          autoGenStage !== 'idle' ? (
            <div className="text-center py-8">
              {autoGenStage === 'roadmap' && (
                <div>
                  <Loader2 size={44} className="mx-auto mb-4 text-indigo-400 animate-spin" />
                  <p className="text-gray-700 font-semibold mb-1">AI 正在生成学习路线</p>
                  <p className="text-gray-400 text-sm mb-3">分析学习目标，规划最优路径...</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs text-indigo-500">约需 20-40 秒</span>
                  </div>
                </div>
              )}
              {autoGenStage === 'plan' && (
                <div>
                  <Loader2 size={44} className="mx-auto mb-4 text-emerald-400 animate-spin" />
                  <p className="text-gray-700 font-semibold mb-1">学习路线已生成</p>
                  <p className="text-gray-400 text-sm mb-3">正在为你准备今日学习规划...</p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-600">约需 10-20 秒</span>
                  </div>
                </div>
              )}
              {autoGenStage === 'done' && (
                <div>
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">一切就绪！</p>
                  <p className="text-gray-400 text-sm">{autoGenError || '学习路线和今日规划已生成'}</p>
                </div>
              )}
              {autoGenStage === 'error' && (
                <div>
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle size={28} className="text-red-400" />
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">生成失败</p>
                  <p className="text-gray-400 text-sm mb-5 max-w-sm mx-auto">{autoGenError}</p>
                  <button
                    onClick={() => { autoGenTried.current = false; setAutoGenStage('idle'); startAutoGenerate() }}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 text-sm cursor-pointer transition-all shadow-md shadow-indigo-200 font-medium"
                  >
                    重新生成
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpen size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm mb-4">暂无学习路线</p>
              <button onClick={handleGenerateRoadmap} disabled={!!actionLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 text-sm cursor-pointer transition-all shadow-md shadow-indigo-200 font-medium">
                生成路线
              </button>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {phases.map((p: any, i: number) => (
              <details key={p.phase} className="group border border-gray-100 rounded-xl overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors list-none">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                      {p.phase}
                    </span>
                    <span className="font-medium text-sm text-gray-700">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{p.duration_days}天</span>
                    <ChevronDown size={16} className="text-gray-300 group-open:hidden" />
                    <ChevronUp size={16} className="text-gray-300 hidden group-open:block" />
                  </div>
                </summary>
                <div className="px-4 pb-3 pl-14 space-y-1">
                  {(p.topics || []).map((t: any) => {
                    const isLearned = learnedDays.has(t.day)
                    return (
                      <button
                        type="button"
                        key={t.day}
                        onClick={() => handleLearnTopic(t.day, t.title)}
                        disabled={topicLoading === t.day}
                        className={`w-full flex items-center gap-2 py-1.5 text-sm rounded-lg px-2 cursor-pointer transition-colors disabled:opacity-50 ${
                          isLearned
                            ? 'bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100'
                            : 'text-gray-600 hover:bg-indigo-50'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono shrink-0 ${
                          isLearned ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-500'
                        }`}>
                          {isLearned ? <CheckCircle2 size={11} /> : t.day}
                        </span>
                        <span className="text-left">{t.title}</span>
                        {topicLoading === t.day && (
                          <Loader2 size={12} className="animate-spin text-indigo-400 ml-auto shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* 每日规划 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar size={18} className="text-indigo-500" />
            {isToday ? '今日规划' : '规划'}
            {tasks.length > 0 && (
              <span className="text-[11px] text-gray-400 font-normal ml-1">点击任务开始学习</span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {currentPlan && (
              <button onClick={() => exportPlan(+id!, planDate).then(b => downloadBlob(b, `学习规划_${planDate}.md`))}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-all">
                <Download size={12} /> 导出
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPlanDate(d => {
              const dt = new Date(d); dt.setDate(dt.getDate() - 1); return dt.toISOString().slice(0, 10)
            })} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
              <ChevronDown size={16} className="text-gray-400 rotate-90" />
            </button>
            <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:border-indigo-400 outline-none" />
            <button onClick={() => setPlanDate(d => {
              const dt = new Date(d); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10)
            })} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
              <ChevronDown size={16} className="text-gray-400 -rotate-90" />
            </button>
          </div>
        </div>
        {loadingPlan ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-shimmer" />)}
          </div>
        ) : !currentPlan ? (
          <div className="text-center py-8">
            <Calendar size={36} className="mx-auto mb-2 text-gray-200" />
            <p className="text-gray-400 text-sm mb-4">{fmtDate(planDate)} 暂无规划</p>
            {isToday && (
              <button onClick={handleGeneratePlan} disabled={!!actionLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 text-sm cursor-pointer transition-all shadow-md shadow-indigo-200 font-medium">
                生成规划
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t: any, i: number) => (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i}
                onClick={() => setSelectedTask(t)}
                className={`flex items-start gap-3 p-3.5 rounded-xl transition-all cursor-pointer group ${
                  currentPlan?.completed ? 'bg-emerald-50/50' :
                  isToday ? 'bg-gray-50 hover:bg-indigo-50 hover:shadow-sm' : 'bg-gray-50/50'
                }`}
              >
                {isToday && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isToday && currentPlan) completePlan(currentPlan.id).then(() => { loadGoal(); loadPlan(planDate) })
                    }}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      currentPlan?.completed
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-300 group-hover:border-indigo-400'
                    }`}
                  >
                    {currentPlan?.completed && <CheckCircle2 size={12} className="text-white" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium flex items-center gap-2 ${
                    currentPlan?.completed ? 'text-gray-400 line-through' : 'text-gray-800'
                  }`}>
                    {t.title}
                    {t.materials && (
                      <BookOpen size={12} className="text-indigo-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span className="flex items-center gap-0.5"><Clock size={10} /> {t.duration_min}分钟</span>
                    <span>{t.detail}</span>
                    {t.materials && <span className="text-indigo-400 group-hover:text-indigo-600 transition-colors">点击开始学习 →</span>}
                  </div>
                </div>
              </motion.div>
            ))}
            {/* 旧规划没有材料时提示 */}
            {tasks.length > 0 && !tasks.some((t: any) => t.materials) && isToday && (
              <div className="mt-3 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  此规划不含学习材料，重新生成后可点击任务直接学习
                </span>
                <button onClick={handleGeneratePlan} disabled={!!actionLoading}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs cursor-pointer font-medium transition-colors shrink-0">
                  重新生成
                </button>
              </div>
            )}
            {planNote && (
              <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {planNote}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 继续学习 — 按路线顺序无限制学下去 */}
      {isToday && phases.length > 0 && (() => {
        const allTopics = phases.flatMap((p: any) => ({
          ...p,
          phaseTitle: p.title,
          topics: p.topics || [],
        }))
        const flatTopics = phases.flatMap((p: any) => (p.topics || []).map((t: any) => ({
          ...t,
          phaseTitle: p.title,
          phaseNum: p.phase,
        })))
        // 找到第一个未学过的主题
        const nextTopic = flatTopics.find((t: any) => !learnedDays.has(t.day))
        const totalTopics = flatTopics.length
        const learnedCount = totalTopics - flatTopics.filter((t: any) => !learnedDays.has(t.day)).length
        const progressPct = totalTopics > 0 ? Math.round((learnedCount / totalTopics) * 100) : 0

        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Play size={18} className="text-emerald-500" />
              继续学习
              <span className="text-xs text-gray-400 font-normal">按路线顺序 • 无限制</span>
            </h2>

            {/* 进度条 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">
                  路线进度：{learnedCount}/{totalTopics} 节
                </span>
                <span className="text-xs font-medium text-indigo-600">{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {nextTopic ? (
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] text-emerald-600 font-medium mb-1">
                      Phase {nextTopic.phaseNum} · {nextTopic.phaseTitle}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      Day {nextTopic.day}：{nextTopic.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      点击开始学习本节内容，AI 将实时生成完整学习材料
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLearnTopic(nextTopic.day, nextTopic.title)}
                    disabled={topicLoading === nextTopic.day}
                    className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 cursor-pointer text-sm font-medium transition-all shadow-md shadow-emerald-200 flex items-center gap-2"
                  >
                    {topicLoading === nextTopic.day ? (
                      <><Loader2 size={15} className="animate-spin" /> 生成中...</>
                    ) : (
                      <><Play size={15} /> 开始学习</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-300" />
                <p className="text-gray-500 font-medium mb-1">全部学完了！</p>
                <p className="text-gray-400 text-sm mb-4">路线中所有 {totalTopics} 节内容都已完成</p>
                <button
                  onClick={() => {
                    setLearnedDays(new Set())
                    localStorage.removeItem(learnedKey)
                  }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl cursor-pointer transition-colors"
                >
                  重置进度，重新来过
                </button>
              </div>
            )}

            {/* 已学列表（可折叠） */}
            {learnedCount > 0 && (
              <details className="mt-4 group">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 list-none flex items-center gap-1">
                  已学 {learnedCount} 节
                  <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {flatTopics
                    .filter((t: any) => learnedDays.has(t.day))
                    .map((t: any) => (
                      <button
                        key={t.day}
                        onClick={() => handleLearnTopic(t.day, t.title)}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors flex items-center gap-2"
                      >
                        <span className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center text-[10px] font-mono text-emerald-600 shrink-0">
                          {t.day}
                        </span>
                        {t.title}
                        <span className="text-gray-300 ml-auto shrink-0">复习</span>
                      </button>
                    ))}
                </div>
              </details>
            )}
          </div>
        )
      })()}

      {/* 今日问题 */}
      {isToday && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Brain size={18} className="text-indigo-500" />
              今日问题
            </h2>
            <button onClick={handleGenerateQuestions} disabled={actionLoading === '生成问题'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-all bg-white">
              <Sparkles size={13} className="text-indigo-500" />
              生成问题
            </button>
          </div>
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle size={36} className="mx-auto mb-2 text-gray-200" />
              <p className="text-gray-400 text-sm">暂无问题，点击生成获取今日练习</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions
                .filter((q: any) => !evaluations[q.id] && q.status !== 'answered')
                .map((q: any) => (
                  <div key={q.id} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 transition-all">
                    <p className="text-sm font-medium text-gray-900 mb-3 flex items-start gap-2">
                      <MessageCircle size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                      {q.question}
                      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-600' :
                        q.difficulty === 'hard' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                      }`}>{q.difficulty}</span>
                    </p>
                    <div className="space-y-2">
                      <textarea
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-all"
                        rows={3}
                        placeholder="写下你的回答..."
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      />
                      <button
                        onClick={() => handleSubmitAnswer(q.id)}
                        disabled={submittingQ === q.id || !(answers[q.id] || '').trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 cursor-pointer text-sm transition-all shadow-sm shadow-indigo-200"
                      >
                        {submittingQ === q.id ? (
                          <><Loader2 size={14} className="animate-spin" /> AI 评估中...</>
                        ) : (
                          <><Send size={13} /> 提交评估</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
          {/* 生成更多题目 */}
          {questions.length > 0 && questions.every((q: any) => q.status === 'answered' || evaluations[q.id]) && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">全部答完，可以继续刷题</span>
              <button onClick={handleGenerateQuestions} disabled={actionLoading === '生成问题'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 cursor-pointer transition-all shadow-sm shadow-indigo-200">
                <Sparkles size={13} /> 生成更多题目
              </button>
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Link to={`/goals/${id}/history`} className="text-sm text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors">
              <FileText size={13} /> 查看问答历史 →
            </Link>
          </div>
        </div>
      )}

      {/* 学习日志 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <PenLine size={18} className="text-indigo-500" />
            {isToday ? '今日学习心得' : `${fmtDate(planDate)} 记录`}
          </h2>
          <button onClick={() => exportJournal(+id!).then(b => downloadBlob(b, '学习日志.md'))}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-all">
            <Download size={12} /> 导出
          </button>
        </div>
        {goal.today_journal && isToday ? (
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><BookOpen size={12} /> 学习内容</p>
              <p className="text-sm text-gray-800">{goal.today_journal.content || '无'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Brain size={12} /> 心得反思</p>
              <p className="text-sm text-gray-800">{goal.today_journal.reflection || '无'}</p>
            </div>
            {goal.today_journal.duration_minutes > 0 && (
              <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> {goal.today_journal.duration_minutes}分钟</p>
            )}
          </div>
        ) : isToday ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">今天学了什么？</label>
              <textarea className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-all" rows={3}
                placeholder="记录今天学习的内容..." value={journalContent}
                onChange={e => setJournalContent(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">学习心得与反思</label>
              <textarea className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-all" rows={2}
                placeholder="今天的感受、遇到的困难、收获..." value={journalReflection}
                onChange={e => setJournalReflection(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">学习时长（分钟）</label>
                <input type="number" min={0} value={journalDuration}
                  onChange={e => setJournalDuration(+e.target.value || 0)}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none" />
              </div>
              <button onClick={handleSaveJournal}
                disabled={savingJournal || (!journalContent.trim() && !journalReflection.trim())}
                className="mt-5 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 cursor-pointer text-sm transition-all shadow-sm shadow-indigo-200 flex items-center gap-1.5">
                {savingJournal ? <><Loader2 size={14} className="animate-spin" /> 保存中...</> : <><CheckCircle2 size={14} /> 保存日志</>}
              </button>
              {journalMsg && (
                <span className={`mt-5 text-sm flex items-center gap-1 ${journalMsg === '已保存' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {journalMsg === '已保存' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {journalMsg}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">切换到「今天」可查看和编辑今日日志</p>
        )}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Link to={`/goals/${id}/history`} className="text-sm text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors">
            <FileText size={13} /> 查看全部记录 →
          </Link>
        </div>
      </div>

      {/* 学习弹窗 */}
      <AnimatePresence>
        {selectedTask && (
          <LearningModal
            task={selectedTask}
            goalId={+id!}
            goalTitle={goal?.title || ''}
            onClose={() => { setSelectedTask(null); setModalLoading(false); setModalError('') }}
            onRegenerate={handleGeneratePlan}
            loading={modalLoading}
            error={modalError}
            onRetry={() => {
              const pt = pendingTopicRef.current
              if (pt) handleLearnTopic(pt.day, pt.title)
            }}
          />
        )}
      </AnimatePresence>

      {/* 知识图谱 */}
      <AnimatePresence>
        {showGraph && (
          <KnowledgeGraph
            goalId={+id!}
            onClose={() => setShowGraph(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
