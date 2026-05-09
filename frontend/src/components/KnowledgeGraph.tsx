import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getKnowledgeGraph, generateConceptMap } from '../services/api'
import { Target, GitBranch, Circle, X, ZoomIn, ZoomOut, Maximize2, Sparkles, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface GraphNode {
  id: string
  label: string
  type: 'root' | 'phase' | 'topic' | 'concept'
  subtitle: string
  status: 'completed' | 'in_progress' | 'pending'
  score?: number | null
  concept_count?: number
  topic_day?: number
}

interface GraphEdge {
  source: string
  target: string
  dependency?: boolean
}

interface LayoutNode extends GraphNode {
  x: number
  y: number
  width: number
  height: number
}

const NODE_SHAPES: Record<string, { w: number; h: number; rx: number }> = {
  root: { w: 200, h: 52, rx: 16 },
  phase: { w: 170, h: 44, rx: 12 },
  topic: { w: 140, h: 34, rx: 8 },
  concept: { w: 120, h: 26, rx: 13 },
}

function statusColors(status: string) {
  switch (status) {
    case 'completed': return { fill: '#ecfdf5', stroke: '#6ee7b7', text: '#059669', badge: '#10b981' }
    case 'in_progress': return { fill: '#eef2ff', stroke: '#a5b4fc', text: '#4f46e5', badge: '#6366f1' }
    default: return { fill: '#f9fafb', stroke: '#e5e7eb', text: '#9ca3af', badge: '#d1d5db' }
  }
}

function calcLayout(
  nodes: GraphNode[], edges: GraphEdge[],
  collapsedPhases: Set<string>, expandedTopics: Set<string>,
): LayoutNode[] {
  const result: LayoutNode[] = []

  const root = nodes.find(n => n.type === 'root')
  const phases = nodes.filter(n => n.type === 'phase')
  const topics = nodes.filter(n => n.type === 'topic')
  const concepts = nodes.filter(n => n.type === 'concept')

  const canvasW = Math.max(phases.length * 240 + 160, 800)
  const phaseY = 180

  if (root) {
    result.push({ ...root, x: canvasW / 2, y: 60, width: NODE_SHAPES.root.w, height: NODE_SHAPES.root.h })
  }

  const phaseGap = canvasW / (phases.length + 1)
  const phasePositions = new Map<string, { x: number }>()

  phases.forEach((p, i) => {
    const x = phaseGap * (i + 1)
    phasePositions.set(p.id, { x })
    result.push({ ...p, x, y: phaseY, width: NODE_SHAPES.phase.w, height: NODE_SHAPES.phase.h })
  })

  // 主题 + 概念布局：动态计算每个阶段列的高度
  phases.forEach(p => {
    const pp = phasePositions.get(p.id)!
    const childTopics = topics.filter(t =>
      edges.some(e => e.source === p.id && e.target === t.id)
    )

    if (collapsedPhases.has(p.id)) return // 阶段收起，不显示 topic

    let topicY = phaseY + 80
    childTopics.forEach(t => {
      result.push({ ...t, x: pp.x, y: topicY, width: NODE_SHAPES.topic.w, height: NODE_SHAPES.topic.h })

      // 如果 topic 展开了，下方显示概念
      if (expandedTopics.has(t.id)) {
        const childConcepts = concepts.filter(c =>
          edges.some(e => e.source === t.id && e.target === c.id)
        )
        if (childConcepts.length > 0) {
          topicY += 44
          childConcepts.forEach(c => {
            result.push({ ...c, x: pp.x, y: topicY, width: NODE_SHAPES.concept.w, height: NODE_SHAPES.concept.h })
            topicY += 34
          })
          topicY += 8 // 概念组后加间距
        }
      }
      topicY += 50
    })
  })

  return result
}

export default function KnowledgeGraph({ goalId, onClose }: { goalId: number; onClose: () => void }) {
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[]; has_concepts: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null)
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  const fetchGraph = useCallback(() => {
    setLoading(true)
    getKnowledgeGraph(goalId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [goalId])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  const layoutNodes = useMemo(
    () => (data ? calcLayout(data.nodes, data.edges, collapsedPhases, expandedTopics) : []),
    [data, collapsedPhases, expandedTopics],
  )

  const nodeMap = useMemo(
    () => new Map(layoutNodes.map(n => [n.id, n])),
    [layoutNodes],
  )

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
      return { scale: newScale, x: mx - (mx - prev.x) * scaleRatio, y: my - (my - prev.y) * scaleRatio }
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as Element
    if (target === svgRef.current || target.tagName === 'svg' || target.closest('g') === null) {
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

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  const handleNodeClick = useCallback((node: LayoutNode) => {
    if (node.type === 'phase') {
      setCollapsedPhases(prev => {
        const next = new Set(prev)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        return next
      })
    }
    if (node.type === 'topic') {
      // 检查是否有概念子节点
      const hasConcepts = data?.nodes.some(n => n.type === 'concept' &&
        data.edges.some(e => e.source === node.id && e.target === n.id))
      if (hasConcepts) {
        setExpandedTopics(prev => {
          const next = new Set(prev)
          if (next.has(node.id)) next.delete(node.id)
          else next.add(node.id)
          return next
        })
      }
    }
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [data])

  const handleGenerateConcepts = useCallback(async () => {
    setGenerating(true)
    try {
      await generateConceptMap(goalId)
      await fetchGraph()
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }, [goalId, fetchGraph])

  const resetView = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), [])

  // --- 加载态 ---
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">加载知识图谱...</p>
        </div>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <GitBranch size={48} className="mx-auto mb-4 text-gray-200 dark:text-slate-700" />
          <p className="text-gray-500 dark:text-slate-400 font-medium">暂无知识图谱</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">请先生成学习路线</p>
          <button onClick={onClose}
            className="mt-6 px-5 py-2 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 cursor-pointer text-sm transition-colors">
            返回
          </button>
        </div>
      </div>
    )
  }

  const topicsTotal = data.nodes.filter(n => n.type === 'topic').length
  const topicsDone = data.nodes.filter(n => n.type === 'topic' && n.status === 'completed').length
  const conceptsTotal = data.nodes.filter(n => n.type === 'concept').length
  const rootNode = data.nodes.find(n => n.type === 'root')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-50 dark:bg-slate-800 flex flex-col select-none"
    >
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-5 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <GitBranch size={17} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              {rootNode ? rootNode.label : '知识图谱'}
            </h2>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {topicsDone}/{topicsTotal} 主题
              {conceptsTotal > 0 && ` · ${conceptsTotal} 个概念`}
              {` · ${data.nodes.filter(n => n.type === 'phase').length} 阶段`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!data.has_concepts && !generating && (
            <button
              onClick={handleGenerateConcepts}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 cursor-pointer text-xs font-medium transition-all shadow-sm shadow-indigo-200"
            >
              <Sparkles size={13} />
              生成概念图
            </button>
          )}
          {generating && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg text-xs">
              <Loader2 size={13} className="animate-spin" />
              AI 正在提取概念...
            </div>
          )}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400" /> 已完成
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs">
            <div className="w-2 h-2 rounded-full bg-indigo-400" /> 进行中
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 text-xs">
            <div className="w-2 h-2 rounded-full bg-gray-300" /> 待学习
          </div>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(2.5, p.scale * 1.2) }))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-slate-800 cursor-pointer text-gray-400 dark:text-slate-500" title="放大">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.3, p.scale * 0.8) }))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-slate-800 cursor-pointer text-gray-400 dark:text-slate-500" title="缩小">
            <ZoomOut size={16} />
          </button>
          <button onClick={resetView}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-slate-800 cursor-pointer text-gray-400 dark:text-slate-500" title="重置视角">
            <Maximize2 size={16} />
          </button>
          <button onClick={onClose}
            className="ml-1 p-2 rounded-lg hover:bg-gray-100 dark:bg-slate-800 cursor-pointer">
            <X size={16} className="text-gray-400 dark:text-slate-500" />
          </button>
        </div>
      </header>

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

              const isRootEdge = edge.source === 'root'
              const isTopicSeq = edge.source.startsWith('topic_') && edge.target.startsWith('topic_')
              const isConceptDep = edge.dependency === true
              const isTopicToConcept = edge.source.startsWith('topic_') && edge.target.startsWith('c_')

              let strokeColor = '#e5e7eb'
              let strokeW = 1.2
              let dash = 'none'

              if (isRootEdge) { strokeColor = '#c7d2fe'; strokeW = 2 }
              else if (isConceptDep) { strokeColor = '#f59e0b'; strokeW = 1.2; dash = '5,4' }
              else if (isTopicToConcept) { strokeColor = '#e2e8f0'; strokeW = 1 }
              else if (isTopicSeq) { strokeColor = '#f3f4f6'; strokeW = 1; dash = '6,4' }

              if (isRootEdge) {
                const midY = (src.y + src.height / 2 + tgt.y - tgt.height / 2) / 2
                return (
                  <path key={`edge-${i}`}
                    d={`M ${src.x} ${src.y + src.height / 2} C ${src.x} ${midY}, ${tgt.x} ${midY}, ${tgt.x} ${tgt.y - tgt.height / 2}`}
                    fill="none" stroke={strokeColor} strokeWidth={strokeW} />
                )
              }

              if (isConceptDep) {
                const dx = tgt.x - src.x
                const cp = Math.abs(dx) * 0.4
                return (
                  <path key={`edge-${i}`}
                    d={`M ${src.x} ${src.y} C ${src.x + cp} ${src.y}, ${tgt.x - cp} ${tgt.y}, ${tgt.x} ${tgt.y}`}
                    fill="none" stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={dash}
                    markerEnd="url(#arrowhead)" />
                )
              }

              return (
                <line key={`edge-${i}`}
                  x1={src.x} y1={src.y + src.height / 2}
                  x2={tgt.x} y2={tgt.y - tgt.height / 2}
                  stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={dash} />
              )
            })}

            {/* 箭头标记（概念依赖用） */}
            <defs>
              <marker id="arrowhead" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="6" markerHeight="4" orient="auto">
                <polygon points="0,0 8,3 0,6" fill="#f59e0b" />
              </marker>
            </defs>

            {/* 节点 */}
            {layoutNodes.map((node) => {
              const colors = statusColors(node.status)
              const isSelected = selectedNode?.id === node.id
              const isPhaseCollapsed = node.type === 'phase' && collapsedPhases.has(node.id)
              const shape = NODE_SHAPES[node.type]

              return (
                <g key={node.id}
                  transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
                  onClick={(e) => { e.stopPropagation(); handleNodeClick(node) }}
                  className="cursor-pointer">
                  <rect
                    x={0} y={0} width={node.width} height={node.height} rx={shape.rx}
                    fill={node.type === 'concept' ? '#fff7ed' : colors.fill}
                    stroke={isSelected ? '#6366f1' : node.type === 'concept' ? '#fed7aa' : colors.stroke}
                    strokeWidth={isSelected ? 2 : node.type === 'concept' ? 1 : 1.5}
                    filter={isSelected ? 'drop-shadow(0 0 6px rgba(99,102,241,0.3))' : undefined}
                    className="transition-all duration-150" />

                  {/* 根节点 */}
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
                      <circle cx={node.width - 16} cy={node.height / 2} r={10} fill={colors.badge} opacity={0.15} />
                      <text x={node.width - 16} y={node.height / 2} fontSize={11} fontWeight={700}
                        fill={colors.badge} textAnchor="middle" dominantBaseline="middle">
                        {isPhaseCollapsed ? '+' : '−'}
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
                      {node.concept_count != null && node.concept_count > 0 && (
                        <circle cx={node.width - 28} cy={4} r={6} fill="#f59e0b" opacity={0.8} />
                      )}
                    </>
                  )}

                  {/* 概念节点：小胶囊 */}
                  {node.type === 'concept' && (
                    <>
                      <rect x={0} y={0} width={node.width} height={node.height} rx={shape.rx}
                        fill="#fff7ed" stroke="#fed7aa" strokeWidth={1} />
                      <text x={node.width / 2} y={node.height / 2} fontSize={10} fontWeight={500}
                        fill="#c2410c" textAnchor="middle" dominantBaseline="middle">
                        {node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center gap-4 z-20">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            selectedNode.type === 'root' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' :
            selectedNode.type === 'phase' ? 'bg-indigo-100' :
            selectedNode.type === 'concept' ? 'bg-orange-100' : 'bg-gray-100'
          }`}>
            {selectedNode.type === 'root' ? <Target size={18} className="text-white" /> :
             selectedNode.type === 'phase' ? <GitBranch size={18} className="text-indigo-600" /> :
             selectedNode.type === 'concept' ? <Sparkles size={14} className="text-orange-500" /> :
             <Circle size={16} className={statusColors(selectedNode.status).text} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{selectedNode.label}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {selectedNode.subtitle}
              {selectedNode.score != null && ` · 均分 ${selectedNode.score}`}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            selectedNode.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' :
            selectedNode.status === 'in_progress' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' :
            'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
          }`}>
            {selectedNode.status === 'completed' ? '已完成' : selectedNode.status === 'in_progress' ? '进行中' : '待学习'}
          </span>
          {selectedNode.type === 'phase' && (
            <button onClick={() => setCollapsedPhases(prev => {
              const next = new Set(prev)
              if (next.has(selectedNode.id)) next.delete(selectedNode.id)
              else next.add(selectedNode.id)
              return next
            })} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
              {collapsedPhases.has(selectedNode.id) ? '展开主题' : '收起主题'}
            </button>
          )}
          {selectedNode.type === 'topic' && data?.nodes.some(n => n.type === 'concept' &&
            data.edges.some(e => e.source === selectedNode.id && e.target === n.id)) && (
            <button onClick={() => setExpandedTopics(prev => {
              const next = new Set(prev)
              if (next.has(selectedNode.id)) next.delete(selectedNode.id)
              else next.add(selectedNode.id)
              return next
            })} className="text-xs px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg cursor-pointer transition-colors">
              {expandedTopics.has(selectedNode.id) ? '收起概念' : '展开概念'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
