import { Orchestrator } from '../agents/Orchestrator.js'
import { AgentContext } from '../agents/AgentContext.js'
import { agentRunRepository } from '../repositories/agentRunRepository.js'
import { tripRepository } from '../repositories/tripRepository.js'
import { AppError } from '../utils/AppError.js'

const MAX_REPLAN_ITERATIONS = 2

export const tripService = {
  async planTrip({ userId, tripRequest, saveAsTrip = false, onTrace = null, onContextReady = null }) {
    if (!tripRequest?.destination) {
      throw AppError.badRequest('destination is required', { field: 'destination' })
    }

    const run = agentRunRepository.create({ userId, request: tripRequest })
    const context = new AgentContext({ tripRequest, runId: run.id, userId, maxReplanIterations: MAX_REPLAN_ITERATIONS, onTrace })
    onContextReady?.(context)
    const orchestrator = new Orchestrator({ maxReplanIterations: MAX_REPLAN_ITERATIONS })

    try {
      await orchestrator.run(context)

      let trip = null
      if (saveAsTrip) {
        trip = tripRepository.create({
          ownerId: userId,
          title: `Trip to ${context.state.intent.destination}`,
          destination: context.state.intent.destination,
          origin: context.state.intent.origin,
          startDate: context.state.intent.startDate,
          endDate: context.state.intent.endDate,
          budget: context.state.intent.budget || 0,
          request: tripRequest,
          finalPlan: context.state.finalPlan,
        })
      }

      agentRunRepository.complete(run.id, {
        status: context.state.critique.data.approved ? 'completed' : 'completed',
        trace: context.executionTrace,
        result: context.state,
        tripId: trip?.id ?? null,
      })

      return { runId: run.id, trip, state: context.state, trace: context.executionTrace }
    } catch (err) {
      const trace = err.context?.executionTrace || context.executionTrace
      agentRunRepository.complete(run.id, { status: 'failed', trace, result: null, error: err.message })
      throw err
    }
  },

  getRun(runId, userId) {
    const run = agentRunRepository.findByIdForUser(runId, userId)
    if (!run) throw AppError.notFound('Agent run not found')
    return run
  },

  // --- Trip CRUD (minimal — full itinerary UI wiring comes in a later checkpoint) ---

  createManual({ userId, title, destination, origin, startDate, endDate, budget }) {
    if (!destination) throw AppError.badRequest('destination is required', { field: 'destination' })
    return tripRepository.create({ ownerId: userId, title: title || `Trip to ${destination}`, destination, origin, startDate, endDate, budget })
  },

  listForUser(userId) {
    return tripRepository.listForUser(userId)
  },

  getById(id, userId) {
    const trip = tripRepository.findById(id)
    if (!trip) throw AppError.notFound('Trip not found')
    if (!tripRepository.isMember(id, userId)) throw AppError.forbidden('Not a member of this trip')
    return trip
  },

  update(id, userId, fields) {
    this.getById(id, userId) // ownership/membership check
    return tripRepository.update(id, fields)
  },

  remove(id, userId) {
    const trip = tripRepository.findById(id)
    if (!trip) throw AppError.notFound('Trip not found')
    if (trip.ownerId !== userId) throw AppError.forbidden('Only the trip owner can delete it')
    tripRepository.delete(id)
  },
}
