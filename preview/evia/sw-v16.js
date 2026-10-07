const TARGET = "https://ddrnfinch.github.io/nisia-app/evia/";
/* The preview copies are switched off. This replaces the old worker: it stops handling this preview, removes
   itself, and sends any open preview window to the live app. The live apps' saved files are left alone. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  await self.registration.unregister();
  const wins = await self.clients.matchAll({ type: "window" });
  wins.forEach((w) => w.navigate(TARGET).catch(() => {}));
})()));
