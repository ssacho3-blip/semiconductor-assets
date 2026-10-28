/**
 * Client Controller for BrainDeck 2.0 (MVVM Binding + Web Speech TTS + Smart Recall).
 */
(function () {
  "use strict";

  const vm = window.BrainDeckViewModel || window.AnkiStudioViewModel;
  const standaloneEngine =
    vm && typeof vm.createStandaloneEngine === "function" ? vm.createStandaloneEngine() : null;
  const VAULT_STORAGE_KEY = "braindeck_offline_vault_v1";
  const PROFILE_STORAGE_KEY = "braindeck_learner_profile_v55";
  let runtimeBackendMode = null; // "SERVER_API" | "STANDALONE_STATIC"

  const _APP_MODULE_PATHS = {
    BrainDeckUiDialogsRender: "./modules/ui_dialogs_render.js",
    BrainDeckFsrsCore: "./modules/fsrs_core.js",
    BrainDeckSyncCrdt: "./modules/sync_crdt.js",
    BrainDeckCurriculumStandards: "./modules/curriculum_standards.js",
    BrainDeckAnalyticsOnboardingVm: "./modules/analytics_onboarding_vm.js",
  };
  function _getAppModule(globalName) {
    if (typeof globalThis !== "undefined" && Object.prototype.hasOwnProperty.call(globalThis, globalName)) {
      if (globalThis[globalName] === null) throw new Error("MODULE_NOT_LOADED: " + globalName);
      if (globalThis[globalName]) return globalThis[globalName];
    }
    if (typeof window !== "undefined" && window && Object.prototype.hasOwnProperty.call(window, globalName)) {
      if (window[globalName] === null) throw new Error("MODULE_NOT_LOADED: " + globalName);
      if (window[globalName]) return window[globalName];
    }
    if (typeof require === "function" && _APP_MODULE_PATHS[globalName]) {
      const path = require("path");
      const fs = require("fs");
      const candDirs = [];
      if (typeof __dirname === "string") candDirs.push(__dirname);
      candDirs.push(
        "./src/anki_studio/ui/static",
        "../src/anki_studio/ui/static",
        "/Users/choyoungseo/Documents/개발/BrainDeck/src/anki_studio/ui/static"
      );
      for (let i = 0; i < candDirs.length; i += 1) {
        const resolved = path.resolve(candDirs[i], _APP_MODULE_PATHS[globalName]);
        if (fs.existsSync(resolved)) {
          const mod = require(resolved);
          if (typeof window !== "undefined" && window) window[globalName] = mod;
          return mod;
        }
      }
    }
    throw new Error("MODULE_NOT_LOADED: " + globalName);
  }
  function resolveRuntimeBackendMode() {
    if (runtimeBackendMode) return runtimeBackendMode;
    const loc = (typeof window !== "undefined" && window.location) || {};
    const host = String(loc.hostname || "").toLowerCase();
    const proto = String(loc.protocol || "").toLowerCase();
    if (proto === "file:" || host.endsWith(".github.io") || host.endsWith(".pages.dev") || host.endsWith(".netlify.app")) {
      runtimeBackendMode = "STANDALONE_STATIC";
      return runtimeBackendMode;
    }
    return "SERVER_API";
  }
  let state = {
    decks: [],
    selectedDeckId: "",
    rawDueCards: [],
    dueCards: [],
    currentIndex: 0,
    isRevealed: false,
    hintLevel: 0,
    ageTier: "teen",
    learnerProfile:
      vm && typeof vm.normalizeLearnerProfile === "function"
        ? vm.normalizeLearnerProfile({ ageTier: "teen", solveMode: "adaptive", difficulty: "mixed", order: "interleaved" })
        : { ageTier: "teen", solveMode: "adaptive", difficulty: "mixed", order: "interleaved", summaryLabel: "" },
    cardModeOverride: "",
    currentEvidence: {
      isRevealed: false,
      hintStep: 0,
      choiceCorrect: null,
      typedVerdict: null,
      dontKnow: false,
    },
    studyFilterMode: "all", // "all" | "wrong_only" | "marked_only"
    questionTypeFilter: "all", // "all" | "vocab" | "grammar" | "hanja" | "history_sci"
    stageFilter: "all", // "all" | "lv1" | "lv2" | "lv3" | "lv4"
    deckProgress: null,
    shuffleMode: "interleaved", // "interleaved" | "sequential"
    sessionWrongCardIds: [],
    sessionWrongCardMap: {},
    markedCardIds: [],
    buriedCardIds: [],
    storePacks: [],
    selectedStoreCategory: "all",
    selectedBundlePackIds: [],
    combinedExamScopes: [],
  };

  const el = (id) => document.getElementById(id);
  const ONBOARDING_STORAGE_KEY = "braindeck_onboarding_v52";

  function switchTabPage(tabId) {
    const resolved =
      vm && typeof vm.resolveActivePageState === "function"
        ? vm.resolveActivePageState(tabId, true)
        : { activeTab: tabId || "study" };
    state.activeTab = resolved.activeTab;

    document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
      const t = btn.getAttribute("data-tab");
      if (t === state.activeTab) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    ["study", "curriculum", "create", "store", "stats"].forEach((id) => {
      const pageEl = el(`page-${id}`);
      if (pageEl) {
        if (id === state.activeTab) {
          pageEl.classList.add("active");
        } else {
          pageEl.classList.remove("active");
        }
      }
    });
  }

  function showUxToast(message, tone = "emerald", actionLabel = "", onAction = null) {
    const banner = el("ux-toast-banner");
    if (!banner) return;
    banner.textContent = "";
    banner.style.display = "flex";
    banner.style.justifyContent = "space-between";
    banner.style.alignItems = "center";
    banner.style.gap = "10px";
    banner.style.flexWrap = "wrap";
    const colorMap = {
      emerald: "var(--emerald)",
      amber: "var(--amber)",
      rose: "var(--rose)",
      accent: "var(--accent)",
    };
    const toneColor = colorMap[tone] || "var(--accent)";
    banner.style.borderColor = toneColor;
    banner.style.color = "var(--text)";

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;
    banner.appendChild(msgSpan);

    const rightBox = document.createElement("div");
    rightBox.style.cssText = "display:flex;align-items:center;gap:6px;";
    if (actionLabel && typeof onAction === "function") {
      const actBtn = document.createElement("button");
      actBtn.type = "button";
      actBtn.className = "btn-primary";
      actBtn.style.cssText = "padding:4px 10px;font-size:0.74rem;";
      actBtn.textContent = actionLabel;
      actBtn.onclick = () => {
        onAction();
      };
      rightBox.appendChild(actBtn);
    }
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.style.cssText = "padding:2px 7px;font-size:0.72rem;color:var(--muted);";
    closeBtn.textContent = "✕";
    closeBtn.onclick = () => {
      banner.style.display = "none";
    };
    rightBox.appendChild(closeBtn);
    banner.appendChild(rightBox);
  }

  function saveLocalVaultSnapshot(bundle) {
    try {
      if (bundle && typeof localStorage !== "undefined") {
        localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(bundle));
      }
      if (navigator && navigator.storage && typeof navigator.storage.persist === "function") {
        navigator.storage.persist().catch(() => {});
      }
    } catch (_) {
      // Ignore storage quota errors in private mode
    }
  }

  function loadLocalVaultSnapshot() {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(VAULT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  function enrichStandaloneCard(c) {
    const rawFront = String(c.front_text || "");
    const rawBack = String(c.back_text || "");
    const renderedQ = rawFront.replace(/\{\{c\d+::([^}:]+)(?:::([^}]+))?\}\}/g, (_m, _ans, hint) =>
      hint ? `[...(${hint})...]` : "[ ... ]"
    );
    const extracted =
      vm && typeof vm.extractTargetAndExplanation === "function"
        ? vm.extractTargetAndExplanation(rawFront, rawBack, c.target_answer, c.extra_explanation)
        : { targetAnswer: rawBack, extraExplanation: "" };
    return {
      ...c,
      rendered_question: c.rendered_question || renderedQ,
      rendered_answer: c.rendered_answer || rawBack,
      target_answer: c.target_answer || extracted.targetAnswer || rawBack,
      extra_explanation: c.extra_explanation || extracted.extraExplanation || "",
      retrievability: c.retrievability || 0.94,
      leech_status: Number(c.lapses || 0) >= 3 ? "leech" : "ok",
    };
  }

  function fallbackStandaloneGet(path) {
    if (!standaloneEngine) return null;
    if (path.startsWith("/api/status")) {
      const dash = standaloneEngine.getDashboard();
      const db = standaloneEngine.loadDb();
      const revEvents = (db.reviewHistory || []).map((r) => ({
        rating: Number(r.rating || r.raw_rating || 3),
        reviewed_at_ms: r.at ? Date.parse(r.at) : Date.now(),
        stability: Number(r.prev_stability || 1.2),
      }));
      const curveVm = _getAppModule("BrainDeckAnalyticsOnboardingVm").computeRetentionAndForgettingCurveVm(revEvents, 0.90);
      return {
        ...dash,
        stats: {
          ...dash.stats,
          true_retention_pct: curveVm.empirical_retention_pct,
          retention_display_label: curveVm.display_label,
          forgetting_curve: curveVm.forgetting_curve_points,
        },
      };
    }
    if (path.startsWith("/api/due")) {
      const qIdx = path.indexOf("?");
      const qs = qIdx >= 0 ? new URLSearchParams(path.slice(qIdx + 1)) : new URLSearchParams();
      const deckId = qs.get("deck_id") || "";
      const shuffleMode = qs.get("shuffle") || state.shuffleMode || "interleaved";
      const respectPlan = qs.get("respect_plan") === "1" || qs.get("respect_plan") === "true";
      const dueRes = standaloneEngine.getDueCards({
        deck_id: deckId,
        shuffle_mode: shuffleMode,
        respect_plan: respectPlan,
      });
      dueRes.cards = (dueRes.cards || []).map(enrichStandaloneCard);
      return dueRes;
    }
    if (path.startsWith("/api/catalog")) {
      return standaloneEngine.getCatalog();
    }
    if (path.startsWith("/api/store/packs")) {
      if (typeof standaloneEngine.getStorePacks === "function") {
        const qIdx = path.indexOf("?");
        const qs = qIdx >= 0 ? new URLSearchParams(path.slice(qIdx + 1)) : new URLSearchParams();
        return standaloneEngine.getStorePacks(qs.get("category") || "all");
      }
    }
    if (path.startsWith("/api/bundle/offline-snapshot")) {
      return {
        ok: true,
        standalone: true,
        status: fallbackStandaloneGet("/api/status"),
        due: fallbackStandaloneGet("/api/due"),
        store: fallbackStandaloneGet("/api/store/packs"),
        catalog: standaloneEngine.getCatalog(),
      };
    }
    return null;
  }

  function fallbackStandalonePost(path, payload) {
    if (!standaloneEngine) return { ok: false, offline: true };
    const p = payload || {};
    if (path.startsWith("/api/review/undo")) {
      if (typeof standaloneEngine.undoLastReview === "function") {
        return standaloneEngine.undoLastReview();
      }
      return { ok: false, standalone: true, error: "되돌리기 미지원" };
    }
    if (path.startsWith("/api/reset") || path.startsWith("/api/study/reset") || path.startsWith("/api/review/reset")) {
      if (typeof standaloneEngine.resetStudyProgress === "function") {
        return standaloneEngine.resetStudyProgress(p);
      }
      return { ok: true, standalone: true, reset_count: 0 };
    }
    if (path.startsWith("/api/review")) {
      return standaloneEngine.submitReview(p);
    }
    if (path.startsWith("/api/decks/batch-save")) {
      if (typeof standaloneEngine.batchSaveDeck === "function") {
        return standaloneEngine.batchSaveDeck(p);
      }
    }
    if (path.startsWith("/api/store/purchase-bundle")) {
      if (typeof standaloneEngine.purchaseStoreBundle === "function") {
        return standaloneEngine.purchaseStoreBundle(p);
      }
    }
    if (path.startsWith("/api/store/purchase")) {
      if (typeof standaloneEngine.purchaseStorePack === "function") {
        return standaloneEngine.purchaseStorePack(p);
      }
    }
    if (path.startsWith("/api/store/refund")) {
      if (typeof standaloneEngine.refundStorePack === "function") {
        return standaloneEngine.refundStorePack(p);
      }
    }
    if (path.startsWith("/api/catalog/exam-scope") || path.startsWith("/api/catalog/generate-exam-scope-deck")) {
      return standaloneEngine.buildExamScopeDeck(p);
    }
    if (path.startsWith("/api/catalog/collection-deck") || path.startsWith("/api/catalog/generate-collection-deck")) {
      return standaloneEngine.buildCollectionDeck(p);
    }
    if (path.startsWith("/api/catalog/combined-exam-deck") || path.startsWith("/api/catalog/generate-combined-exam-deck")) {
      return standaloneEngine.buildCombinedExamDeck(p);
    }
    if (path.startsWith("/api/ai/generate-cards") || path.startsWith("/api/cards/generate")) {
      return standaloneEngine.buildSmartTextDeck({
        text: p.raw_text,
        difficulty_level: p.difficulty_level || (state.learnerProfile && state.learnerProfile.difficulty) || "mixed",
        auto_save: p.auto_save !== false,
      });
    }
    if (path.startsWith("/api/quiz/interactive-options")) {
      const card = currentCard();
      let fullPool =
        Array.isArray(state.rawDueCards) && state.rawDueCards.length > 0
          ? state.rawDueCards.slice()
          : (state.dueCards || []).slice();
      if (fullPool.length < 30 && standaloneEngine && typeof standaloneEngine.exploreDeckCards === "function") {
        const expRes = standaloneEngine.exploreDeckCards({
          deck_id: state.selectedDeckId || (card && card.deck_id) || null,
          limit: 1500,
        });
        if (expRes && Array.isArray(expRes.cards) && expRes.cards.length > 0) {
          fullPool = expRes.cards.map(enrichStandaloneCard);
        }
      }
      if (vm && typeof vm.buildTypeMatchedQuizOptions === "function") {
        const matched = vm.buildTypeMatchedQuizOptions(card, fullPool, 4);
        return {
          ok: true,
          standalone: true,
          mode: "multiple_choice",
          question_type: matched.question_type,
          question_facet: matched.question_facet,
          question_facet_label: matched.question_facet,
          target_answer: matched.target_answer,
          options: matched.options,
          tap_blocks: matched.tap_blocks,
        };
      }
      const target = (card && (card.target_answer || card.rendered_answer)) || "정답";
      return {
        ok: true,
        standalone: true,
        mode: "multiple_choice",
        question_facet: "단어 뜻·어휘",
        target_answer: target,
        options: [target, "소개하다", "가장 좋아하는", "전통적인"].slice(0, 4),
        tap_blocks: String(target).split(/\s+/).filter(Boolean),
      };
    }
    if (path.startsWith("/api/study-plan")) {
      const shouldApply = path.startsWith("/api/study-plan/apply") || Boolean(p.apply || p.apply_plan);
      if (shouldApply && typeof standaloneEngine.applyStudyPlan === "function") {
        return standaloneEngine.applyStudyPlan(p);
      }
      if (typeof standaloneEngine.getStudyPlan === "function") {
        return standaloneEngine.getStudyPlan(p);
      }
      if (vm && typeof vm.computeAnkiStudyPlan === "function") {
        const cards = state.rawDueCards || [];
        const total = Math.max(cards.length, 1020);
        const plan = vm.computeAnkiStudyPlan({
          total_cards: total,
          new_count: total,
          target_days: Number(p.target_days || 30),
          daily_minutes_budget: Number(p.daily_minutes_budget || 30),
        });
        return { ok: true, standalone: true, plan };
      }
    }
    if (path === "/api/ai/evaluate" || path.startsWith("/api/ai/evaluate")) {
      if (typeof standaloneEngine.evaluateTypedAnswer === "function") {
        const card = currentCard();
        return standaloneEngine.evaluateTypedAnswer({
          ...p,
          card_id: p.card_id || (card && card.card_id),
          expected_answer: p.expected_answer || (card && (card.target_answer || card.rendered_answer || card.back_text)) || "",
        });
      }
    }
    if (path === "/api/ai/hint" || path.startsWith("/api/ai/hint")) {
      if (typeof standaloneEngine.generateProgressiveHint === "function") {
        const card = currentCard();
        return standaloneEngine.generateProgressiveHint({
          ...p,
          card_id: p.card_id || (card && card.card_id),
        });
      }
    }
    if (path === "/api/backlog/decompress" || path.startsWith("/api/backlog/decompress")) {
      if (typeof standaloneEngine.decompressBacklog === "function") {
        return standaloneEngine.decompressBacklog(p);
      }
    }
    if (path === "/api/ai/decompose-leech" || path.startsWith("/api/ai/decompose-leech")) {
      if (typeof standaloneEngine.decomposeLeechCard === "function") {
        return standaloneEngine.decomposeLeechCard(p);
      }
    }
    if (path === "/api/cards/suspend" || path.startsWith("/api/cards/suspend")) {
      if (typeof standaloneEngine.suspendCard === "function") {
        return standaloneEngine.suspendCard(p);
      }
    }
    if (path === "/api/cards/action" || path.startsWith("/api/cards/action")) {
      if (typeof standaloneEngine.applyCardAction === "function") {
        return standaloneEngine.applyCardAction(p);
      }
      const card = currentCard() || { card_id: p.card_id, tags: [] };
      if (vm && typeof vm.applyAnkiCardAction === "function") {
        const updated = vm.applyAnkiCardAction(card, p.action, { flag: p.flag, due_days: p.due_days });
        return { ok: true, standalone: true, card_id: p.card_id, action: p.action, card: updated };
      }
    }
    if (path === "/api/cards/add-direct" || path.startsWith("/api/cards/add-direct")) {
      if (typeof standaloneEngine.addDirectCard === "function") {
        return standaloneEngine.addDirectCard(p);
      }
    }
    if (path === "/api/cards/update" || path.startsWith("/api/cards/update")) {
      if (typeof standaloneEngine.updateCard === "function") {
        return standaloneEngine.updateCard(p);
      }
    }
    if (path === "/api/cards/delete" || path.startsWith("/api/cards/delete")) {
      if (typeof standaloneEngine.deleteCard === "function") {
        return standaloneEngine.deleteCard(p);
      }
    }
    if (path === "/api/backup/export-json" || path.startsWith("/api/backup/export-json")) {
      if (typeof standaloneEngine.exportBackupPayload === "function") {
        return standaloneEngine.exportBackupPayload(p);
      }
    }
    if (path === "/api/backup/import-json" || path.startsWith("/api/backup/import-json")) {
      if (typeof standaloneEngine.importBackupPayload === "function") {
        return standaloneEngine.importBackupPayload(p);
      }
    }
    if (path.startsWith("/api/deck/explorer")) {
      if (typeof standaloneEngine.exploreDeckCards === "function") {
        return standaloneEngine.exploreDeckCards(p);
      }
    }
    if (path.startsWith("/api/custom-study")) {
      const cards = (state.rawDueCards && state.rawDueCards.length > 0) ? state.rawDueCards : (state.dueCards || []);
      if (vm && typeof vm.buildCustomStudySession === "function") {
        const sess = vm.buildCustomStudySession(cards, p);
        return Object.assign({ ok: true, standalone: true }, sess);
      }
    }
    return { ok: false, standalone: true, error_code: "UNSUPPORTED_OFFLINE" };
  }

  async function apiGet(path) {
    if (resolveRuntimeBackendMode() === "STANDALONE_STATIC") {
      const stRes = fallbackStandaloneGet(path);
      if (stRes) return stRes;
    }
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (_) {
      const stRes = fallbackStandaloneGet(path);
      if (stRes) return stRes;
      const vault = loadLocalVaultSnapshot();
      if (!vault) return { ok: false, offline: true };
      if (path.startsWith("/api/status")) return vault.status || { ok: false };
      if (path.startsWith("/api/due")) return vault.due || { ok: true, cards: [] };
      if (path.startsWith("/api/store/packs")) return vault.store || { ok: true, packs: [] };
      if (path.startsWith("/api/catalog")) return vault.catalog || { ok: true, textbooks: [], collections: [] };
      return { ok: false, offline: true };
    }
  }

  async function apiPost(path, payload) {
    if (resolveRuntimeBackendMode() === "STANDALONE_STATIC") {
      return fallbackStandalonePost(path, payload);
    }
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // If static host returns 404/405, use standalone engine
        if (res.status === 404 || res.status === 405) {
          return fallbackStandalonePost(path, payload);
        }
      }
      return await res.json();
    } catch (_) {
      return fallbackStandalonePost(path, payload);
    }
  }

  function currentCard() {
    return state.dueCards[state.currentIndex] || null;
  }

  function clearRecommendedGlow() {
    [1, 2, 3, 4].forEach((r) => {
      const btn = el(`rate-${r}`);
      if (btn) btn.classList.remove("recommended-glow");
    });
  }

  function refreshFilterBadgeCounts() {
    const buriedSet = new Set(state.buriedCardIds.map(Number));
    const activeRaw = (state.rawDueCards || []).filter((c) => c && !buriedSet.has(Number(c.card_id)));
    if (vm && typeof vm.computeAnkiQueueCounts === "function") {
      const qCounts = vm.computeAnkiQueueCounts(activeRaw);
      const cNew = el("count-new");
      const cLearn = el("count-learn");
      const cRev = el("count-review");
      if (cNew) cNew.textContent = `새 카드 ${qCounts.newCount}`;
      if (cLearn) cLearn.textContent = `학습·오답 ${qCounts.learnCount + state.sessionWrongCardIds.length}`;
      if (cRev) cRev.textContent = `복습 ${qCounts.reviewCount}`;
    }

    const combinedPool = activeRaw.slice();
    const seenIds = new Set(combinedPool.map((c) => Number(c.card_id)));
    state.sessionWrongCardIds.forEach((cid) => {
      const snap = state.sessionWrongCardMap[cid];
      if (snap && !seenIds.has(Number(cid)) && !buriedSet.has(Number(cid))) {
        combinedPool.push(snap);
        seenIds.add(Number(cid));
      }
    });

    const wrongList =
      vm && typeof vm.filterStudyQueue === "function"
        ? vm.filterStudyQueue(combinedPool, "wrong_only", state.sessionWrongCardIds, state.markedCardIds)
        : [];
    const leechList = combinedPool.filter(
      (c) =>
        c &&
        (Number(c.lapses || 0) >= 8 ||
          c.leech_status === "leech" ||
          (Array.isArray(c.tags) && c.tags.includes("leech")))
    );
    const markedList =
      vm && typeof vm.filterStudyQueue === "function"
        ? vm.filterStudyQueue(combinedPool, "marked_only", state.sessionWrongCardIds, state.markedCardIds)
        : [];

    const btnWrong = el("btn-filter-wrong");
    if (btnWrong) btnWrong.textContent = `오답·모르는 것만 (${wrongList.length})`;
    const btnLeech = el("btn-filter-leech");
    if (btnLeech) btnLeech.textContent = `거머리 취약만 (${leechList.length})`;
    const btnMarked = el("btn-filter-marked");
    if (btnMarked) btnMarked.textContent = `중요 표시 카드만 (${markedList.length})`;

    return { activeRaw, wrongList, leechList, markedList };
  }

  function applyStudyFilter(opts) {
    const filterOpts = opts || {};
    const { activeRaw, wrongList, leechList, markedList } = refreshFilterBadgeCounts();

    let candidateQueue;
    if (state.studyFilterMode === "wrong_only") {
      candidateQueue = wrongList;
    } else if (state.studyFilterMode === "leech_only") {
      candidateQueue = leechList;
    } else if (state.studyFilterMode === "marked_only") {
      candidateQueue = markedList;
    } else {
      candidateQueue = activeRaw;
    }

    if (vm && typeof vm.computeQuestionTypeCounts === "function") {
      const tCounts = vm.computeQuestionTypeCounts(candidateQueue);
      const bAll = el("btn-qtype-all");
      const bVocab = el("btn-qtype-vocab");
      const bGram = el("btn-qtype-grammar");
      const bHanja = el("btn-qtype-hanja");
      const bHist = el("btn-qtype-history_sci");
      if (bAll) bAll.textContent = `전체 유형 (${tCounts.all})`;
      if (bVocab) bVocab.textContent = `단어·어휘만 (${tCounts.vocab})`;
      if (bGram) bGram.textContent = `문법·구문만 (${tCounts.grammar})`;
      if (bHanja) bHanja.textContent = `한자·성어만 (${tCounts.hanja})`;
      if (bHist) bHist.textContent = `역사·과학·전공 (${tCounts.history_sci})`;
    }

    if (vm && typeof vm.filterStudyQueueByQuestionType === "function" && state.questionTypeFilter !== "all") {
      candidateQueue = vm.filterStudyQueueByQuestionType(candidateQueue, state.questionTypeFilter);
    }

    if (vm && typeof vm.classifyCardStage === "function" && state.stageFilter && state.stageFilter !== "all") {
      candidateQueue = candidateQueue.filter((c) => vm.classifyCardStage(c) === state.stageFilter);
    }

    if (filterOpts.preserveSessionOrder && Array.isArray(filterOpts.previousQueue) && filterOpts.previousQueue.length > 0) {
      const byId = new Map();
      candidateQueue.forEach((c) => {
        if (c && c.card_id !== undefined) byId.set(Number(c.card_id), c);
      });
      const preserved = [];
      const seen = new Set();
      filterOpts.previousQueue.forEach((prevCard) => {
        const cid = Number(prevCard && prevCard.card_id);
        if (byId.has(cid) && !seen.has(cid)) {
          if (filterOpts.lastRating === 1 && cid === Number(filterOpts.lastRatedCardId)) {
            return; // Re-insert at deterministic +4 offset below
          }
          preserved.push(byId.get(cid));
          seen.add(cid);
        }
      });
      candidateQueue.forEach((c) => {
        const cid = Number(c && c.card_id);
        if (seen.has(cid)) return;
        if (filterOpts.lastRating === 1 && cid === Number(filterOpts.lastRatedCardId)) return;
        preserved.push(c);
        seen.add(cid);
      });
      if (filterOpts.lastRating === 1 && filterOpts.lastRatedCardId !== undefined) {
        const failedId = Number(filterOpts.lastRatedCardId);
        const failedCard = byId.get(failedId);
        if (failedCard) {
          const insertIdx = Math.min(4, preserved.length);
          preserved.splice(insertIdx, 0, failedCard);
        }
      }
      state.dueCards = preserved;
    } else if (vm && typeof vm.interleaveAndShuffleStudyQueue === "function" && state.shuffleMode !== "sequential") {
      const intraday = candidateQueue.filter((c) => c && (c.state === "learning" || c.state === "relearning"));
      const rest = candidateQueue.filter((c) => !c || (c.state !== "learning" && c.state !== "relearning"));
      state.dueCards = intraday.concat(vm.interleaveAndShuffleStudyQueue(rest, state.shuffleMode));
    } else {
      state.dueCards = candidateQueue;
    }
    // Frame 4: Sibling Burying (keep at most 1 facet per concept:<id> in a single study session)
    if (vm && typeof vm.deduplicateSessionSiblings === "function" && state.studyFilterMode !== "wrong_only") {
      state.dueCards = vm.deduplicateSessionSiblings(state.dueCards);
    }
    state.currentIndex = 0;
  }

  function renderDeckProgressDashboard(dp) {
    if (!dp) return;
    const t = dp.today || {};
    const b = dp.buckets || {};
    const m = dp.milestone || {};
    const byStage = dp.by_stage || {};
    const setTxt = (id, txt) => {
      const node = el(id);
      if (node) node.textContent = txt;
    };
    const setWidth = (id, pct) => {
      const node = el(id);
      if (node) node.style.width = `${pct}%`;
    };
    const overTxt = Number(t.over_target_count || 0) > 0 ? ` (+${t.over_target_count}장 초과달성)` : "";
    const todayPctClamp = Math.min(100, Math.max(0, Number(t.percent || 0)));
    setTxt("bd-today-progress-label", `오늘 목표 진척률: ${t.completed_count || 0} / ${t.target_count || 0}장 완료 (${Number(t.percent || 0).toFixed(1)}%)${overTxt}`);
    setTxt("bd-today-eta-label", Number(t.remaining_count || 0) > 0 ? `남은 ${t.remaining_count}장 · 약 ${t.estimated_remaining_minutes || 0}분` : "오늘 목표 100% 달성");
    setWidth("bd-today-progress-fill", todayPctClamp);
    setTxt("bd-deck-coverage-label", `전체 덱 진도율 (1회 이상 학습): ${Number(dp.coverage_pct || 0).toFixed(1)}% (${dp.touched_cards || 0} / ${dp.total_cards || 0}장)`);
    setTxt("bd-deck-mastery-label", `FSRS 가중 숙련도: ${Number(dp.mastery_pct || 0).toFixed(1)}% · 장기마스터 ${Number(dp.mature_pct || 0).toFixed(1)}%`);
    setTxt("bd-deck-milestone-label", Number(m.cards_to_next || 0) > 0 ? `다음 마일스톤(${m.next_pct || 10}%): ${m.cards_to_next}장 남음 (약 ${m.days_to_next || 1}일) · 전수 완주 D-${dp.eta_full_coverage_days || 0}` : "전체 덱 100% 마일스톤 달성");

    const activeTotal = Math.max(1, Number(dp.active_cards || dp.total_cards || 1));
    const matureW = ((Number(b.mature || 0) / activeTotal) * 100).toFixed(2);
    const youngW = ((Number(b.young || 0) / activeTotal) * 100).toFixed(2);
    const learnW = ((Number(b.learning || 0) / activeTotal) * 100).toFixed(2);
    const unseenW = Math.max(0, 100 - Number(matureW) - Number(youngW) - Number(learnW)).toFixed(2);
    setWidth("bd-bar-mature", matureW);
    setWidth("bd-bar-young", youngW);
    setWidth("bd-bar-learning", learnW);
    setWidth("bd-bar-unseen", unseenW);
    setTxt("bd-cnt-unseen", String(b.unseen || 0));
    setTxt("bd-cnt-learning", String(b.learning || 0));
    setTxt("bd-cnt-young", String(b.young || 0));
    setTxt("bd-cnt-mature", String(b.mature || 0));

    ["lv1", "lv2", "lv3", "lv4"].forEach((stKey) => {
      const st = byStage[stKey];
      if (st) setTxt(`btn-stage-${stKey}`, `${st.label || stKey} (${Number(st.coverage_pct || 0).toFixed(0)}% · ${st.touched || 0}/${st.total || 0})`);
    });

    const inlineBoxEl = el("card-inline-progress-box");
    if (inlineBoxEl) inlineBoxEl.style.display = "block";
    setTxt("card-inline-today-pct", `오늘 진척률: ${Number(t.percent || 0).toFixed(1)}% (${t.completed_count || 0}/${t.target_count || 0}장 완료)`);
    setTxt("card-inline-deck-pct", `전체 덱 진도율: ${Number(dp.coverage_pct || 0).toFixed(1)}% (${dp.touched_cards || 0}/${dp.total_cards || 0}장) · 숙련도 ${Number(dp.mastery_pct || 0).toFixed(1)}%`);
    setWidth("card-inline-today-fill", todayPctClamp);
  }

  async function renderDeckExplorerPanel() {
    const panel = el("deck-card-explorer-panel");
    if (!panel || panel.style.display === "none") return;
    return _getAppModule("BrainDeckUiDialogsRender").renderDeckExplorerPanelDom({
      el,
      state,
      apiPost,
      enrichStandaloneCard,
      renderCurrentCard,
      showUxToast,
    });
  }
  function applyEvidenceRatingGuard() {
    const ratingBox = el("rating-grid-box");
    const guardBanner = el("rating-guard-banner");
    if (!state.isRevealed) {
      if (ratingBox) ratingBox.style.display = "none";
      if (guardBanner) guardBanner.style.display = "none";
      return;
    }
    const guard =
      vm && typeof vm.resolveAllowedRatings === "function"
        ? vm.resolveAllowedRatings(state.currentEvidence, state.ageTier)
        : { allowedRatings: [1, 2, 3, 4], recommendedRating: 3, bannerText: "" };

    if (ratingBox) ratingBox.style.display = "grid";
    if (guardBanner) {
      guardBanner.textContent = guard.bannerText || "";
      guardBanner.style.display = guard.bannerText ? "block" : "none";
    }
    clearRecommendedGlow();
    [1, 2, 3, 4].forEach((r) => {
      const btn = el(`rate-${r}`);
      if (!btn) return;
      if (state.ageTier === "junior" && r === 4) {
        btn.style.display = "none";
        return;
      }
      btn.style.display = "flex";
      const isAllowed = (guard.allowedRatings || []).includes(r);
      btn.disabled = !isAllowed;
      btn.style.opacity = isAllowed ? "1" : "0.28";
      btn.style.pointerEvents = isAllowed ? "auto" : "none";
      if (Number(guard.recommendedRating) === r && isAllowed) {
        btn.classList.add("recommended-glow");
      }
    });
  }

  function renderCurrentCard() {
    const card = currentCard();
    state.isRevealed = false;
    state.hintLevel = 0;
    state.cardShownAtMs = Date.now();
    state.currentEvidence = {
      isRevealed: false,
      hintStep: 0,
      choiceCorrect: null,
      typedVerdict: null,
      dontKnow: false,
    };
    clearRecommendedGlow();
    applyEvidenceRatingGuard();

    const btnReveal = el("btn-reveal");
    if (btnReveal) {
      btnReveal.textContent = "정답 보기";
    }
    el("card-answer").style.display = "none";
    const extraEl = el("card-extra-explanation");
    if (extraEl) {
      extraEl.style.display = "none";
      extraEl.textContent = "";
    }
    el("hint-box").style.display = "none";
    el("eval-box").style.display = "none";
    const btnOverride = el("btn-override-correct");
    if (btnOverride) btnOverride.style.display = "none";
    const quizBox = el("interactive-quiz-box");
    if (quizBox) quizBox.style.display = "none";
    const retryBox = el("post-session-retry-box");
    if (retryBox) retryBox.style.display = "none";
    el("recall-input").value = "";

    if (!card) {
      const dp = state.deckProgress;
      const dpSummary = dp
        ? ` (오늘 ${dp.today ? dp.today.completed_count : 0}/${dp.today ? dp.today.target_count : 0}장 완료 · 전체 덱 진도 ${Number(dp.coverage_pct || 0).toFixed(1)}% · 숙련도 ${Number(dp.mastery_pct || 0).toFixed(1)}%)`
        : "";
      el("card-meta").textContent = `복습 완료${dpSummary}`;
      const sprintBadgeEl = el("sprint-progress-badge");
      if (sprintBadgeEl) sprintBadgeEl.textContent = "오늘 목표 스프린트 완료";
      el("card-fsrs-meta").textContent = "Due: 0";
      el("card-question").textContent =
        state.studyFilterMode === "wrong_only"
          ? "오답·모르는 카드를 모두 복습했습니다!"
          : `오늘 배정된 학습 목표 카드를 모두 완료했습니다!${dpSummary}`;
      el("leech-banner").style.display = "none";
      const typingZone = el("typing-solve-zone");
      if (typingZone) typingZone.style.display = "none";
      if (retryBox && state.sessionWrongCardIds.length > 0 && state.studyFilterMode !== "wrong_only") {
        const sumEl = el("post-session-summary");
        if (sumEl) {
          sumEl.textContent = `방금 학습 중 헷갈렸거나 몰랐던 카드가 ${state.sessionWrongCardIds.length}장 있습니다.`;
        }
        retryBox.style.display = "block";
      }
      return;
    }

    const isMarked = state.markedCardIds.includes(Number(card.card_id));
    const btnMark = el("btn-mark-card");
    if (btnMark) {
      btnMark.textContent = isMarked ? "★ 중요됨" : "☆ 중요";
      btnMark.style.color = isMarked ? "var(--amber)" : "var(--muted)";
    }

    const qTypeObj =
      vm && typeof vm.classifyCardQuestionType === "function"
        ? vm.classifyCardQuestionType(card)
        : { badge_label: card.note_type === "cloze" ? "빈칸 추론" : "핵심 인출", short_label: "개념" };
    const qtypeBadgeEl = el("card-qtype-badge");
    if (qtypeBadgeEl) {
      qtypeBadgeEl.textContent = qTypeObj.badge_label;
    }

    const isUnfilteredSession =
      state.studyFilterMode === "all" &&
      (!state.stageFilter || state.stageFilter === "all") &&
      state.questionTypeFilter === "all" &&
      !state.isCramSandbox;
    const dp = state.deckProgress;
    const todayProg = dp && dp.today ? dp.today : null;
    const effectivePosZeroBased =
      isUnfilteredSession && todayProg
        ? Number(todayProg.completed_count || 0) + state.currentIndex
        : state.currentIndex;
    const effectiveTotal =
      isUnfilteredSession && todayProg
        ? Math.max(effectivePosZeroBased + 1, Number(todayProg.target_count || state.dueCards.length || 1))
        : Math.max(1, state.dueCards.length);

    const sprintBadgeEl = el("sprint-progress-badge");
    if (sprintBadgeEl) {
      const curSprintIdx = Math.floor(effectivePosZeroBased / 7) + 1;
      const totalSprints = Math.max(1, Math.ceil(effectiveTotal / 7));
      const inSprintPos = (effectivePosZeroBased % 7) + 1;
      const curSprintLen =
        curSprintIdx < totalSprints ? 7 : Math.max(inSprintPos, effectiveTotal - (totalSprints - 1) * 7);
      sprintBadgeEl.textContent = `스프린트 ${curSprintIdx}/${totalSprints} (${inSprintPos}/${curSprintLen})`;
    }
    const typeLabel = card.note_type === "cloze" ? "빈칸 추론" : "핵심 인출";
    if (isUnfilteredSession && dp && todayProg) {
      const ord = effectivePosZeroBased + 1;
      const todayPct = Number(todayProg.percent || 0).toFixed(1);
      const covPct = Number(dp.coverage_pct || 0).toFixed(1);
      el("card-meta").textContent =
        `${card.deck_name} · 오늘 ${ord}/${effectiveTotal}번째 (${todayPct}% 완료) · 전체 진도 ${covPct}% (${dp.touched_cards}/${dp.total_cards}장) · ${typeLabel}`;
      const inlineTodayEl = el("card-inline-today-pct");
      if (inlineTodayEl) {
        inlineTodayEl.textContent = `오늘 진척률: ${todayPct}% (${todayProg.completed_count || 0}/${effectiveTotal}장 완료 · 현재 ${ord}번째)`;
      }
      const inlineDeckEl = el("card-inline-deck-pct");
      if (inlineDeckEl) {
        inlineDeckEl.textContent = `전체 덱 진도율: ${covPct}% (${dp.touched_cards || 0}/${dp.total_cards || 0}장) · 숙련도 ${Number(dp.mastery_pct || 0).toFixed(1)}%`;
      }
      const inlineFillEl = el("card-inline-today-fill");
      if (inlineFillEl) {
        inlineFillEl.style.width = `${Math.min(100, Math.max(0, Number(todayProg.percent || 0)))}%`;
      }
    } else {
      el("card-meta").textContent = `${card.deck_name} · #${state.currentIndex + 1}/${state.dueCards.length} · ${typeLabel}`;
    }
    const rPct = ((Number(card.retrievability) || 1) * 100).toFixed(1);
    el("card-fsrs-meta").textContent = `S: ${Number(card.stability).toFixed(1)}d · D: ${Number(card.difficulty).toFixed(1)} · R: ${rPct}%`;
    el("card-question").textContent = card.rendered_question || card.front_text || "";
    const svgBox = el("card-svg-diagram");
    if (svgBox) {
      svgBox.style.display = "none";
      svgBox.replaceChildren();
      if (card.svg_diagram && String(card.svg_diagram).includes("<svg") && typeof DOMParser !== "undefined") {
        const parsedSvg = new DOMParser().parseFromString(String(card.svg_diagram), "image/svg+xml").documentElement;
        if (parsedSvg && parsedSvg.tagName && parsedSvg.tagName.toLowerCase() === "svg") {
          parsedSvg.querySelectorAll("script,foreignObject").forEach((n) => n.remove());
          [parsedSvg, ...parsedSvg.querySelectorAll("*")].forEach((node) => {
            Array.from(node.attributes || []).forEach((attr) => {
              if (String(attr.name || "").toLowerCase().startsWith("on")) {
                node.removeAttribute(attr.name);
              }
            });
          });
          svgBox.replaceChildren(document.importNode(parsedSvg, true));
        }
      }
    }

    const extracted =
      vm && typeof vm.extractTargetAndExplanation === "function"
        ? vm.extractTargetAndExplanation(
            card.front_text,
            card.back_text,
            card.target_answer,
            card.extra_explanation
          )
        : {
            targetAnswer: card.target_answer || card.rendered_answer,
            extraExplanation: card.extra_explanation || "",
          };
    el("card-answer").textContent = `정답: ${extracted.targetAnswer || card.rendered_answer}`;
    if (extraEl) {
      const fullAns = String(card.rendered_answer || "").trim();
      const extraText = extracted.extraExplanation || (fullAns !== extracted.targetAnswer ? fullAns : "");
      extraEl.textContent = extraText ? `해설 및 전체 문장:\n${extraText}` : "";
    }

    const leech = vm.formatLeechBadge(card.leech_status, card.lapses);
    const btnDecompose = el("btn-decompose");
    if (leech.visible) {
      el("leech-banner").textContent = leech.label;
      el("leech-banner").style.display = "block";
      if (btnDecompose) btnDecompose.style.display = "inline-block";
    } else {
      el("leech-banner").style.display = "none";
      if (btnDecompose) btnDecompose.style.display = "none";
    }

    const p = card.button_previews || {};
    const cState = String(card.state || "new").toLowerCase();
    const isGraduatedReview = cState === "review" && Number(card.reps || 0) >= 2;
    const schedDays = Math.max(1, Number(card.scheduled_days || card.stability || 1));
    el("preview-1").textContent = (p.again && p.again.label) || (isGraduatedReview ? "10분" : "<1분");
    el("preview-2").textContent = (p.hard && p.hard.label) || (isGraduatedReview ? `${Math.max(1, Math.round(schedDays * 1.2))}일` : "6분");
    el("preview-3").textContent =
      (p.good && p.good.label) ||
      (isGraduatedReview ? `${Math.max(2, Math.round(schedDays * 2.5))}일` : Number(card.reps || 0) === 0 ? "10분" : "1일");
    el("preview-4").textContent =
      (p.easy && p.easy.label) ||
      (isGraduatedReview ? `${Math.max(4, Math.round(schedDays * 3.8))}일` : "4일");

    // Frame 2: 1-Card 1-Mode Active Solve Mode Resolution
    const activeSolveMode =
      state.cardModeOverride ||
      (vm && typeof vm.resolveCardSolveMode === "function"
        ? vm.resolveCardSolveMode(card, state.learnerProfile)
        : state.ageTier === "junior"
        ? "choice"
        : "typing");

    const modeBadge = el("solve-mode-badge");
    const typingZone = el("typing-solve-zone");
    if (activeSolveMode === "choice") {
      if (modeBadge) modeBadge.textContent = "4지선다 모드";
      if (typingZone) typingZone.style.display = "none";
      requestInteractiveQuiz("multiple_choice");
    } else if (activeSolveMode === "typing") {
      if (modeBadge) modeBadge.textContent = "서술형 인출 모드";
      if (typingZone) typingZone.style.display = "flex";
      if (quizBox) quizBox.style.display = "none";
    } else {
      if (modeBadge) modeBadge.textContent = "카드 뒤집기 모드";
      if (typingZone) typingZone.style.display = "none";
      if (quizBox) quizBox.style.display = "none";
    }
  }

  async function renderStudyPlanBanner(planRes) {
    return _getAppModule("BrainDeckUiDialogsRender").renderStudyPlanBannerDom(
      { el, state, renderDeckProgressDashboard },
      planRes
    );
  }
  async function refreshDashboardAndQueue(opts) {
    const refreshOpts = opts || {};
    const status = await apiGet("/api/status");
    if (status && status.ok) {
      if (!state.autoEnsuredFullScaleDeck) {
        state.autoEnsuredFullScaleDeck = true;
        const decksList = status.decks || [];
        const fullDeck = decksList.find((d) => Number(d.total_cards || 0) >= 100);
        if (!fullDeck) {
          const autoRes = await apiPost("/api/catalog/generate-collection-deck", {
            collection_id: "hanja-grade:8geup",
            limit: 1000,
            deck_name: "기초 한자 8급·초등 스타터",
            difficulty_level: "mixed",
            shuffle_mode: "interleaved",
          }).catch(() => null);
          if (autoRes && autoRes.ok && autoRes.deck_id) {
            state.selectedDeckId = String(autoRes.deck_id);
            return refreshDashboardAndQueue(refreshOpts);
          }
        } else if (!state.selectedDeckId && decksList.some((d) => Number(d.total_cards || 0) < 50)) {
          state.selectedDeckId = String(fullDeck.deck_id);
        }
      }
      const s = status.stats;
      el("stat-due").textContent = `${s.due_now}장`;
      el("stat-total").textContent = `${s.total_cards}장 / 오늘 ${s.reviews_today}회`;
      const badge = vm.formatRetentionBadge(s.true_retention_pct);
      el("stat-retention").textContent = badge.label;
      el("stat-stability").textContent = `${s.avg_stability_days}일 · 집중복습 ${s.leech_cards}건`;

      const points = vm.buildForgettingCurveSvgPoints(s.forgetting_curve, 480, 120);
      el("curve-polyline").setAttribute("points", points);

      state.decks = status.decks || [];
      const sel = el("deck-select");
      const prevVal = state.selectedDeckId;
      sel.textContent = "";
      const optAll = document.createElement("option");
      optAll.value = "";
      optAll.textContent = `전체 덱 (${s.due_now}장 대기 / 총 ${s.total_cards}장)`;
      sel.appendChild(optAll);
      state.decks.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = String(d.deck_id);
        const covPct = d.coverage_pct !== undefined ? Number(d.coverage_pct).toFixed(1) : "0.0";
        const mastPct = d.mastery_pct !== undefined ? Number(d.mastery_pct).toFixed(1) : "0.0";
        const remToday = d.remaining_new_today !== undefined ? d.remaining_new_today : d.due_cards;
        opt.textContent = `${d.name} [진도 ${covPct}% · 마스터 ${mastPct}% · 오늘 ${remToday}장 / 총 ${d.total_cards}장]`;
        sel.appendChild(opt);
      });
      sel.value = prevVal;
    }

    const daysSel = el("bd-plan-days");
    const minsSel = el("bd-plan-minutes");
    const newSel = el("bd-plan-daily-new");
    const targetDays = Number((daysSel && daysSel.value) || (state.currentDailyQuota && state.currentDailyQuota.target_days) || 30);
    const dailyMinutes = Number((minsSel && minsSel.value) || 30);
    const customNew = newSel && newSel.value && newSel.value !== "auto" ? Number(newSel.value) : null;
    const planRes = await apiPost("/api/study-plan", {
      deck_id: state.selectedDeckId || null,
      target_days: targetDays,
      daily_minutes_budget: dailyMinutes,
      new_per_day: customNew,
    });

    const params = new URLSearchParams();
    if (state.selectedDeckId) params.set("deck_id", state.selectedDeckId);
    if (state.shuffleMode) params.set("shuffle", state.shuffleMode);
    params.set("respect_plan", "1");
    const q = params.toString() ? `?${params.toString()}` : "";
    const dueRes = await apiGet(`/api/due${q}`);
    state.rawDueCards = (dueRes && dueRes.cards) || [];
    state.currentDailyQuota = (dueRes && dueRes.daily_quota) || (planRes && planRes.daily_quota) || null;
    if (dueRes && dueRes.deck_progress) {
      state.deckProgress = dueRes.deck_progress;
      renderDeckProgressDashboard(state.deckProgress);
    } else if (planRes && planRes.deck_progress) {
      state.deckProgress = planRes.deck_progress;
      renderDeckProgressDashboard(state.deckProgress);
    } else if (vm && typeof vm.computeDeckMasteryProgress === "function") {
      state.deckProgress = vm.computeDeckMasteryProgress(state.rawDueCards, state.currentDailyQuota || {});
      renderDeckProgressDashboard(state.deckProgress);
    }
    applyStudyFilter(refreshOpts);
    renderCurrentCard();
    await renderDeckExplorerPanel();
    if (planRes && planRes.ok) {
      await renderStudyPlanBanner(planRes);
    }
  }

  function revealAnswer() {
    const card = currentCard();
    if (!card) return;
    state.isRevealed = true;
    state.currentEvidence.isRevealed = true;
    if (card.note_type === "cloze" && card.front_text) {
      const revealedCloze = String(card.front_text).replace(
        /\{\{c\d+::([^:}]+)(?:::[^}]*)?\}\}/g,
        "【$1】"
      );
      el("card-question").textContent = revealedCloze;
    }
    el("card-answer").style.display = "block";
    const svgBox = el("card-svg-diagram");
    if (svgBox && svgBox.childElementCount > 0) {
      svgBox.style.display = "block";
    }
    const extraEl = el("card-extra-explanation");
    if (extraEl && extraEl.textContent) {
      extraEl.style.display = "block";
    }
    const btnReveal = el("btn-reveal");
    if (btnReveal) {
      btnReveal.textContent = "정답 확인됨 (아래 1~4 평가)";
    }
    applyEvidenceRatingGuard();
  }

  async function undoLastReview() {
    const res = await apiPost("/api/review/undo", {});
    if (res && res.ok) {
      const cid = res.undone_card_id ?? res.restored_card_id ?? "";
      showUxToast(
        `복습 취소 완료: 카드 #${cid}가 이전 기억 상태(S=${Number(res.restored_stability || 0).toFixed(1)}d)로 복원되었습니다.`,
        "emerald"
      );
      await refreshDashboardAndQueue();
    } else if (vm && typeof vm.formatApiErrorBanner === "function") {
      const errVm = vm.formatApiErrorBanner(res);
      showUxToast(`${errVm.title} — ${errVm.message}`, errVm.tone);
    }
  }

  async function resetStudyProgress() {
    const deckIdParam = state.selectedDeckId ? Number(state.selectedDeckId) || state.selectedDeckId : null;
    const res = await apiPost("/api/reset", { deck_id: deckIdParam });
    if (!res || !res.ok) {
      const errMsg = (res && (res.detail || res.error)) || "초기화 요청을 처리할 수 없습니다.";
      showUxToast(`학습 초기화 실패: ${errMsg}`, "rose");
      return;
    }
    if (!res.standalone && standaloneEngine && typeof standaloneEngine.resetStudyProgress === "function") {
      standaloneEngine.resetStudyProgress({ deck_id: deckIdParam });
    }
    state.sessionWrongCardIds = [];
    state.sessionWrongCardMap = {};
    state.buriedCardIds = [];
    state.markedCardIds = [];
    state.studyFilterMode = "all";
    state.questionTypeFilter = "all";
    state.stageFilter = "all";
    state.currentIndex = 0;
    state.isRevealed = false;
    document.querySelectorAll(".study-filter-btn").forEach((b) => {
      if (b.getAttribute("data-filter") === "all") b.classList.add("btn-primary");
      else b.classList.remove("btn-primary");
    });
    document.querySelectorAll(".study-qtype-btn").forEach((b) => {
      if (b.getAttribute("data-qtype") === "all") b.classList.add("btn-primary");
      else b.classList.remove("btn-primary");
    });
    document.querySelectorAll(".bd-stage-btn").forEach((b) => {
      if (b.getAttribute("data-stage") === "all") b.classList.add("btn-primary");
      else b.classList.remove("btn-primary");
    });
    await refreshDashboardAndQueue();
    const count = Number(res.reset_count ?? res.reset_cards ?? 0);
    showUxToast(
      `학습 초기화 완료: ${count}장의 카드가 초기 상태(새 카드 1번)로 복원되었습니다.`,
      "emerald"
    );
  }

  async function submitRating(rating) {
    const card = currentCard();
    if (!card) return;
    if (!state.isRevealed) {
      showUxToast("정답을 먼저 확인한 뒤 난이도를 평가해 주세요.", "amber");
      return;
    }
    const guard =
      vm && typeof vm.resolveAllowedRatings === "function"
        ? vm.resolveAllowedRatings(state.currentEvidence, state.ageTier)
        : { allowedRatings: [1, 2, 3, 4], recommendedRating: 3 };
    let safeRating = Number(rating);
    if (Array.isArray(guard.allowedRatings) && guard.allowedRatings.length > 0 && !guard.allowedRatings.includes(safeRating)) {
      safeRating = Number(guard.recommendedRating || guard.allowedRatings[guard.allowedRatings.length - 1] || 1);
    }

    const cid = Number(card.card_id);
    const previousQueueSnapshot = Array.isArray(state.dueCards) ? state.dueCards.slice() : [];
    if (safeRating <= 2) {
      if (!state.sessionWrongCardIds.includes(cid)) {
        state.sessionWrongCardIds.push(cid);
      }
      state.sessionWrongCardMap[cid] = { ...card };
    } else if (state.studyFilterMode === "wrong_only") {
      // Mastered in wrong_only cram mode -> remove from wrong list
      state.sessionWrongCardIds = state.sessionWrongCardIds.filter((id) => id !== cid);
      delete state.sessionWrongCardMap[cid];
    }

    const rtMs = state.cardShownAtMs ? Math.max(0, Date.now() - state.cardShownAtMs) : null;
    const res = state.isCramSandbox
      ? { ok: true, standalone: true, card_id: card.card_id, rating: safeRating, scheduled_label: "CRAM 무오염 (FSRS 유지)", memory: { stability: card.stability } }
      : await apiPost("/api/review", {
          card_id: card.card_id,
          rating: safeRating,
          response_time_ms: rtMs,
        });
    if (res && res.ok) {
      const stab = (res.memory && res.memory.stability) ?? res.stability ?? card.stability ?? 0;
      const nextLbl = state.isCramSandbox
        ? "CRAM 샌드박스 (장기기억 S 보존)"
        : res.scheduled_label || `${Number(res.scheduled_days || 0).toFixed(1)}d`;
      showUxToast(
        `평가 반영 완료 (S: ${Number(stab).toFixed(1)}d · ${nextLbl})`,
        "emerald",
        state.isCramSandbox ? "" : "방금 평가 취소 (Z)",
        state.isCramSandbox ? null : () => undoLastReview()
      );
    }
    if (state.isCramSandbox) {
      state.currentIndex = (state.currentIndex + 1) % Math.max(1, state.dueCards.length);
      renderCurrentCard();
    } else {
      await refreshDashboardAndQueue({
        preserveSessionOrder: true,
        previousQueue: previousQueueSnapshot,
        lastRatedCardId: cid,
        lastRating: safeRating,
      });
    }
  }

  async function requestInteractiveQuiz(forcedSubmode = "") {
    const card = currentCard();
    const quizBox = el("interactive-quiz-box");
    if (!card || !quizBox) return;
    const res = await apiPost("/api/quiz/interactive-options", {
      card_id: card.card_id,
      age_tier: state.ageTier || "teen",
    });
    if (!res || !res.ok) return;

    const activeSubmode = forcedSubmode || (res.mode === "tap_block" ? "tap_block" : "multiple_choice");
    quizBox.textContent = "";
    quizBox.style.display = "block";

    const topBar = document.createElement("div");
    topBar.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;";

    const header = document.createElement("div");
    header.style.cssText = "font-weight:700;color:var(--accent);";
    const facetBadge = res.question_facet_label || (res.question_type && res.question_type.badge_label) || res.question_facet || "동종 유형 보기";
    header.textContent =
      activeSubmode === "multiple_choice"
        ? `🎯 [1단계: 4지선다 객관식 · ${facetBadge} 전용 보기] 알맞은 정답을 선택하세요:`
        : `🧩 [2단계: 순서 배열 탭 블록 조립] 아래 구문 조각을 순서대로 눌러 정답을 완성하세요:`;
    topBar.appendChild(header);

    const switchRow = document.createElement("div");
    switchRow.style.cssText = "display:flex;gap:6px;";
    const btnMc = document.createElement("button");
    btnMc.type = "button";
    btnMc.className = activeSubmode === "multiple_choice" ? "btn-primary" : "";
    btnMc.style.cssText = "padding:4px 9px;font-size:0.74rem;";
    btnMc.textContent = "🎯 1단계: 4지선다";
    btnMc.onclick = () => requestInteractiveQuiz("multiple_choice");

    const btnTb = document.createElement("button");
    btnTb.type = "button";
    btnTb.className = activeSubmode === "tap_block" ? "btn-primary" : "";
    btnTb.style.cssText = "padding:4px 9px;font-size:0.74rem;";
    btnTb.textContent = "🧩 2단계: 탭 블록 조립";
    btnTb.onclick = () => requestInteractiveQuiz("tap_block");

    switchRow.appendChild(btnMc);
    switchRow.appendChild(btnTb);
    topBar.appendChild(switchRow);
    quizBox.appendChild(topBar);

    if (activeSubmode === "multiple_choice") {
      const grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;";

      const rawOptions = Array.isArray(res.options) ? res.options.slice() : [];
      const optionButtons = [];
      rawOptions.forEach((optText, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText = "text-align:left;padding:10px 12px;font-size:0.84rem;";
        btn.textContent = `${idx + 1}. ${optText}`;
        optionButtons.push({ btn, optText, idx });
        btn.addEventListener("click", () => {
          const isCorrect = optText === res.target_answer;
          state.currentEvidence.choiceCorrect = isCorrect;
          if (!isCorrect) {
            const cid = Number(card.card_id);
            if (!state.sessionWrongCardIds.includes(cid)) state.sessionWrongCardIds.push(cid);
            state.sessionWrongCardMap[cid] = { ...card };
            refreshFilterBadgeCounts();
          }
          revealAnswer();

          optionButtons.forEach(({ btn: b, optText: oText, idx: oIdx }) => {
            b.disabled = true;
            b.style.cursor = "default";
            if (oText === res.target_answer) {
              b.style.borderColor = "var(--emerald)";
              b.style.background = "#e8faf0";
              b.style.color = "var(--emerald)";
              b.style.fontWeight = "800";
              b.textContent = `✅ ${oIdx + 1}. ${oText}`;
            } else if (oIdx === idx && !isCorrect) {
              b.style.borderColor = "var(--rose)";
              b.style.background = "#fff0f0";
              b.style.color = "var(--rose)";
              b.style.fontWeight = "700";
              b.textContent = `❌ ${oIdx + 1}. ${oText}`;
            } else {
              b.style.opacity = "0.62";
            }
          });

          const evalBox = el("eval-box");
          if (evalBox) {
            evalBox.style.background = isCorrect ? "#e8faf0" : "#fff0f0";
            evalBox.style.color = isCorrect ? "#008a50" : "#be123c";
            evalBox.textContent = isCorrect
              ? `🎯 4지선다 정답! ('${res.target_answer}')\n아래 정답과 해설을 확인한 뒤 하단 난이도 버튼(추천: 3 · Good)을 눌러 다음 카드로 넘어가세요.`
              : `❌ 오답입니다 (선택: '${optText}' ➔ 정답: '${res.target_answer}').\n아래 정답과 해설을 충분히 확인한 뒤 하단 '1 · Again' 버튼을 눌러 복습하세요.`;
            evalBox.style.display = "block";
          }

          if (isCorrect) {
            showUxToast(
              "🎉 정답입니다! 아래 🎯 정답·해설을 확인한 뒤 난이도 버튼(3 · Good)을 눌러 다음 카드로 이동하세요.",
              "emerald"
            );
          } else {
            showUxToast(
              `💡 오답입니다. 정답('${res.target_answer}')과 해설을 확인한 뒤 다시(1) 버튼을 눌러 복습하세요.`,
              "rose"
            );
          }
        });
        grid.appendChild(btn);
      });
      quizBox.appendChild(grid);
    } else {
      // Uses vm.evaluateTapBlockAttempt via BrainDeckUiDialogsRender
      _getAppModule("BrainDeckUiDialogsRender").renderTapBlockQuizDom({
        el,
        vm,
        res,
        quizBox,
        revealAnswer,
        clearRecommendedGlow,
      });
    }
  }

  async function requestSocraticHint() {
    const card = currentCard();
    if (!card) return;
    state.hintLevel = Math.min(2, state.hintLevel + 1);
    state.currentEvidence.hintStep = state.hintLevel;
    if (state.isRevealed) applyEvidenceRatingGuard();
    const conciseTarget = card.target_answer || card.rendered_answer;
    const box = el("hint-box");
    if (vm && typeof vm.generateProgressiveHint === "function") {
      const localHint = vm.generateProgressiveHint(conciseTarget, card.extra_explanation || "", state.hintLevel);
      box.textContent = localHint.cueText;
      box.style.display = "block";
    }
    const res = await apiPost("/api/ai/hint", {
      question_text: card.rendered_question,
      target_answer: conciseTarget,
      lapses: card.lapses || 0,
      level: state.hintLevel,
    }).catch(() => null);
    if (res && res.ok) {
      box.textContent = `🧭 [단계 ${res.level}/2] ${res.structural_cue}\n❓ ${res.socratic_question}\n${res.mnemonic_tip}`;
      box.style.display = "block";
    }
  }

  async function evaluateFreeRecall(forceDontKnow = false) {
    const card = currentCard();
    if (!card) return;
    const inputEl = el("recall-input");
    const ans = forceDontKnow ? "" : inputEl.value.trim();
    const expectedTarget = card.target_answer || card.rendered_answer;

    const localEval =
      vm && typeof vm.evaluateTypedAnswerUnderstanding === "function"
        ? vm.evaluateTypedAnswerUnderstanding(ans, expectedTarget)
        : {
            verdict: ans ? "PARTIAL" : "UNKNOWN",
            badgeLabel: ans ? "💡 약간 이해" : "❓ 모름",
            recommendedRating: ans ? 2 : 1,
            feedback: "",
          };

    state.currentEvidence.dontKnow = Boolean(forceDontKnow);
    state.currentEvidence.typedVerdict = localEval.verdict;

    const cid = Number(card.card_id);
    if (localEval.verdict === "UNKNOWN" || localEval.verdict === "PARTIAL") {
      if (!state.sessionWrongCardIds.includes(cid)) {
        state.sessionWrongCardIds.push(cid);
      }
      state.sessionWrongCardMap[cid] = { ...card };
      refreshFilterBadgeCounts();
    }

    revealAnswer();

    const box = el("eval-box");
    const bgMap = {
      EXACT: "#e8faf0",
      PARTIAL: "#fff8e6",
      UNKNOWN: "#fff0f0",
    };
    const fgMap = {
      EXACT: "#008a50",
      PARTIAL: "#b45309",
      UNKNOWN: "#be123c",
    };
    box.style.background = bgMap[localEval.verdict] || "#e8f3ff";
    box.style.color = fgMap[localEval.verdict] || "#1b64da";
    box.textContent = `${localEval.badgeLabel} (일치도 ${localEval.scorePct}%)\n${localEval.feedback}`;
    box.style.display = "block";

    const btnOverride = el("btn-override-correct");
    if (btnOverride) {
      btnOverride.style.display = localEval.verdict !== "EXACT" ? "inline-block" : "none";
    }

    if (ans) {
      const res = await apiPost("/api/ai/evaluate", {
        user_answer: ans,
        expected_answer: expectedTarget,
        question_text: card.rendered_question,
      }).catch(() => null);
      if (res && res.ok) {
        box.textContent = `${localEval.badgeLabel} (정확도 ${res.score_pct}%)\n${res.feedback}`;
      }
    }
  }

  async function decomposeCurrentLeech() {
    const card = currentCard();
    if (!card) return;
    const res = await apiPost("/api/ai/decompose-leech", {
      front_text: card.front_text,
      back_text: card.back_text,
      deck_id: card.deck_id,
      parent_card_id: card.card_id,
      auto_save: true,
    });
    if (res && res.ok) {
      const suspendedLabel = res.parent_suspended ? " (원본 복합 카드 자동 정지)" : "";
      const splitCount = Array.isArray(res.cards) ? res.cards.length : 0;
      await refreshDashboardAndQueue();
      showUxToast(
        `🧬 [쉬운 카드로 쪼개기 완료] 복합 카드를 ${splitCount}개의 단일 개념 카드로 나누어 현재 덱에 추가했습니다!${suspendedLabel}`,
        "emerald"
      );
    }
  }

  function speakCurrentCard() {
    const card = currentCard();
    if (!card) return;
    if (!("speechSynthesis" in window)) {
      showUxToast("🔇 현재 브라우저 환경에서 Web Speech TTS 음성 합성을 지원하지 않습니다.", "amber");
      return;
    }
    window.speechSynthesis.cancel();
    const textToSpeak = state.isRevealed ? (card.target_answer || card.rendered_answer) : card.rendered_question;
    const cleanText = textToSpeak.replace(/[【】\[\]]/g, " ");
    const utter = new SpeechSynthesisUtterance(cleanText);
    const hasKorean = /[가-힣]/.test(cleanText);
    utter.lang = hasKorean ? "ko-KR" : "en-US";
    utter.rate = 0.96;
    window.speechSynthesis.speak(utter);
    showUxToast(`🔊 ${state.isRevealed ? "정답" : "질문"} 원어민 발음 재생 중...`, "accent");
  }

  function bindEvents() {
    el("deck-select").addEventListener("change", (e) => {
      state.selectedDeckId = e.target.value;
      refreshDashboardAndQueue();
    });

    el("btn-reveal").addEventListener("click", revealAnswer);
    const btnQuiz = el("btn-quiz-mode");
    if (btnQuiz) {
      btnQuiz.addEventListener("click", () => {
        const order = ["choice", "typing", "flip"];
        const cur =
          state.cardModeOverride ||
          (vm && typeof vm.resolveCardSolveMode === "function"
            ? vm.resolveCardSolveMode(currentCard(), state.learnerProfile)
            : "choice");
        const nextIdx = (order.indexOf(cur) + 1) % order.length;
        state.cardModeOverride = order[nextIdx];
        renderCurrentCard();
      });
    }

    // Frame 5: 3-Segment Switcher in Create Tab (doc | manual | ai)
    document.querySelectorAll(".create-seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const seg = btn.getAttribute("data-create-seg") || "doc";
        document.querySelectorAll(".create-seg-btn").forEach((b) => {
          if (b.getAttribute("data-create-seg") === seg) b.classList.add("btn-primary");
          else b.classList.remove("btn-primary");
        });
        ["doc", "manual", "ai"].forEach((id) => {
          const p = el(`create-seg-${id}`);
          if (p) p.style.display = id === seg ? "block" : "none";
        });
      });
    });
    const btnUndo = el("btn-undo-review");
    if (btnUndo) btnUndo.addEventListener("click", undoLastReview);
    const btnResetStudy = el("btn-reset-study");
    if (btnResetStudy) btnResetStudy.addEventListener("click", resetStudyProgress);
    const btnResetArena = el("btn-reset-card-arena");
    if (btnResetArena) btnResetArena.addEventListener("click", resetStudyProgress);
    const btnResetPostSession = el("btn-reset-post-session");
    if (btnResetPostSession) btnResetPostSession.addEventListener("click", resetStudyProgress);
    el("btn-hint").addEventListener("click", requestSocraticHint);
    el("btn-decompose").addEventListener("click", decomposeCurrentLeech);
    el("btn-tts").addEventListener("click", speakCurrentCard);
    const btnPlayTts = el("btn-play-tts");
    if (btnPlayTts) btnPlayTts.addEventListener("click", speakCurrentCard);
    el("btn-eval").addEventListener("click", () => evaluateFreeRecall(false));
    const btnDontKnow = el("btn-dont-know");
    if (btnDontKnow) {
      btnDontKnow.addEventListener("click", () => evaluateFreeRecall(true));
    }

    const btnToggleShuffle = el("btn-toggle-shuffle");
    if (btnToggleShuffle) {
      btnToggleShuffle.addEventListener("click", () => {
        state.shuffleMode = state.shuffleMode === "interleaved" ? "sequential" : "interleaved";
        const isInterleaved = state.shuffleMode === "interleaved";
        btnToggleShuffle.textContent = isInterleaved ? "🔀 스마트 랜덤 섞기: ON" : "📋 순차 학습: ON";
        if (isInterleaved) {
          btnToggleShuffle.classList.add("btn-primary");
        } else {
          btnToggleShuffle.classList.remove("btn-primary");
        }
        applyStudyFilter();
        renderCurrentCard();
        showUxToast(
          isInterleaved
            ? "🔀 단원·유형 쏠림 방지 스마트 인터리빙 랜덤 모드가 활성화되었습니다!"
            : "📋 기본 순차 출제 모드로 전환되었습니다.",
          "accent"
        );
      });
    }

    // Study Filter Mode Buttons (All / Wrong-Unknown Only / Marked Only)
    function setStudyFilterMode(mode) {
      state.studyFilterMode = mode || "all";
      document.querySelectorAll(".study-filter-btn").forEach((b) => {
        if (b.getAttribute("data-filter") === state.studyFilterMode) {
          b.classList.add("btn-primary");
        } else {
          b.classList.remove("btn-primary");
        }
      });
      applyStudyFilter();
      renderCurrentCard();
    }
    document.querySelectorAll(".study-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setStudyFilterMode(btn.getAttribute("data-filter") || "all");
      });
    });

    // Gate T43: Question-Type Filter Buttons (All / Vocab / Grammar / Hanja / History-Sci)
    function setQuestionTypeFilter(qtype) {
      state.questionTypeFilter = qtype || "all";
      document.querySelectorAll(".study-qtype-btn").forEach((b) => {
        if (b.getAttribute("data-qtype") === state.questionTypeFilter) {
          b.classList.add("btn-primary");
        } else {
          b.classList.remove("btn-primary");
        }
      });
      applyStudyFilter();
      renderCurrentCard();
    }
    document.querySelectorAll(".study-qtype-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const qtype = btn.getAttribute("data-qtype") || "all";
        setQuestionTypeFilter(qtype);
        const labelMap = {
          all: "🗂️ 전체 유형 통합 출제 모드 (4지선다 보기는 각 문제 유형별로 자동 분리됩니다)",
          vocab: "📘 단어·어휘 문제만 모아 풀기 모드",
          grammar: "📐 문법·어법 문제만 모아 풀기 모드",
          hanja: "漢字 한자·사자성어 문제만 모아 풀기 모드",
          history_sci: "🏛️ 역사·과학·전공 개념 문제만 모아 풀기 모드",
        };
        showUxToast(labelMap[qtype] || labelMap.all, "accent");
      });
    });

    const btnRetryWrong = el("btn-retry-wrong-now");
    if (btnRetryWrong) {
      btnRetryWrong.addEventListener("click", () => {
        setStudyFilterMode("wrong_only");
        showUxToast("🔥 오답·모르는 카드 집중 복습 모드를 시작합니다!", "amber");
      });
    }

    const btnFocusMode = el("btn-focus-study-mode");
    if (btnFocusMode) {
      btnFocusMode.addEventListener("click", () => {
        state.isFocusStudyMode = !state.isFocusStudyMode;
        const navEl = el("main-tab-nav");
        const headerZoneEl = el("bd-collapsible-header-zone");
        const toolsDrawerEl = el("study-tools-drawer");
        const explorerEl = el("deck-card-explorer-panel");
        btnFocusMode.setAttribute("aria-pressed", state.isFocusStudyMode ? "true" : "false");
        btnFocusMode.textContent = state.isFocusStudyMode ? "✕ 집중모드 종료" : "🎯 집중모드";
        if (navEl) navEl.style.display = state.isFocusStudyMode ? "none" : "grid";
        if (headerZoneEl) headerZoneEl.style.display = state.isFocusStudyMode ? "none" : "block";
        if (state.isFocusStudyMode) {
          if (toolsDrawerEl) toolsDrawerEl.style.display = "none";
          if (explorerEl) explorerEl.style.display = "none";
          showUxToast("🎯 집중 학습 모드가 켜졌습니다. 플래시카드와 채점에만 몰입하세요.", "accent");
        } else {
          showUxToast("📊 대시보드 학습 모드로 복귀했습니다.", "emerald");
        }
      });
    }

    // Card Actions: Mark (Star), Bury Today, Suspend
    const btnMarkCard = el("btn-mark-card");
    if (btnMarkCard) {
      btnMarkCard.addEventListener("click", () => {
        const card = currentCard();
        if (!card) return;
        const cid = Number(card.card_id);
        let isNowMarked = false;
        if (state.markedCardIds.includes(cid)) {
          state.markedCardIds = state.markedCardIds.filter((id) => id !== cid);
          showUxToast("☆ 별표 표시를 해제했습니다.", "accent");
        } else {
          state.markedCardIds.push(cid);
          isNowMarked = true;
          showUxToast("⭐ 별표 카드로 저장했습니다! 상단 [⭐ 별표 카드만]에서 모아볼 수 있습니다.", "emerald");
        }
        btnMarkCard.textContent = isNowMarked ? "⭐ 별표됨" : "☆ 별표";
        btnMarkCard.style.color = isNowMarked ? "var(--amber)" : "var(--muted)";
        if (state.studyFilterMode === "marked_only") {
          applyStudyFilter();
          renderCurrentCard();
        } else {
          refreshFilterBadgeCounts();
        }
      });
    }

    const btnBuryCard = el("btn-bury-card");
    if (btnBuryCard) {
      btnBuryCard.addEventListener("click", () => {
        const card = currentCard();
        if (!card) return;
        const cid = Number(card.card_id);
        if (!state.buriedCardIds.includes(cid)) {
          state.buriedCardIds.push(cid);
        }
        applyStudyFilter();
        renderCurrentCard();
        showUxToast("💤 이 카드를 오늘 하루 학습 큐에서 숨겼습니다.", "accent");
      });
    }

    const btnSuspendCard = el("btn-suspend-card");
    if (btnSuspendCard) {
      btnSuspendCard.addEventListener("click", async () => {
        const card = currentCard();
        if (!card) return;
        const cid = Number(card.card_id);
        if (!state.buriedCardIds.includes(cid)) {
          state.buriedCardIds.push(cid);
        }
        await apiPost("/api/cards/suspend", { card_id: cid }).catch(() => null);
        applyStudyFilter();
        renderCurrentCard();
        showUxToast("⏸️ 카드를 영구 일시 정지했습니다.", "amber");
      });
    }

    // Direct Card Add (Basic & Cloze {{c1::...}})
    const btnInsertCloze = el("btn-insert-cloze");
    if (btnInsertCloze) {
      btnInsertCloze.addEventListener("click", () => {
        const frontEl = el("direct-card-front");
        if (!frontEl) return;
        frontEl.value = `${frontEl.value ? frontEl.value + " " : ""}{{c1::핵심정답}}`;
        frontEl.focus();
      });
    }

    const btnAddDirectCard = el("btn-add-direct-card");
    if (btnAddDirectCard) {
      btnAddDirectCard.addEventListener("click", async () => {
        const frontEl = el("direct-card-front");
        const backEl = el("direct-card-back");
        const statusEl = el("direct-card-status");
        const front = (frontEl && frontEl.value.trim()) || "";
        const back = (backEl && backEl.value.trim()) || "";
        if (!front || !back) {
          if (statusEl) statusEl.textContent = "✏️ 앞면(질문)과 뒷면(정답)을 모두 입력해 주세요.";
          return;
        }
        const targetDeck = state.selectedDeckId ? Number(state.selectedDeckId) : null;
        const res = await apiPost("/api/cards/add-direct", {
          deck_id: targetDeck,
          front_text: front,
          back_text: back,
          tags: ["direct_input"],
        });
        if (res && res.ok) {
          if (frontEl) frontEl.value = "";
          if (backEl) backEl.value = "";
          if (statusEl) statusEl.textContent = "✅ 새 카드가 단어장에 바로 추가되었습니다!";
          await refreshDashboardAndQueue();
          showUxToast("➕ 새 카드가 단어장에 추가되었습니다!", "emerald");
        }
      });
    }

    el("recall-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        evaluateFreeRecall();
      }
    });

    const btnOverrideCorrect = el("btn-override-correct");
    if (btnOverrideCorrect) {
      btnOverrideCorrect.addEventListener("click", () => {
        const card = currentCard();
        if (!card) return;
        state.currentEvidence.typedVerdict = "EXACT";
        state.currentEvidence.dontKnow = false;
        state.currentEvidence.choiceCorrect = true;
        const cid = Number(card.card_id);
        state.sessionWrongCardIds = state.sessionWrongCardIds.filter((id) => id !== cid);
        delete state.sessionWrongCardMap[cid];
        refreshFilterBadgeCounts();
        applyEvidenceRatingGuard();
        btnOverrideCorrect.style.display = "none";
        const evalBox = el("eval-box");
        if (evalBox) {
          evalBox.style.background = "#e8faf0";
          evalBox.style.color = "#008a50";
          evalBox.textContent = "✅ 내 답이 맞아요 (정답 인정 완료)\n오타·유의어를 정답으로 인정했습니다. 아래 난이도 버튼(추천: 3 · Good)을 눌러 다음 카드로 이동하세요.";
          evalBox.style.display = "block";
        }
        showUxToast("✅ 오타·유의어 정답 인정! 해설을 확인한 뒤 알맞음(3 · Good)을 눌러주세요.", "emerald");
      });
    }

    [1, 2, 3, 4].forEach((r) => {
      el(`rate-${r}`).addEventListener("click", () => submitRating(r));
    });

    el("btn-generate-cards").addEventListener("click", async () => {
      const rawText = el("ai-raw-text").value.trim();
      if (!rawText) {
        el("ai-gen-status").textContent = "✏️ 먼저 학습 노트나 조문·교과서 문장을 입력창에 붙여넣어 주세요.";
        el("ai-raw-text").focus();
        return;
      }
      const mode = el("ai-domain-mode").value;
      const diffEl = el("ai-difficulty-select");
      const diffLevel = (diffEl && diffEl.value) || "standard";
      const ollamaSel = el("ai-ollama-model-select");
      const ollamaModel = (ollamaSel && ollamaSel.value) || "glm-5.3-flash";
      const targetDeck = state.selectedDeckId ? Number(state.selectedDeckId) : null;
      el("ai-gen-status").textContent = "⏳ 스마트 카드 생성 중...";
      const res = await apiPost("/api/ai/generate-cards", {
        raw_text: rawText,
        domain_mode: mode,
        deck_id: targetDeck,
        auto_save: true,
        difficulty_level: diffLevel,
        ollama_cloud_model: ollamaModel,
      });
      if (res && res.ok) {
        const aiDecision =
          vm && typeof vm.resolveSmartAiEngine === "function"
            ? vm.resolveSmartAiEngine({
                taskType: "card_generate",
                manualOverride: res.ollama_cloud_model || ollamaModel,
                offlineOnly: !res.ollama_cloud_used && res.provider !== "llm",
              })
            : { ui_label: res.ollama_cloud_used ? "✨ 스마트 자동 생성" : "⚡ 오프라인 빠른 생성" };
        const providerBadge = aiDecision.ui_label || "✨ 스마트 자동 생성";
        el("ai-gen-status").textContent = `✅ ${res.generated_count}장 생성 및 저장 완료! [${providerBadge} · 난이도 ${diffLevel.toUpperCase()} · ${res.latency_ms || 0}ms]`;
        el("ai-raw-text").value = "";
        await refreshDashboardAndQueue();
      }
    });

    // Photo & PDF Auto-Deck Builder events (with Smart AI Engine Policy Router)
    const dropzone = el("doc-dropzone");
    const fileInput = el("doc-file-input");

    async function handleDocumentFile(file) {
      if (!file) return;
      const banner = el("doc-ingest-banner");
      const previewContainer = el("doc-preview-container");
      const docOllamaEl = el("doc-ollama-model-select");
      const ollamaModel = (docOllamaEl && docOllamaEl.value) || "glm-5.3-flash";
      if (file.size > 20 * 1024 * 1024) {
        banner.style.display = "block";
        banner.style.borderColor = "var(--rose)";
        banner.style.color = "var(--rose)";
        banner.textContent = "⚠️ 파일 크기가 허용 한도(20MB)를 초과했습니다.";
        return;
      }
      banner.style.display = "block";
      banner.style.borderColor = "var(--accent)";
      banner.style.color = "var(--text)";
      const docEngineDecision =
        vm && typeof vm.resolveSmartAiEngine === "function"
          ? vm.resolveSmartAiEngine({
              taskType: "ocr_extract",
              manualOverride: ollamaModel,
              offlineOnly: ollamaModel === "local_rule",
            })
          : { ui_label: ollamaModel !== "local_rule" ? "✨ 스마트 자동 생성" : "⚡ 오프라인 빠른 생성" };
      const modelTagLabel = docEngineDecision.ui_label || "✨ 스마트 자동 생성";
      banner.textContent = `⏳ '${file.name}' (${(file.size / 1024).toFixed(1)}KB) ${modelTagLabel} 분석 및 카드 생성 중...`;
      previewContainer.style.display = "none";

      const deckName = el("doc-deck-name").value.trim();
      const autoSave = el("doc-auto-save").checked ? "1" : "0";
      const docDiffEl = el("doc-difficulty-select");
      const docDiff = (docDiffEl && docDiffEl.value) || "standard";
      const params = new URLSearchParams({
        auto_save: autoSave,
        max_cards: "30",
        difficulty_level: docDiff,
        ollama_cloud_model: ollamaModel,
      });
      if (deckName) params.set("deck_name", deckName);

      const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png");
      const lowerName = (file.name || "").toLowerCase();
      const isPlainTextDoc =
        lowerName.endsWith(".txt") ||
        lowerName.endsWith(".md") ||
        lowerName.endsWith(".csv") ||
        lowerName.endsWith(".tsv") ||
        mime.startsWith("text/");
      const buf = await file.arrayBuffer();
      let res = null;
      const runOfflineDocFallback = () => {
        const cleanTitle = deckName || file.name.replace(/\.[^.]+$/, "") || "문서 단어장";
        if (isPlainTextDoc && standaloneEngine) {
          const decodedText = new TextDecoder("utf-8").decode(buf).trim();
          if (!decodedText) {
            return {
              ok: false,
              status: "EMPTY_DOCUMENT",
              error_code: "EMPTY_DOCUMENT",
              message: "문서에서 추출된 텍스트가 없습니다.",
              cards: [],
            };
          }
          const fallbackRes = standaloneEngine.buildSmartTextDeck({
            deck_name: cleanTitle,
            text: decodedText,
            difficulty_level: docDiff,
            auto_save: autoSave === "1",
          });
          return {
            ok: true,
            status: "OK",
            deck_id: autoSave === "1" ? fallbackRes.deck_id : null,
            deck_name: cleanTitle,
            category: "general",
            ollama_cloud_model: "local_rule",
            ollama_cloud_used: false,
            provider: "standalone_local",
            latency_ms: 8,
            stats: { pages: 1, ocr_pages: 0, low_confidence_lines: 0, dropped_ungrounded: 0, duplicates: 0 },
            cards: (fallbackRes.cards || []).map((c) => ({
              ...c,
              pattern: c.pattern || "definition",
              source_page: 1,
              source_excerpt: file.name,
              tags: (c.tags || []).concat(["local_text_ingest"]),
            })),
          };
        }
        return {
          ok: false,
          status: "UNSUPPORTED_OFFLINE_OCR",
          error_code: "OCR_REQUIRES_SERVER_OR_APP",
          message:
            "오프라인 정적 웹 환경에서는 이미지·PDF OCR 서버 분석을 사용할 수 없습니다. 텍스트(.txt/.md/.csv) 파일을 업로드하거나 로컬 서버·안드로이드 앱을 이용해 주세요.",
          stats: { pages: 0, ocr_pages: 0, low_confidence_lines: 0, dropped_ungrounded: 0, duplicates: 0 },
          cards: [],
        };
      };

      if (resolveRuntimeBackendMode() === "STANDALONE_STATIC") {
        res = runOfflineDocFallback();
      } else {
        try {
          const resp = await fetch(`/api/ai/ingest-document?${params.toString()}`, {
            method: "POST",
            headers: { "Content-Type": mime },
            body: buf,
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          res = await resp.json();
        } catch (_err) {
          res = runOfflineDocFallback();
        }
      }
      const formatted = vm.formatIngestStatusBanner(res);
      banner.style.borderColor = formatted.tone === "rose" ? "var(--rose)" : "var(--emerald)";
      banner.style.color = formatted.tone === "rose" ? "var(--rose)" : "var(--text)";
      banner.textContent = `${formatted.title}\n${formatted.summary}`;

      if (res && res.status === "OK") {
        state.pendingDeckPlan = {
          deck_name: res.deck_name,
          category: res.category,
          cards: (res.cards || []).map((c) => ({ ...c })),
        };
        const isAlreadySaved = Boolean(res.deck_id);
        const listEl = el("doc-preview-list");

        function renderPreviewCards() {
          _getAppModule("BrainDeckUiDialogsRender").renderDocumentPreviewCardsDom({
            el,
            vm,
            state,
            res,
            listEl,
            isAlreadySaved,
            formatted,
            renderPreviewCards,
          });
        }
        renderPreviewCards();
        previewContainer.style.display = "block";
        if (res.deck_id) {
          state.selectedDeckId = String(res.deck_id);
          await refreshDashboardAndQueue();
        }
      }
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleDocumentFile(e.target.files[0]);
          e.target.value = "";
        }
      });
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "var(--emerald)";
      });
      dropzone.addEventListener("dragleave", () => {
        dropzone.style.borderColor = "rgba(56,189,248,0.45)";
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "rgba(56,189,248,0.45)";
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleDocumentFile(e.dataTransfer.files[0]);
        }
      });
    }

    const btnSaveDocDeck = el("btn-save-doc-deck");
    if (btnSaveDocDeck) {
      btnSaveDocDeck.addEventListener("click", async () => {
        const plan = state.pendingDeckPlan;
        if (!plan || !plan.cards || !plan.cards.length) return;
        const customName = el("doc-deck-name").value.trim() || plan.deck_name;
        const res = await apiPost("/api/decks/batch-save", {
          deck_name: customName,
          category: plan.category,
          cards: plan.cards,
        });
        if (res && res.ok) {
          el("doc-preview-title").textContent = `🎉 '${res.deck_name}' 덱 (${res.saved_count}장) 일괄 생성 완료!`;
          btnSaveDocDeck.style.display = "none";
          state.selectedDeckId = String(res.deck_id);
          await refreshDashboardAndQueue();
        }
      });
    }

    el("btn-decompress").addEventListener("click", async () => {
      const targetDeck = state.selectedDeckId ? Number(state.selectedDeckId) : null;
      const res = await apiPost("/api/backlog/decompress", {
        deck_id: targetDeck,
        daily_cap: 25,
        horizon_days: 7,
      });
      if (res && res.ok) {
        showUxToast(
          `🏖️ 복습 폭탄 평탄화 완료! 대기 ${res.total_due_evaluated}장 중 오늘 저-R 위험군 ${res.kept_today}장 유지 · 향후 ${res.horizon_days}일로 ${res.deferred_across_days}장 안전 분산`,
          "emerald"
        );
        await refreshDashboardAndQueue();
      }
    });

    window.addEventListener("keydown", (e) => {
      const activeTag = (document.activeElement && document.activeElement.tagName) || "";
      const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
      const wcag = _getAppModule("BrainDeckAnalyticsOnboardingVm").resolveWcagKeyboardShortcut(e.key, state.isRevealed, isTyping);
      if (wcag && wcag.aria_announcement) {
        const liveEl = el("aria-live-announcer");
        if (liveEl) liveEl.textContent = wcag.aria_announcement;
      }
      const cmd = vm.mapKeyboardShortcut(e.key, state.isRevealed, isTyping, state.ageTier);
      if (!cmd) return;
      e.preventDefault();
      if (cmd.action === "reveal") revealAnswer();
      else if (cmd.action === "rate") submitRating(cmd.rating);
      else if (cmd.action === "hint") requestSocraticHint();
      else if (cmd.action === "tts") speakCurrentCard();
      else if (cmd.action === "quiz") requestInteractiveQuiz("");
      else if (cmd.action === "undo") undoLastReview();
    });
  }

  // Delegates catalog ("btn-toggle-all-units"), lock recovery ("formatApiErrorBanner"), and store ("store-bundle-cb", "/api/store/refund") to BrainDeckUiDialogsRender
  function _catalogStoreControllers() {
    return _getAppModule("BrainDeckUiDialogsRender").createCatalogAndStoreControllers({
      el, vm, state, apiGet, apiPost, refreshDashboardAndQueue, switchTabPage, showUxToast, syncOfflineVault,
    });
  }
  function renderCatalogLockRecovery(statusEl, apiErrorRes, retryCallback) {
    return _catalogStoreControllers().renderCatalogLockRecovery(statusEl, apiErrorRes, retryCallback);
  }
  async function loadCatalogAndBind() { return _catalogStoreControllers().loadCatalogAndBind(); }
  async function loadBrainPackStoreAndBind() { return _catalogStoreControllers().loadBrainPackStoreAndBind(); }
  async function syncOfflineVault(showBanner = true) {
    try {
      if (standaloneEngine && typeof standaloneEngine.syncCrdtDelta === "function") {
        standaloneEngine.syncCrdtDelta({ schema_version: 1, device_id: "web-pwa", review_events: [] });
      }
      const bundle = await apiGet("/api/bundle/offline-snapshot");
      if (bundle && bundle.ok) {
        saveLocalVaultSnapshot(bundle);
        const badge = el("offline-vault-badge");
        if (badge) badge.textContent = "📱 온디바이스 올인원 내장 완료";
        if (showBanner) {
          const statusMsgEl = el("store-status-msg");
          if (statusMsgEl) {
            statusMsgEl.textContent = "✅ 보유 중인 모든 브레인팩과 학습 덱 데이터가 이 기기(localStorage + IndexedDB)에 안전하게 내장되었습니다!";
          }
          showUxToast("💾 오프라인 금고 동기화 완료: 비행기 모드에서도 보유 브레인팩과 복습 큐가 100% 작동합니다.", "emerald");
        }
      }
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    const ageBtns = document.querySelectorAll(".age-tier-btn");
    async function applyAgeTierUiTokens(tier, syncServer = false) {
      state.ageTier = tier || "teen";
      if (syncServer) {
        await apiPost("/api/profile/age-tier", { age_tier: state.ageTier }).catch(() => {});
      }
      if (!vm || typeof vm.resolveUiUxTokens !== "function") return;
      const isStandalone = Boolean(
        (window.navigator && window.navigator.standalone) ||
          (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
      );
      const tokens = vm.resolveUiUxTokens(tier, window.innerWidth || 1200, isStandalone);
      document.documentElement.style.setProperty("--question-font-size", `${tokens.questionFontPx}px`);
      document.documentElement.style.setProperty("--min-touch-target", `${tokens.minTouchTargetPx}px`);
      document.documentElement.style.setProperty("--card-radius", `${tokens.cardBorderRadiusPx}px`);
      const bannerEl = el("age-tier-banner");
      if (bannerEl) {
        bannerEl.textContent = tokens.bannerText;
      }
      if (typeof vm.formatRatingButtonsForAgeTier === "function") {
        const ratingList = vm.formatRatingButtonsForAgeTier(state.ageTier) || [];
        [1, 2, 3, 4].forEach((r) => {
          const item = ratingList.find((b) => Number(b.rating) === r);
          const titleEl = el(`rate-title-${r}`);
          const btnEl = el(`rate-${r}`);
          if (titleEl && item) {
            titleEl.textContent = item.title;
          }
          if (btnEl) {
            btnEl.style.display = item && item.visible ? "flex" : "none";
          }
        });
      } else {
        const easyBtn = el("rate-4");
        if (easyBtn) {
          easyBtn.style.display = tokens.allowEasyButton ? "flex" : "none";
        }
      }
      if (syncServer) {
        showUxToast(tokens.bannerText, "accent");
        renderCurrentCard();
      }
    }
    ageBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        ageBtns.forEach((b) => b.classList.remove("btn-primary"));
        btn.classList.add("btn-primary");
        applyAgeTierUiTokens(btn.getAttribute("data-age-tier") || "teen", true);
      });
    });

    // Multi-Page Tab Navigation Binding
    document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchTabPage(btn.getAttribute("data-tab") || "study");
      });
    });

    // Onboarding & LearnerProfile v2 Binding
    const onboardingModal = el("onboarding-modal");
    function applyLearnerProfile(rawProf, closeSheet = true) {
      const norm =
        vm && typeof vm.normalizeLearnerProfile === "function"
          ? vm.normalizeLearnerProfile(rawProf)
          : { ageTier: rawProf.ageTier || "teen", solveMode: "adaptive", difficulty: "mixed", order: "interleaved", summaryLabel: "" };
      state.learnerProfile = norm;
      state.ageTier = norm.ageTier;
      state.shuffleMode = norm.order === "sequential" ? "sequential" : "interleaved";
      state.cardModeOverride = "";
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(ONBOARDING_STORAGE_KEY, norm.ageTier);
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(norm));
        }
      } catch (_) {}
      const sumEl = el("learner-policy-summary");
      if (sumEl) sumEl.textContent = norm.summaryLabel || "";
      ["curriculum-difficulty-select", "doc-difficulty-select", "ai-difficulty-select"].forEach((selId) => {
        const s = el(selId);
        if (s) s.value = norm.difficulty || "mixed";
      });
      const smSel = el("profile-solve-mode-select");
      if (smSel) smSel.value = norm.solveMode;
      const dfSel = el("profile-difficulty-select");
      if (dfSel) dfSel.value = norm.difficulty;

      if (closeSheet && onboardingModal) {
        onboardingModal.style.display = "none";
      }
      ageBtns.forEach((b) => {
        if (b.getAttribute("data-age-tier") === norm.ageTier) b.classList.add("btn-primary");
        else b.classList.remove("btn-primary");
      });
      applyAgeTierUiTokens(norm.ageTier, closeSheet);
      if (closeSheet) switchTabPage("study");
    }

    function completeOnboardingMode(tier) {
      const chosen = tier || "teen";
      const onbMod = _getAppModule("BrainDeckAnalyticsOnboardingVm");
      const s1 = onbMod.advanceOnboardingState({ step: 1, completed: false }, { goal_track: chosen === "adult" ? "civil_law" : "k12_school" });
      const s2 = onbMod.advanceOnboardingState(s1, { daily_minutes: 20, target_days: 30 });
      state.onboardingVmState = onbMod.advanceOnboardingState(s2, { diagnostic_ratings: [3, 3, 4] });
      const preset =
        vm && typeof vm.buildLearnerProfilePreset === "function"
          ? vm.buildLearnerProfilePreset(chosen)
          : { ageTier: chosen, solveMode: "adaptive", difficulty: "mixed", order: "interleaved" };
      applyLearnerProfile(preset, true);
    }

    document.querySelectorAll(".onboarding-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        completeOnboardingMode(btn.getAttribute("data-onboarding-tier") || "teen");
      });
    });

    const btnSaveProfile = el("btn-save-learner-profile");
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener("click", () => {
        const smSel = el("profile-solve-mode-select");
        const dfSel = el("profile-difficulty-select");
        applyLearnerProfile(
          {
            ageTier: state.ageTier || "teen",
            solveMode: (smSel && smSel.value) || "adaptive",
            difficulty: (dfSel && dfSel.value) || "mixed",
            order: state.shuffleMode || "interleaved",
          },
          true
        );
      });
    }

    const btnOpenModeSetup = el("btn-open-mode-setup");
    if (btnOpenModeSetup && onboardingModal) {
      btnOpenModeSetup.addEventListener("click", () => {
        onboardingModal.style.display = "flex";
      });
    }

    let savedMode = null;
    let savedProf = null;
    try {
      if (typeof localStorage !== "undefined") {
        savedMode = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        const rawP = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (rawP) savedProf = JSON.parse(rawP);
      }
    } catch (_) {}

    if (!savedMode && onboardingModal) {
      onboardingModal.style.display = "flex";
      applyLearnerProfile({ ageTier: "teen", solveMode: "adaptive", difficulty: "mixed", order: "interleaved" }, false);
    } else {
      applyLearnerProfile(savedProf || { ageTier: savedMode || "teen" }, false);
    }

    const syncBtn = el("btn-sync-offline-vault");
    if (syncBtn) {
      syncBtn.addEventListener("click", () => syncOfflineVault(true));
    }

    // Delegates REA study tools, "btn-toggle-compact-header", ".bd-stage-btn", "syncStudyToolsSummaryBadge", and "switchCurriculumSegment"
    const reaPlannerCtrl = _getAppModule("BrainDeckUiDialogsRender").bindReaUtilitiesAndPlannerDom({
      el, vm, state, apiPost, currentCard, enrichStandaloneCard, applyStudyFilter,
      renderCurrentCard, renderStudyPlanBanner, refreshDashboardAndQueue,
      renderDeckExplorerPanel, loadBrainPackStoreAndBind, loadCatalogAndBind, showUxToast,
    });
    function syncStudyToolsSummaryBadge() { return reaPlannerCtrl.syncStudyToolsSummaryBadge(); }
    function switchCurriculumSegment(seg) { return reaPlannerCtrl.switchCurriculumSegment(seg); }
    // BD-F06: Hydrate unified IndexedDB & Register PWA Service Worker
    if (standaloneEngine && typeof standaloneEngine.hydrateFromIndexedDb === "function") {
      standaloneEngine.hydrateFromIndexedDb(() => {
        loadBrainPackStoreAndBind(); loadCatalogAndBind(); refreshDashboardAndQueue();
      });
    }
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    loadBrainPackStoreAndBind(); loadCatalogAndBind(); refreshDashboardAndQueue();
    syncOfflineVault(false); syncStudyToolsSummaryBadge();
  });
})();
