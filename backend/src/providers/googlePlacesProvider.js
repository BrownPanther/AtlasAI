import { env } from '../config/env.js'

export const googlePlacesProvider = {
  isConfigured() {
    return !!env.providers.googlePlacesApiKey
  },

  /**
   * Searches Google Places API (New) for a given place name and destination,
   * returning a direct media URL for its primary photo.
   *
   * Note: The Google Cloud project MUST have billing enabled, otherwise the
   * API will silently omit the `photos` array from the response.
   */
  async getPhotoForAttraction(name, destination) {
    if (!this.isConfigured()) return null

    const query = `${name}, ${destination}`
    const url = 'https://places.googleapis.com/v1/places:searchText'
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.providers.googlePlacesApiKey,
          'X-Goog-FieldMask': 'places.id,places.photos'
        },
        body: JSON.stringify({ textQuery: query })
      })
      
      const data = await res.json()
      
      if (data.places && data.places[0] && data.places[0].photos && data.places[0].photos.length > 0) {
        const photoName = data.places[0].photos[0].name
        return `https://places.googleapis.com/v1/${photoName}/media?key=${env.providers.googlePlacesApiKey}&maxHeightPx=800&maxWidthPx=800`
      }
      return null
    } catch (e) {
      console.error('[google-places] fetch error:', e)
      return null
    }
  }
}
