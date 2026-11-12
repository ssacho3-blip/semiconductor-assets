const CACHE_NAME = "braindeck-shell-v1.1.0-b109";
const CORPUS_CACHE_NAME = "braindeck-corpus-v8-55793ba0";
const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./modules/rust_wasm_core.js",
  "./modules/fsrs_core.js",
  "./modules/sync_crdt.js",
  "./modules/curriculum_standards.js",
  "./modules/analytics_onboarding_vm.js",
  "./modules/study_planner_mastery_core.js",
  "./modules/catalog_store_core.js",
  "./modules/standalone_engine_core.js",
  "./modules/standalone_engine_ops.js",
  "./modules/ui_dialogs_render.js",
  "./modules/user_guide_and_quick_vm.js",
  "./wasm/braindeck_core.wasm",
  "./viewmodel.js",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
  "./THIRD_PARTY_NOTICES.txt"
];
// Heavy corpus bundles are cached on-demand in CORPUS_CACHE_NAME when requested via ensureCorpusBundleLoaded()
const LAZY_CORPUS_ASSETS = [
  "./curriculum_corpus_v8.json",
  "./curriculum_corpus_v8.js"
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
            if (key !== CACHE_NAME && key !== CORPUS_CACHE_NAME) {
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
  const isCorpusAsset =
    url.pathname.endsWith("/curriculum_corpus_v8.json") ||
    url.pathname.endsWith("/curriculum_corpus_v8.js");
  const targetCache = isCorpusAsset ? CORPUS_CACHE_NAME : CACHE_NAME;
  event.respondWith(
    caches.match(req).then((exactCached) => {
      const hasVersionQuery = url.searchParams.has("v");
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(targetCache).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          req.mode === "navigate" || hasVersionQuery
            ? exactCached
            : exactCached || caches.match(req, { ignoreSearch: true })
        );
      if (req.mode === "navigate" || hasVersionQuery) {
        return networkFetch;
      }
      if (exactCached) {
        return exactCached;
      }
      return caches.match(req, { ignoreSearch: true }).then((fallbackCached) => {
        return fallbackCached || networkFetch;
      });
    })
  );
});
