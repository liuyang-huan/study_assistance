import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen, Clock, Lightbulb, Code, PenLine, X, Target,
  Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Save, Loader2, AlertCircle,
  MessageCircle, Send, Bot, User, Sparkles, Menu, GitBranch, Layers, LightbulbOff, MessagesSquare, Minimize2, Maximize2, StickyNote, FileText, Image
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { getNotes, saveNote, updateSectionTranslation } from '../services/api'
import { handleImageUpload } from '../utils/imageUpload'
import type { Note } from '../types'



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
  original_text?: string
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

function normalizeParagraphs(text: string): string {
  const lines = text.replace(/\n{3,}/g, '\n\n').split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i])
    if (i < lines.length - 1) {
      const curr = lines[i]
      const next = lines[i + 1]
      if (curr.trim() && next.trim() &&
          !/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|---|\|)/.test(curr) &&
          !/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|---|\|)/.test(next)) {
        out.push('')
      }
    }
  }
  return out.join('\n')
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
      {normalizeParagraphs(text)}
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

const deepDivePresets = [
  { id: 'analogy', icon: Lightbulb, label: '类比', prompt: (t: string) => `请用生活中的类比和比喻来解释下面这段话，让抽象概念变得更容易理解：\n\n> ${t}` },
  { id: 'principle', icon: GitBranch, label: '原理', prompt: (t: string) => `请从底层原理和设计思路的角度，深入推导和解释下面这段内容，说明"为什么会这样"：\n\n> ${t}` },
  { id: 'decompose', icon: Layers, label: '拆解', prompt: (t: string) => `请把下面这段内容拆解成更小、更容易理解的子概念，每个子概念用一句话解释，最后总结它们之间的关系：\n\n> ${t}` },
  { id: 'example', icon: MessagesSquare, label: '举例', prompt: (t: string) => `请用 2-3 个由浅入深的具体例子来说明下面这段内容，每个例子说明场景和要点：\n\n> ${t}` },
  { id: 'simplify', icon: LightbulbOff, label: '简化', prompt: (t: string) => `请用费曼学习法，用最简单直白的大白话重新解释下面这段内容，假装我完全零基础：\n\n> ${t}` },
]

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
  console.log('[LearningModal] render', { hasTask: !!task, loading, error: !!error, hasMaterials: !!m, materialsKeys: m ? Object.keys(m) : 'null' })
  if (!m) { console.log('[LearningModal] m is falsy, returning null'); return null }
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
  const [notes, setNotes] = useState('')
  const [noteId, setNoteId] = useState<number | null>(null)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [allNotes, setAllNotes] = useState<Note[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [isChatExpanded, setIsChatExpanded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [editingTranslation, setEditingTranslation] = useState(false)
  const [translationEditText, setTranslationEditText] = useState('')
  const [savingTranslation, setSavingTranslation] = useState(false)

  // 选中文字快速提问
  const [selectedText, setSelectedText] = useState('')
  const selectionRef = useRef<{ text: string; x: number; y: number } | null>(null)

  // AI 搭子聊天状态
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

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

  const dismissSelection = () => {
    window.getSelection()?.removeAllRanges()
    setSelectedText('')
    selectionRef.current = null
  }

  const sendMessage = async (message?: string) => {
    const msg = (message || chatInput).trim()
    if (!msg || chatLoading) return
    if (!message) setChatInput('')
    setIsChatExpanded(true)
    const updated = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(updated)
    setChatLoading(true)
    setChatMessages([...updated, { role: 'assistant', content: '' }])
    try {
      const resp = await fetch(`/api/goals/${goalId}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          context: buildContext(),
          chat_history: chatMessages.slice(-20),
        }),
      })
      const reader = resp.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()
      let fullReply = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6)
            if (payload === '[DONE]') break
            try {
              const { token } = JSON.parse(payload)
              fullReply += token
              setChatMessages([...updated, { role: 'assistant', content: fullReply }])
            } catch {}
          }
        }
      }
    } catch {
      setChatMessages([...updated, { role: 'assistant', content: '抱歉，AI 搭子暂时不在线，请稍后重试。' }])
    } finally {
      setChatLoading(false)
    }
  }

  const deepDive = (preset: typeof deepDivePresets[number]) => {
    if (!showRightPanel) setShowRightPanel(true)
    sendMessage(preset.prompt(selectedText))
    dismissSelection()
  }

  const dismissSelectionRef = useRef(dismissSelection)
  dismissSelectionRef.current = dismissSelection

  const sendMessageRef = useRef(sendMessage)
  sendMessageRef.current = sendMessage
  const selectedTextRef = useRef(selectedText)
  selectedTextRef.current = selectedText

  // 全局键盘监听：选中文字时 Enter 提问，Esc 取消（document 级别，避免 tabIndex 干扰文本选择）
  useEffect(() => {
    if (!selectedText) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!showRightPanel) setShowRightPanel(true)
        const query = `我在学习中看到这段话，不太理解，请帮我详细解释一下：\n\n> ${selectedTextRef.current || selectedText}`
        sendMessageRef.current(query)
        dismissSelectionRef.current()
      }
      if (e.key === 'Escape') {
        dismissSelectionRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedText, showRightPanel])

  const askAboutSection = (sectionId: string) => {
    const label = sectionLabels[sectionId] || sectionId
    const query = sectionQueries[sectionId] || `请帮我讲解一下「${label}」部分的内容`
    const fullQuery = `我正在学习「${task.title}」，当前看到「${label}」部分。${query}`
    sendMessage(fullQuery)
  }

  // 自动滚动到底部（仅当用户在底部时才跟随）
  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
      if (isNearBottom) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
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

  const loadNotesForGoal = async () => {
    try {
      const [topicNotes, all] = await Promise.all([
        getNotes(goalId, task.title),
        getNotes(goalId),
      ])
      if (topicNotes.length > 0) {
        setNotes(topicNotes[0].content)
        setNoteId(topicNotes[0].id)
      }
      setAllNotes(all)
    } catch {}
  }

  const autoSaveNote = (content: string) => {
    setNotes(content)
    setNotesSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setNotesSaving(true)
      try {
        const result = await saveNote(goalId, { topic_title: task.title, content })
        setNoteId(result.id)
        setNotesSaved(true)
        setAllNotes(prev => {
          const idx = prev.findIndex(n => n.id === result.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = result
            return next
          }
          return [result, ...prev]
        })
      } catch {}
      setNotesSaving(false)
    }, 1500)
  }

  const handleNotePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file && noteTextareaRef.current) {
          handleImageUpload(file, noteTextareaRef.current, (newContent) => autoSaveNote(newContent))
        }
        break
      }
    }
  }, [])

  const handleNoteDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/') && noteTextareaRef.current) {
      handleImageUpload(file, noteTextareaRef.current, (newContent) => autoSaveNote(newContent))
    }
  }, [])

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  useEffect(() => {
    if (showNotes) loadNotesForGoal()
  }, [showNotes])

  const timerProgress = timerMode === 'focus'
    ? ((pomodoroDuration - timerSeconds) / pomodoroDuration) * 100
    : ((300 - timerSeconds) / 300) * 100

  const timerPct = Math.round(timerProgress)

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 dark:bg-slate-800 flex animate-[fadeIn_0.2s_ease]">
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
        <div ref={contentRef} onScroll={onScroll} onMouseUp={handleContentMouseUp} className="flex-1 overflow-y-auto px-8 py-6 content-select">
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
                          <li key={i} className="text-sm text-gray-700 dark:text-slate-300">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 text-[10px] font-bold mr-2">
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

                {/* 原文/AI 内容切换 */}
                {m.original_text && (
                  <div className="flex gap-1 mb-4 border-b border-gray-100 dark:border-slate-800 pb-2 flex-wrap">
                    <button onClick={() => { setShowOriginal(false); setEditingTranslation(false) }}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                        !showOriginal && !editingTranslation ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400'
                      }`}>
                      AI 讲解内容
                    </button>
                    <button onClick={() => { setShowOriginal(true); setEditingTranslation(false) }}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                        showOriginal && !editingTranslation ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400'
                      }`}>
                      教材原文
                    </button>
                    {m.is_translated && (
                      <button onClick={() => { setEditingTranslation(true); setShowOriginal(false); setTranslationEditText(m.original_text || '') }}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                          editingTranslation ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400'
                        }`}>
                        编辑翻译
                      </button>
                    )}
                  </div>
                )}

                {/* 教材原文 */}
                {editingTranslation ? (
                  <section id="sec-edit-translation">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 p-6 mb-4">
                      <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-3">
                        <FileText size={15} /> 编辑翻译
                      </h3>
                      <textarea
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm resize-y min-h-[300px] focus:border-emerald-400 outline-none transition-colors"
                        value={translationEditText}
                        onChange={e => setTranslationEditText(e.target.value)}
                      />
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={async () => {
                            if (!m.section_id) return
                            setSavingTranslation(true)
                            try {
                              await updateSectionTranslation(goalId, m.section_id, { content_translated: translationEditText })
                              m.original_text = translationEditText
                              setShowOriginal(true)
                              setEditingTranslation(false)
                            } catch {
                              alert('保存翻译修改失败')
                            } finally {
                              setSavingTranslation(false)
                            }
                          }}
                          disabled={savingTranslation}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 text-sm cursor-pointer font-medium transition-colors"
                        >
                          {savingTranslation ? '保存中...' : '保存修改'}
                        </button>
                        <button
                          onClick={() => setEditingTranslation(false)}
                          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 text-sm cursor-pointer transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </section>
                ) : showOriginal && m.original_text ? (
                  <section id="sec-original">
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 p-6 mb-4">
                      <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-3">
                        <FileText size={15} /> 教材原文{m.is_translated ? '（AI 翻译）' : ''}
                      </h3>
                      <div className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto">
                        <Markdown text={m.original_text} />
                      </div>
                    </div>
                  </section>
                ) : (
                  <>
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
      <aside className={`bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700 flex flex-col shrink-0 transition-all duration-300
        fixed lg:static inset-y-0 right-0 z-50
        ${isChatExpanded ? 'w-[480px]' : 'w-80'}
        ${showRightPanel ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
          {/* AI 搭子头部 */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-500" /> AI 学习搭子
              </h4>
              <button
                onClick={() => setIsChatExpanded(!isChatExpanded)}
                title={isChatExpanded ? '收起面板' : '展开面板'}
                className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200"
              >
                {isChatExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">
              点击左侧章节，AI 自动讲解；也可直接提问
            </p>
          </div>


          {/* 聊天消息区 */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
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
                  <div
                    key={i}
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
                  </div>
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

      {/* 左下角浮动笔记面板 */}
      <div className="fixed bottom-4 left-4 z-[60]">
        {showNotes ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl w-[420px] max-h-[65vh] flex flex-col overflow-hidden animate-[fadeIn_0.15s_ease]">
            {/* 面板头部 */}
            <div className="p-3.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <StickyNote size={16} className="text-amber-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">学习笔记</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  notesSaving ? 'text-amber-600 bg-amber-50' :
                  notesSaved ? 'text-emerald-600 bg-emerald-50' : 'text-gray-300'
                }`}>
                  {notesSaving ? '保存中...' : notesSaved ? '已保存' : ''}
                </span>
              </div>
              <button onClick={() => setShowNotes(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                <X size={14} className="text-gray-400 dark:text-slate-500" />
              </button>
            </div>

            {/* 正文区域 */}
            <div className="p-3.5 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  当前知识点: <span className="text-gray-600 dark:text-slate-400 font-medium">{task.title}</span>
                </p>
                <button
                  onClick={() => document.getElementById('note-image-input')?.click()}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="插入图片"
                >
                  <Image size={14} className="text-gray-400 dark:text-slate-500" />
                </button>
                <input
                  id="note-image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file && noteTextareaRef.current) {
                      handleImageUpload(file, noteTextareaRef.current, (newContent) => autoSaveNote(newContent))
                    }
                    e.target.value = ''
                  }}
                />
              </div>
              <textarea
                ref={noteTextareaRef}
                className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                rows={8}
                placeholder="记录你的学习笔记、疑问、心得... (支持粘贴/拖拽图片)"
                value={notes}
                onChange={e => autoSaveNote(e.target.value)}
                onPaste={handleNotePaste}
                onDrop={handleNoteDrop}
                onDragOver={e => e.preventDefault()}
              />

              {/* 本目标其他笔记 */}
              {allNotes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-2 flex items-center gap-1">
                    <FileText size={11} /> 本目标笔记 ({allNotes.length})
                  </p>
                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {allNotes.map(n => (
                      <button
                        key={n.id}
                        onClick={() => { setNotes(n.content); setNoteId(n.id) }}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          n.topic_title === task.title
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100'
                            : 'bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <p className="font-medium text-gray-700 dark:text-slate-300 truncate">{n.topic_title}</p>
                        <p className="text-gray-400 dark:text-slate-500 truncate mt-0.5">
                          {n.content.slice(0, 60)}{n.content.length > 60 ? '...' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNotes(true)}
            className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:border-amber-300 transition-all cursor-pointer flex items-center justify-center group"
            title="打开笔记"
          >
            <StickyNote size={20} className="text-gray-400 dark:text-slate-500 group-hover:text-amber-500 transition-colors" />
          </button>
        )}
      </div>

      {/* 选中文字浮动快捷操作栏 */}
      {selectedText && selectionRef.current && (
        <div className="fixed z-[100] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl px-1.5 py-1.5 flex items-center gap-0.5"
          style={{
            left: Math.min(Math.max(selectionRef.current.x - 160, 10), window.innerWidth - 340),
            top: Math.max(selectionRef.current.y - 50, 10),
          }}
        >
          {deepDivePresets.map(p => (
            <button
              key={p.id}
              onClick={() => deepDive(p)}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
              title={p.label}
            >
              <p.icon size={15} className="text-gray-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors" />
              <span className="text-[10px] text-gray-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{p.label}</span>
            </button>
          ))}
          <span className="w-px h-6 bg-gray-200 dark:bg-slate-700 mx-0.5" />
          <button
            onClick={dismissSelection}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={13} className="text-gray-400 dark:text-slate-500" />
            <span className="text-[10px] text-gray-400 dark:text-slate-500">关闭</span>
          </button>
        </div>
      )}
    </div>
  )
}
