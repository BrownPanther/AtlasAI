import { Plane, Hotel, MapPinned, Wallet, CalendarDays, CheckCircle2, Clock3, AlertCircle } from 'lucide-react'

const SOURCE_BADGE = { live: 'Live', cached: 'Cached', estimated: 'Est.', sample: 'Sample', unavailable: 'N/A' }
const SOURCE_COLOR = { live: '#22c55e', cached: '#3b82f6', estimated: '#f59e0b', sample: '#94a3b8', unavailable: '#ef4444' }

function SourceTag({ state }) {
  if (!state) return null
  return <span style={{ fontSize: 8, fontWeight: 700, color: SOURCE_COLOR[state] || '#94a3b8', marginLeft: 6 }}>{SOURCE_BADGE[state] || state}</span>
}

export default function OverviewPanel({ finalPlan }) {
  const totalActivities = finalPlan.days.reduce((sum, d) => sum + d.stops.filter((s) => s.id).length, 0)
  const totalStops = finalPlan.days.reduce((sum, d) => sum + d.stops.length, 0)
  const completedStops = finalPlan.days.reduce((sum, d) => sum + d.stops.filter((s) => s.completed).length, 0)
  const overallCompletion = totalStops ? Math.round((completedStops / totalStops) * 100) : 0

  const ss = finalPlan.sourceStatus || {}
  const budget = finalPlan.budget || {}
  const arrival = finalPlan.arrival

  const cards = [
    {
      icon: Plane, label: 'Transport',
      value: finalPlan.transport?.mode || '—',
      sub: finalPlan.transport?.provider || (finalPlan.sources?.transport === 'unavailable' ? 'Not available' : null),
      source: ss.flights?.state || finalPlan.sources?.transport,
    },
    {
      icon: Hotel, label: 'Accommodation',
      value: finalPlan.stay?.name || '—',
      sub: finalPlan.stay?.area || (finalPlan.sources?.stay === 'unavailable' ? 'Not available' : null),
      source: ss.hotels?.state || finalPlan.sources?.stay,
    },
    {
      icon: MapPinned, label: 'Total activities',
      value: totalActivities,
      sub: `across ${finalPlan.days.length} day(s)`,
      source: ss.attractions?.state || finalPlan.sources?.activities,
    },
    {
      icon: Wallet, label: 'Estimated total cost',
      value: `₹${(budget.total || 0).toLocaleString()}${budget.isLowerBound ? '+' : ''}`,
      sub: budget.budget ? `of ₹${budget.budget.toLocaleString()} budget${budget.isLowerBound ? ' (lower bound)' : ''}` : null,
    },
    {
      icon: CalendarDays, label: 'Trip duration',
      value: `${finalPlan.days.length} days`,
      sub: `${finalPlan.startDate || '—'} → ${finalPlan.endDate || '—'}`,
    },
    {
      icon: CheckCircle2, label: 'Completion',
      value: `${overallCompletion}%`,
      sub: `${completedStops}/${totalStops} stops done`,
    },
  ]

  // Arrival info card (if real transport data provides it)
  if (arrival) {
    cards.splice(4, 0, {
      icon: Clock3, label: 'Arrival',
      value: arrival.time || arrival.date || '—',
      sub: arrival.date && arrival.time ? `Day 1 starts ${arrival.time}` : null,
    })
  }

  // Data completeness
  if (finalPlan.dataCompleteness === 'partial') {
    cards.push({
      icon: AlertCircle, label: 'Data completeness',
      value: 'Partial',
      sub: finalPlan.unavailableComponents?.length ? `Missing: ${finalPlan.unavailableComponents.join(', ')}` : 'Some data unavailable',
    })
  }

  return (
    <div className="atlas-overview-grid">
      {cards.map(({ icon: Icon, label, value, sub, source }) => (
        <div className="atlas-overview-card" key={label}>
          <span><Icon size={13} style={{ display: 'inline', marginRight: 6 }} />{label}<SourceTag state={source} /></span>
          <strong>{value}</strong>
          {sub && <small>{sub}</small>}
        </div>
      ))}
    </div>
  )
}
