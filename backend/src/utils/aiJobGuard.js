// One AI generation per trader at a time, shared by the weekly and the date-range reviews, so nobody can fan out
// several Gemini calls at once by mixing the two. In-memory is fine for one server instance (same as geminiQueue).
const busy = new Map();

export const isUserBusy = (ownerId) => busy.has(String(ownerId));
export const markUserBusy = (ownerId, key) => busy.set(String(ownerId), key);
export const releaseUser = (ownerId) => busy.delete(String(ownerId));
