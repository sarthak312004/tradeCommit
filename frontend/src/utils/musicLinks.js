// Parsing and embed helpers for the Deep Mode music link (account-level focus preference).
//
// Only links to the two providers' official embeddable content are accepted, and every accepted link is stored
// in a canonical form (tracking parameters such as `si=` are dropped), so nothing user-supplied beyond a
// validated ID is ever persisted or later placed in an embed URL.
//
// Frontend twin of backend/src/utils/musicLinks.js (the server re-validates every save). Keep the parsing rules in sync.

export const MUSIC_PROVIDERS = ["spotify", "youtube"];
export const MAX_MUSIC_URL_LENGTH = 500;

const SPOTIFY_HOSTS = new Set(["open.spotify.com", "spotify.com", "www.spotify.com"]);
const SPOTIFY_PATH = /^\/(?:intl-[a-z]{2}(?:-[A-Za-z]{2})?\/)?(playlist|album|track|episode|show)\/([A-Za-z0-9]{8,40})\/?$/;

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{12,64}$/;

const fail = (message) => ({ ok: false, message });

const toUrl = (raw) => {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > MAX_MUSIC_URL_LENGTH) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

function parseSpotify(raw) {
  const url = toUrl(raw);
  if (!url || !SPOTIFY_HOSTS.has(url.hostname)) return fail("Enter a Spotify playlist, album, track, episode, or show link");
  const match = SPOTIFY_PATH.exec(url.pathname);
  if (!match) return fail("Enter a Spotify playlist, album, track, episode, or show link");
  const [, kind, id] = match;
  return { ok: true, provider: "spotify", kind, id, url: `https://open.spotify.com/${kind}/${id}` };
}

function parseYoutube(raw) {
  const url = toUrl(raw);
  if (!url || !YOUTUBE_HOSTS.has(url.hostname)) return fail("Enter a YouTube playlist or video link");

  let videoId = null;
  const listId = url.searchParams.get("list");
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.hostname === "youtu.be") {
    videoId = segments.length === 1 ? segments[0] : null;
  } else if (segments[0] === "watch" && segments.length === 1) {
    videoId = url.searchParams.get("v");
  } else if (segments[0] === "embed" && segments.length === 2 && segments[1] !== "videoseries") {
    videoId = segments[1];
  } else if (!(segments[0] === "playlist" && segments.length === 1) && !(segments[0] === "embed" && segments[1] === "videoseries")) {
    return fail("Enter a YouTube playlist or video link");
  }

  if (videoId !== null && !VIDEO_ID.test(videoId)) return fail("That YouTube video link looks incomplete");
  if (listId !== null) {
    // Mixes (RD…), Liked videos (LL) and Watch later (WL) are personal/auto-generated and can't be embedded.
    if (/^(RD|LL|WL)/.test(listId)) return fail("YouTube Mixes, Liked videos and Watch later can't be embedded. Use a regular playlist link");
    if (!LIST_ID.test(listId)) return fail("That YouTube playlist link looks incomplete");
  }
  if (videoId === null && listId === null) return fail("Enter a YouTube playlist or video link");

  if (videoId && listId) return { ok: true, provider: "youtube", kind: "video-in-playlist", videoId, listId, url: `https://www.youtube.com/watch?v=${videoId}&list=${listId}` };
  if (listId) return { ok: true, provider: "youtube", kind: "playlist", listId, url: `https://www.youtube.com/playlist?list=${listId}` };
  return { ok: true, provider: "youtube", kind: "video", videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

/** @returns {{ ok: true, provider, kind, url }|{ ok: false, message }} `url` is the canonical form to store. */
export function parseMusicLink(provider, raw) {
  if (provider === "spotify") return parseSpotify(raw);
  if (provider === "youtube") return parseYoutube(raw);
  return fail("Choose Spotify or YouTube");
}

export const PROVIDER_LABEL = { spotify: 'Spotify', youtube: 'YouTube' }

const KIND_LABEL = { playlist: 'Playlist', album: 'Album', track: 'Track', episode: 'Episode', show: 'Show', video: 'Video', 'video-in-playlist': 'Playlist' }
export const kindLabel = (kind) => KIND_LABEL[kind] ?? 'Link'

/** Official Spotify embed (plain iframe; no OAuth, no API key). The ID was validated by parseMusicLink. */
export const spotifyEmbedUrl = (parsed) => `https://open.spotify.com/embed/${parsed.kind}/${parsed.id}?utm_source=generator`

/** `open.spotify.com/playlist/37i9…` style label for the saved-playlist card. */
export const shortLink = (url) => {
  try {
    const { hostname, pathname, search } = new URL(url)
    const text = `${hostname.replace(/^www\./, '')}${pathname}${search}`.replace(/\/$/, '')
    return text.length > 52 ? `${text.slice(0, 51)}…` : text
  } catch {
    return ''
  }
}

/** The saved playlist from the account's focus preferences, or null when none is set (or the saved value no longer parses). */
export const getSavedMusic = (preferences) => {
  const provider = preferences?.musicProvider
  if (provider !== 'spotify' && provider !== 'youtube') return null
  const url = provider === 'spotify' ? preferences.spotifyUrl : preferences.youtubeUrl
  if (typeof url !== 'string' || url === '') return null
  return { provider, url, parsed: parseMusicLink(provider, url) }
}

/** When a pasted link belongs to the other provider, tells the UI which one so it can offer to switch. */
export const detectOtherProvider = (provider, raw) => {
  const other = provider === 'spotify' ? 'youtube' : 'spotify'
  return parseMusicLink(other, raw).ok ? other : null
}
