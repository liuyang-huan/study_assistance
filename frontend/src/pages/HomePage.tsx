import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGoals, createGoal, deleteGoal, getGoalsProgress, getNotes } from '../services/api'
import type { LearningGoal } from '../types'
import { Plus, Target, Calendar, Trash2, BookOpen, Sparkles, ChevronRight, StickyNote } from 'lucide-react'

export default function HomePage() {
  const [goals, setGoals] = useState<LearningGoal[]>([])
  const [progress, setProgress] = useState<Record<number, { learned: number; total: number; percent: number }>>({})
  const [noteCounts, setNoteCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()

  const loadGoals = async () => {
    try {
      const [goalsData, progressData] = await Promise.all([getGoals(), getGoalsProgress()])
      setGoals(goalsData)
      const map: Record<number, any> = {}
      progressData.forEach(p => { map[p.goal_id] = { learned: p.learned, total: p.total, percent: p.percent } })
      setProgress(map)
      // 加载笔记数量
      const noteResults = await Promise.allSettled(goalsData.map(g => getNotes(g.id)))
      const counts: Record<number, number> = {}
      noteResults.forEach((r, i) => {
        if (r.status === 'fulfilled') counts[goalsData[i].id] = r.value.length
      })
      setNoteCounts(counts)
    } catch (e) {
      console.error('加载目标失败', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGoals() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const goal = await createGoal({ title, description })
      setTitle('')
      setDescription('')
      setShowForm(false)
      navigate(`/goals/${goal.id}`)
    } catch (e) {
      console.error('创建失败', e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该学习目标？')) return
    try {
      await deleteGoal(id)
      await loadGoals()
    } catch (e) {
      console.error('删除失败', e)
    }
  }

  const statusLabel = (s: string) =>
    s === 'active' ? '进行中' : s === 'completed' ? '已完成' : '已暂停'

  const statusColor = (s: string) =>
    s === 'active' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' :
    s === 'completed' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="text-center mb-8 pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 text-xs text-indigo-600 mb-4">
          <Sparkles size={13} />
          AI 驱动个人学习助手
        </div>
        <h1 className="text-3xl font-bold gradient-text mb-2">今天想学什么？</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm">设定目标，AI 为你量身定制学习路线</p>
      </div>

      {/* 创建表单 */}
      <div className="max-w-lg mx-auto mb-8">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full p-4 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl text-gray-400 dark:text-slate-500 hover:border-indigo-300 hover:text-indigo-500 transition-all cursor-pointer group"
          >
            <Plus size={24} className="mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-sm">创建新的学习目标</span>
          </button>
        ) : (
          <form
            onSubmit={handleCreate}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target size={18} className="text-indigo-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">新学习目标</span>
            </div>
            <input
              className="w-full mb-3 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-base focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              placeholder="想学什么？例如：学会微积分"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
            <textarea
              className="w-full mb-4 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
              placeholder="补充描述（可选）：你的基础、期望的时间等"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 cursor-pointer font-medium text-sm transition-all shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    AI 生成路线中...
                  </span>
                ) : '创建并生成路线'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-400 cursor-pointer text-sm"
              >
                取消
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 目标列表 */}
      {loading ? (
        <div className="space-y-3 max-w-lg mx-auto">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
            <BookOpen size={32} className="text-gray-300 dark:text-slate-600" />
          </div>
          <p className="text-gray-400 dark:text-slate-500 text-sm">还没有学习目标</p>
          <p className="text-gray-300 dark:text-slate-600 text-xs mt-1">点击上方按钮创建第一个</p>
        </div>
      ) : (
        <div className="grid gap-3 max-w-lg mx-auto">
          {goals.map((g, i) => (
            <div
              key={g.id}
              className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 hover:border-indigo-200 hover:shadow-lg transition-all duration-300"
            >
              <Link to={`/goals/${g.id}`} className="flex items-center gap-4 p-4 no-underline text-inherit">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  g.status === 'active' ? 'bg-gradient-to-br from-indigo-100 to-purple-100' :
                  g.status === 'completed' ? 'bg-gradient-to-br from-emerald-100 to-teal-100' :
                  'bg-gray-100'
                }`}>
                  <Target size={18} className={
                    g.status === 'active' ? 'text-indigo-500' :
                    g.status === 'completed' ? 'text-emerald-500' : 'text-gray-400 dark:text-slate-500'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors truncate">
                    {g.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusColor(g.status)}`}>
                      {statusLabel(g.status)}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-0.5">
                      <Calendar size={11} />
                      {new Date(g.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  {progress[g.id] && progress[g.id].total > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">
                          {progress[g.id].learned}/{progress[g.id].total} 节
                        </span>
                        <span className="text-[10px] font-medium text-indigo-500">{progress[g.id].percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${progress[g.id].percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {noteCounts[g.id] > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-500">
                      <StickyNote size={11} />
                      {noteCounts[g.id]} 条笔记
                    </div>
                  )}
                </div>
                <ChevronRight size={18} className="text-gray-300 dark:text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(g.id) }}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:bg-red-900/30 transition-colors cursor-pointer"
                title="删除此目标"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
