import { BookOpen, Clock, Lightbulb, Code, PenLine, X, ChevronRight, Target, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

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
  const html = text
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

export default function LearningModal({
  task,
  onClose,
  onRegenerate,
}: {
  task: TaskInfo
  onClose: () => void
  onRegenerate?: () => void
}) {
  const m = task.materials

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh]"
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

      {/* 弹窗 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-gray-100"
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors z-10"
        >
          <X size={18} className="text-gray-400" />
        </button>

        {/* 头部 */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 pt-6 pb-4 border-b border-gray-100 z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <BookOpen size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{task.title}</h2>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={11} /> {task.duration_min}分钟</span>
                {task.detail && <span>{task.detail}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {!m ? (
            <div className="text-center py-12">
              <BookOpen size={48} className="mx-auto mb-4 text-gray-200" />
              <p className="text-gray-500 font-medium mb-1">暂无学习材料</p>
              <p className="text-gray-400 text-sm mb-5">此规划是旧版生成的，需重新生成以获取详细学习内容</p>
              {onRegenerate ? (
                <button
                  onClick={() => { onClose(); onRegenerate(); }}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 cursor-pointer text-sm font-medium transition-all shadow-md shadow-indigo-200 inline-flex items-center gap-2"
                >
                  <RefreshCw size={15} />
                  重新生成今日规划
                </button>
              ) : (
                <p className="text-xs text-gray-400">返回目标页点击「生成今日规划」获取带材料的版本</p>
              )}
            </div>
          ) : (
            <>
              {/* 概述 */}
              {m.summary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100"
                >
                  <p className="text-sm font-medium text-indigo-700 flex items-center gap-1.5 mb-1.5">
                    <Lightbulb size={14} /> 本节概述
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{m.summary}</p>
                </motion.div>
              )}

              {/* 核心概念 */}
              {m.key_concepts && m.key_concepts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                    <Target size={14} className="text-indigo-500" /> 核心知识点
                  </p>
                  <div className="grid gap-2">
                    {m.key_concepts.map((kc, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-sm font-medium text-gray-800">{kc.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{kc.explanation}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 详细内容 */}
              {m.content && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                    <BookOpen size={14} className="text-indigo-500" /> 学习内容
                  </p>
                  <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 prose prose-sm max-w-none text-gray-700 leading-relaxed text-sm">
                    {renderMarkdown(m.content)}
                  </div>
                </motion.div>
              )}

              {/* 示例 */}
              {m.example && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                    <Code size={14} className="text-indigo-500" /> 示例演示
                  </p>
                  <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed">
                    {renderMarkdown(m.example)}
                  </div>
                </motion.div>
              )}

              {/* 练习 */}
              {m.practice && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                    <PenLine size={14} className="text-indigo-500" /> 巩固练习
                  </p>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-gray-700 leading-relaxed">
                    {renderMarkdown(m.practice)}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm px-6 py-4 border-t border-gray-100 rounded-b-2xl flex items-center justify-between">
          <span className="text-xs text-gray-400">学完此节后可以在日志中记录心得</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 cursor-pointer text-sm font-medium transition-all shadow-sm shadow-indigo-200 flex items-center gap-1.5"
          >
            完成学习 <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
