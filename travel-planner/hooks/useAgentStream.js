import { useCallback, useRef, useState } from 'react'
import { API_URL, getToken } from '../services/api'

// We use fetch + a manual SSE-line parser rather than the native EventSource,
// because EventSource can't send an Authorization header or a POST body,
// and the plan request needs both.
export function useAgentStream() {
  const [trace, setTrace] = useState([])
  const [status, setStatus] = useState('idle') // idle | streaming | done | error | cancelled
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStatus('cancelled')
  }, [])

  const start = useCallback(async (tripRequest) => {
    setTrace([])
    setResult(null)
    setError(null)
    setStatus('streaming')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${API_URL}/ai/plan/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify(tripRequest),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || `Planning request failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() // last chunk may be incomplete, keep it for next read

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          const payload = JSON.parse(line.slice(6))

          if (payload.type === 'trace') {
            setTrace((t) => [...t, payload.entry])
          } else if (payload.type === 'done') {
            setResult(payload)
            setStatus('done')
          } else if (payload.type === 'error') {
            setError(payload.message)
            setStatus('error')
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setStatus('error')
    }
  }, [])

  return { start, cancel, trace, status, result, error }
}
