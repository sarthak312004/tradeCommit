import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMusicLink, spotifyEmbedUrl, getSavedMusic, detectOtherProvider, shortLink, kindLabel } from './musicLinks.js'

const SP = '37i9dQZF1DXcBWIGoYBM5M'
const LIST = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'

test('spotify links are validated, canonicalized and turned into an official embed url', () => {
  const parsed = parseMusicLink('spotify', `https://open.spotify.com/playlist/${SP}?si=tracking`)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.url, `https://open.spotify.com/playlist/${SP}`)
  assert.equal(spotifyEmbedUrl(parsed), `https://open.spotify.com/embed/playlist/${SP}?utm_source=generator`)
  assert.equal(parseMusicLink('spotify', `https://open.spotify.com/intl-fr/album/${SP}`).kind, 'album')
})

test('unsupported links are rejected with a helpful message', () => {
  for (const bad of ['', 'hello', 'http://open.spotify.com/playlist/' + SP, 'https://evil.com/playlist/' + SP, 'javascript:alert(1)', 'https://open.spotify.com/user/abc']) {
    const result = parseMusicLink('spotify', bad)
    assert.equal(result.ok, false, bad)
    assert.ok(result.message.length > 0)
  }
  assert.match(parseMusicLink('youtube', `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ`).message, /Mixes/)
  assert.equal(parseMusicLink('youtube', 'https://www.youtube.com/@channel').ok, false)
})

test('youtube playlist, video and video-in-playlist links', () => {
  assert.deepEqual(
    (({ kind, listId }) => ({ kind, listId }))(parseMusicLink('youtube', `https://youtube.com/playlist?list=${LIST}`)),
    { kind: 'playlist', listId: LIST }
  )
  assert.equal(parseMusicLink('youtube', 'https://youtu.be/dQw4w9WgXcQ?t=5').videoId, 'dQw4w9WgXcQ')
  const both = parseMusicLink('youtube', `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${LIST}`)
  assert.deepEqual([both.videoId, both.listId], ['dQw4w9WgXcQ', LIST])
})

test('getSavedMusic reads the account preference and survives bad data', () => {
  assert.equal(getSavedMusic(undefined), null)
  assert.equal(getSavedMusic({ musicProvider: '', spotifyUrl: '', youtubeUrl: '' }), null)
  const saved = getSavedMusic({ musicProvider: 'youtube', spotifyUrl: '', youtubeUrl: `https://www.youtube.com/playlist?list=${LIST}` })
  assert.equal(saved.provider, 'youtube')
  assert.equal(saved.parsed.ok, true)
  const corrupt = getSavedMusic({ musicProvider: 'spotify', spotifyUrl: 'https://example.com/nope', youtubeUrl: '' })
  assert.equal(corrupt.parsed.ok, false)
})

test('a link pasted under the wrong provider is detected', () => {
  assert.equal(detectOtherProvider('spotify', `https://www.youtube.com/playlist?list=${LIST}`), 'youtube')
  assert.equal(detectOtherProvider('youtube', `https://open.spotify.com/playlist/${SP}`), 'spotify')
  assert.equal(detectOtherProvider('spotify', 'nonsense'), null)
})

test('display helpers', () => {
  assert.equal(shortLink(`https://open.spotify.com/playlist/${SP}`), `open.spotify.com/playlist/${SP}`)
  assert.equal(shortLink('not a url'), '')
  assert.equal(kindLabel('video-in-playlist'), 'Playlist')
  assert.equal(kindLabel('???'), 'Link')
})
