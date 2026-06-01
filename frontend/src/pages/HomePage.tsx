import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGoals, createGoal, deleteGoal, getGoalsProgress, getNotes, importDocument, getGlobalNotes, createGlobalNote, updateGlobalNote, deleteGlobalNote } from '../services/api'
import type { LearningGoal, GlobalNote } from '../types'
import { Plus, Target, Calendar, Trash2, BookOpen, Sparkles, ChevronRight, StickyNote, Upload, NotebookPen, Pencil, Check, X } from 'lucide-react'

export default function HomePage() {
  const [goals, setGoals] = useState<LearningGoal[]>([])
  const [progress, setProgress] = useState<Record<number, { learned: number; total: number; percent: number }>>({})
  const [noteCounts, setNoteCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [globalNotes, setGlobalNotes] = useState<GlobalNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())
  const [notesLoading, setNotesLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => { loadGoals(); loadGlobalNotes() }, [])

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

  const loadGlobalNotes = async () => {
    try {
      const notes = await getGlobalNotes()
      setGlobalNotes(notes)
    } catch (e) {
      console.error('加载全局笔记失败', e)
    } finally {
      setNotesLoading(false)
    }
  }

  const handleCreateGlobalNote = async () => {
    if (!newNote.trim() || savingNote) return
    setSavingNote(true)
    try {
      const note = await createGlobalNote(newNote.trim())
      setGlobalNotes(prev => [note, ...prev])
      setNewNote('')
    } catch (e) {
      console.error('保存笔记失败', e)
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteGlobalNote = async (noteId: number) => {
    try {
      await deleteGlobalNote(noteId)
      setGlobalNotes(prev => prev.filter(n => n.id !== noteId))
    } catch (e) {
      console.error('删除笔记失败', e)
    }
  }

  const handleStartEdit = (note: GlobalNote) => {
    setEditingNoteId(note.id)
    setEditingContent(note.content)
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditingContent('')
  }

  const toggleNote = (noteId: number) => {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  const handleSaveEdit = async (noteId: number) => {
    if (!editingContent.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const updated = await updateGlobalNote(noteId, editingContent.trim())
      setGlobalNotes(prev => prev.map(n => n.id === noteId ? updated : n))
      setEditingNoteId(null)
      setEditingContent('')
    } catch (e) {
      console.error('更新笔记失败', e)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportProgress(0)
    try {
      const result = await importDocument(file, (pct) => setImportProgress(pct))
      navigate(`/goals/${result.goal.id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '导入失败'
      alert(msg)
    } finally {
      setImporting(false)
      setImportProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

      {/* 主内容区：桌面端双栏，移动端单栏 */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* 左栏：目标管理 */}
        <div className="space-y-5 min-w-0">
          {/* 创建表单 */}
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
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800"
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

          {/* 导入教材 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
          {importing ? (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
              <div className="flex items-center gap-3 mb-2">
                <svg className="animate-spin w-5 h-5 text-indigo-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-indigo-600 dark:text-indigo-400">
                  正在导入教材… {importProgress > 0 && `${importProgress}%`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-indigo-100 dark:bg-indigo-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress || 5}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-amber-200 dark:border-amber-800 rounded-2xl text-amber-500 dark:text-amber-400 hover:border-amber-400 hover:text-amber-600 transition-all cursor-pointer group"
            >
              <Upload size={24} className="mx-auto mb-1 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-sm">导入教材（PDF / DOCX）</span>
            </button>
          )}

          {/* 目标列表 */}
          {loading ? (
            <div className="space-y-3">
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
            <div className="grid gap-3">
              {goals.map((g) => (
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
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                    title="删除此目标"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右栏：全局笔记本（sticky 悬浮） */}
        <div className="lg:sticky lg:top-4 mt-5 lg:mt-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                <NotebookPen size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">学习心得笔记本</span>
              {!notesLoading && (
                <span className="text-[11px] text-gray-400 dark:text-slate-500 ml-auto">{globalNotes.length} 条笔记</span>
              )}
            </div>

            <div className="p-4">
              <textarea
                className="w-full px-4 py-4 bg-amber-50/50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900/30 outline-none transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                placeholder="写点学习心得…比如今天学到了什么、有什么感悟"
                rows={12}
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleCreateGlobalNote()
                  }
                }}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-gray-400 dark:text-slate-500">Ctrl + Enter 快速保存</span>
                <button
                  onClick={handleCreateGlobalNote}
                  disabled={!newNote.trim() || savingNote}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl hover:from-amber-500 hover:to-orange-600 disabled:opacity-40 cursor-pointer font-medium text-sm transition-all shadow-sm"
                >
                  {savingNote ? '保存中...' : '记下心得'}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-50 dark:border-slate-800">
              {notesLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-xl animate-shimmer" />
                  ))}
                </div>
              ) : globalNotes.length === 0 ? (
                <div className="py-10 text-center">
                  <StickyNote size={28} className="mx-auto text-gray-200 dark:text-slate-700 mb-2" />
                  <p className="text-xs text-gray-400 dark:text-slate-500">还没有学习心得，写一条吧</p>
                </div>
              ) : (
                <div className="p-3 space-y-2 max-h-[calc(100vh-140px)] overflow-y-auto">
                  {globalNotes.map(note => {
                    const isEditing = editingNoteId === note.id
                    return (
                    <div
                      key={note.id}
                      className={`group relative p-3 rounded-xl transition-colors ${
                        isEditing
                          ? 'bg-amber-50/80 dark:bg-amber-900/20 ring-2 ring-amber-200 dark:ring-amber-800'
                          : 'bg-gray-50/50 dark:bg-slate-800/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
                      }`}
                    >
                      {isEditing ? (
                        <div>
                          <textarea
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900/30 outline-none transition-all resize-none"
                            rows={5}
                            value={editingContent}
                            onChange={e => setEditingContent(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault()
                                handleSaveEdit(note.id)
                              }
                              if (e.key === 'Escape') {
                                handleCancelEdit()
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-gray-400 dark:text-slate-500">Esc 取消 · Ctrl+Enter 保存</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="取消"
                              >
                                <X size={14} />
                              </button>
                              <button
                                onClick={() => handleSaveEdit(note.id)}
                                disabled={!editingContent.trim() || savingEdit}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg hover:from-amber-500 hover:to-orange-600 disabled:opacity-40 cursor-pointer text-xs font-medium transition-all shadow-sm"
                              >
                                {savingEdit ? '保存中...' : '保存'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => toggleNote(note.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[11px] text-gray-400 dark:text-slate-500">
                                  {new Date(note.created_at).toLocaleDateString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                    weekday: 'short',
                                  })}
                                </span>
                                {note.updated_at !== note.created_at && (
                                  <span className="text-[10px] text-gray-300 dark:text-slate-600">(已编辑)</span>
                                )}
                              </div>
                              {expandedNotes.has(note.id) ? (
                                <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                  {note.content}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                  {note.content}
                                </p>
                              )}
                              {note.content.length > 80 && (
                                <span className="inline-block mt-1 text-[11px] text-amber-500">
                                  {expandedNotes.has(note.id) ? '收起' : '展开全文'}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleStartEdit(note)}
                                className="p-1 rounded-lg text-gray-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
                                title="编辑笔记"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteGlobalNote(note.id)}
                                className="p-1 rounded-lg text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                                title="删除笔记"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
