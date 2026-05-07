import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getGoal, generateRoadmap, generatePlan, completePlan,
  generateQuestions, submitAnswer, saveJournal, getPlans, getQuestions,
} from '../services/api'
import StatsPanel from '../components/StatsPanel'
import type { GoalDetail as GoalDetailType } from '../types'

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

  // 问答
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submittingQ, setSubmittingQ] = useState<number | null>(null)
  const [evaluations, setEvaluations] = useState<Record<number, any>>({})

  // 日志
  const [journalContent, setJournalContent] = useState('')
  const [journalReflection, setJournalReflection] = useState('')
  const [journalDuration, setJournalDuration] = useState(0)
  const [savingJournal, setSavingJournal] = useState(false)
  const [journalMsg, setJournalMsg] = useState('')

  // 规划日期
  const [planDate, setPlanDate] = useState(todayStr())
  const [planData, setPlanData] = useState<any>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  // 全局
  const [actionLoading, setActionLoading] = useState('')

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
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }
  if (!goal) {
    return <div className="text-center py-20 text-gray-500">目标不存在</div>
  }

  const phases = goal.roadmap?.content?.phases || []
  const tasks = (planData || goal.today_plan)?.plan_content?.tasks || []
  const planNote = (planData || goal.today_plan)?.plan_content?.note || ''
  const currentPlan = planData || goal.today_plan
  const questions = goal.today_questions || []
  const isToday = planDate === todayStr()

  return (
    <div className="pb-12">
      {/* 顶部 */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">← 返回首页</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{goal.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              goal.status === 'active' ? 'bg-green-100 text-green-700' :
              goal.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {goal.status === 'active' ? '进行中' : goal.status === 'completed' ? '已完成' : '已暂停'}
            </span>
            <span className="text-xs text-gray-400">路线版本 {goal.roadmap?.version || '-'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleGenerateRoadmap} disabled={actionLoading === '生成路线'}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
            {actionLoading === '生成路线' ? '...' : '调整路线'}
          </button>
          <button onClick={handleGeneratePlan} disabled={actionLoading === '生成规划'}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
            {actionLoading === '生成规划' ? '...' : '生成今日规划'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      <StatsPanel goalId={+id!} />

      {/* 学习路线 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          学习路线
          {goal.roadmap && <span className="text-xs text-gray-400 font-normal">版本 {goal.roadmap.version}</span>}
        </h2>
        {phases.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-3">暂无学习路线</p>
            <button onClick={handleGenerateRoadmap} disabled={!!actionLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm cursor-pointer">
              生成路线
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {phases.map((p: any) => (
              <details key={p.phase} className="group border border-gray-100 rounded-lg p-3">
                <summary className="cursor-pointer font-medium text-sm text-gray-700 hover:text-indigo-600">
                  Phase {p.phase}: {p.title}
                  <span className="ml-2 text-xs text-gray-400">{p.duration_days}天</span>
                </summary>
                <div className="mt-3 pl-4 border-l-2 border-indigo-200 space-y-1.5">
                  {(p.topics || []).map((t: any) => (
                    <div key={t.day} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-indigo-400 font-mono text-xs mt-0.5">D{t.day}</span>
                      <span>{t.title}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* 每日规划 + 日期切换 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">
            {isToday ? '今日规划' : '规划'}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setPlanDate(d => {
              const dt = new Date(d); dt.setDate(dt.getDate() - 1); return dt.toISOString().slice(0, 10)
            })} className="px-2 py-1 text-sm border rounded hover:bg-gray-50 cursor-pointer">◀</button>
            <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-lg" />
            <button onClick={() => setPlanDate(d => {
              const dt = new Date(d); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10)
            })} className="px-2 py-1 text-sm border rounded hover:bg-gray-50 cursor-pointer">▶</button>
          </div>
        </div>
        {loadingPlan ? (
          <p className="text-sm text-gray-400 py-4 text-center">加载中...</p>
        ) : !currentPlan ? (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-3">{fmtDate(planDate)}暂无规划</p>
            {isToday && (
              <button onClick={handleGeneratePlan} disabled={!!actionLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm cursor-pointer">
                生成规划
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t: any, i: number) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                isToday ? 'bg-gray-50' : 'bg-gray-50 opacity-60'
              }`}>
                {isToday && <input type="checkbox" className="mt-0.5"
                  checked={currentPlan?.completed}
                  onChange={() => {
                    if (isToday && currentPlan) completePlan(currentPlan.id).then(() => { loadGoal(); loadPlan(planDate) })
                  }} />}
                <div>
                  <div className="text-sm font-medium text-gray-800">{t.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.detail} · {t.duration_min}分钟</div>
                </div>
              </div>
            ))}
            {planNote && <p className="text-xs text-gray-400 mt-3 p-2 bg-yellow-50 rounded-lg">{planNote}</p>}
          </div>
        )}
      </div>

      {/* 今日问题 */}
      {isToday && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">今日问题</h2>
            <button onClick={handleGenerateQuestions} disabled={actionLoading === '生成问题'}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
              {actionLoading === '生成问题' ? '...' : '生成问题'}
            </button>
          </div>
          {questions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">暂无问题，点击"生成问题"获取今日练习。</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q: any) => {
                const evalData = evaluations[q.id]
                const isAnswered = q.status === 'answered' || !!evalData
                return (
                  <div key={q.id} className={`p-4 rounded-lg border ${
                    evalData ? (evalData.score && evalData.score >= 7 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50') :
                    isAnswered ? 'border-gray-200 bg-gray-50' : 'border-indigo-100 bg-indigo-50'
                  }`}>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Q: {q.question}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        q.difficulty === 'easy' ? 'bg-green-100 text-green-600' :
                        q.difficulty === 'hard' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>{q.difficulty}</span>
                    </p>

                    {evalData ? (
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">AI 评分：</span>
                          <span className={`font-bold text-lg ${evalData.score && evalData.score >= 7 ? 'text-green-600' : evalData.score && evalData.score >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {evalData.score}/10
                          </span>
                        </div>
                        <p className="text-gray-600"><span className="font-medium">正确性：</span>{evalData.correctness}</p>
                        {evalData.depth && <p className="text-gray-600"><span className="font-medium">理解深度：</span>{evalData.depth}</p>}
                        {evalData.suggestion && <p className="text-indigo-600 bg-white rounded p-2">{evalData.suggestion}</p>}
                        {evalData.need_adjust && (
                          <button onClick={handleGenerateRoadmap} className="text-sm text-orange-600 hover:text-orange-800">
                            AI 建议调整路线 →
                          </button>
                        )}
                      </div>
                    ) : isAnswered ? (
                      <p className="text-sm text-gray-400 mt-2">已提交，等待评估...</p>
                    ) : (
                      <div className="mt-2">
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          rows={3}
                          placeholder="写下你的回答..."
                          value={answers[q.id] || ''}
                          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => handleSubmitAnswer(q.id)}
                          disabled={submittingQ === q.id || !(answers[q.id] || '').trim()}
                          className="mt-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer text-sm"
                        >
                          {submittingQ === q.id ? 'AI 评估中...' : '提交评估'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Link to={`/goals/${id}/history`} className="text-sm text-indigo-600 hover:text-indigo-800">
              查看问答历史 →
            </Link>
          </div>
        </div>
      )}

      {/* 学习日志 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">
          {isToday ? '今日学习心得' : `${fmtDate(planDate)} 学习记录`}
        </h2>
        {goal.today_journal && isToday ? (
          <div className="space-y-2">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">学习内容</p>
              <p className="text-sm text-gray-800">{goal.today_journal.content || '无'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">心得反思</p>
              <p className="text-sm text-gray-800">{goal.today_journal.reflection || '无'}</p>
            </div>
            {goal.today_journal.duration_minutes > 0 && (
              <p className="text-xs text-gray-400">学习时长：{goal.today_journal.duration_minutes}分钟</p>
            )}
          </div>
        ) : isToday ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">今天学了什么？</label>
              <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={3}
                placeholder="记录今天学习的内容..." value={journalContent}
                onChange={e => setJournalContent(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学习心得与反思</label>
              <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={3}
                placeholder="今天的感受、遇到的困难、收获..." value={journalReflection}
                onChange={e => setJournalReflection(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学习时长（分钟）</label>
                <input type="number" min={0} value={journalDuration}
                  onChange={e => setJournalDuration(+e.target.value || 0)}
                  className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <button onClick={handleSaveJournal}
                disabled={savingJournal || (!journalContent.trim() && !journalReflection.trim())}
                className="mt-5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer text-sm">
                {savingJournal ? '保存中...' : '保存日志'}
              </button>
              {journalMsg && <span className={`mt-5 text-sm ${journalMsg === '已保存' ? 'text-green-600' : 'text-red-600'}`}>{journalMsg}</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">切换到「今天」可查看和编辑今日日志</p>
        )}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Link to={`/goals/${id}/history`} className="text-sm text-indigo-600 hover:text-indigo-800">
            查看全部记录 →
          </Link>
        </div>
      </div>
    </div>
  )
}
