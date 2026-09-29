import { Router } from 'express'
import authRoutes from './auth.routes.js'
import usersRoutes from './users.routes.js'
import tripsRoutes from './trips.routes.js'
import aiRoutes from './ai.routes.js'
import groupsRoutes from './groups.routes.js'
import notificationsRoutes from './notifications.routes.js'
import bookingsRoutes from './bookings.routes.js'
import servicesRoutes from './services.routes.js'
import feedbackRoutes from './feedback.routes.js'
import supportRoutes from './support.routes.js'
import adminRoutes from './admin.routes.js'
import attractionsRoutes from './attractions.routes.js'
import routesRoutes from './routes.routes.js'
import hotelsRoutes from './hotels.routes.js'
import flightsRoutes from './flights.routes.js'
import trainsRoutes from './trains.routes.js'
import weatherRoutes from './weather.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', usersRoutes)
router.use('/trips', tripsRoutes)
router.use('/ai', aiRoutes)
router.use('/groups', groupsRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/bookings', bookingsRoutes)
router.use('/services', servicesRoutes)
router.use('/feedback', feedbackRoutes)
router.use('/support', supportRoutes)
router.use('/admin', adminRoutes)
router.use('/', attractionsRoutes)
router.use('/', routesRoutes)
router.use('/', hotelsRoutes)
router.use('/', flightsRoutes)
router.use('/', trainsRoutes)
router.use('/', weatherRoutes)

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'atlasai-backend', time: new Date().toISOString() })
})

export default router
