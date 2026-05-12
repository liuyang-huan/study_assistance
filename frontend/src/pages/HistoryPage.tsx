import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getJournalHistory, getQuestionsHistory } from '../services/api'
import { ArrowLeft, FileText, MessageCircle, Calendar, Clock, Target, Brain } from 'lucide-react'

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<'journal' | 'questions'>('journal')
  const [journals, setJournals] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getJournalHistory(+id),
      getQuestionsHistory(+id),
    ]).then(([j, q]) => {
      setJournals(j)
      setQuestions(q)
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="h-6 w-32 rounded-lg animate-shimmer" />
        <div className="h-8 w-48 rounded-lg animate-shimmer mb-4" />
        {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl animate-shimmer" />)}
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <Link to={`/goals/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-400 mb-2 transition-colors">
        <ArrowLeft size={14} /> 返回目标
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6 flex items-center gap-2">
        <FileText size={22} className="text-indigo-500" />
        学习记录
      </h1>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('journal')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            tab === 'journal'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300'
          }`}>
          <FileText size={14} />
          学习日志 ({journals.length})
        </button>
        <button onClick={() => setTab('questions')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            tab === 'questions'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300'
          }`}>
          <MessageCircle size={14} />
          问答记录 ({questions.length})
        </button>
      </div>

      {/* 学习日志列表 */}
      {tab === 'journal' && (
        <div className="space-y-3">
          {journals.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={40} className="mx-auto mb-3 text-gray-200 dark:text-slate-700" />
              <p className="text-gray-400 dark:text-slate-500 text-sm">暂无日志记录</p>
            </div>
          ) : (
            journals.map((j: any, i: number) => (
              <div
                key={j.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-400" />
                    {new Date(j.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                  {j.duration_minutes > 0 && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                      <Clock size={11} /> {j.duration_minutes}分钟
                    </span>
                  )}
                </div>
                {j.content && (
                  <div className="mb-2.5 p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl">
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                      <Target size={11} /> 学习内容
                    </p>
                    <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">{j.content}</p>
                  </div>
                )}
                {j.reflection && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30/30 rounded-xl">
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                      <Brain size={11} /> 心得反思
                    </p>
                    <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">{j.reflection}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 问答记录 */}
      {tab === 'questions' && (
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle size={40} className="mx-auto mb-3 text-gray-200 dark:text-slate-700" />
              <p className="text-gray-400 dark:text-slate-500 text-sm">暂无问答记录</p>
            </div>
          ) : (
            questions.map((q: any, i: number) => (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-400" />
                    {new Date(q.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    q.difficulty === 'easy' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border border-emerald-200' :
                    q.difficulty === 'hard' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 border border-red-200' :
                    'bg-amber-50 dark:bg-amber-900/30 text-amber-600 border border-amber-200'
                  }`}>{q.difficulty}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3 flex items-start gap-2">
                  <MessageCircle size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                  {q.question}
                </p>
                {q.answers && q.answers.map((a: any) => (
                  <div key={a.id} className="ml-5 pl-3 border-l-2 border-indigo-200 space-y-2.5">
                    <div>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-1">你的回答</p>
                      <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">{a.answer}</p>
                    </div>
                    {a.ai_evaluation && (
                      <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500 dark:text-slate-400">AI 评分</span>
                          <span className={`text-base font-bold ${a.score && a.score >= 7 ? 'text-emerald-600' : a.score && a.score >= 4 ? 'text-amber-600' : 'text-red-600'}`}>
                            {a.score}/10
                          </span>
                        </div>
                        {a.ai_evaluation.correctness && (
                          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">{a.ai_evaluation.correctness}</p>
                        )}
                        {a.ai_evaluation.suggestion && (
                          <p className="text-xs text-indigo-600 mt-1.5 leading-relaxed">{a.ai_evaluation.suggestion}</p>
                        )}
                        {a.ai_evaluation.model_answer && (
                          <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">满分答案</p>
                            <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{a.ai_evaluation.model_answer}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
