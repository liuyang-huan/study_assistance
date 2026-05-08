import { useState, useEffect } from 'react'
import { getStats } from '../services/api'
import type { LearningStats } from '../types'

export default function StatsPanel({ goalId }: { goalId: number }) {
  const [stats, setStats] = useState<LearningStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getStats(goalId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [goalId])

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-xl h-24 mb-5" />
  }
  if (!stats) return null

  const scores = stats.score_trend.map(s => s.score)
  const scoreMax = scores.length > 0 ? Math.max(...scores, 10) : 10
  const minutes = stats.study_trend.map(s => s.minutes)
  const minuteMax = minutes.length > 0 ? Math.max(...minutes, 60) : 60

  return (
    <div className="space-y-5">
      {/* 总体进度条 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">学习进度</span>
          <span className="text-sm text-indigo-600 font-semibold">{stats.overall_percent}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${stats.overall_percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>{stats.total_study_days} 天学习 / {stats.streak} 天连续</span>
          {stats.current_phase && (
            <span>当前：{stats.current_phase.title}</span>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="学习天数" value={stats.total_study_days} unit="天" color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="连续打卡" value={stats.streak} unit="天" color="text-green-600" bg="bg-green-50"
          extra={stats.studied_today ? '今日已学' : '今日未学'} />
        <StatCard label="学习时长" value={Math.round(stats.total_minutes / 60 * 10) / 10} unit="小时" color="text-purple-600" bg="bg-purple-50" />
        <StatCard label="平均评分" value={stats.avg_score} unit="/10" color="text-orange-600" bg="bg-orange-50"
          extra={`${stats.answered_questions}/${stats.total_questions} 题`} />
      </div>

      {/* 阶段进度 + 评分趋势 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 分阶段进度 */}
        {stats.phase_progress.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">阶段完成度</h3>
            <div className="space-y-3">
              {stats.phase_progress.map(p => (
                <div key={p.phase}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={p.phase === stats.current_phase?.phase ? 'font-semibold text-indigo-600' : 'text-gray-500'}>
                      Phase {p.phase}: {p.title}
                    </span>
                    <span className="text-gray-400">{p.completed_days}/{p.total_days}d</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.percent >= 100 ? 'bg-green-500' :
                        p.phase === stats.current_phase?.phase ? 'bg-indigo-500' : 'bg-gray-300'
                      }`}
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 评分趋势 */}
        {stats.score_trend.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">评分趋势</h3>
            <div className="flex items-end gap-1 h-24">
              {stats.score_trend.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-indigo-400 rounded-t"
                    style={{ height: `${(s.score / scoreMax) * 80}px` }}
                  />
                  <span className="text-[10px] text-gray-400">{s.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 学习时长趋势 */}
      {stats.study_trend.length > 0 && stats.study_trend.some(s => s.minutes > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">学习时长趋势（分钟）</h3>
          <div className="flex items-end gap-1 h-20">
            {stats.study_trend.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-green-400 rounded-t"
                  style={{ height: `${Math.max(4, (s.minutes / minuteMax) * 70)}px` }}
                />
                <span className="text-[10px] text-gray-400">{s.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 知识时间线 */}
      {stats.topics_covered.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">知识时间线</h3>
          <div className="space-y-2">
            {stats.topics_covered.slice(0, 15).map((t, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-xs text-gray-400 w-16 shrink-0">{t.date}</span>
                <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  t.type === 'question' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {t.type === 'question' ? 'Q' : 'J'}
                </span>
                <span className="text-gray-700 truncate">{t.content}</span>
                {t.score !== undefined && (
                  <span className={`text-xs font-semibold ml-auto ${
                    t.score >= 7 ? 'text-green-600' : t.score >= 4 ? 'text-yellow-600' : 'text-red-600'
                  }`}>{t.score}/10</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color, bg, extra }: {
  label: string; value: number | string; unit: string; color: string; bg: string; extra?: string
}) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value}<span className="text-sm font-normal text-gray-400 ml-0.5">{unit}</span>
      </p>
      {extra && <p className="text-xs text-gray-400 mt-1">{extra}</p>}
    </div>
  )
}
