import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { BookOpen, Target, ChevronRight, Moon, Sun, Palette, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../hooks/useTheme'
import { useTeachingStyle, STYLE_OPTIONS, type TeachingStyle } from '../hooks/useTeachingStyle'

export default function Layout() {
  const location = useLocation()
  const { dark, toggle } = useTheme()
  const { style, changeStyle } = useTeachingStyle()
  const [styleOpen, setStyleOpen] = useState(false)
  const styleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setStyleOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950 transition-colors">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 glass border-b border-white/50 dark:border-slate-700/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900 group-hover:shadow-indigo-300 transition-shadow">
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">学习助手</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Link to="/" className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors no-underline ${
                location.pathname === '/' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium' : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400'
              }`}>
                <Target size={14} />
                目标
              </Link>
              <ChevronRight size={12} className="text-gray-300 dark:text-gray-600" />
              <span className="text-gray-400 dark:text-gray-500">AI 驱动学习</span>
            </div>
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer transition-colors text-gray-500 dark:text-gray-400"
              title={dark ? '切换到亮色模式' : '切换到暗色模式'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="relative" ref={styleRef}>
              <button
                onClick={() => setStyleOpen(!styleOpen)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                  style !== 'default'
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-500'
                    : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400'
                }`}
                title="AI 教学风格"
              >
                <Palette size={16} />
              </button>
              {styleOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50"
                >
                  <div className="p-2">
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 px-2 pb-1.5 uppercase tracking-wider">AI 教学风格</p>
                    {STYLE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { changeStyle(opt.value); setStyleOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                          style === opt.value
                            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-medium'
                            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="text-[13px] font-medium">{opt.label}</div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500">{opt.desc}</div>
                        </div>
                        {style === opt.value && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 页面内容 + 过渡动画 */}
      <main className="max-w-5xl mx-auto px-5 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
