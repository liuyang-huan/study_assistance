import { useState, useMemo } from 'react'

export interface HeatmapDay {
  date: string
  level: number
  minutes: number
  journals: number
  plan_completed: boolean
  questions: number
}

function formatDateCN(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function getLevelColor(level: number) {
  switch (level) {
    case 1: return 'bg-emerald-200'
    case 2: return 'bg-emerald-400'
    case 3: return 'bg-emerald-600'
    case 4: return 'bg-emerald-800'
    default: return 'bg-gray-100'
  }
}

export default function Heatmap({ data, loading }: { data: HeatmapDay[]; loading: boolean }) {
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null)

  const weeks = useMemo(() => {
    if (!data.length) return []
    // 按周日到周六分组为周
    const result: HeatmapDay[][] = []
    let currentWeek: HeatmapDay[] = []
    let firstDay = new Date(data[0].date + 'T00:00:00')
    // 补齐到周日开始
    const startDow = firstDay.getDay()
    for (let i = 0; i < startDow; i++) {
      currentWeek.push(null as any)
    }
    for (const day of data) {
      const d = new Date(day.date + 'T00:00:00')
      currentWeek.push(day)
      if (d.getDay() === 6) {
        result.push(currentWeek)
        currentWeek = []
      }
    }
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null as any)
    }
    if (currentWeek.length > 0) {
      result.push(currentWeek)
    }
    return result
  }, [data])

  // 月份标签：计算每个月份占几个周列
  const monthLabels = useMemo(() => {
    if (!weeks.length) return []
    const result: { weekIndex: number; label: string; colspan: number }[] = []
    let currentMonth = -1
    let currentStart = 0
    for (let wi = 0; wi < weeks.length; wi++) {
      const validDay = weeks[wi].find(d => d)
      if (!validDay) continue
      const m = parseInt(validDay.date.slice(5, 7))
      if (m !== currentMonth) {
        if (currentMonth !== -1) {
          result[result.length - 1].colspan = wi - currentStart
        }
        currentMonth = m
        currentStart = wi
        result.push({
          weekIndex: wi,
          label: new Date(validDay.date + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'short' }),
          colspan: 1,
        })
      }
    }
    if (result.length > 0) {
      result[result.length - 1].colspan = weeks.length - currentStart
    }
    return result
  }, [weeks])

  const dayLabels = ['一', '', '三', '', '五', '', '']

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="h-4 w-24 rounded animate-shimmer mb-4" />
        <div className="animate-pulse space-y-0.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex gap-0.5">
              {Array.from({ length: 53 }).map((_, j) => (
                <div key={j} className="w-3.5 h-3.5 rounded-sm bg-gray-100" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (!data.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">打卡热力图</h3>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-0.5 min-w-max">
          {/* 月份标签 */}
          <div className="flex ml-7 mb-1" style={{ gap: '2px' }}>
            {monthLabels.map(({ weekIndex, label, colspan }) => (
              <span
                key={weekIndex}
                className="text-[10px] text-gray-400"
                style={{ width: `${colspan * 16 - 2}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* 网格 + 星期标签 */}
          <div className="flex gap-0.5">
            {/* 星期标签 */}
            <div className="flex flex-col gap-0.5 mr-1">
              {dayLabels.map((label, i) => (
                <div key={i} className="w-6 h-3.5 flex items-center justify-end">
                  <span className="text-[10px] text-gray-300">{label}</span>
                </div>
              ))}
            </div>

            {/* 周列 */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => (
                  day ? (
                    <div
                      key={di}
                      className={`w-3.5 h-3.5 rounded-sm ${getLevelColor(day.level)} cursor-pointer transition-transform hover:scale-125 hover:ring-1 hover:ring-indigo-300`}
                      onMouseEnter={(e) => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({ day, x: rect.left, y: rect.top })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ) : (
                    <div key={di} className="w-3.5 h-3.5" />
                  )
                ))}
              </div>
            ))}
          </div>

          {/* 图例 */}
          <div className="flex items-center gap-1 mt-2 ml-7">
            <span className="text-[10px] text-gray-300 mr-1">少</span>
            {[0, 1, 2, 3, 4].map(lv => (
              <div key={lv} className={`w-3 h-3 rounded-sm ${getLevelColor(lv)}`} />
            ))}
            <span className="text-[10px] text-gray-300 ml-1">多</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[100] px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: tooltip.x - 60,
            top: tooltip.y - 40,
          }}
        >
          <p className="font-medium">{formatDateCN(tooltip.day.date)}</p>
          <p className="text-gray-300 text-[11px]">
            学习 {tooltip.day.minutes} 分钟
            {tooltip.day.journals > 0 && ` · ${tooltip.day.journals}篇日志`}
            {tooltip.day.questions > 0 && ` · ${tooltip.day.questions}题`}
          </p>
          {tooltip.day.level === 0 && <p className="text-gray-400 text-[11px]">无学习记录</p>}
        </div>
      )}
    </div>
  )
}
