import { useState, useCallback } from 'react'

export type TeachingStyle = 'default' | 'analogy' | 'feynman' | 'rigorous' | 'code-heavy'

export const STYLE_OPTIONS: { value: TeachingStyle; label: string; desc: string; icon: string }[] = [
  { value: 'default', label: '默认', desc: '均衡讲解风格', icon: '📚' },
  { value: 'analogy', label: '类比', desc: '多用生活类比和比喻', icon: '💡' },
  { value: 'feynman', label: '费曼', desc: '用最简单的话讲清楚', icon: '🎯' },
  { value: 'rigorous', label: '严谨', desc: '学术风格，注重精确', icon: '📖' },
  { value: 'code-heavy', label: '实例', desc: '多给代码和实际例子', icon: '💻' },
]

export function useTeachingStyle() {
  const [style, setStyle] = useState<TeachingStyle>(() => {
    const saved = localStorage.getItem('teaching_style')
    if (saved && STYLE_OPTIONS.some(o => o.value === saved)) return saved as TeachingStyle
    return 'default'
  })

  const changeStyle = useCallback((s: TeachingStyle) => {
    setStyle(s)
    localStorage.setItem('teaching_style', s)
  }, [])

  return { style, changeStyle }
}
