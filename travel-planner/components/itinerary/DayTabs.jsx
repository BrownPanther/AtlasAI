import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar, MapPin, CheckCircle2, CloudSun, Clock } from 'lucide-react'

export default function DayTabs({ days, activeIndex, onSelect }) {
  const containerRef = useRef(null)
  const touchStartX = useRef(null)

  // Scroll active card into center view smoothly
  useEffect(() => {
    if (!containerRef.current) return
    const activeEl = containerRef.current.querySelector(`[data-day-index="${activeIndex}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeIndex])

  const handlePrev = () => {
    if (activeIndex > 0) onSelect(activeIndex - 1)
  }

  const handleNext = () => {
    if (activeIndex < days.length - 1) onSelect(activeIndex + 1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      handlePrev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      handleNext()
    }
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNext()
      else handlePrev()
    }
    touchStartX.current = null
  }

  if (!days || days.length <= 1) return null

  const activeDay = days[activeIndex] || days[0]

  return (
    <section className="atlas-day-carousel-section" aria-label="Itinerary day selector" onKeyDown={handleKeyDown}>
      {/* Top Carousel Navigation Bar */}
      <div className="atlas-day-carousel-header">
        <div className="atlas-day-carousel-title-group">
          <span className="atlas-eyebrow">Trip Timeline</span>
          <h2 className="atlas-day-carousel-title">
            Day {activeDay?.dayNumber} <span className="atlas-day-carousel-sub">{activeDay?.date ? `· ${activeDay.date}` : ''}</span>
          </h2>
        </div>

        <div className="atlas-day-carousel-nav-controls">
          <span className="atlas-day-counter">
            <strong>{activeIndex + 1}</strong> of {days.length} days
          </span>
          <div className="atlas-day-carousel-buttons">
            <button
              type="button"
              className="atlas-carousel-btn"
              onClick={handlePrev}
              disabled={activeIndex === 0}
              aria-label="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="atlas-carousel-btn"
              onClick={handleNext}
              disabled={activeIndex >= days.length - 1}
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Centered Carousel Track */}
      <div
        className="atlas-day-carousel-viewport"
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        tabIndex={0}
        role="region"
        aria-label="Days carousel (use left/right arrows to navigate)"
      >
        <div className="atlas-day-carousel-track">
          {days.map((day, i) => {
            const isActive = i === activeIndex
            const isPrev = i === activeIndex - 1
            const isNext = i === activeIndex + 1
            const stopCount = day.stops?.length || 0
            const completion = Math.round(day.completionPercent || 0)
            const weather = day.weather

            return (
              <div
                key={day.dayNumber || i}
                data-day-index={i}
                onClick={() => onSelect(i)}
                className={`atlas-day-card ${isActive ? 'is-active' : ''} ${isPrev ? 'is-prev' : ''} ${isNext ? 'is-next' : ''}`}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'true' : 'false'}
                aria-label={`Day ${day.dayNumber}: ${day.theme || 'Plan'}, ${stopCount} stops`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i) } }}
              >
                {/* Glowing top accent line for active */}
                {isActive && <div className="atlas-day-card-glow-bar" />}

                <div className="atlas-day-card-header">
                  <div className="atlas-day-badge">
                    <span>DAY</span>
                    <strong>{day.dayNumber}</strong>
                  </div>

                  <div className="atlas-day-meta-top">
                    {day.date && (
                      <span className="atlas-day-date">
                        <Calendar size={11} /> {day.date}
                      </span>
                    )}
                    {weather && weather.tempMaxC != null && (
                      <span className="atlas-day-weather-pill" title={`${weather.condition || 'Weather'}: ${weather.tempMinC}–${weather.tempMaxC}°C`}>
                        <CloudSun size={11} /> {weather.tempMaxC}°C
                      </span>
                    )}
                  </div>
                </div>

                <div className="atlas-day-card-body">
                  <h3 className="atlas-day-theme">
                    {day.theme || `Day ${day.dayNumber} Itinerary`}
                  </h3>
                  {day.destination && (
                    <p className="atlas-day-location">
                      <MapPin size={11} /> {day.destination}
                    </p>
                  )}
                </div>

                <div className="atlas-day-card-footer">
                  <div className="atlas-day-stops-pill">
                    <Clock size={11} /> {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
                  </div>

                  {completion > 0 ? (
                    <div className="atlas-day-status-pill completed">
                      <CheckCircle2 size={11} /> {completion}% done
                    </div>
                  ) : (
                    <div className="atlas-day-status-pill upcoming">
                      <span>Ready</span>
                    </div>
                  )}
                </div>

                {/* Progress bar at the base of the card */}
                <div className="atlas-day-progress-track">
                  <div className="atlas-day-progress-fill" style={{ width: `${completion}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Jump Dots / Day Strip */}
      <div className="atlas-day-carousel-indicators" role="tablist" aria-label="Jump to day">
        {days.map((day, i) => (
          <button
            key={day.dayNumber || i}
            type="button"
            className={`atlas-day-dot ${i === activeIndex ? 'is-active' : ''}`}
            onClick={() => onSelect(i)}
            aria-label={`Jump to Day ${day.dayNumber}`}
            aria-selected={i === activeIndex}
          >
            <span>{day.dayNumber}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
