export const trips = [
  { id: 't1', destination: 'Manali', from: 'New Delhi', startDate: '2026-09-20', endDate: '2026-09-25', budget: 35000, spent: 22400, status: 'upcoming' },
  { id: 't2', destination: 'Goa', from: 'Mumbai', startDate: '2026-11-10', endDate: '2026-11-14', budget: 28000, spent: 0, status: 'planned' },
]

export const flights = [
  { id: 'f1', provider: 'IndiGo', route: 'DEL → KUL', time: '06:20 AM, 20 Sep', price: 4200, status: 'Available' },
  { id: 'f2', provider: 'Air India', route: 'DEL → KUL', time: '11:45 AM, 20 Sep', price: 5100, status: 'Available' },
  { id: 'f3', provider: 'Vistara', route: 'DEL → KUL', time: '04:10 PM, 20 Sep', price: 4800, status: 'Available' },
]

export const trains = [
  { id: 'tr1', provider: 'IRCTC', route: 'New Delhi → Manali (via Chandigarh)', time: '09:00 PM, 19 Sep', price: 1450, status: 'Available' },
  { id: 'tr2', provider: 'IRCTC', route: 'New Delhi → Manali (Volvo connect)', time: '10:30 PM, 19 Sep', price: 1650, status: 'Available' },
]

export const buses = [
  { id: 'b1', provider: 'RedBus — HRTC Volvo', route: 'Delhi → Manali', time: '08:00 PM, 19 Sep', price: 1200, status: 'Available' },
  { id: 'b2', provider: 'RedBus — Zing Bus', route: 'Delhi → Manali', time: '09:15 PM, 19 Sep', price: 950, status: 'Available' },
  { id: 'b3', provider: 'FlixBus', route: 'Delhi → Manali', time: '07:30 PM, 19 Sep', price: 1100, status: 'Available' },
]

export const hotels = [
  { id: 'h1', provider: 'Grand Hyatt Manali', route: 'Old Manali', time: 'Check-in 3 PM', price: 8500, status: 'Available' },
  { id: 'h2', provider: 'Snow Valley Resorts', route: 'Manali Mall Road', time: 'Check-in 12 PM', price: 5200, status: 'Available' },
  { id: 'h3', provider: 'Zostel Manali', route: 'Old Manali', time: 'Check-in 11 AM', price: 1800, status: 'Available' },
]

export const rentals = [
  { id: 'r1', provider: 'Hertz', route: 'Royal Enfield Himalayan', time: 'Self-pickup, Manali', price: 1500, status: 'Available' },
  { id: 'r2', provider: 'Avis', route: 'Mahindra Thar 4x4', time: 'Self-pickup, Manali', price: 3200, status: 'Available' },
]

export const attractions = [
  { id: 'a1', name: 'Solang Valley', category: 'Adventure', rating: 4.6, cost: 800, destination: 'Manali' },
  { id: 'a2', name: 'Hadimba Temple', category: 'Culture', rating: 4.5, cost: 0, destination: 'Manali' },
  { id: 'a3', name: 'Rohtang Pass', category: 'Nature', rating: 4.7, cost: 1200, destination: 'Manali' },
  { id: 'a4', name: 'Old Manali Cafes', category: 'Food', rating: 4.4, cost: 500, destination: 'Manali' },
  { id: 'a5', name: 'Jogini Waterfall', category: 'Nature', rating: 4.3, cost: 0, destination: 'Manali' },
]

export const bookings = [
  { id: 'bk1', type: 'Flight', name: 'IndiGo DEL → KUL', date: '20 Sep', price: 4200, status: 'Confirmed' },
  { id: 'bk2', type: 'Hotel', name: 'Grand Hyatt Manali', date: '20–25 Sep', price: 8500, status: 'Pending' },
  { id: 'bk3', type: 'Rental', name: 'Hertz — Royal Enfield', date: '21 Sep', price: 1500, status: 'Confirmed' },
]

export const expenses = [
  { id: 'e1', category: 'Transport', label: 'Train tickets', amount: 2900, date: '19 Sep' },
  { id: 'e2', category: 'Hotel', label: 'Grand Hyatt advance', amount: 4250, date: '18 Sep' },
  { id: 'e3', category: 'Food', label: 'Cafe hopping', amount: 1200, date: '20 Sep' },
]

export const groupMembers = [
  { id: 'g1', name: 'Simrandeep', role: 'Admin', online: true },
  { id: 'g2', name: 'Aarav Mehta', role: 'Editor', online: true },
  { id: 'g3', name: 'Priya Sharma', role: 'Viewer', online: false },
]

export const chatMessages = [
  { id: 'c1', sender: 'Aarav Mehta', text: 'Should we book the Volvo bus or the train?', time: '10:02 AM' },
  { id: 'c2', sender: 'Simrandeep', text: 'Train — cheaper and scenic', time: '10:05 AM' },
]

export const generationSteps = [
  'Understanding preferences',
  'Finding transportation',
  'Comparing hotels',
  'Finding attractions',
  'Checking budget',
  'Optimizing itinerary',
]