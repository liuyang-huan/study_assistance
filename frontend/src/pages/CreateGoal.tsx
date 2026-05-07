import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createGoal } from '../services/api'

export default function CreateGoal() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const goal = await createGoal({ title, description })
      navigate(`/goals/${goal.id}`)
    } catch (e) {
      setError('创建失败，请确保后端服务已启动')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">创建新的学习目标</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">学习目标 *</span>
          <input
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-lg"
            placeholder="例如：学会微积分、掌握钢琴入门"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">补充描述</span>
          <textarea
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="你的基础、期望的时间安排、具体目标等"
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer font-medium"
        >
          {submitting ? 'AI 正在生成学习路线...' : '创建并生成学习路线'}
        </button>
      </form>
    </div>
  )
}
