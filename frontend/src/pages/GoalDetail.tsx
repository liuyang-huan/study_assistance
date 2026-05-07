import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getGoal, generateRoadmap, generatePlan, completePlan,
  getQuestions, generateQuestions, submitAnswer,
  saveJournal, getJournal,
} from '../services/api'
import type { GoalDetail as GoalDetailType } from '../types'

export default function GoalDetail() {
  const { id } = useParams<{ id: string }>()
  const [goal, setGoal] = useState<GoalDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [answer, setAnswer] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState<number | null>(null)
  const [journalContent, setJournalContent] = useState('')
  const [journalReflection, setJournalReflection] = useState('')
  const [savingJournal, setSavingJournal] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const loadGoal = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getGoal(+id)
      setGoal(data)
      // 回填日志
      if (data.today_journal) {
        setJournalContent(data.today_journal.content || '')
        setJournalReflection(data.today_journal.reflection || '')
      }
    } catch (e) {
      console.error('加载目标失败', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGoal() }, [id])

  const handleGenerateRoadmap = async () => {
    if (!id) return
    setRegenerating(true)
    try {
      await generateRoadmap(+id)
      await loadGoal()
    } catch (e) {
      console.error('生成路线失败', e)
    } finally {
      setRegenerating(false)
    }
  }

  const handleGeneratePlan = async () => {
    if (!id) return
    setRegenerating(true)
    try {
      await generatePlan(+id)
      await loadGoal()
    } catch (e) {
      console.error('生成规划失败', e)
    } finally {
      setRegenerating(false)
    }
  }

  const handleGenerateQuestions = async () => {
    if (!id) return
    setRegenerating(true)
    try {
      await generateQuestions(+id)
      await loadGoal()
    } catch (e) {
      console.error('生成问题失败', e)
    } finally {
      setRegenerating(false)
    }
  }

  const handleSubmitAnswer = async (questionId: number) => {
    if (!answer.trim()) return
    setSubmittingAnswer(questionId)
    try {
      await submitAnswer(questionId, answer)
      setAnswer('')
      await loadGoal()
    } catch (e) {
      console.error('提交回答失败', e)
    } finally {
      setSubmittingAnswer(null)
    }
  }

  const handleSaveJournal = async () => {
    if (!id) return
    setSavingJournal(true)
    try {
      await saveJournal(+id, {
        content: journalContent,
        reflection: journalReflection,
        duration_minutes: 0,
      })
      setJournalContent('')
      setJournalReflection('')
      await loadGoal()
    } catch (e) {
      console.error('保存日志失败', e)
    } finally {
      setSavingJournal(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>
  }
  if (!goal) {
    return <div className="text-center py-12 text-gray-500">目标不存在</div>
  }

  const phases = goal.roadmap?.content?.phases || []
  const planTasks = goal.today_plan?.plan_content?.tasks || []
  const planNote = goal.today_plan?.plan_content?.note || ''
  const questions = goal.today_questions || []
  const today = new Date().toLocaleDateString('zh-CN')

  return (
    <div>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 no-underline">← 返回</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{goal.title}</h1>
          <p className="text-sm text-gray-500">{today} · {goal.status === 'active' ? '进行中' : goal.status}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGenerateRoadmap} disabled={regenerating}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            调整路线
          </button>
          <button onClick={handleGeneratePlan} disabled={regenerating}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer">
            生成今日规划
          </button>
        </div>
      </div>

      {/* 学习路线 + 今日规划 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* 学习路线 */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">学习路线</h2>
          {phases.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-3">暂无学习路线</p>
              <button onClick={handleGenerateRoadmap} disabled={regenerating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer text-sm">
                生成路线
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-auto">
              {phases.map((p: any) => (
                <details key={p.phase} className="group">
                  <summary className="cursor-pointer font-medium text-sm text-gray-700 hover:text-indigo-600 py-1">
                    Phase {p.phase}: {p.title}（{p.duration_days}天）
                  </summary>
                  <div className="mt-2 pl-4 border-l-2 border-indigo-200 space-y-2">
                    {(p.topics || []).map((t: any) => (
                      <div key={t.day} className="text-sm text-gray-600">
                        <span className="font-medium">Day {t.day}:</span> {t.title}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* 今日规划 */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">今日规划</h2>
          {!goal.today_plan ? (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-3">暂无今日规划</p>
              <button onClick={handleGeneratePlan} disabled={regenerating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer text-sm">
                生成规划
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {planTasks.map((t: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                  <input type="checkbox" className="mt-0.5"
                    checked={goal.today_plan?.completed}
                    onChange={() => goal.today_plan && completePlan(goal.today_plan.id).then(loadGoal)} />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{t.title}</div>
                    <div className="text-xs text-gray-500">{t.detail} · {t.duration_min}分钟</div>
                  </div>
                </div>
              ))}
              {planNote && <p className="text-xs text-gray-400 mt-2">💡 {planNote}</p>}
            </div>
          )}
        </div>
      </div>

      {/* 今日问题 */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">今日问题</h2>
          <button onClick={handleGenerateQuestions} disabled={regenerating}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            生成问题
          </button>
        </div>
        {questions.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无问题，点击"生成问题"获取今日练习。</p>
        ) : (
          <div className="space-y-4">
            {questions.map((q: any) => (
              <div key={q.id} className="p-3 bg-indigo-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Q: {q.question}
                  <span className="ml-2 text-xs text-gray-400">({q.difficulty})</span>
                  {q.status === 'answered' && <span className="ml-2 text-xs text-green-500">已答</span>}
                </p>
                {q.status !== 'answered' && (
                  <div>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-2"
                      rows={3}
                      placeholder="写下你的回答..."
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                    />
                    <button
                      onClick={() => handleSubmitAnswer(q.id)}
                      disabled={submittingAnswer === q.id || !answer.trim()}
                      className="mt-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer text-sm"
                    >
                      {submittingAnswer === q.id ? 'AI 评估中...' : '提交评估'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 学习日志 */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">今日学习心得</h2>
        {goal.today_journal ? (
          <div className="space-y-2">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">📝 学习内容：</p>
              <p className="text-sm text-gray-800 mt-1">{goal.today_journal.content || '无'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">💭 心得反思：</p>
              <p className="text-sm text-gray-800 mt-1">{goal.today_journal.reflection || '无'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">今天学了什么？</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
                placeholder="记录今天学习的内容..."
                value={journalContent}
                onChange={e => setJournalContent(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学习心得与反思</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
                placeholder="今天的学习感受、遇到的困难、收获..."
                value={journalReflection}
                onChange={e => setJournalReflection(e.target.value)}
              />
            </div>
            <button
              onClick={handleSaveJournal}
              disabled={savingJournal || (!journalContent.trim() && !journalReflection.trim())}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer text-sm"
            >
              {savingJournal ? '保存中...' : '保存日志'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
