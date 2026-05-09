import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getKnowledgeGraph } from '../services/api'
import { Target, GitBranch, Circle, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface GraphNode {
  id: string
  label: string
  type: 'root' | 'phase' | 'topic'
  subtitle: string
  status: 'completed' | 'in_progress' | 'pending'
  score?: number | null
}

interface GraphEdge {
  source: string
  target: string
}

interface LayoutNode extends GraphNode {
  x: number
  y: number
  width: number
  height: number
}

const NODE_SHAPES = {
  root: { w: 200, h: 52, rx: 16 },
  phase: { w: 170, h: 44, rx: 12 },
  topic: { w: 140, h: 34, rx: 8 },
}

function statusColors(status: string) {
  switch (status) {
    case 'completed': return { fill: '#ecfdf5', stroke: '#6ee7b7', text: '#059669', badge: '#10b981' }
    case 'in_progress': return { fill: '#eef2ff', stroke: '#a5b4fc', text: '#4f46e5', badge: '#6366f1' }
    default: return { fill: '#f9fafb', stroke: '#e5e7eb', text: '#9ca3af', badge: '#d1d5db' }
  }
}

function calcLayout(nodes: GraphNode[], edges: GraphEdge[], collapsed: Set<string>): LayoutNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const result: LayoutNode[] = []

  const root = nodes.find(n => n.type === 'root')
  const phases = nodes.filter(n => n.type === 'phase')
  const topics = nodes.filter(n => n.type === 'topic')

  // 画布宽度根据阶段数动态计算
  const canvasW = Math.max(phases.length * 240 + 160, 800)

  // 根节点：顶部居中
  if (root) {
    result.push({ ...root, x: canvasW / 2, y: 60, width: NODE_SHAPES.root.w, height: NODE_SHAPES.root.h })
  }

  // 阶段节点：水平均匀分布
  const phaseY = 180
  const phaseGap = canvasW / (phases.length + 1)
  const phasePositions = new Map<string, { x: number; y: number }>()
  phases.forEach((p, i) => {
    const x = phaseGap * (i + 1)
    phasePositions.set(p.id, { x, y: phaseY })
    result.push({ ...p, x, y: phaseY, width: NODE_SHAPES.phase.w, height: NODE_SHAPES.phase.h })
  })

  // 主题节点：阶段下方按列排列
  const topicX = new Map<string, number>() // topic_id → x (从阶段继承)
  phases.forEach(p => {
    const pp = phasePositions.get(p.id)!
    const childTopics = topics.filter(t =>
      edges.some(e => e.source === p.id && e.target === t.id)
    )
    childTopics.forEach((t, i) => {
      topicX.set(t.id, pp.x)
      if (!collapsed.has(p.id)) {
        const y = phaseY + 80 + i * 50
        result.push({ ...t, x: pp.x, y, width: NODE_SHAPES.topic.w, height: NODE_SHAPES.topic.h })
      }
    })
  })

  return result
}

export default function KnowledgeGraph({ goalId, onClose }: { goalId: number; onClose: () => void }) {
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  useEffect(() => {
    getKnowledgeGraph(goalId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [goalId])

  const layoutNodes = useMemo(
    () => (data ? calcLayout(data.nodes, data.edges, collapsed) : []),
    [data, collapsed],
  )

  const nodeMap = useMemo(
    () => new Map(layoutNodes.map(n => [n.id, n])),
    [layoutNodes],
  )

  // 画布尺寸
  const maxX = Math.max(...layoutNodes.map(n => n.x + n.width / 2 + 100), 800)
  const maxY = Math.max(...layoutNodes.map(n => n.y + n.height / 2 + 100), 600)

  // 缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setTransform(prev => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.min(2.5, Math.max(0.3, prev.scale * delta))
      const scaleRatio = newScale / prev.scale
      return {
        scale: newScale,
        x: mx - (mx - prev.x) * scaleRatio,
        y: my - (my - prev.y) * scaleRatio,
      }
    })
  }, [])

  // 拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement)?.tagName === 'svg') {
      dragging.current = true
      dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
    }
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    setTransform(prev => ({
      ...prev,
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    }))
  }, [])

  const handleMouseUp = useCallback(() => {
    dragging.current = false
  }, [])

  // 节点点击
  const handleNodeClick = useCallback((node: LayoutNode) => {
    if (node.type === 'phase') {
      setCollapsed(prev => {
        const next = new Set(prev)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        return next
      })
    }
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [])

  // 重置视角
  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  // --- 加载态 ---
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 text-sm">加载知识图谱...</p>
        </div>
      </div>
    )
  }

  // --- 空态 ---
  if (!data || data.nodes.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-center">
          <GitBranch size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500 font-medium">暂无知识图谱</p>
          <p className="text-gray-400 text-sm mt-1">请先生成学习路线</p>
          <button onClick={onClose}
            className="mt-6 px-5 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 cursor-pointer text-sm transition-colors">
            返回
          </button>
        </div>
      </div>
    )
  }

  const topicsTotal = data.nodes.filter(n => n.type === 'topic').length
  const topicsDone = data.nodes.filter(n => n.type === 'topic' && n.status === 'completed').length
  const rootNode = data.nodes.find(n => n.type === 'root')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-50 flex flex-col select-none"
    >
      {/* 顶部栏 */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <GitBranch size={17} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {rootNode ? rootNode.label : '知识图谱'}
            </h2>
            <p className="text-xs text-gray-400">
              {topicsDone}/{topicsTotal} 个主题已完成
              {` · ${data.nodes.filter(n => n.type === 'phase').length} 个阶段`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400" /> 已完成
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs">
            <div className="w-2 h-2 rounded-full bg-indigo-400" /> 进行中
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-400 text-xs">
            <div className="w-2 h-2 rounded-full bg-gray-300" /> 待学习
          </div>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(2.5, p.scale * 1.2) }))}
            className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-400" title="放大">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.3, p.scale * 0.8) }))}
            className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-400" title="缩小">
            <ZoomOut size={16} />
          </button>
          <button onClick={resetView}
            className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-400" title="重置视角">
            <Maximize2 size={16} />
          </button>
          <button onClick={onClose}
            className="ml-1 p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </header>

      {/* SVG 画布 */}
      <div className="flex-1 overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px]">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* 边 */}
            {data.edges.map((edge, i) => {
              const src = nodeMap.get(edge.source)
              const tgt = nodeMap.get(edge.target)
              if (!src || !tgt) return null

              const isPhaseEdge = edge.source === 'root'
              const isCrossPhase = edge.source.startsWith('topic_') && edge.target.startsWith('topic_')
              const phaseOfSrc = data.nodes.find(n => n.type === 'phase' && n.id ===
                data.edges.find(e => e.target === edge.source && e.source.startsWith('phase_'))?.source
              )
              const isCollapsedPhase = phaseOfSrc && collapsed.has(phaseOfSrc.id)

              let strokeColor = '#e5e7eb'
              let strokeW = 1.5
              let dash = 'none'
              if (isPhaseEdge) { strokeColor = '#c7d2fe'; strokeW = 2 }
              else if (isCrossPhase) { strokeColor = '#f3f4f6'; strokeW = 1; dash = '6,4' }

              // 曲线或直线
              if (isPhaseEdge) {
                const midY = (src.y + src.height / 2 + tgt.y - tgt.height / 2) / 2
                return (
                  <path
                    key={`edge-${i}`}
                    d={`M ${src.x} ${src.y + src.height / 2} C ${src.x} ${midY}, ${tgt.x} ${midY}, ${tgt.x} ${tgt.y - tgt.height / 2}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                  />
                )
              }

              return (
                <line
                  key={`edge-${i}`}
                  x1={src.x} y1={src.y + src.height / 2}
                  x2={tgt.x} y2={tgt.y - tgt.height / 2}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeDasharray={dash}
                />
              )
            })}

            {/* 节点 */}
            {layoutNodes.map((node) => {
              const colors = statusColors(node.status)
              const isSelected = selectedNode?.id === node.id
              const isCollapsed = node.type === 'phase' && collapsed.has(node.id)
              const shape = NODE_SHAPES[node.type]

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
                  onClick={(e) => { e.stopPropagation(); handleNodeClick(node) }}
                  className="cursor-pointer"
                >
                  <rect
                    x={0} y={0}
                    width={node.width} height={node.height}
                    rx={shape.rx}
                    fill={colors.fill}
                    stroke={isSelected ? '#6366f1' : colors.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    filter={isSelected ? 'drop-shadow(0 0 6px rgba(99,102,241,0.3))' : undefined}
                    className="transition-all duration-150"
                  />

                  {/* 根节点特殊样式 */}
                  {node.type === 'root' && (
                    <>
                      <text x={node.width / 2} y={node.height / 2 - 4} fontSize={14} fontWeight={700}
                        fill="#1e293b" textAnchor="middle" dominantBaseline="middle">
                        {node.label.length > 14 ? node.label.slice(0, 14) + '...' : node.label}
                      </text>
                      {node.subtitle && (
                        <text x={node.width / 2} y={node.height / 2 + 14} fontSize={10}
                          fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">
                          {node.subtitle.length > 18 ? node.subtitle.slice(0, 18) + '...' : node.subtitle}
                        </text>
                      )}
                      {/* 装饰圆点 */}
                      <circle cx={node.width - 16} cy={16} r={10} fill={colors.badge} opacity={0.3} />
                      <circle cx={node.width - 16} cy={16} r={5} fill={colors.badge} />
                    </>
                  )}

                  {/* 阶段节点 */}
                  {node.type === 'phase' && (
                    <>
                      <text x={14} y={node.height / 2} fontSize={13} fontWeight={600}
                        fill={colors.text} dominantBaseline="middle">
                        {node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
                      </text>
                      <text x={14} y={node.height / 2 + 14} fontSize={10}
                        fill="#9ca3af" dominantBaseline="middle">
                        {node.subtitle}
                      </text>
                      {/* 展开/收起指示器 */}
                      <circle cx={node.width - 16} cy={node.height / 2} r={10} fill={colors.badge} opacity={0.15} />
                      <text x={node.width - 16} y={node.height / 2} fontSize={11} fontWeight={700}
                        fill={colors.badge} textAnchor="middle" dominantBaseline="middle">
                        {isCollapsed ? '+' : '−'}
                      </text>
                    </>
                  )}

                  {/* 主题节点 */}
                  {node.type === 'topic' && (
                    <>
                      <text x={12} y={node.height / 2} fontSize={11} fontWeight={500}
                        fill={colors.text} dominantBaseline="middle">
                        {node.label.length > 9 ? node.label.slice(0, 9) + '...' : node.label}
                      </text>
                      <text x={node.width - 10} y={node.height / 2} fontSize={10}
                        fill={colors.badge} textAnchor="end" dominantBaseline="middle" fontWeight={600}>
                        D{node.subtitle.replace(/[^0-9]/g, '')}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* 选中节点详情浮窗 */}
      {selectedNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-200 px-6 py-4 flex items-center gap-4 z-20">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            selectedNode.type === 'root' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' :
            selectedNode.type === 'phase' ? 'bg-indigo-100' : 'bg-gray-100'
          }`}>
            {selectedNode.type === 'root'
              ? <Target size={18} className="text-white" />
              : selectedNode.type === 'phase'
                ? <GitBranch size={18} className="text-indigo-600" />
                : <Circle size={16} className={statusColors(selectedNode.status).text} />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedNode.label}</p>
            <p className="text-xs text-gray-400">
              {selectedNode.subtitle}
              {selectedNode.score != null && ` · 均分 ${selectedNode.score}`}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            selectedNode.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
            selectedNode.status === 'in_progress' ? 'bg-indigo-50 text-indigo-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {selectedNode.status === 'completed' ? '已完成' : selectedNode.status === 'in_progress' ? '进行中' : '待学习'}
          </span>
          {selectedNode.type === 'phase' && (
            <button
              onClick={() => setCollapsed(prev => {
                const next = new Set(prev)
                if (next.has(selectedNode.id)) next.delete(selectedNode.id)
                else next.add(selectedNode.id)
                return next
              })}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
            >
              {collapsed.has(selectedNode.id) ? '展开主题' : '收起主题'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
