import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen, Clock, Lightbulb, Code, PenLine, X, Target,
  Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Save, AlarmClock, Loader2, AlertCircle,
  MessageCircle, Send, Bot, User, Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { chatWithBuddy } from '../services/api'

interface KeyConcept {
  name: string
  explanation: string
}

interface Materials {
  summary?: string
  key_concepts?: KeyConcept[]
  content?: string
  example?: string
  practice?: string
}

interface TaskInfo {
  title: string
  duration_min: number
  detail?: string
  materials?: Materials
}

function renderMarkdown(text: string) {
  if (!text) return null

  // 先处理表格（多行匹配）
  let html = text.replace(/\n(\|.+\|)\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_m: string, header: string, _sep: string, rows: string) => {
    const hCells = header.split('|').filter(c => c.trim()).map(c => `<th class="px-3 py-2 text-left text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">${c.trim()}</th>`).join('')
    const rHtml = rows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td class="px-3 py-2 text-xs text-gray-600 border-b border-gray-100">${c.trim()}</td>`).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    return `\n<table class="w-full my-3 border border-gray-200 rounded-lg overflow-hidden"><thead><tr>${hCells}</tr></thead><tbody>${rHtml}</tbody></table>\n`
  })

  html = html
    .replace(/### (.+)/g, '<h3 class="text-base font-semibold text-gray-800 mt-4 mb-2">$1</h3>')
    .replace(/## (.+)/g, '<h2 class="text-lg font-semibold text-gray-900 mt-5 mb-2">$1</h2>')
    .replace(/# (.+)/g, '<h1 class="text-xl font-bold text-gray-900 mt-5 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-mono">$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs overflow-x-auto my-3 font-mono leading-relaxed">$2</pre>')
    .replace(/^- (.+)/gm, '<li class="ml-4 text-sm text-gray-700 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)/gm, '<li class="ml-4 text-sm text-gray-700 list-decimal">$1. $2</li>')
    .replace(/\n\n/g, '<br/><br/>')
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
  const m = task.materials
  const [activeSection, setActiveSection] = useState<string>('summary')

  // 番茄钟计时器
  const pomodoroDuration = Math.max(task.duration_min, 5) * 60
  const [timerSeconds, setTimerSeconds] = useState(pomodoroDuration)
  const [isRunning, setIsRunning] = useState(false)
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 笔记
  const notesKey = `learning-note-${task.title}`
  const [notes, setNotes] = useState(() => localStorage.getItem(notesKey) || '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [rightPanelMode, setRightPanelMode] = useState<'timer' | 'chat'>('timer')

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

  const sendMessage = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    setChatInput('')
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

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // 滚动监听，高亮当前章节
  const contentRef = useRef<HTMLDivElement>(null)
  const sections = ['summary', ...(m?.key_concepts?.length ? ['concepts'] : []), 'content', ...(m?.example ? ['example'] : []), ...(m?.practice ? ['practice'] : [])]

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
        setTimerSeconds(300) // 5分钟休息
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

  const progress = timerMode === 'focus'
    ? ((pomodoroDuration - timerSeconds) / pomodoroDuration) * 100
    : ((300 - timerSeconds) / 300) * 100

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-100 flex"
    >
      {/* 左侧大纲导航 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-2 shadow-md shadow-indigo-200">
            <BookOpen size={17} className="text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 leading-tight">{task.title}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{task.duration_min} 分钟</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sections.map((id) => {
            const labels: Record<string, string> = {
              summary: '本节概述',
              concepts: '核心知识点',
              content: '学习内容',
              example: '示例演示',
              practice: '巩固练习',
            }
            const icons: Record<string, JSX.Element> = {
              summary: <Lightbulb size={12} />,
              concepts: <Target size={12} />,
              content: <BookOpen size={12} />,
              example: <Code size={12} />,
              practice: <PenLine size={12} />,
            }
            return (
              <a
                key={id}
                href={`#sec-${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all no-underline ${
                  activeSection === id
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {icons[id]}
                {labels[id]}
              </a>
            )
          })}
        </nav>
      </aside>

      {/* 中间主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{task.title}</h2>
              {task.detail && <p className="text-xs text-gray-400">{task.detail}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {showRightPanel && (
              <>
                <button
                  onClick={() => setRightPanelMode('timer')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                    rightPanelMode === 'timer'
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <AlarmClock size={13} className="inline mr-1" />
                  计时器
                </button>
                <button
                  onClick={() => setRightPanelMode('chat')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                    rightPanelMode === 'chat'
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MessageCircle size={13} className="inline mr-1" />
                  AI 搭子
                </button>
                <span className="w-px h-5 bg-gray-200 mx-1" />
              </>
            )}
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
            >
              {showRightPanel ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronLeft size={16} className="text-gray-400" />}
            </button>
          </div>
        </header>

        {/* 滚动内容 */}
        <div ref={contentRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl mx-auto space-y-8">
            {!m ? (
              loading ? (
                <div className="text-center py-20">
                  <Loader2 size={48} className="mx-auto mb-5 text-indigo-400 animate-spin" />
                  <p className="text-gray-500 font-medium mb-1">AI 正在生成学习材料...</p>
                  <p className="text-gray-400 text-sm mb-6">请耐心等待，约需 10-30 秒</p>
                </div>
              ) : error ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-50 flex items-center justify-center">
                    <AlertCircle size={32} className="text-red-400" />
                  </div>
                  <p className="text-gray-700 font-medium mb-1">学习材料生成失败</p>
                  <p className="text-gray-400 text-sm mb-1 max-w-md mx-auto">{error}</p>
                  <p className="text-gray-300 text-xs mb-6">可能是网络波动或 AI 服务繁忙，点击重试</p>
                  <div className="flex items-center justify-center gap-3">
                    {onRetry && (
                      <button onClick={onRetry}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 cursor-pointer text-sm font-medium transition-all shadow-md shadow-indigo-200">
                        重新生成
                      </button>
                    )}
                    <button onClick={onClose}
                      className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 cursor-pointer text-sm font-medium transition-all">
                      返回
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <BookOpen size={56} className="mx-auto mb-5 text-gray-200" />
                  <p className="text-gray-500 font-medium mb-1">暂无学习材料</p>
                  <p className="text-gray-400 text-sm mb-6">此规划是旧版生成的，需重新生成以获取详细学习内容</p>
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
                {/* 概述 */}
                {m.summary && (
                  <section id="sec-summary">
                    <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                      <h3 className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5 mb-2">
                        <Lightbulb size={15} /> 本节概述
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed">{m.summary}</p>
                    </div>
                  </section>
                )}

                {/* 核心知识点 */}
                {m.key_concepts && m.key_concepts.length > 0 && (
                  <section id="sec-concepts">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <Target size={16} className="text-indigo-500" /> 核心知识点
                    </h3>
                    <div className="grid gap-3">
                      {m.key_concepts.map((kc, i) => (
                        <div key={i} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-sm font-semibold text-gray-800 mb-1">{kc.name}</p>
                          <p className="text-xs text-gray-500 leading-relaxed">{kc.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 详细学习内容 */}
                {m.content && (
                  <section id="sec-content">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <BookOpen size={16} className="text-indigo-500" /> 学习内容
                    </h3>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 prose prose-sm max-w-none">
                      <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                        {renderMarkdown(m.content)}
                      </div>
                    </div>
                  </section>
                )}

                {/* 示例 */}
                {m.example && (
                  <section id="sec-example">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <Code size={16} className="text-indigo-500" /> 示例演示
                    </h3>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <div className="text-sm text-gray-700 leading-relaxed">
                        {renderMarkdown(m.example)}
                      </div>
                    </div>
                  </section>
                )}

                {/* 练习 */}
                {m.practice && (
                  <section id="sec-practice">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <PenLine size={16} className="text-indigo-500" /> 巩固练习
                    </h3>
                    <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
                      <div className="text-sm text-gray-700 leading-relaxed">
                        {renderMarkdown(m.practice)}
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右侧面板 */}
      {showRightPanel && (
        <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0">
          {rightPanelMode === 'timer' ? (
            <>
              {/* 计时器 */}
              <div className="p-4 border-b border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <AlarmClock size={12} />
                  {timerMode === 'focus' ? '专注计时' : '休息时间'}
                </h4>

                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 mb-3">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={timerMode === 'focus' ? 'url(#timerGradient)' : '#10b981'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
                      />
                      <defs>
                        <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold font-mono ${timerMode === 'focus' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                        {formatTime(timerSeconds)}
                      </span>
                      <span className="text-[10px] text-gray-400">{timerMode === 'focus' ? '分钟' : '休息'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={toggleTimer}
                      className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                        isRunning
                          ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                      }`}>
                      {isRunning ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={resetTimer}
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 text-gray-400 hover:bg-gray-200 cursor-pointer transition-all">
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 笔记区 */}
              <div className="flex-1 flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <PenLine size={12} /> 学习笔记
                  </h4>
                  <button onClick={saveNotes}
                    className={`text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all ${
                      notesSaved ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    <Save size={11} /> {notesSaved ? '已保存' : '保存'}
                  </button>
                </div>
                <textarea
                  className="flex-1 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="记录你的学习笔记、疑问、心得..."
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
                />
              </div>

              <div className="p-4 border-t border-gray-100">
                <button onClick={onClose}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 cursor-pointer text-sm font-medium transition-all shadow-sm shadow-indigo-200 flex items-center justify-center gap-2">
                  完成学习 <ChevronRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* AI 搭子聊天 */}
              <div className="p-4 border-b border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-indigo-500" /> AI 学习搭子
                </h4>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  学习中遇到问题？随时问 AI 搭子
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <Bot size={40} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-sm text-gray-400">还没聊过，来问问吧</p>
                    <p className="text-xs text-gray-300 mt-1">
                      "这个概念不太懂" "给个例子" "怎么记更快"
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
                              : 'bg-gray-100 text-gray-700 rounded-bl-md'
                          }`}
                        >
                          <div className="prose prose-xs max-w-none">{renderMarkdown(msg.content) || msg.content}</div>
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
                        <div className="bg-gray-100 rounded-xl rounded-bl-md px-3 py-2">
                          <Loader2 size={14} className="animate-spin text-indigo-400" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              <div className="p-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    placeholder="问 AI 搭子..."
                    disabled={chatLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    className="w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-center hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 cursor-pointer transition-all shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      )}
    </motion.div>
  )
}
