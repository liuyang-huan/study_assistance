import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getGoal, generateRoadmap, generatePlan, completePlan,
  generateQuestions, submitAnswer, saveJournal, getPlans, getQuestions,
} from '../services/api'
import StatsPanel from '../components/StatsPanel'
import LearningModal from '../components/LearningModal'
import type { GoalDetail as GoalDetailType } from '../types'
import {
  ArrowLeft, Target, RefreshCw, Calendar, Sparkles, CheckCircle2,
  BookOpen, MessageCircle, Clock, BarChart3, Send, Loader2, PenLine,
  ChevronDown, ChevronUp, AlertCircle, Play, FileText, Brain
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
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-500" />
          学习路线
          {goal.roadmap && <span className="text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-full">v{goal.roadmap.version}</span>}
        </h2>
        {phases.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm mb-4">暂无学习路线</p>
            <button onClick={handleGenerateRoadmap} disabled={!!actionLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 text-sm cursor-pointer transition-all shadow-md shadow-indigo-200 font-medium">
              生成路线
            </button>
          </div>
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
                  {(p.topics || []).map((t: any) => (
                    <div key={t.day} className="flex items-center gap-2 py-1.5 text-sm text-gray-600">
                      <span className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-mono text-indigo-500 shrink-0">
                        {t.day}
                      </span>
                      <span>{t.title}</span>
                    </div>
                  ))}
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
              {questions.map((q: any) => {
                const evalData = evaluations[q.id]
                const isAnswered = q.status === 'answered' || !!evalData
                return (
                  <div key={q.id} className={`p-4 rounded-xl border transition-all ${
                    evalData ? (evalData.score && evalData.score >= 7
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-amber-200 bg-amber-50/50')
                    : isAnswered ? 'border-gray-200 bg-gray-50' : 'border-indigo-100 bg-indigo-50/50'
                  }`}>
                    <p className="text-sm font-medium text-gray-900 mb-3 flex items-start gap-2">
                      <MessageCircle size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                      {q.question}
                      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-600' :
                        q.difficulty === 'hard' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                      }`}>{q.difficulty}</span>
                    </p>

                    {evalData ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">AI 评分</span>
                          <span className={`text-lg font-bold ${
                            evalData.score && evalData.score >= 7 ? 'text-emerald-600' :
                            evalData.score && evalData.score >= 4 ? 'text-amber-600' : 'text-red-600'
                          }`}>{evalData.score}/10</span>
                        </div>
                        {evalData.correctness && <p className="text-gray-600 bg-white/60 rounded-lg p-2 text-xs">{evalData.correctness}</p>}
                        {evalData.suggestion && (
                          <p className="text-indigo-600 bg-white rounded-lg p-2 text-xs border border-indigo-100">{evalData.suggestion}</p>
                        )}
                        {evalData.need_adjust && (
                          <button onClick={handleGenerateRoadmap}
                            className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1">
                            <AlertCircle size={12} /> AI 建议调整路线 →
                          </button>
                        )}
                      </motion.div>
                    ) : isAnswered ? (
                      <p className="text-sm text-gray-400 flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> 等待评估...
                      </p>
                    ) : (
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
                    )}
                  </div>
                )
              })}
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
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <PenLine size={18} className="text-indigo-500" />
          {isToday ? '今日学习心得' : `${fmtDate(planDate)} 记录`}
        </h2>
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
            onClose={() => setSelectedTask(null)}
            onRegenerate={handleGeneratePlan}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
