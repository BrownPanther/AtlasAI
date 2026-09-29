import { getDestinationData } from '../data/sampleTravelData.js'

export function getDestinationMeta(destination) {
  const data = getDestinationData(destination)
  return {
    region: data.region,
    bestSeason: data.bestSeason,
    generalRiskLevel: data.generalRiskLevel,
    weatherNote: data.weatherNote,
    dataSource: data.dataSource,
    known: data.known,
  }
}
