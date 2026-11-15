// Offline reading (public/sw.js). Not in dev, where it would serve stale builds.
if (process.env.NODE_ENV === "production") navigator.serviceWorker?.register("/sw.js").catch(() => {}); // e.g. private mode: online only, as before
