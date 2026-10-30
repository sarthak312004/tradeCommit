// Validation for the Deep Mode music link (account-level focus preference).
//
// Only links to the two providers' official embeddable content are accepted, and every accepted link is stored
// in a canonical form (tracking parameters such as `si=` are dropped), so nothing user-supplied beyond a
// validated ID is ever persisted or later placed in an embed URL.
//
// Keep the parsing rules in sync with frontend/src/utils/musicLinks.js.

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

/**
 * Turns the body of PUT /auth/focus-preferences into the music fields to $set. Never trusts the client to say
 * which provider a URL belongs to: the URL is validated against the provider it claims, and only the active
 * provider's link is kept (the other one is cleared), so an account has at most one saved playlist.
 *
 * Bodies without `musicProvider` come from the earlier client that only knew Spotify: they keep working.
 *
 * @returns {{ ok: true, changes: object }|{ ok: false, message: string }}
 */
export function resolveMusicChanges(body) {
  const provider = body?.musicProvider;

  if (provider === undefined) {
    const spotifyUrl = body?.spotifyUrl;
    if (typeof spotifyUrl !== "string" || spotifyUrl.length > MAX_MUSIC_URL_LENGTH) return fail("Enter a valid Spotify link");
    if (spotifyUrl.trim() === "") return { ok: true, changes: { spotifyUrl: "" } };
    const parsed = parseSpotify(spotifyUrl);
    if (!parsed.ok) return parsed;
    return { ok: true, changes: { musicProvider: "spotify", spotifyUrl: parsed.url, youtubeUrl: "" } };
  }

  if (provider === "") return { ok: true, changes: { musicProvider: "", spotifyUrl: "", youtubeUrl: "" } };
  if (!MUSIC_PROVIDERS.includes(provider)) return fail("Choose Spotify or YouTube");

  const parsed = parseMusicLink(provider, provider === "spotify" ? body?.spotifyUrl : body?.youtubeUrl);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    changes: {
      musicProvider: provider,
      spotifyUrl: provider === "spotify" ? parsed.url : "",
      youtubeUrl: provider === "youtube" ? parsed.url : ""
    }
  };
}

/** What the client receives: always a complete, consistent object (also for accounts saved before YouTube existed). */
export function toMusicPreferences(saved) {
  const spotifyUrl = typeof saved?.spotifyUrl === "string" ? saved.spotifyUrl : "";
  const youtubeUrl = typeof saved?.youtubeUrl === "string" ? saved.youtubeUrl : "";
  let musicProvider = MUSIC_PROVIDERS.includes(saved?.musicProvider) ? saved.musicProvider : "";
  if (musicProvider === "spotify" && !spotifyUrl) musicProvider = "";
  if (musicProvider === "youtube" && !youtubeUrl) musicProvider = "";
  if (!musicProvider && spotifyUrl) musicProvider = "spotify"; // saved before musicProvider existed
  return {
    musicProvider,
    spotifyUrl: musicProvider === "youtube" ? "" : spotifyUrl,
    youtubeUrl: musicProvider === "youtube" ? youtubeUrl : ""
  };
}
