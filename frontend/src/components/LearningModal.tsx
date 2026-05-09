import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen, Clock, Lightbulb, Code, PenLine, X, Target,
  Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Save, Loader2, AlertCircle,
  MessageCircle, Send, Bot, User, Sparkles, Menu
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { chatWithBuddy } from '../services/api'

interface KeyConcept {
  name: string
  explanation: string
}

interface Example {
  title: string
  description: string
  code: string
}

interface PracticeQuestion {
  question: string
  hint: string
}

interface Materials {
  summary?: string
  learning_objectives?: string[]
  key_concepts?: KeyConcept[]
  content?: string
  example?: string
  practice?: string
  examples?: Example[]
  practice_questions?: PracticeQuestion[]
}

interface TaskInfo {
  title: string
  duration_min: number
  detail?: string
  materials?: Materials
}

function hasMaterialsContent(m: any): boolean {
  if (!m || typeof m !== 'object') return false
  return !!(
    m.summary || m.content || m.example || m.practice ||
    (m.key_concepts?.length > 0) ||
    (m.learning_objectives?.length > 0) ||
    (m.examples?.length > 0) ||
    (m.practice_questions?.length > 0)
  )
}

function Markdown({ text }: { text?: string }) {
  if (!text || typeof text !== 'string') return null
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mt-5 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mt-5 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold text-gray-800 dark:text-slate-200 mt-4 mb-2">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-3 mb-1.5">{children}</h4>,
        h5: ({ children }) => <h5 className="text-sm font-medium text-gray-700 dark:text-slate-300 mt-3 mb-1">{children}</h5>,
        h6: ({ children }) => <h6 className="text-xs font-medium text-gray-600 dark:text-slate-400 mt-2 mb-1">{children}</h6>,
        p: ({ children }) => <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed my-1.5">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-slate-100">{children}</strong>,
        em: ({ children }) => <em className="text-gray-600 dark:text-slate-400">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm text-gray-700 dark:text-slate-300">{children}</li>,
        code: ({ className, children, ...props }) => {
          const isBlock = className?.startsWith('language-')
          if (isBlock) {
            const lang = className?.replace('language-', '') || ''
            return (
              <div className="my-3 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                {lang && <div className="text-[10px] text-gray-400 dark:text-slate-500 px-4 py-1 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">{lang}</div>}
                <pre className="bg-gray-900 text-gray-100 p-4 text-xs overflow-x-auto font-mono leading-relaxed">
                  <code>{children}</code>
                </pre>
              </div>
            )
          }
          return <code className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-mono" {...props}>{children}</code>
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 pl-4 py-2 my-2 rounded-r-lg text-sm text-gray-700 dark:text-slate-300 italic">{children}</blockquote>
        ),
        table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full border border-gray-200 dark:border-slate-700 rounded-lg">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-gray-50 dark:bg-slate-800">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-xs text-gray-600 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">{children}</td>,
        tr: ({ children }) => <tr>{children}</tr>,
        a: ({ href, children }) => <a href={href} className="text-indigo-600 dark:text-indigo-400 hover:underline" target="_blank" rel="noopener">{children}</a>,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const sectionLabels: Record<string, string> = {
  objectives: '学习目标',
  summary: '本节概述',
  concepts: '核心知识点',
  content: '学习内容',
  examples: '示例演示',
  example: '示例演示',
  practice_qs: '巩固练习',
  practice: '巩固练习',
}

const sectionQueries: Record<string, string> = {
  objectives: '请帮我梳理一下这部分的学习目标，明确学习重点',
  summary: '请给我详细讲解一下这部分内容的概述和核心要点',
  concepts: '请给我详细解释一下这部分的核心知识点和关键概念',
  content: '请给我深入讲解一下这部分的学习内容，尽量通俗易懂',
  examples: '请给我举例说明这部分内容，用具体的实例帮助理解',
  example: '请给我举例说明这部分内容，用具体的实例帮助理解',
  practice_qs: '请帮我解析一下这部分的练习题，给出解题思路',
  practice: '请帮我解析一下这部分的练习题，给出解题思路',
}

export default function LearningModal({
  task,
  goalId,
  goalTitle,
  onClose,
  onRegenerate,
  loading = false,
  error = '',
  onRetry,
}: {
  task: TaskInfo
  goalId: number
  goalTitle: string
  onClose: () => void
  onRegenerate?: () => void
  loading?: boolean
  error?: string
  onRetry?: () => void
}) {
  const m = task.materials!
  if (!m) return null
  const [activeSection, setActiveSection] = useState<string>('summary')

  // 加载计时
  const [loadElapsed, setLoadElapsed] = useState(0)
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (loading) {
      setLoadElapsed(0)
      loadTimerRef.current = setInterval(() => setLoadElapsed(s => s + 1), 1000)
    } else {
      if (loadTimerRef.current) { clearInterval(loadTimerRef.current); loadTimerRef.current = null }
      setLoadElapsed(0)
    }
    return () => { if (loadTimerRef.current) clearInterval(loadTimerRef.current) }
  }, [loading])

  // 番茄钟 — 进入页面自动开始计时
  const pomodoroDuration = Math.max(task.duration_min, 5) * 60
  const [timerSeconds, setTimerSeconds] = useState(pomodoroDuration)
  const [isRunning, setIsRunning] = useState(true)
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 笔记
  const notesKey = `learning-note-${task.title}`
  const [notes, setNotes] = useState(() => localStorage.getItem(notesKey) || '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 选中文字快速提问
  const [selectedText, setSelectedText] = useState('')
  const selectionRef = useRef<{ text: string; x: number; y: number } | null>(null)

  // AI 搭子聊天状态
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const buildContext = () => {
    const parts = [goalTitle]
    if (task.title) parts.push(`当前学习: ${task.title}`)
    if (task.materials?.summary) parts.push(`内容概述: ${task.materials.summary}`)
    return parts.join('\n')
  }

  // 检测文本选中，记录位置
  const handleContentMouseUp = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() || ''
    if (text && sel?.rangeCount) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectedText(text)
      selectionRef.current = { text, x: rect.left + rect.width / 2, y: rect.top - 10 }
    } else {
      setSelectedText('')
      selectionRef.current = null
    }
  }

  // 内容区按键：选中文字 + Enter → 快速提问
  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && selectedText) {
      e.preventDefault()
      if (!showRightPanel) setShowRightPanel(true)
      const query = `我在学习中看到这段话，不太理解，请帮我详细解释一下：\n\n> ${selectedText}`
      sendMessage(query)
      window.getSelection()?.removeAllRanges()
      setSelectedText('')
      selectionRef.current = null
    }
  }

  const sendMessage = async (message?: string) => {
    const msg = (message || chatInput).trim()
    if (!msg || chatLoading) return
    if (!message) setChatInput('')
    const updated = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(updated)
    setChatLoading(true)
    try {
      const res = await chatWithBuddy(goalId, {
        message: msg,
        context: buildContext(),
        chat_history: chatMessages.slice(-20),
      })
      setChatMessages([...updated, { role: 'assistant', content: res.reply }])
    } catch {
      setChatMessages([...updated, { role: 'assistant', content: '抱歉，AI 搭子暂时不在线，请稍后重试。' }])
    } finally {
      setChatLoading(false)
    }
  }

  const askAboutSection = (sectionId: string) => {
    const label = sectionLabels[sectionId] || sectionId
    const query = sectionQueries[sectionId] || `请帮我讲解一下「${label}」部分的内容`
    const fullQuery = `我正在学习「${task.title}」，当前看到「${label}」部分。${query}`
    sendMessage(fullQuery)
  }

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // 滚动监听，高亮当前章节
  const contentRef = useRef<HTMLDivElement>(null)
  const sections = [
    ...(m?.learning_objectives?.length ? ['objectives'] : []),
    'summary',
    ...(m?.key_concepts?.length ? ['concepts'] : []),
    'content',
    ...(m?.examples?.length ? ['examples'] : (m?.example ? ['example'] : [])),
    ...(m?.practice_questions?.length ? ['practice_qs'] : (m?.practice ? ['practice'] : [])),
  ]

  const onScroll = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const scrollTop = el.scrollTop + 100
    for (const id of [...sections].reverse()) {
      const target = document.getElementById(`sec-${id}`)
      if (target && target.offsetTop <= scrollTop) {
        setActiveSection(id)
        break
      }
    }
  }, [sections])

  // 计时器
  useEffect(() => {
    if (isRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s - 1)
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRunning, timerSeconds])

  // 计时结束
  useEffect(() => {
    if (timerSeconds <= 0 && isRunning) {
      setIsRunning(false)
      if (timerMode === 'focus') {
        setTimerMode('break')
        setTimerSeconds(300)
      } else {
        setTimerMode('focus')
        setTimerSeconds(pomodoroDuration)
      }
    }
  }, [timerSeconds, isRunning, timerMode, pomodoroDuration])

  const toggleTimer = () => setIsRunning(!isRunning)
  const resetTimer = () => {
    setIsRunning(false)
    setTimerSeconds(timerMode === 'focus' ? pomodoroDuration : 300)
  }

  const saveNotes = () => {
    localStorage.setItem(notesKey, notes)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const timerProgress = timerMode === 'focus'
    ? ((pomodoroDuration - timerSeconds) / pomodoroDuration) * 100
    : ((300 - timerSeconds) / 300) * 100

  const timerPct = Math.round(timerProgress)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-100 dark:bg-slate-800 flex"
    >
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 左侧大纲导航 */}
      <aside className={`bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col shrink-0 transition-all duration-200
        fixed lg:static inset-y-0 left-0 z-50 w-72
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:w-64
      `}>
        <div className="p-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-2 shadow-md shadow-indigo-200">
            <BookOpen size={17} className="text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-tight">{task.title}</h3>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{task.duration_min} 分钟</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] text-gray-400 dark:text-slate-500 px-3 pb-1 uppercase tracking-wider">点击章节 → AI 自动讲解</p>
          {sections.map((id) => {
            const icons: Record<string, React.ReactNode> = {
              objectives: <Target size={12} />,
              summary: <Lightbulb size={12} />,
              concepts: <Target size={12} />,
              content: <BookOpen size={12} />,
              examples: <Code size={12} />,
              example: <Code size={12} />,
              practice_qs: <PenLine size={12} />,
              practice: <PenLine size={12} />,
            }
            return (
              <button
                key={id}
                onClick={() => {
                  document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setSidebarOpen(false)
                  askAboutSection(id)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                  activeSection === id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 font-medium'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800'
                }`}
              >
                {icons[id]}
                {sectionLabels[id]}
                <MessageCircle size={10} className="ml-auto text-indigo-300" />
              </button>
            )
          })}
        </nav>
      </aside>

      {/* 中间主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 — 含紧凑计时器 */}
        <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0 lg:hidden">
              <Menu size={18} className="text-gray-400 dark:text-slate-500" />
            </button>
            <button onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0">
              <X size={18} className="text-gray-400 dark:text-slate-500" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate">{task.title}</h2>
              {task.detail && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{task.detail}</p>}
            </div>
          </div>

          {/* 紧凑计时器 */}
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium ${
              timerMode === 'focus' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600'
            }`}>
              <Clock size={13} />
              <span>{formatTime(timerSeconds)}</span>
              <span className="text-[10px] font-normal text-gray-400 dark:text-slate-500">
                {timerMode === 'focus' ? `/${task.duration_min}min` : '休息'}
              </span>
            </div>
            {/* 微型进度条 */}
            <div className="w-12 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  timerMode === 'focus' ? 'bg-indigo-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
            <button onClick={toggleTimer}
              className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                isRunning
                  ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200'
              }`}>
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={resetTimer}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:bg-gray-200 cursor-pointer transition-all">
              <RotateCcw size={13} />
            </button>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:bg-slate-800 cursor-pointer transition-colors">
              {showRightPanel ? <ChevronRight size={16} className="text-gray-400 dark:text-slate-500" /> : <ChevronLeft size={16} className="text-gray-400 dark:text-slate-500" />}
            </button>
          </div>
        </header>

        {/* 滚动内容 */}
        <div ref={contentRef} onScroll={onScroll} onMouseUp={handleContentMouseUp} onKeyDown={handleContentKeyDown} tabIndex={-1} className="flex-1 overflow-y-auto px-8 py-6 outline-none">
          <div className="max-w-3xl mx-auto space-y-8">
            {!hasMaterialsContent(m) ? (
              loading ? (
                <div className="text-center py-20">
                  <Loader2 size={48} className="mx-auto mb-5 text-indigo-400 animate-spin" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium mb-1">AI 正在生成学习材料...</p>
                  <p className="text-gray-400 dark:text-slate-500 text-sm mb-2">预计需要 30-60 秒，已等待 {loadElapsed} 秒</p>
                  <p className="text-gray-300 dark:text-slate-600 text-xs mb-6">AI 正在深度分析主题并撰写内容，请耐心等待</p>
                  <button onClick={onClose}
                    className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-xl hover:bg-gray-200 cursor-pointer text-sm transition-all">
                    取消等待
                  </button>
                </div>
              ) : error ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertCircle size={32} className="text-red-400" />
                  </div>
                  <p className="text-gray-700 dark:text-slate-300 font-medium mb-1">学习材料生成失败</p>
                  <p className="text-gray-400 dark:text-slate-500 text-sm mb-1 max-w-md mx-auto">{error}</p>
                  <p className="text-gray-300 dark:text-slate-600 text-xs mb-6">可能是网络波动或 AI 服务繁忙，点击重试</p>
                  <div className="flex items-center justify-center gap-3">
                    {onRetry && (
                      <button onClick={onRetry}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 cursor-pointer text-sm font-medium transition-all shadow-md shadow-indigo-200">
                        重新生成
                      </button>
                    )}
                    <button onClick={onClose}
                      className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-xl hover:bg-gray-200 cursor-pointer text-sm font-medium transition-all">
                      返回
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <BookOpen size={56} className="mx-auto mb-5 text-gray-200 dark:text-slate-700" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium mb-1">暂无学习材料</p>
                  <p className="text-gray-400 dark:text-slate-500 text-sm mb-6">此规划是旧版生成的，需重新生成以获取详细学习内容</p>
                  {onRegenerate && (
                    <button onClick={() => { onClose(); onRegenerate() }}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 cursor-pointer text-sm font-medium transition-all shadow-md shadow-indigo-200">
                      重新生成今日规划
                    </button>
                  )}
                </div>
              )
            ) : (
              <>
                {/* 学习目标 */}
                {m.learning_objectives && m.learning_objectives.length > 0 && (
                  <section id="sec-objectives">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                      <Target size={16} className="text-emerald-500" /> {sectionLabels.objectives}
                    </h3>
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl border border-emerald-100 p-5">
                      <ul className="space-y-2">
                        {m.learning_objectives.map((obj, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                            <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                )}

                {/* 概述 */}
                {m.summary && (
                  <section id="sec-summary">
                    <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                      <h3 className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5 mb-2">
                        <Lightbulb size={15} /> {sectionLabels.summary}
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{m.summary}</p>
                    </div>
                  </section>
                )}

                {/* 核心知识点 */}
                {m.key_concepts && m.key_concepts.length > 0 && (
                  <section id="sec-concepts">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                      <Target size={16} className="text-indigo-500" /> {sectionLabels.concepts}
                    </h3>
                    <div className="grid gap-3">
                      {m.key_concepts.map((kc, i) => (
                        <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">{kc.name}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{kc.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 学习内容 */}
                {m.content && (
                  <section id="sec-content">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                      <BookOpen size={16} className="text-indigo-500" /> {sectionLabels.content}
                    </h3>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 prose prose-sm max-w-none">
                      <div className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed space-y-3">
                        <Markdown text={m.content} />
                      </div>
                    </div>
                  </section>
                )}

                {/* 示例（旧版兼容） */}
                {m.example && !m.examples && (
                  <section id="sec-example">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                      <Code size={16} className="text-indigo-500" /> {sectionLabels.example}
                    </h3>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6">
                      <div className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                        <Markdown text={m.example} />
                      </div>
                    </div>
                  </section>
                )}

                {/* 多示例（新版） */}
                {m.examples && m.examples.length > 0 && (
                  <section id="sec-examples">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                      <Code size={16} className="text-indigo-500" /> {sectionLabels.examples}
                    </h3>
                    <div className="space-y-4">
                      {m.examples.map((ex, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                          <div className="px-5 py-3 bg-indigo-50 dark:bg-indigo-900/30/50 border-b border-indigo-100 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                              {i + 1}
                            </span>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{ex.title}</h4>
                              <p className="text-[11px] text-gray-500 dark:text-slate-400">{ex.description}</p>
                            </div>
                          </div>
                          {ex.code && (
                            <div className="p-5 bg-gray-900 overflow-x-auto">
                              <pre className="text-xs text-gray-100 font-mono leading-relaxed whitespace-pre-wrap">{ex.code}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 练习（旧版兼容） */}
                {m.practice && !m.practice_questions && (
                  <section id="sec-practice">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                      <PenLine size={16} className="text-indigo-500" /> {sectionLabels.practice}
                    </h3>
                    <div className="bg-amber-50 dark:bg-amber-900/30 rounded-2xl border border-amber-100 dark:border-amber-800 p-6">
                      <div className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                        <Markdown text={m.practice} />
                      </div>
                    </div>
                  </section>
                )}

                {/* 多练习题（新版） */}
                {m.practice_questions && m.practice_questions.length > 0 && (
                  <section id="sec-practice_qs">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                      <PenLine size={16} className="text-indigo-500" /> {sectionLabels.practice_qs}
                    </h3>
                    <div className="space-y-3">
                      {m.practice_questions.map((q, i) => (
                        <details key={i} className="group bg-white dark:bg-slate-900 rounded-xl border border-amber-100 shadow-sm overflow-hidden">
                          <summary className="px-5 py-3 flex items-start gap-3 cursor-pointer hover:bg-amber-50 dark:bg-amber-900/30/50 transition-colors list-none">
                            <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <span className="text-sm text-gray-800 dark:text-slate-200">{q.question}</span>
                            </div>
                            <ChevronRight size={14} className="text-gray-300 dark:text-slate-600 group-open:rotate-90 transition-transform shrink-0" />
                          </summary>
                          <div className="px-5 pb-4 pl-12">
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                              <p className="text-[11px] text-amber-700 font-medium mb-1">提示</p>
                              <p className="text-xs text-gray-600 dark:text-slate-400">{q.hint}</p>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右侧面板遮罩（移动端） */}
      {showRightPanel && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setShowRightPanel(false)} />
      )}

      {/* 右侧面板 — AI 搭子聊天 */}
      <aside className={`bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 flex flex-col shrink-0 transition-all duration-200
        fixed lg:static inset-y-0 right-0 z-50 w-80
        ${showRightPanel ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
          {/* AI 搭子头部 */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-500" /> AI 学习搭子
              </h4>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all ${
                  showNotes ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200'
                }`}>
                <PenLine size={11} /> 笔记
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">
              点击左侧章节，AI 自动讲解；也可直接提问
            </p>
          </div>

          {/* 笔记区（可折叠） */}
          <AnimatePresence>
            {showNotes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-gray-100"
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400">学习笔记</span>
                    <button onClick={saveNotes}
                      className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all ${
                        notesSaved ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200'
                      }`}>
                      <Save size={10} /> {notesSaved ? '已保存' : '保存'}
                    </button>
                  </div>
                  <textarea
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    rows={4}
                    placeholder="记录你的学习笔记、疑问、心得..."
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 聊天消息区 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12">
                <Bot size={40} className="mx-auto mb-3 text-gray-200 dark:text-slate-700" />
                <p className="text-sm text-gray-400 dark:text-slate-500">点击左侧章节让 AI 讲解</p>
                <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">
                  或者直接输入问题开始对话
                </p>
              </div>
            ) : (
              <>
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={12} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`text-xs leading-relaxed px-3 py-2 rounded-xl max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-indigo-500 text-white rounded-br-md'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-bl-md'
                      }`}
                    >
                      {msg.content ? <div className="prose prose-xs max-w-none"><Markdown text={msg.content} /></div> : null}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-lg bg-gray-300 flex items-center justify-center shrink-0 mt-0.5">
                        <User size={12} className="text-white" />
                      </div>
                    )}
                  </motion.div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={12} className="text-white" />
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-xl rounded-bl-md px-3 py-2">
                      <Loader2 size={14} className="animate-spin text-indigo-400" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* 聊天输入 */}
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                placeholder="问 AI 搭子..."
                disabled={chatLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={chatLoading || !chatInput.trim()}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-center hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 cursor-pointer transition-all shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </aside>

      {/* 选中文字浮动提示：按 Enter 询问 AI */}
      {selectedText && selectionRef.current && (
        <div
          className="fixed z-[100] px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none animate-bounce"
          style={{
            left: Math.min(Math.max(selectionRef.current.x - 80, 10), window.innerWidth - 200),
            top: Math.max(selectionRef.current.y - 36, 10),
          }}
        >
          按 <kbd className="px-1 py-0.5 bg-gray-700 rounded text-[10px] font-mono">Enter</kbd> 询问 AI 搭子
        </div>
      )}
    </motion.div>
  )
}
