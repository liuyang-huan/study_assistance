import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getJournalHistory } from '../services/api'
import axios from 'axios'

const http = axios.create({ baseURL: 'http://localhost:8000/api' })

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
      http.get(`/goals/${id}/questions/history`).then(r => r.data),
    ]).then(([j, q]) => {
      setJournals(j)
      setQuestions(q)
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-center py-20 text-gray-500">加载中...</div>
  }

  return (
    <div>
      <Link to={`/goals/${id}`} className="text-sm text-gray-400 hover:text-gray-600">← 返回目标</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-1 mb-6">学习记录</h1>

      {/* Tab 切换 */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button onClick={() => setTab('journal')}
          className={`pb-2 text-sm font-medium border-b-2 cursor-pointer ${
            tab === 'journal' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          学习日志 ({journals.length})
        </button>
        <button onClick={() => setTab('questions')}
          className={`pb-2 text-sm font-medium border-b-2 cursor-pointer ${
            tab === 'questions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          问答记录 ({questions.length})
        </button>
      </div>

      {/* 学习日志列表 */}
      {tab === 'journal' && (
        <div className="space-y-4">
          {journals.length === 0 ? (
            <p className="text-gray-400 text-center py-8">暂无日志记录</p>
          ) : (
            journals.map((j: any) => (
              <div key={j.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">
                    {new Date(j.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                  {j.duration_minutes > 0 && (
                    <span className="text-xs text-gray-400">{j.duration_minutes}分钟</span>
                  )}
                </div>
                {j.content && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-400 mb-1">学习内容</p>
                    <p className="text-sm text-gray-800">{j.content}</p>
                  </div>
                )}
                {j.reflection && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">心得反思</p>
                    <p className="text-sm text-gray-800">{j.reflection}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 问答记录 */}
      {tab === 'questions' && (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">暂无问答记录</p>
          ) : (
            questions.map((q: any) => (
              <div key={q.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">
                    {new Date(q.date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    q.difficulty === 'easy' ? 'bg-green-100 text-green-600' :
                    q.difficulty === 'hard' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                  }`}>{q.difficulty}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-2">Q: {q.question}</p>
                {q.answers && q.answers.map((a: any) => (
                  <div key={a.id} className="mt-3 ml-4 pl-3 border-l-2 border-indigo-200 space-y-2">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">你的回答</p>
                      <p className="text-sm text-gray-800">{a.answer}</p>
                    </div>
                    {a.ai_evaluation && (
                      <div className="p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs text-gray-500">AI 评分：</span>
                          <span className={`text-sm font-bold ${a.score && a.score >= 7 ? 'text-green-600' : a.score && a.score >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {a.score}/10
                          </span>
                        </div>
                        {a.ai_evaluation.correctness && <p className="text-xs text-gray-600">{a.ai_evaluation.correctness}</p>}
                        {a.ai_evaluation.suggestion && <p className="text-xs text-indigo-600 mt-1">{a.ai_evaluation.suggestion}</p>}
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
