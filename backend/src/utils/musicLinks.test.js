import test from "node:test";
import assert from "node:assert/strict";
import { parseMusicLink, resolveMusicChanges, toMusicPreferences } from "./musicLinks.js";

const SP = "37i9dQZF1DXcBWIGoYBM5M";
const LIST = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";

test("spotify: accepts playlist/album links, canonicalizes and drops tracking", () => {
  const parsed = parseMusicLink("spotify", ` https://open.spotify.com/playlist/${SP}?si=abc123&utm_source=copy-link `);
  assert.deepEqual([parsed.ok, parsed.kind, parsed.url], [true, "playlist", `https://open.spotify.com/playlist/${SP}`]);
  assert.equal(parseMusicLink("spotify", `https://open.spotify.com/intl-de/album/${SP}`).url, `https://open.spotify.com/album/${SP}`);
});

test("spotify: rejects other hosts, schemes, paths and junk", () => {
  for (const bad of ["", "   ", "spotify:playlist:" + SP, `http://open.spotify.com/playlist/${SP}`, `https://evil.com/playlist/${SP}`,
    `https://open.spotify.com.evil.com/playlist/${SP}`, "https://open.spotify.com/user/someone", `https://open.spotify.com/playlist/${SP}/../x`,
    `https://youtube.com/playlist?list=${LIST}`, "javascript:alert(1)", "x".repeat(600), null, undefined, 42]) {
    assert.equal(parseMusicLink("spotify", bad).ok, false, `should reject: ${String(bad).slice(0, 40)}`);
  }
});

test("youtube: playlist, video, short link, embed and music.youtube.com", () => {
  assert.equal(parseMusicLink("youtube", `https://www.youtube.com/playlist?list=${LIST}&si=zzz`).url, `https://www.youtube.com/playlist?list=${LIST}`);
  assert.equal(parseMusicLink("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s").url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(parseMusicLink("youtube", "https://youtu.be/dQw4w9WgXcQ?si=x").kind, "video");
  assert.equal(parseMusicLink("youtube", "https://youtube.com/embed/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(parseMusicLink("youtube", `https://music.youtube.com/playlist?list=${LIST}`).kind, "playlist");
  const both = parseMusicLink("youtube", `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${LIST}&index=3`);
  assert.deepEqual([both.kind, both.url], ["video-in-playlist", `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=${LIST}`]);
  assert.equal(parseMusicLink("youtube", `https://www.youtube.com/embed/videoseries?list=${LIST}`).kind, "playlist");
});

test("youtube: rejects mixes, personal lists, bad ids, other hosts and paths", () => {
  const bad = ["https://www.youtube.com/watch?v=short", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ",
    "https://www.youtube.com/playlist?list=LL", "https://www.youtube.com/playlist?list=WL", "https://www.youtube.com/playlist?list=PLshort",
    "https://www.youtube.com/playlist", "https://www.youtube.com/@somechannel", "https://www.youtube.com/channel/UC123",
    "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "http://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://vimeo.com/123",
    `https://open.spotify.com/playlist/${SP}`, "https://www.youtube.com/watch?v=dQw4w9WgXcQ/extra"];
  for (const url of bad) assert.equal(parseMusicLink("youtube", url).ok, false, `should reject: ${url}`);
  assert.match(parseMusicLink("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDabc").message, /Mixes/);
});

test("an unknown provider is rejected", () => {
  assert.equal(parseMusicLink("apple", "https://music.apple.com/x").ok, false);
});

test("resolveMusicChanges: youtube save clears spotify (one playlist per account)", () => {
  const result = resolveMusicChanges({ musicProvider: "youtube", youtubeUrl: `https://www.youtube.com/playlist?list=${LIST}&si=1`, spotifyUrl: `https://open.spotify.com/playlist/${SP}` });
  assert.deepEqual(result, { ok: true, changes: { musicProvider: "youtube", spotifyUrl: "", youtubeUrl: `https://www.youtube.com/playlist?list=${LIST}` } });
});

test("resolveMusicChanges: spotify save clears youtube", () => {
  const result = resolveMusicChanges({ musicProvider: "spotify", spotifyUrl: `https://open.spotify.com/album/${SP}?si=1`, youtubeUrl: `https://www.youtube.com/playlist?list=${LIST}` });
  assert.deepEqual(result.changes, { musicProvider: "spotify", spotifyUrl: `https://open.spotify.com/album/${SP}`, youtubeUrl: "" });
});

test("resolveMusicChanges: the client cannot pair a url with the wrong provider", () => {
  assert.equal(resolveMusicChanges({ musicProvider: "spotify", spotifyUrl: `https://www.youtube.com/playlist?list=${LIST}` }).ok, false);
  assert.equal(resolveMusicChanges({ musicProvider: "youtube", youtubeUrl: `https://open.spotify.com/playlist/${SP}` }).ok, false);
  assert.equal(resolveMusicChanges({ musicProvider: "youtube", spotifyUrl: `https://open.spotify.com/playlist/${SP}` }).ok, false); // youtubeUrl missing
  assert.equal(resolveMusicChanges({ musicProvider: "tidal", spotifyUrl: "" }).ok, false);
  assert.equal(resolveMusicChanges({ musicProvider: { $ne: "" } }).ok, false); // operator-style objects are not providers
});

test("resolveMusicChanges: removing clears everything", () => {
  assert.deepEqual(resolveMusicChanges({ musicProvider: "", spotifyUrl: "ignored", youtubeUrl: "ignored" }).changes, { musicProvider: "", spotifyUrl: "", youtubeUrl: "" });
});

test("resolveMusicChanges: earlier Spotify-only clients keep working and never wipe YouTube by accident", () => {
  assert.deepEqual(resolveMusicChanges({ spotifyUrl: "", focusTheme: "sage" }), { ok: true, changes: { spotifyUrl: "" } });
  assert.deepEqual(resolveMusicChanges({ spotifyUrl: `https://open.spotify.com/playlist/${SP}` }).changes,
    { musicProvider: "spotify", spotifyUrl: `https://open.spotify.com/playlist/${SP}`, youtubeUrl: "" });
  assert.equal(resolveMusicChanges({ spotifyUrl: "https://evil.com" }).ok, false);
  assert.equal(resolveMusicChanges({}).ok, false);
  assert.equal(resolveMusicChanges({ spotifyUrl: { $gt: "" } }).ok, false);
});

test("toMusicPreferences: always a complete, consistent object", () => {
  assert.deepEqual(toMusicPreferences(undefined), { musicProvider: "", spotifyUrl: "", youtubeUrl: "" });
  assert.deepEqual(toMusicPreferences({ spotifyUrl: `https://open.spotify.com/playlist/${SP}` }).musicProvider, "spotify"); // saved before musicProvider existed
  assert.deepEqual(toMusicPreferences({ musicProvider: "youtube", youtubeUrl: "u", spotifyUrl: "old" }), { musicProvider: "youtube", spotifyUrl: "", youtubeUrl: "u" });
  assert.equal(toMusicPreferences({ musicProvider: "youtube", youtubeUrl: "" }).musicProvider, "");
  assert.equal(toMusicPreferences({ musicProvider: "bogus", spotifyUrl: "" }).musicProvider, "");
});
