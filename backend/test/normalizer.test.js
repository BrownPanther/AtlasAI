import './support/setup.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeOpenTripMapAttraction, normalizeOpenTripMapListItem, normalizeSampleAttraction, parseOpenTripMapRate,
} from '../src/normalizers/attractionNormalizer.js'
import { details, radiusList } from './support/otmFixtures.js'

test('detail response maps real fields and never fabricates missing ones', () => {
  const a = normalizeOpenTripMapAttraction(details.N1)
  assert.equal(a.id, 'N1')
  assert.equal(a.providerId, 'N1')
  assert.equal(a.name, 'Hadimba Temple')
  assert.equal(a.category, 'culture')
  assert.equal(a.area, 'Old Manali')
  assert.equal(a.address, 'Dhungri Road, Old Manali, Manali, Himachal Pradesh, India')
  assert.deepEqual(a.coordinates, { lat: 32.25, lng: 77.18 })
  assert.equal(a.rating, 3)
  assert.equal(a.ratingScale, 'opentripmap-popularity-1-3')
  assert.equal(a.wikidataId, 'Q1')
  assert.equal(a.wikipediaUrl, 'https://en.wikipedia.org/wiki/Hidimba_Devi_Temple')
  assert.equal(a.website, 'https://example.org/hadimba')
  assert.deepEqual(a.images, ['https://upload.wikimedia.org/example/hadimba.jpg'])
  assert.equal(a.dataSource, 'live')
  assert.equal(a.provider, 'opentripmap')
  assert.ok(a.description.length <= 501 && a.description.endsWith('…'))
  // Fields OpenTripMap does not provide stay unavailable.
  assert.equal(a.estimatedCost, null)
  assert.equal(a.costKnown, false)
  assert.equal(a.durationHours, null)
  assert.equal(a.reviewCount, null)
  assert.equal(a.openingHours, null)
})

test('sparse detail response: no rating, no image, no coordinates invented', () => {
  const a = normalizeOpenTripMapAttraction(details.N5)
  assert.equal(a.rating, null)
  assert.equal(a.ratingScale, null)
  assert.deepEqual(a.images, [])
  assert.equal(a.description, '')
  assert.equal(a.address, '')
})

test('rate parsing handles strings, heritage suffix, and out-of-range values', () => {
  assert.equal(parseOpenTripMapRate('3h'), 3)
  assert.equal(parseOpenTripMapRate(2), 2)
  assert.equal(parseOpenTripMapRate('0'), null)
  assert.equal(parseOpenTripMapRate(7), null)
  assert.equal(parseOpenTripMapRate(undefined), null)
  assert.equal(parseOpenTripMapRate('abc'), null)
})

test('malformed / nameless inputs return null instead of a placeholder', () => {
  assert.equal(normalizeOpenTripMapAttraction(null), null)
  assert.equal(normalizeOpenTripMapAttraction('nope'), null)
  assert.equal(normalizeOpenTripMapAttraction({ xid: 'X', name: '' }), null)
  assert.equal(normalizeOpenTripMapListItem(radiusList[2]), null)
})

test('unsafe URLs from the provider are dropped', () => {
  const a = normalizeOpenTripMapAttraction({ ...details.N2, url: 'javascript:alert(1)', wikipedia: 'not a url', preview: { source: 'javascript:x' } })
  assert.equal(a.website, null)
  assert.equal(a.wikipediaUrl, null)
  assert.deepEqual(a.images, [])
})

test('list item normalization keeps provider fields only', () => {
  const a = normalizeOpenTripMapListItem(radiusList[1])
  assert.equal(a.name, 'Solang Valley')
  assert.equal(a.rating, 2)
  assert.equal(a.category, 'nature')
  assert.equal(a.description, '')
})

test('sample normalization stays labeled sample', () => {
  const a = normalizeSampleAttraction({ id: 'atr-1', name: 'Rohtang Pass', area: 'Rohtang', category: 'nature', estimatedCost: 500, durationHours: 5, bestTimeOfDay: 'morning' })
  assert.equal(a.dataSource, 'sample')
  assert.equal(a.provider, 'sample')
  assert.equal(a.rating, null)
})
