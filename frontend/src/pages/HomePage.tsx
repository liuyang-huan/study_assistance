import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getGoals, createGoal, deleteGoal } from '../services/api'
import type { LearningGoal } from '../types'

export default function HomePage() {
  const [goals, setGoals] = useState<LearningGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadGoals = async () => {
    try {
      const data = await getGoals()
      setGoals(data)
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
      await createGoal({ title, description })
      setTitle('')
      setDescription('')
      setShowForm(false)
      await loadGoals()
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">我的学习目标</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
        >
          + 新建目标
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-lg shadow border border-gray-200">
          <input
            className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-lg"
            placeholder="想学什么？例如：学会微积分"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="补充描述（可选）：你的基础、期望的时间等"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'AI 正在生成学习路线...' : '创建并生成路线'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : goals.length === 0 ? (
        <p className="text-gray-500">还没有学习目标，点击上方按钮创建第一个。</p>
      ) : (
        <div className="grid gap-4">
          {goals.map(g => (
            <div key={g.id} className="p-4 bg-white rounded-lg shadow border border-gray-200 flex items-center justify-between">
              <Link to={`/goals/${g.id}`} className="no-underline text-inherit flex-1">
                <h3 className="text-lg font-semibold text-indigo-600">{g.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {g.status === 'active' ? '进行中' : g.status === 'completed' ? '已完成' : '已暂停'} · {new Date(g.created_at).toLocaleDateString('zh-CN')}
                </p>
              </Link>
              <button
                onClick={() => handleDelete(g.id)}
                className="ml-4 px-3 py-1 text-red-500 hover:text-red-700 cursor-pointer text-sm"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
