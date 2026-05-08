import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createGoal } from '../services/api'
import { Target, Sparkles, ArrowLeft, Loader2 } from 'lucide-react'

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
    <div className="max-w-lg mx-auto animate-fade-in">
      <button onClick={() => navigate('/')} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors cursor-pointer">
        <ArrowLeft size={14} /> 返回首页
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <Target size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">创建新的学习目标</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700">学习目标 *</span>
            <div className="relative mt-1.5">
              <Target size={16} className="absolute left-3.5 top-3 text-gray-300" />
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                placeholder="例如：学会微积分、掌握钢琴入门"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
              />
            </div>
          </label>

          <label className="block mb-6">
            <span className="text-sm font-medium text-gray-700">补充描述</span>
            <textarea
              className="mt-1.5 w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
              placeholder="你的基础、期望的时间安排、具体目标等"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 cursor-pointer font-medium text-sm transition-all shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> AI 正在生成学习路线...</>
              ) : (
                <><Sparkles size={15} /> 创建并生成学习路线</>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2.5 text-gray-400 hover:text-gray-600 cursor-pointer text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
