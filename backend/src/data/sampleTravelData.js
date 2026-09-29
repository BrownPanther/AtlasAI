// All prices are in INR and are SAMPLE/DEMO data, not live provider data.
// Every record carries dataSource: 'sample' so the UI can label it honestly.
// A destination not in this table falls back to generateFallback() below,
// which is still 'sample' — never presented as live.

export const DESTINATIONS = {
  manali: {
    region: 'Himachal Pradesh, India',
    bestSeason: 'March–June, Dec–Jan (snow)',
    generalRiskLevel: 'low-moderate (mountain roads, altitude, weather)',
    weatherNote: 'Cold in winter, landslide risk in monsoon (Jul–Sep).',
    transportOptions: [
      { id: 'trn-manali-1', mode: 'bus', provider: 'HRTC Volvo', from: 'Delhi', to: 'Manali', price: 1200, durationHours: 14, departure: '18:00', arrival: '08:00' },
      { id: 'trn-manali-2', mode: 'train+cab', provider: 'Rail + shared cab', from: 'Delhi', to: 'Manali', price: 2200, durationHours: 16, departure: '17:30', arrival: '10:00' },
      { id: 'trn-manali-3', mode: 'flight', provider: 'Regional carrier', from: 'Delhi', to: 'Kullu (Bhuntar)', price: 6800, durationHours: 1.2, departure: '09:15', arrival: '10:25' },
      { id: 'trn-manali-4', mode: 'cab', provider: 'Private cab (shared)', from: 'Delhi', to: 'Manali', price: 3500, durationHours: 12, departure: 'flexible', arrival: 'flexible' },
    ],
    hotels: [
      { id: 'htl-manali-1', name: 'Riverside Homestay', area: 'Old Manali', pricePerNight: 1400, rating: 4.3, amenities: ['wifi', 'breakfast', 'mountain view'] },
      { id: 'htl-manali-2', name: 'Snowline Resort', area: 'Manali Mall Road', pricePerNight: 3200, rating: 4.5, amenities: ['wifi', 'restaurant', 'parking', 'heater'] },
      { id: 'htl-manali-3', name: 'Solang Valley Retreat', area: 'Solang', pricePerNight: 5200, rating: 4.7, amenities: ['wifi', 'spa', 'restaurant', 'valley view'] },
      { id: 'htl-manali-4', name: 'Budget Backpackers Inn', area: 'Old Manali', pricePerNight: 800, rating: 4.0, amenities: ['wifi', 'common kitchen'] },
    ],
    attractions: [
      { id: 'atr-manali-1', name: 'Rohtang Pass', area: 'Rohtang', category: 'nature', estimatedCost: 500, durationHours: 5, bestTimeOfDay: 'morning', notes: 'Permit required in season; weather-dependent.' },
      { id: 'atr-manali-2', name: 'Solang Valley', area: 'Solang', category: 'adventure', estimatedCost: 1200, durationHours: 4, bestTimeOfDay: 'morning' },
      { id: 'atr-manali-3', name: 'Hadimba Temple', area: 'Old Manali', category: 'culture', estimatedCost: 0, durationHours: 1.5, bestTimeOfDay: 'anytime' },
      { id: 'atr-manali-4', name: 'Old Manali Cafes', area: 'Old Manali', category: 'food', estimatedCost: 600, durationHours: 2, bestTimeOfDay: 'afternoon' },
      { id: 'atr-manali-5', name: 'Jogini Waterfall Trek', area: 'Vashisht', category: 'nature', estimatedCost: 0, durationHours: 3, bestTimeOfDay: 'morning' },
      { id: 'atr-manali-6', name: 'Vashisht Hot Springs', area: 'Vashisht', category: 'relaxation', estimatedCost: 100, durationHours: 1.5, bestTimeOfDay: 'evening' },
      { id: 'atr-manali-7', name: 'Mall Road Shopping', area: 'Manali Mall Road', category: 'leisure', estimatedCost: 800, durationHours: 2, bestTimeOfDay: 'evening' },
    ],
  },

  goa: {
    region: 'Goa, India',
    bestSeason: 'Nov–Feb',
    generalRiskLevel: 'low (watch water/current safety, road traffic at night)',
    weatherNote: 'Hot and humid Mar–May, monsoon Jun–Sep.',
    transportOptions: [
      { id: 'trn-goa-1', mode: 'flight', provider: 'Domestic carrier', from: 'Delhi', to: 'Goa (Dabolim)', price: 5200, durationHours: 2.5, departure: '07:00', arrival: '09:30' },
      { id: 'trn-goa-2', mode: 'train', provider: 'Konkan Railway', from: 'Mumbai', to: 'Goa', price: 900, durationHours: 11, departure: '21:00', arrival: '08:00' },
      { id: 'trn-goa-3', mode: 'bus', provider: 'Sleeper coach', from: 'Mumbai', to: 'Goa', price: 1100, durationHours: 13, departure: '20:00', arrival: '09:00' },
    ],
    hotels: [
      { id: 'htl-goa-1', name: 'Palm Grove Guesthouse', area: 'Baga', pricePerNight: 1800, rating: 4.2, amenities: ['wifi', 'pool', 'breakfast'] },
      { id: 'htl-goa-2', name: 'Candolim Beach Resort', area: 'Candolim', pricePerNight: 4200, rating: 4.6, amenities: ['wifi', 'pool', 'beach access', 'spa'] },
      { id: 'htl-goa-3', name: 'South Goa Villa', area: 'Palolem', pricePerNight: 3300, rating: 4.5, amenities: ['wifi', 'kitchen', 'quiet'] },
    ],
    attractions: [
      { id: 'atr-goa-1', name: 'Baga Beach', area: 'Baga', category: 'beach', estimatedCost: 0, durationHours: 3, bestTimeOfDay: 'morning' },
      { id: 'atr-goa-2', name: 'Fort Aguada', area: 'Candolim', category: 'history', estimatedCost: 200, durationHours: 2, bestTimeOfDay: 'afternoon' },
      { id: 'atr-goa-3', name: 'Anjuna Flea Market', area: 'Anjuna', category: 'shopping', estimatedCost: 1000, durationHours: 2.5, bestTimeOfDay: 'afternoon' },
      { id: 'atr-goa-4', name: 'Palolem Beach', area: 'Palolem', category: 'beach', estimatedCost: 0, durationHours: 3, bestTimeOfDay: 'morning' },
      { id: 'atr-goa-5', name: 'Spice Plantation Tour', area: 'Ponda', category: 'nature', estimatedCost: 700, durationHours: 3, bestTimeOfDay: 'morning' },
      { id: 'atr-goa-6', name: 'Tito\u2019s Lane Nightlife', area: 'Baga', category: 'nightlife', estimatedCost: 1500, durationHours: 3, bestTimeOfDay: 'evening' },
    ],
  },

  jaipur: {
    region: 'Rajasthan, India',
    bestSeason: 'Oct–Mar',
    generalRiskLevel: 'low (extreme heat risk Apr–Jun)',
    weatherNote: 'Very hot summers; pleasant winters.',
    transportOptions: [
      { id: 'trn-jai-1', mode: 'train', provider: 'Shatabdi Express', from: 'Delhi', to: 'Jaipur', price: 900, durationHours: 4.5, departure: '06:00', arrival: '10:30' },
      { id: 'trn-jai-2', mode: 'bus', provider: 'AC Volvo', from: 'Delhi', to: 'Jaipur', price: 700, durationHours: 5.5, departure: '07:00', arrival: '12:30' },
      { id: 'trn-jai-3', mode: 'flight', provider: 'Domestic carrier', from: 'Delhi', to: 'Jaipur', price: 3800, durationHours: 1, departure: '11:00', arrival: '12:00' },
    ],
    hotels: [
      { id: 'htl-jai-1', name: 'Pink City Haveli', area: 'Old City', pricePerNight: 1600, rating: 4.3, amenities: ['wifi', 'rooftop', 'breakfast'] },
      { id: 'htl-jai-2', name: 'Heritage Palace Hotel', area: 'Civil Lines', pricePerNight: 4800, rating: 4.7, amenities: ['wifi', 'pool', 'restaurant', 'spa'] },
      { id: 'htl-jai-3', name: 'Budget Traveller Inn', area: 'Bani Park', pricePerNight: 900, rating: 3.9, amenities: ['wifi'] },
    ],
    attractions: [
      { id: 'atr-jai-1', name: 'Amber Fort', area: 'Amer', category: 'history', estimatedCost: 500, durationHours: 3, bestTimeOfDay: 'morning' },
      { id: 'atr-jai-2', name: 'Hawa Mahal', area: 'Old City', category: 'history', estimatedCost: 200, durationHours: 1, bestTimeOfDay: 'morning' },
      { id: 'atr-jai-3', name: 'City Palace', area: 'Old City', category: 'history', estimatedCost: 300, durationHours: 2, bestTimeOfDay: 'afternoon' },
      { id: 'atr-jai-4', name: 'Johari Bazaar', area: 'Old City', category: 'shopping', estimatedCost: 1500, durationHours: 2, bestTimeOfDay: 'afternoon' },
      { id: 'atr-jai-5', name: 'Nahargarh Fort Sunset', area: 'Nahargarh', category: 'nature', estimatedCost: 200, durationHours: 2, bestTimeOfDay: 'evening' },
      { id: 'atr-jai-6', name: 'Chokhi Dhani Cultural Village', area: 'Tonk Road', category: 'culture', estimatedCost: 1200, durationHours: 3, bestTimeOfDay: 'evening' },
    ],
  },
}

const AREA_POOL = ['Old Town', 'Riverside', 'Market District', 'Hillside', 'City Center']
const CATEGORY_POOL = ['nature', 'culture', 'food', 'history', 'leisure', 'adventure']

// Deterministic-ish pseudo-random generator seeded by destination name, so the
// same unlisted destination always yields the same sample options.
function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 4294967296
  }
}

export function getDestinationData(destinationRaw) {
  const key = (destinationRaw || '').trim().toLowerCase()
  if (DESTINATIONS[key]) return { ...DESTINATIONS[key], dataSource: 'sample', known: true }
  return generateFallback(key || 'unknown destination')
}

function generateFallback(destinationKey) {
  const rand = seededRandom(destinationKey)
  const label = destinationKey.replace(/\b\w/g, (c) => c.toUpperCase())

  const transportOptions = [
    { id: `trn-${destinationKey}-bus`, mode: 'bus', provider: 'Sample Coach Co.', from: 'Origin city', to: label, price: Math.round(600 + rand() * 900), durationHours: Math.round(6 + rand() * 8), departure: '20:00', arrival: 'next morning' },
    { id: `trn-${destinationKey}-train`, mode: 'train', provider: 'Sample Rail', from: 'Origin city', to: label, price: Math.round(500 + rand() * 700), durationHours: Math.round(5 + rand() * 10), departure: '18:00', arrival: 'next morning' },
    { id: `trn-${destinationKey}-flight`, mode: 'flight', provider: 'Sample Air', from: 'Origin city', to: label, price: Math.round(3500 + rand() * 4000), durationHours: Math.round(1 + rand() * 2), departure: '09:00', arrival: 'same day' },
  ]

  const hotels = [1, 2, 3].map((n) => ({
    id: `htl-${destinationKey}-${n}`,
    name: `${label} ${['Budget Stay', 'Comfort Hotel', 'Premium Resort'][n - 1]}`,
    area: AREA_POOL[Math.floor(rand() * AREA_POOL.length)],
    pricePerNight: Math.round([900, 2200, 4500][n - 1] * (0.85 + rand() * 0.3)),
    rating: Math.round((3.8 + rand() * 1.1) * 10) / 10,
    amenities: ['wifi', n > 1 ? 'breakfast' : 'common area'],
  }))

  const attractions = Array.from({ length: 6 }).map((_, i) => ({
    id: `atr-${destinationKey}-${i + 1}`,
    name: `${label} ${['Landmark', 'Old Quarter', 'Local Market', 'Scenic Viewpoint', 'Museum', 'Riverside Walk'][i]}`,
    area: AREA_POOL[Math.floor(rand() * AREA_POOL.length)],
    category: CATEGORY_POOL[Math.floor(rand() * CATEGORY_POOL.length)],
    estimatedCost: Math.round(rand() * 800),
    durationHours: Math.round(1 + rand() * 3),
    bestTimeOfDay: ['morning', 'afternoon', 'evening'][Math.floor(rand() * 3)],
  }))

  return {
    region: 'Unlisted destination — generated sample data',
    bestSeason: 'Unknown — check local sources',
    generalRiskLevel: 'unknown — general precautions apply',
    weatherNote: 'No local weather data available for this destination yet.',
    transportOptions,
    hotels,
    attractions,
    dataSource: 'sample',
    known: false,
  }
}
