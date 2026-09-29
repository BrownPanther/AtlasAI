import { useId } from 'react'

export function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  const id = useId()
  return (
    <div className="atlas-field">
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function SelectField({ label, value, onChange, options }) {
  const id = useId()
  return (
    <div className="atlas-field">
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
