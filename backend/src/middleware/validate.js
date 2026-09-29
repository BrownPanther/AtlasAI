import { AppError } from '../utils/AppError.js'

/**
 * validate({ body: { field: rule, ... } })
 * rule can be: 'string' | 'number' | 'email' | { type, required, min, max }
 * Unknown/extra fields are left alone (not stripped) — we only enforce what's declared.
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      for (const [source, rules] of Object.entries(schema)) {
        const data = req[source] || {}
        for (const [field, rawRule] of Object.entries(rules)) {
          const rule = typeof rawRule === 'string' ? { type: rawRule, required: true } : rawRule
          const value = data[field]
          const required = rule.required !== false

          if (value === undefined || value === null || value === '') {
            if (required) throw AppError.badRequest(`"${field}" is required`, { field })
            continue
          }

          if (rule.type === 'string' && typeof value !== 'string') {
            throw AppError.badRequest(`"${field}" must be a string`, { field })
          }
          if (rule.type === 'number' && Number.isNaN(Number(value))) {
            throw AppError.badRequest(`"${field}" must be a number`, { field })
          }
          if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw AppError.badRequest(`"${field}" must be a valid email`, { field })
          }
          if (rule.type === 'string' && rule.min && value.length < rule.min) {
            throw AppError.badRequest(`"${field}" must be at least ${rule.min} characters`, { field })
          }
          if (rule.type === 'string' && rule.max && value.length > rule.max) {
            throw AppError.badRequest(`"${field}" must be at most ${rule.max} characters`, { field })
          }
          if (rule.oneOf && !rule.oneOf.includes(value)) {
            throw AppError.badRequest(`"${field}" must be one of: ${rule.oneOf.join(', ')}`, { field })
          }
        }
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
