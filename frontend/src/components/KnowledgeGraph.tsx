import { useState, useEffect, useMemo } from 'react'
import { getKnowledgeGraph } from '../services/api'
import { Target, GitBranch, Circle, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface GraphNode {
  id: string
  label: string
  type: 'phase' | 'topic'
  subtitle: string
  status: 'completed' | 'in_progress' | 'pending'
  score?: number
}

interface GraphEdge {
  source: string
  target: string
}

interface LayoutNode extends GraphNode {
  x: number
  y: number
}

function calculateLayout(nodes: GraphNode[], edges: GraphEdge[]): LayoutNode[] {
  const phaseNodes = nodes.filter(n => n.type === 'phase')
  const topicNodes = nodes.filter(n => n.type === 'topic')
  const layoutNodes: LayoutNode[] = []

  // 阶段节点垂直排列在左侧
  const phaseSpacing = 160
  const startY = 80
  phaseNodes.forEach((phase, i) => {
    layoutNodes.push({ ...phase, x: 60, y: startY + i * phaseSpacing })
  })

  // 主题节点按阶段分组，分布在右侧
  topicNodes.forEach(topic => {
    // 找到这个主题属于哪个阶段
    const phaseEdge = edges.find(e => e.target === topic.id && e.source.startsWith('phase_'))
    const phaseId = phaseEdge?.source
    const phaseNode = phaseId ? layoutNodes.find(n => n.id === phaseId) : null

    if (phaseNode) {
      // 找到同阶段的所有主题
      const siblingEdges = edges.filter(e => e.source === phaseId && e.target.startsWith('topic_'))
      const siblingIds = siblingEdges.map(e => e.target)
      const siblingIndex = siblingIds.indexOf(topic.id)
      const totalSiblings = siblingIds.length

      const x = 280 + (siblingIndex % 5) * 170
      const row = Math.floor(siblingIndex / 5)
      const y = phaseNode.y - ((totalSiblings - 1) * 40) / 2 + siblingIndex * 44 + row * 20

      layoutNodes.push({ ...topic, x, y })
    } else {
      layoutNodes.push({ ...topic, x: 300, y: startY + layoutNodes.length * 44 })
    }
  })

  return layoutNodes
}

function statusColors(status: string) {
  switch (status) {
    case 'completed': return { fill: '#ecfdf5', stroke: '#6ee7b7', text: '#059669', badge: '#10b981' }
    case 'in_progress': return { fill: '#eef2ff', stroke: '#a5b4fc', text: '#4f46e5', badge: '#6366f1' }
    default: return { fill: '#f9fafb', stroke: '#e5e7eb', text: '#9ca3af', badge: '#d1d5db' }
  }
}

export default function KnowledgeGraph({ goalId, onClose }: { goalId: number; onClose: () => void }) {
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null)

  useEffect(() => {
    getKnowledgeGraph(goalId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [goalId])

  const layoutNodes = useMemo(
    () => (data ? calculateLayout(data.nodes, data.edges) : []),
    [data],
  )

  const maxX = Math.max(...layoutNodes.map(n => n.x), 400) + 250
  const maxY = Math.max(...layoutNodes.map(n => n.y), 400) + 120

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

  const stat = {
    total: layoutNodes.filter(n => n.type === 'topic').length,
    completed: layoutNodes.filter(n => n.type === 'topic' && n.status === 'completed').length,
    inProgress: layoutNodes.filter(n => n.type === 'topic' && n.status === 'in_progress').length,
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-50 flex flex-col"
    >
      {/* 顶部栏 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <GitBranch size={17} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">知识图谱</h2>
            <p className="text-xs text-gray-400">
              {stat.completed}/{stat.total} 个主题已完成
              {stat.inProgress > 0 && ` · ${stat.inProgress} 个进行中`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600">
            <div className="w-2 h-2 rounded-full bg-emerald-400" /> 已完成
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600">
            <div className="w-2 h-2 rounded-full bg-indigo-400" /> 进行中
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-400">
            <div className="w-2 h-2 rounded-full bg-gray-300" /> 待学习
          </div>
          <button onClick={onClose}
            className="ml-2 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </header>

      {/* SVG 图谱 */}
      <div className="flex-1 overflow-auto">
        <svg
          width={Math.max(maxX, window.innerWidth - 32)}
          height={Math.max(maxY, window.innerHeight - 100)}
          className="block"
        >
          {/* 边 */}
          {data.edges.map((edge, i) => {
            const src = layoutNodes.find(n => n.id === edge.source)
            const tgt = layoutNodes.find(n => n.id === edge.target)
            if (!src || !tgt) return null
            const isPhaseToTopic = edge.source.startsWith('phase_')
            return (
              <line
                key={`edge-${i}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={isPhaseToTopic ? '#e5e7eb' : '#f3f4f6'}
                strokeWidth={isPhaseToTopic ? 1.5 : 1}
                strokeDasharray={isPhaseToTopic ? 'none' : '4,4'}
              />
            )
          })}

          {/* 节点 */}
          {layoutNodes.map((node) => {
            const colors = statusColors(node.status)
            const isPhase = node.type === 'phase'
            const isSelected = selectedNode?.id === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(isSelected ? null : node)}
                className="cursor-pointer"
              >
                {isPhase ? (
                  <>
                    <rect
                      x={-90} y={-22} width={180} height={44} rx={12}
                      fill={colors.fill}
                      stroke={isSelected ? '#6366f1' : colors.stroke}
                      strokeWidth={isSelected ? 2 : 1}
                      className="transition-all hover:shadow-lg"
                    />
                    <text x={-60} y={-2} fontSize={13} fontWeight={600} fill={colors.text}>
                      {node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
                    </text>
                    <text x={-60} y={14} fontSize={10} fill="#9ca3af">
                      {node.subtitle}
                    </text>
                    <circle cx={70} cy={0} r={9} fill={colors.badge} />
                    <text x={70} y={4} fontSize={9} fontWeight={700} fill="white" textAnchor="middle">
                      {node.status === 'completed' ? '✓' : node.status === 'in_progress' ? '▶' : '·'}
                    </text>
                  </>
                ) : (
                  <>
                    <rect
                      x={-62} y={-18} width={124} height={36} rx={8}
                      fill={colors.fill}
                      stroke={isSelected ? '#6366f1' : colors.stroke}
                      strokeWidth={isSelected ? 2 : 1}
                      className="transition-all hover:shadow-md"
                    />
                    <text x={-50} y={2} fontSize={11} fontWeight={500} fill={colors.text}>
                      {node.label.length > 8 ? node.label.slice(0, 8) + '...' : node.label}
                    </text>
                    {node.score && (
                      <text x={55} y={2} fontSize={9} fontWeight={600} fill={colors.text} textAnchor="end">
                        {node.score}
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* 选中节点详情浮窗 */}
      {selectedNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-200 px-6 py-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            selectedNode.type === 'phase' ? 'bg-indigo-100' : 'bg-gray-100'
          }`}>
            {selectedNode.type === 'phase'
              ? <Target size={18} className="text-indigo-600" />
              : <Circle size={16} className={statusColors(selectedNode.status).text} />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedNode.label}</p>
            <p className="text-xs text-gray-400">
              {selectedNode.subtitle}
              {selectedNode.score && ` · 评分 ${selectedNode.score}`}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            selectedNode.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
            selectedNode.status === 'in_progress' ? 'bg-indigo-50 text-indigo-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {selectedNode.status === 'completed' ? '已完成' : selectedNode.status === 'in_progress' ? '进行中' : '待学习'}
          </span>
        </div>
      )}
    </motion.div>
  )
}
