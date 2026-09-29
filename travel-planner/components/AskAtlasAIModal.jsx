import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ArrowRight,
} from 'lucide-react'

const SUGGESTED_PROMPTS = [
  { label: '✨ Top hidden gems', text: 'What are the top hidden gems and secret viewpoints in this destination?' },
  { label: '🌦️ Weather & packing', text: 'What is the current microclimate like and what essentials should I pack?' },
  { label: '🍽️ Local food spots', text: 'Suggest authentic local food experiences and must-visit cafes.' },
  { label: '💰 Budget optimizer', text: 'How can I optimize travel expenses and avoid tourist markups?' },
  { label: '🗺️ Build custom trip', text: 'Plan a personalized 3-day adventure itinerary here.' },
]

// Parse inline **bold** into React nodes (no dangerouslySetInnerHTML)
function parseInline(text) {
  if (!text || !text.includes('**')) return text
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#d0bcff', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

// Lightweight markdown renderer: headings, bullets, paragraphs, bold
function renderMarkdown(text) {
  if (!text) return null
  const blocks = text.split(/\n\n+/)
  const elements = []

  blocks.forEach((block, bi) => {
    const trimmed = block.trim()
    if (!trimmed) return

    // Heading: # / ## / ###
    if (/^#{1,3}\s/.test(trimmed)) {
      const content = trimmed.replace(/^#{1,3}\s/, '')
      elements.push(
        <p key={`h-${bi}`} style={{ fontWeight: 700, fontSize: 15, color: '#e9def7', margin: '8px 0 4px 0' }}>
          {parseInline(content)}
        </p>
      )
      return
    }

    const lines = trimmed.split('\n')
    const bulletLines = lines.filter(l => /^\s*[-*•]\s/.test(l))
    const paraLines = lines.filter(l => !/^\s*[-*•]\s/.test(l) && l.trim())

    if (bulletLines.length > 0) {
      // Prose before bullets
      if (paraLines.length > 0) {
        elements.push(
          <p key={`p-${bi}`} style={{ margin: '0 0 5px 0', fontSize: 15, lineHeight: '23px', color: '#e9def7' }}>
            {paraLines.map((l, i) => <span key={i}>{parseInline(l)}{i < paraLines.length - 1 ? ' ' : ''}</span>)}
          </p>
        )
      }
      elements.push(
        <ul key={`ul-${bi}`} style={{ margin: '2px 0 8px 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {bulletLines.map((item, ii) => (
            <li key={ii} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 15, lineHeight: '22px', color: '#e9def7' }}>
              <span style={{ color: '#a078ff', flexShrink: 0, marginTop: 3 }}>•</span>
              <span>{parseInline(item.replace(/^\s*[-*•]\s+/, ''))}</span>
            </li>
          ))}
        </ul>
      )
    } else {
      // Paragraph
      elements.push(
        <p key={`p-${bi}`} style={{ margin: '0 0 6px 0', fontSize: 15, lineHeight: '23px', color: '#e9def7' }}>
          {lines.map((l, i) => <span key={i}>{parseInline(l)}{i < lines.length - 1 ? ' ' : ''}</span>)}
        </p>
      )
    }
  })

  return elements
}

export default function AskAtlasAIModal({ isOpen, onClose, destinationContext }) {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [thinking, setThinking] = useState(false)
  const [dest, setDest] = useState(destinationContext || '')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (destinationContext) setDest(destinationContext)
  }, [destinationContext])

  useEffect(() => {
    if (isOpen) {
      const greeting = dest
        ? `Hello! I'm AtlasAI, your personal travel intelligence concierge. I see you're interested in **${dest}**. Based on the available travel data I can help with local activities, hidden gems, route planning, and packing advice. How can I help?`
        : `Hello! I'm AtlasAI, your autonomous travel intelligence concierge. Ask me anything about destination curation, routing, budget optimization, or bespoke itineraries. Note: live pricing and real-time availability depend on your configured data sources.`

      setMessages([{
        id: 'welcome',
        sender: 'ai',
        text: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, dest])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  if (!isOpen) return null

  const generateAnswer = (userQuery) => {
    const q = userQuery.toLowerCase()
    const target = dest || 'your target destination'

    if (q.includes('hidden') || q.includes('secret') || q.includes('gem')) {
      return {
        text: `Here are curated hidden spots worth exploring in **${target}**:\n\n- **Old Quarter Secret Trails**: Walk beyond the tourist streets to find century-old settlements and artisan studios.\n- **Sunrise Viewpoint**: Arrive at dawn for panoramic golden-hour views without the crowds.\n- **Pine Forest Brook**: A tranquil stream just 2–3 km off the main valley road, ideal for peaceful reflection.\n\nWould you like AtlasAI to build a personalized itinerary around these?`,
        hasPlanCta: true,
      }
    }

    if (q.includes('weather') || q.includes('pack') || q.includes('climate')) {
      return {
        text: `**Packing & Climate Notes for ${target}**:\n\nBased on the available travel data for this region:\n\n- **Layers**: Breathable light layers with a wind-resistant shell for evenings and higher altitudes.\n- **Footwear**: Sturdy tread shoes for cobbled lanes and trail exploration.\n- **Essentials**: UV-blocking sunglasses, sunscreen, and a portable power bank for navigation.\n\nFor live microclimate data, check the Weather card in your itinerary once a trip is planned.`,
      }
    }

    if (q.includes('food') || q.includes('cafe') || q.includes('eat') || q.includes('restaurant')) {
      return {
        text: `**Culinary Highlights for ${target}**:\n\nBased on travel knowledge for this destination:\n\n- **Morning**: Local bakeries and chai stalls often outperform tourist cafes for authenticity.\n- **Midday**: Look for thali spots and dhabas frequented by locals.\n- **Evening**: Riverside or hilltop restaurants typically offer the best atmosphere.\n\nNote: AtlasAI does not have live dining reservations. Please confirm availability directly with restaurants.`,
      }
    }

    if (q.includes('budget') || q.includes('cost') || q.includes('save') || q.includes('money')) {
      return {
        text: `**Budget Optimization for ${target}**:\n\n- **Transport**: Booking sleeper trains or express buses in advance saves significantly over last-minute flights.\n- **Accommodation**: Staying 10–15 minutes outside the commercial center can reduce boutique rates by 30–40%.\n- **Multi-entry passes**: Cultural heritage passes reduce individual ticketing costs at major monuments.\n\nAll cost figures in your itinerary are planning estimates based on available travel data — not confirmed live prices.`,
      }
    }

    if (q.includes('plan') || q.includes('itinerary') || q.includes('trip') || q.includes('schedule')) {
      return {
        text: `AtlasAI can build a personalized multi-day itinerary for **${target}** using verified travel data — including route planning, accommodation suggestions, and activity scheduling.\n\nNote: Pricing shown will be planning estimates. Actual availability and rates must be confirmed directly with providers.`,
        hasPlanCta: true,
      }
    }

    return {
      text: `Based on AtlasAI's travel knowledge for **${target}**, this destination is known for scenic contrasts, cultural heritage, and memorable outdoor experiences.\n\nOur itinerary planner can curate a custom journey tuned to your exact preferences and travel dates. Would you like to start planning?`,
      hasPlanCta: true,
    }
  }

  const handleSend = (textToSend) => {
    const query = (textToSend || input).trim()
    if (!query) return

    setMessages((prev) => [...prev, {
      id: String(Date.now()),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])
    setInput('')
    setThinking(true)

    setTimeout(() => {
      const response = generateAnswer(query)
      setMessages((prev) => [...prev, {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: response.text,
        hasPlanCta: response.hasPlanCta,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      setThinking(false)
    }, 650)
  }

  const handleLaunchPlanner = () => {
    onClose()
    navigate('/plan', { state: { destination: dest || 'Manali' } })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl text-white border border-purple-500/30 shadow-[0_24px_80px_-15px_rgba(11,6,22,0.9),0_0_40px_rgba(160,120,255,0.2)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'radial-gradient(circle at 10% 0%, rgba(139,92,246,0.18) 0%, rgba(23,17,36,0.97) 70%)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Top glow bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#a078ff] via-[#ffb0cd] to-[#6d3bd7]" />

        {/* Header */}
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#a078ff] to-[#7c3aed] flex items-center justify-center shadow-[0_0_20px_rgba(160,120,255,0.4)] border border-white/20">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>AtlasAI Concierge</h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Agents Live
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#cbc3d7', marginTop: 1 }}>
                Travel assistance {dest ? `for ${dest}` : 'worldwide'} · Data-dependent results
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-[#cbc3d7] hover:text-white transition-colors cursor-pointer"
            aria-label="Close Concierge"
          >
            <X size={18} />
          </button>
        </header>

        {/* Quick prompts */}
        <div className="px-6 py-2.5 bg-black/20 border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#a078ff', letterSpacing: '0.08em', flexShrink: 0 }}>Ask:</span>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              onClick={() => handleSend(prompt.text)}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-purple-600/30 border border-white/10 hover:border-purple-400/40 whitespace-nowrap transition-all duration-200 cursor-pointer"
              style={{ fontSize: 12, color: '#e9def7' }}
              type="button"
            >
              {prompt.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 px-6 py-5 overflow-y-auto flex flex-col gap-5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 max-w-[88%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-purple-600' : 'bg-gradient-to-br from-[#a078ff] to-[#7c3aed] shadow-md'}`}>
                {msg.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`rounded-2xl px-4 py-3 ${msg.sender === 'user' ? 'bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] shadow-md rounded-tr-sm' : 'bg-[#231a38]/80 border border-white/15 backdrop-blur-xl shadow-lg rounded-tl-sm'}`}>
                {msg.sender === 'ai' ? (
                  <div style={{ lineHeight: 1.55 }}>{renderMarkdown(msg.text)}</div>
                ) : (
                  <p style={{ fontSize: 15, lineHeight: '1.5', margin: 0 }}>{msg.text}</p>
                )}

                {msg.hasPlanCta && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={handleLaunchPlanner}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#d0bcff] to-[#ffb0cd] text-[#3c0091] font-bold shadow-md hover:scale-105 transition-all cursor-pointer"
                      style={{ fontSize: 12 }}
                      type="button"
                    >
                      <Sparkles size={13} />
                      <span>Build Personalized Itinerary</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}

                <div style={{ fontSize: 10, marginTop: 6, textAlign: 'right', color: msg.sender === 'user' ? 'rgba(255,255,255,0.5)' : '#958ea0' }}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex gap-3 max-w-[80%] items-center">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#a078ff] to-[#7c3aed] flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-[#231a38]/80 border border-white/15 flex items-center gap-2" style={{ fontSize: 13, color: '#cbc3d7' }}>
                <Sparkles size={14} className="text-[#d0bcff] animate-spin" />
                <span>Consulting AtlasAI knowledge base…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <footer className="p-4 border-t border-white/10 bg-black/20 shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask AtlasAI about ${dest || 'destinations'}, routes, weather, dining...`}
              className="flex-1 px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white placeholder:text-[#958ea0] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
              style={{ fontSize: 14 }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#a078ff] to-[#7c3aed] hover:from-[#b08aff] hover:to-[#8b5cf6] text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{ fontSize: 14 }}
            >
              <span>Ask</span>
              <Send size={14} />
            </button>
          </form>
        </footer>
      </div>
    </div>
  )
}
