import { useState } from 'react'
import { TextField, SelectField } from '../FormField'

const CATEGORIES = ['nature', 'food', 'culture', 'history', 'leisure', 'adventure', 'shopping', 'relaxation', 'other']

export default function AddStopModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ label: '', category: 'leisure', startTime: '15:00', durationHours: '1', estimatedCost: '0', notes: '' })
  const update = (key) => (val) => setForm((f) => ({ ...f, [key]: val }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.label.trim()) return
    onAdd({
      id: `custom-${Date.now()}`,
      label: form.label.trim(),
      category: form.category,
      area: 'Custom',
      startTime: form.startTime,
      durationHours: Number(form.durationHours) || 1,
      estimatedCost: Number(form.estimatedCost) || 0,
      notes: form.notes.trim() || null,
      completed: false,
    })
  }

  return (
    <div className="atlas-modal-backdrop" onClick={onClose}>
      <div className="atlas-modal" role="dialog" aria-modal="true" aria-labelledby="add-stop-title" onClick={(e) => e.stopPropagation()}>
        <h4 id="add-stop-title">Add a custom stop</h4>
        <form onSubmit={submit} className="atlas-field-grid" style={{ gridTemplateColumns: '1fr' }}>
          <TextField label="What is it?" value={form.label} onChange={update('label')} placeholder="e.g. Sunset viewpoint" />
          <div className="atlas-field-grid three">
            <TextField type="time" label="Start time" value={form.startTime} onChange={update('startTime')} />
            <TextField label="Duration (hrs)" value={form.durationHours} onChange={update('durationHours')} />
            <TextField label="Cost (₹)" value={form.estimatedCost} onChange={update('estimatedCost')} />
          </div>
          <SelectField label="Category" value={form.category} onChange={update('category')} options={CATEGORIES} />
          <TextField label="Notes (optional)" value={form.notes} onChange={update('notes')} />
          <button type="submit" className="btn-primary atlas-plan-submit">Add to day</button>
        </form>
      </div>
    </div>
  )
}
