import { Outlet, Link, useLocation } from 'react-router-dom'
import { BookOpen, Target, ChevronRight, Moon, Sun } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../hooks/useTheme'

export default function Layout() {
  const location = useLocation()
  const { dark, toggle } = useTheme()

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
