import { useState, useEffect, useRef } from 'react'
import { getTodos, createTodo, updateTodo, deleteTodo } from '../services/api'
import type { TodoTask } from '../types'
import { Plus, Trash2, Calendar, CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, ListTodo } from 'lucide-react'

export default function TodoList() {
  const [todos, setTodos] = useState<TodoTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadTodos = async () => {
    try {
      const data = await getTodos()
      setTodos(data)
    } catch (e) {
      console.error('加载待办失败', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTodos() }, [])

  useEffect(() => {
    if (showForm && inputRef.current) inputRef.current.focus()
  }, [showForm])

  const handleAdd = async () => {
    if (!newTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      const todo = await createTodo({
        title: newTitle.trim(),
        deadline: newDeadline || null,
      })
      setTodos(prev => [todo, ...prev])
      setNewTitle('')
      setNewDeadline('')
      setShowForm(false)
    } catch (e) {
      console.error('添加失败', e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (todo: TodoTask) => {
    try {
      const updated = await updateTodo(todo.id, { completed: !todo.completed })
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
    } catch (e) {
      console.error('更新失败', e)
    }
  }

  const handleDelete = async (todoId: number) => {
    try {
      await deleteTodo(todoId)
      setTodos(prev => prev.filter(t => t.id !== todoId))
    } catch (e) {
      console.error('删除失败', e)
    }
  }

  const activeTodos = todos.filter(t => !t.completed)
  const completedTodos = todos.filter(t => t.completed)

  const deadlineLabel = (d: string | null) => {
    if (!d) return null
    const deadline = new Date(d)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const diff = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)

    if (diff < 0) {
      return { text: `已逾期 ${Math.abs(diff)} 天`, urgent: true }
    } else if (diff === 0) {
      return { text: '今天截止', urgent: true }
    } else if (diff <= 3) {
      return { text: `还剩 ${diff} 天`, urgent: false }
    } else {
      return { text: `${deadline.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}`, urgent: false }
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 dark:border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
          <ListTodo size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">待办清单</span>
        {!loading && (
          <span className="text-[11px] text-gray-400 dark:text-slate-500 ml-auto">
            {activeTodos.length} 项待完成
          </span>
        )}
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
          title="添加待办"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* 添加表单 */}
      {showForm && (
        <div className="p-4 border-b border-gray-50 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10">
          <input
            ref={inputRef}
            className="w-full mb-2.5 px-3 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition-all"
            placeholder="输入待办事项..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') { setShowForm(false); setNewTitle(''); setNewDeadline('') }
            }}
          />
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
              <Calendar size={13} className="text-gray-400 shrink-0" />
              <input
                type="date"
                className="text-xs bg-transparent outline-none text-gray-600 dark:text-slate-400 w-full"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || submitting}
              className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 disabled:opacity-40 cursor-pointer text-xs font-medium transition-all shadow-sm"
            >
              {submitting ? '...' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="max-h-[320px] overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : activeTodos.length === 0 && completedTodos.length === 0 ? (
          <div className="py-10 text-center">
            <ListTodo size={28} className="mx-auto text-gray-200 dark:text-slate-700 mb-2" />
            <p className="text-xs text-gray-400 dark:text-slate-500">还没有待办事项</p>
          </div>
        ) : (
          <div className="p-2">
            {/* 活跃任务 */}
            {activeTodos.map(todo => {
              const dl = deadlineLabel(todo.deadline)
              return (
                <div
                  key={todo.id}
                  className="group flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <button
                    onClick={() => handleToggle(todo)}
                    className="mt-0.5 shrink-0 text-gray-300 dark:text-slate-600 hover:text-blue-500 transition-colors cursor-pointer"
                    title="标记完成"
                  >
                    <Circle size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800 dark:text-slate-200 leading-snug">
                      {todo.title}
                    </span>
                    {dl && (
                      <span className={`inline-flex items-center gap-1 ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                        dl.urgent
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                      }`}>
                        <Clock size={10} />
                        {dl.text}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="p-1 rounded text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}

            {/* 分隔 + 历史记录 */}
            {completedTodos.length > 0 && (
              <div className="mt-1">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  已完成 {completedTodos.length} 项
                  {showHistory ? ' — 收起' : ' — 展开'}
                </button>

                {showHistory && (
                  <div>
                    {completedTodos.map(todo => (
                      <div
                        key={todo.id}
                        className="group flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors opacity-60"
                      >
                        <button
                          onClick={() => handleToggle(todo)}
                          className="mt-0.5 shrink-0 text-green-500 hover:text-green-600 transition-colors cursor-pointer"
                          title="取消完成"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-500 dark:text-slate-400 line-through leading-snug">
                            {todo.title}
                          </span>
                          {todo.completed_at && (
                            <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-gray-400 dark:text-slate-500">
                              完成于 {new Date(todo.completed_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(todo.id)}
                          className="p-1 rounded text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
