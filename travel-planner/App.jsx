import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PlanTrip from './pages/PlanTrip'
import Itinerary from './pages/Itinerary'
import Attractions from './pages/Attractions'
import Reservations from './pages/Reservations'
import BookingManager from './pages/BookingManager'
import Expenses from './pages/Expenses'
import GroupHub from './pages/GroupHub'
import Profile from './pages/Profile'
import Login from './pages/Login'
import JoinGroup from './pages/JoinGroup'
import Feedback from './pages/Feedback'
import Support from './pages/Support'
import ShareTrip from './pages/ShareTrip'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="plan" element={<PlanTrip />} />
        <Route path="itinerary" element={<Itinerary />} />
        <Route path="attractions" element={<Attractions />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="trips" element={<BookingManager />} />
        <Route path="bookings" element={<BookingManager />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="group" element={<GroupHub />} />
        <Route path="profile" element={<Profile />} />
        <Route path="login" element={<Login />} />
        <Route path="join/group/:token" element={<JoinGroup />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="support" element={<Support />} />
        <Route path="share/trip/:token" element={<ShareTrip />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  )
}