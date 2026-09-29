import { Sparkles } from 'lucide-react'

const TABS = [
  { key: 'plan', label: 'Plan' },
  { key: 'overview', label: 'Overview' },
  { key: 'budget', label: 'Budget' },
  { key: 'insights', label: 'AI Insights', isAi: true },
  { key: 'safety', label: 'Safety' },
]

export default function TabBar({ active, onChange }) {
  return (
    <div className="atlas-tabbar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`atlas-tab ${active === t.key ? 'is-active' : ''} ${t.isAi ? 'atlas-tab-ai' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.isAi && <Sparkles size={12} className="inline mr-1 text-accent" />}
          {t.label}
        </button>
      ))}
    </div>
  )
}
