const CACHE_NAME = "braindeck-shell-v8.2.0";
const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./curriculum_corpus_v8.js",
  "./curriculum_corpus_v8.json",
  "./modules/fsrs_core.js",
  "./modules/sync_crdt.js",
  "./modules/curriculum_standards.js",
  "./modules/analytics_onboarding_vm.js",
  "./modules/study_planner_mastery_core.js",
  "./modules/catalog_store_core.js",
  "./modules/standalone_engine_core.js",
  "./modules/standalone_engine_ops.js",
  "./modules/ui_dialogs_render.js",
  "./viewmodel.js",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
