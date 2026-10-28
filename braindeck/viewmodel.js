/**
 * Pure Presentation ViewModel for BrainDeck 2.0 (MVVM Architecture).
 * Zero DOM dependencies — 100% deterministic functions testable in Node/Browser.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AnkiStudioViewModel = api;
    root.BrainDeckViewModel = api;
    if (typeof api.createStandaloneEngine === "function") {
      root.BrainDeckStandaloneEngine = api.createStandaloneEngine();
    }
  }
  if (typeof window !== "undefined" && window && window !== root) {
    window.AnkiStudioViewModel = api;
    window.BrainDeckViewModel = api;
    if (typeof api.createStandaloneEngine === "function") {
      window.BrainDeckStandaloneEngine = api.createStandaloneEngine();
    }
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _MODULE_REL_PATHS = {
    BrainDeckFsrsCore: "./modules/fsrs_core.js",
    BrainDeckCatalogStoreCore: "./modules/catalog_store_core.js",
    BrainDeckSyncCrdt: "./modules/sync_crdt.js",
    BrainDeckCurriculumStandards: "./modules/curriculum_standards.js",
    BrainDeckAnalyticsOnboardingVm: "./modules/analytics_onboarding_vm.js",
    BrainDeckStandaloneEngineCore: "./modules/standalone_engine_core.js",
    BrainDeckStandaloneEngineOps: "./modules/standalone_engine_ops.js",
  };

  function _getModule(globalName, relPath) {
    const targetPath = relPath || _MODULE_REL_PATHS[globalName];
    if (typeof globalThis !== "undefined" && Object.prototype.hasOwnProperty.call(globalThis, globalName)) {
      if (globalThis[globalName] === null) {
        throw new Error("MODULE_NOT_LOADED: " + globalName);
      }
      if (globalThis[globalName]) return globalThis[globalName];
    }
    if (typeof window !== "undefined" && window && Object.prototype.hasOwnProperty.call(window, globalName)) {
      if (window[globalName] === null) {
        throw new Error("MODULE_NOT_LOADED: " + globalName);
      }
      if (window[globalName]) return window[globalName];
    }
    if (typeof self !== "undefined" && self && Object.prototype.hasOwnProperty.call(self, globalName)) {
      if (self[globalName] === null) {
        throw new Error("MODULE_NOT_LOADED: " + globalName);
      }
      if (self[globalName]) return self[globalName];
    }
    if (typeof require === "function" && targetPath) {
      const path = require("path");
      const fs = require("fs");
      const candDirs = [];
      if (typeof __dirname === "string") candDirs.push(__dirname);
      if (typeof process !== "undefined" && Array.isArray(process.argv)) {
        for (let i = 0; i < process.argv.length; i += 1) {
          const arg = String(process.argv[i] || "");
          if (arg.endsWith("viewmodel.js") || arg.endsWith("app.js")) {
            candDirs.push(path.dirname(arg));
          }
        }
      }
      candDirs.push(
        "./src/anki_studio/ui/static",
        "../src/anki_studio/ui/static",
        "./Documents/개발/BrainDeck/src/anki_studio/ui/static",
        "/Users/choyoungseo/Documents/개발/BrainDeck/src/anki_studio/ui/static"
      );
      for (let i = 0; i < candDirs.length; i += 1) {
        const resolved = path.resolve(candDirs[i], targetPath);
        if (fs.existsSync(resolved)) {
          const mod = require(resolved);
          if (typeof globalThis !== "undefined" && !Object.prototype.hasOwnProperty.call(globalThis, globalName)) {
            globalThis[globalName] = mod;
          }
          if (typeof window !== "undefined" && window && !Object.prototype.hasOwnProperty.call(window, globalName)) {
            window[globalName] = mod;
          }
          return mod;
        }
      }
    }
    throw new Error("MODULE_NOT_LOADED: " + globalName);
  }

  function formatRetentionBadge(retentionPct) {
    if (retentionPct === null || retentionPct === undefined || retentionPct === "" || Number.isNaN(Number(retentionPct))) {
      return { label: "집계 없음", tone: "slate" };
    }
    const val = Number(retentionPct) || 0;
    if (val >= 90) {
      return { label: `${val.toFixed(1)}% (Optimal FSRS-5)`, tone: "emerald" };
    }
    if (val >= 80) {
      return { label: `${val.toFixed(1)}% (Moderate)`, tone: "amber" };
    }
    return { label: `${val.toFixed(1)}% (At Risk)`, tone: "rose" };
  }

  function formatLeechBadge(leechStatus, lapses) {
    const count = Number(lapses) || 0;
    if (leechStatus === "critical_leech") {
      return {
        visible: true,
        label: `🚨 집중 복습 대상 (${count}회 오답) — 쉬운 카드로 쪼개기 추천`,
        tone: "rose",
      };
    }
    if (leechStatus === "warning") {
      return {
        visible: true,
        label: `⚠️ 반복 오답 주의 (${count}회) — 단계별 힌트 활용 권장`,
        tone: "amber",
      };
    }
    return { visible: false, label: "", tone: "slate" };
  }

  function _withWcagMeta(obj, wcag) {
    if (!obj || typeof obj !== "object") return obj;
    Object.defineProperty(obj, "wcag_action", { value: wcag ? wcag.action : null, enumerable: false, configurable: true });
    Object.defineProperty(obj, "aria_announcement", { value: wcag ? wcag.aria_announcement : null, enumerable: false, configurable: true });
    return obj;
  }

  function mapKeyboardShortcut(key, isAnswerRevealed, isTypingInInput, ageTier) {
    const wcag = _getModule("BrainDeckAnalyticsOnboardingVm").resolveWcagKeyboardShortcut(
      key,
      Boolean(isAnswerRevealed),
      Boolean(isTypingInInput)
    );
    if (isTypingInInput) {
      return null;
    }
    const normalized = String(key || "").toLowerCase();
    const tierNorm = String(ageTier || "teen").toLowerCase();
    if (normalized === " " || normalized === "enter") {
      return isAnswerRevealed
        ? _withWcagMeta({ action: "rate", rating: 3 }, wcag)
        : _withWcagMeta({ action: "reveal" }, wcag);
    }
    if (isAnswerRevealed && ["1", "2", "3", "4"].includes(normalized)) {
      if (normalized === "4" && tierNorm === "junior") {
        return null;
      }
      return _withWcagMeta({ action: "rate", rating: Number(normalized) }, wcag);
    }
    if (normalized === "q") {
      return _withWcagMeta({ action: "quiz" }, wcag);
    }
    if (normalized === "h") {
      return _withWcagMeta({ action: "hint" }, wcag);
    }
    if (normalized === "t") {
      return _withWcagMeta({ action: "tts" }, wcag);
    }
    if (normalized === "z" || normalized === "u") {
      return _withWcagMeta({ action: "undo" }, wcag);
    }
    if (normalized === "-") {
      return _withWcagMeta({ action: "bury" }, wcag);
    }
    if (normalized === "@" || normalized === "!") {
      return _withWcagMeta({ action: "suspend" }, wcag);
    }
    if (normalized === "f") {
      return _withWcagMeta({ action: "cycle_flag" }, wcag);
    }
    if (normalized === "?" || normalized === "/") {
      return _withWcagMeta({ action: "toggle_shortcut_help" }, wcag);
    }
    return null;
  }

  function formatRatingButtonsForAgeTier(ageTier, previews) {
    const tierNorm = String(ageTier || "teen").toLowerCase();
    const p = previews || {};
    const l1 = (p.again && p.again.label) || "10m";
    const l2 = (p.hard && p.hard.label) || "1d";
    const l3 = (p.good && p.good.label) || "3d";
    const l4 = (p.easy && p.easy.label) || "16d";

    if (tierNorm === "junior") {
      return [
        { rating: 1, title: "1 · 다시 볼래요 🌱", subLabel: l1, visible: true },
        { rating: 2, title: "2 · 조금 헷갈려요 🤔", subLabel: l2, visible: true },
        { rating: 3, title: "3 · 맞혔어요! 🎉", subLabel: l3, visible: true },
      ];
    }
    return [
      { rating: 1, title: "1 · Again (망각)", subLabel: l1, visible: true },
      { rating: 2, title: "2 · Hard (어려움)", subLabel: l2, visible: true },
      { rating: 3, title: "3 · Good (적정)", subLabel: l3, visible: true },
      { rating: 4, title: "4 · Easy (완벽)", subLabel: l4, visible: true },
    ];
  }

  function formatApiErrorBanner(res) {
    const r = res || {};
    const code = String(r.error_code || r.error || "UNKNOWN_ERROR");
    const reqPackId = (r.decision && r.decision.required_pack_id) || null;
    if (code === "PACK_LOCKED") {
      return {
        tone: "amber",
        errorCode: code,
        actionPackId: reqPackId,
        message: `🔒 아직 잠금 해제되지 않은 유료 브레인팩(${reqPackId || "스토어 팩"})입니다. 상단 '🛒 브레인팩 스토어'에서 먼저 장착(₩990~₩1,900)해 주세요!`,
      };
    }
    if (code === "PACK_REFUNDED_FROZEN") {
      return {
        tone: "rose",
        errorCode: code,
        actionPackId: reqPackId,
        message: "❄️ 환불 동결(refunded_frozen)된 브레인팩입니다. 기존 FSRS 복습 기록은 보존되지만 신규 시험범위·컬렉션 덱 생성은 제한됩니다.",
      };
    }
    if (code === "CLOUD_VISION_LOCKED") {
      return {
        tone: "rose",
        errorCode: code,
        actionPackId: null,
        message: "🛡️ 아동 개인정보 보호(Junior 하드락) 정책에 의해 외부 클라우드 비전 전송이 차단되었습니다. 온디바이스 OCR만 사용합니다.",
      };
    }
    if (code === "NOTHING_TO_UNDO") {
      return {
        tone: "slate",
        errorCode: code,
        actionPackId: null,
        message: "↩️ 되돌릴 최근 복습 기록이 없습니다.",
      };
    }
    return {
      tone: "rose",
      errorCode: code,
      actionPackId: null,
      message: `⚠️ 요청을 처리할 수 없습니다 (${code}).`,
    };
  }

  function evaluateTapBlockAttempt(selectedBlocks, targetBlocks) {
    const sel = Array.isArray(selectedBlocks) ? selectedBlocks.map(String) : [];
    const tgt = Array.isArray(targetBlocks) ? targetBlocks.map(String) : [];
    if (tgt.length === 0) {
      return { status: "IN_PROGRESS", progressPct: 0, recommendedRating: null };
    }
    for (let i = 0; i < sel.length; i += 1) {
      if (sel[i] !== tgt[i]) {
        return {
          status: "WRONG_ORDER",
          mismatchIndex: i,
          progressPct: Math.round((i / tgt.length) * 100),
          recommendedRating: 1,
        };
      }
    }
    if (sel.length < tgt.length) {
      return {
        status: "IN_PROGRESS",
        progressPct: Math.round((sel.length / tgt.length) * 100),
        recommendedRating: null,
      };
    }
    return {
      status: "CORRECT",
      progressPct: 100,
      recommendedRating: 3,
    };
  }

  function buildForgettingCurveSvgPoints(curvePoints, width, height) {
    const pts = Array.isArray(curvePoints) ? curvePoints : [];
    if (pts.length === 0) return "";
    const w = Number(width) || 480;
    const h = Number(height) || 120;
    const maxDay = Math.max(1, ...pts.map((p) => Number(p.day) || 0));

    return pts
      .map((p) => {
        const x = ((Number(p.day) || 0) / maxDay) * w;
        const r = Math.max(0.5, Math.min(1.0, Number(p.retrievability) || 0.9));
        // Map [0.5 .. 1.0] to [h - 10 .. 10]
        const y = h - 10 - ((r - 0.5) / 0.5) * (h - 20);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const CATEGORY_META = {
    law: { label: "⚖️ 법학·행정·조문", tone: "indigo" },
    medical: { label: "🩺 의학·간호·생명", tone: "emerald" },
    engineering: { label: "🔬 공학·IT·아키텍처", tone: "cyan" },
    language: { label: "🗣️ 어학·외국어 회화", tone: "amber" },
    exam: { label: "📝 자격증·수험 기출", tone: "violet" },
    general: { label: "📚 전공·교양 일반", tone: "slate" },
  };

  const PATTERN_META = {
    definition: "개념 정의",
    numbered_list: "번호 열거",
    causal_compare: "인과·비교",
    statute_numeric: "조문·수치",
    language_pair: "어학 표현",
  };

  function formatCategoryBadge(category) {
    return CATEGORY_META[String(category || "general")] || CATEGORY_META.general;
  }

  function formatPatternBadge(pattern) {
    return PATTERN_META[String(pattern || "definition")] || "개념 정의";
  }

  const OLLAMA_CLOUD_MODELS = [
    { id: "glm-5.3-flash", label: "✨ 스마트 자동 생성 (추천 · 초고속 핵심 카드)", recommended: true },
    { id: "deepseek-v4.1-flash", label: "✨ 스마트 자동 생성 (정밀 빈칸·문맥)", recommended: false },
    { id: "gemma4:31b", label: "✨ 스마트 자동 생성 (시각·표·문서 정밀 분석)", recommended: false },
    { id: "glm-5.3", label: "✨ 스마트 자동 생성 (심화·전공 서술 카드)", recommended: false },
    { id: "local_rule", label: "⚡ 오프라인 빠른 생성 (기기 내장 · 0초)", recommended: false },
  ];

  function isOllamaCloudModelBlocked(modelName) {
    const norm = String(modelName || "").trim().toLowerCase();
    if (!norm) return false;
    return norm.startsWith("kimi") || norm.includes("/kimi") || norm.startsWith("minimax") || norm.includes("/minimax");
  }

  function formatIngestStatusBanner(res) {
    if (!res || res.status !== "OK") {
      const code = (res && res.error_code) || "unknown_error";
      return {
        status: "BLOCKED",
        tone: "rose",
        title: `⛔ 자동 덱 생성 차단 (${code})`,
        summary: "문서/사진에서 신뢰할 수 있는 텍스트나 카드를 추출하지 못해 빈 덱 생성을 차단했습니다.",
        canSave: false,
      };
    }
    const cards = Array.isArray(res.cards) ? res.cards : [];
    const st = res.stats || {};
    const cat = formatCategoryBadge(res.category);
    const savedMsg = res.deck_id ? ` · 덱 즉시 저장 완료(#${res.deck_id})` : " · 미리보기 검수 대기";
    const engineDecision = resolveSmartAiEngine({
      manualOverride: res.ollama_cloud_model || "auto",
      offlineOnly: res.ollama_cloud_model === "local_rule",
    });
    const engineBadge = engineDecision.ui_label ? ` · ${engineDecision.ui_label}` : "";
    return {
      status: "OK",
      tone: "emerald",
      title: `✅ [${cat.label}] '${res.deck_name}' — ${cards.length}장 추출${savedMsg}${engineBadge}`,
      summary: `총 ${st.pages || 1}쪽 (OCR ${st.ocr_pages || 0}쪽) · 저신뢰 제외 ${st.low_confidence_lines || 0}줄 · 근거미달 폐기 ${st.dropped_ungrounded || 0}장 · 중복제거 ${st.duplicates || 0}장 · 엔진: ${engineDecision.ui_label || "스마트 자동 생성"} (${res.latency_ms || 0}ms)`,
      canSave: !res.deck_id && cards.length > 0,
    };
  }

  const STORE_CATEGORY_LABELS = {
    all: "전체 브레인팩",
    moe_curriculum: "📚 교육부 필수(9종)",
    starter_free: "🎁 무료 기본",
    k12_textbook: "🏫 중·고등 내신 교과서",
    hanja_history: "漢字 한자·한국사",
    language_exam: "🗣️ 토익·JLPT 어학",
    pro_cert: "⚖️ 공무원·IT 자격증",
  };

  function filterStorePacks(packs, categoryFilter) {
    const list = Array.isArray(packs) ? packs : [];
    const cat = String(categoryFilter || "all").trim();
    if (!cat || cat === "all") return list;
    if (cat === "moe_curriculum") {
      return list.filter((p) => p && String(p.pack_id || "").startsWith("pack.moe."));
    }
    return list.filter((p) => p && p.category === cat);
  }

  function formatStorePackCard(pack) {
    const p = pack || {};
    const isUnlocked = Boolean(p.unlocked || p.is_free_starter);
    const priceKrw = Number(p.price_krw) || 0;
    const rawPriceLabel = p.price_label || (priceKrw === 0 ? "무료 기본 탑재" : `₩${priceKrw.toLocaleString("ko-KR")}`);
    return {
      packId: String(p.pack_id || ""),
      title: String(p.title || ""),
      subtitle: String(p.subtitle || ""),
      badgeLabel: String(p.badge_label || "BrainPack"),
      priceKrw,
      priceLabel: isUnlocked ? "✅ 앱 내 장착됨" : `🛒 구매 및 즉시 장착 (${rawPriceLabel})`,
      unlocked: isUnlocked,
      tone: isUnlocked ? "emerald" : "indigo",
      estimatedCountLabel: `수록 문항 약 ${Number(p.estimated_card_count || p.estimated_cards) || 24}장`,
      features: Array.isArray(p.features) ? p.features : [],
      sampleCards: Array.isArray(p.sample_cards) ? p.sample_cards : [],
    };
  }

  const NAVIGATION_TABS = [
    { id: "study", icon: "🏠", label: "학습" },
    { id: "curriculum", icon: "🏫", label: "시험·급수" },
    { id: "create", icon: "➕", label: "만들기" },
    { id: "store", icon: "🛒", label: "스토어" },
    { id: "stats", icon: "📊", label: "내 정보" },
  ];

  const ONBOARDING_MODES = [
    {
      id: "junior",
      icon: "🌱",
      title: "주니어 (초등)",
      desc: "큰 글씨 · 쉬운 3버튼 · 4지선다 퀴즈",
    },
    {
      id: "teen",
      icon: "🚀",
      title: "중고등 (내신·수능)",
      desc: "교과서 시험범위 단원 · 스피드 암기",
    },
    {
      id: "adult",
      icon: "🎓",
      title: "성인 (자격증·어학·전공)",
      desc: "핵심 요약 · 정밀 복습 · 자유 입력",
    },
  ];

  function resolveActivePageState(activeTab, onboardingCompleted) {
    const validIds = NAVIGATION_TABS.map((t) => t.id);
    const tab = validIds.includes(String(activeTab || "")) ? String(activeTab) : "study";
    const visiblePages = {};
    validIds.forEach((id) => {
      visiblePages[id] = id === tab;
    });
    return {
      showOnboarding: !Boolean(onboardingCompleted),
      activeTab: tab,
      visiblePages,
    };
  }

  function cleanExpectedAnswerText(rawText) {
    return _getModule("BrainDeckCatalogStoreCore").cleanExpectedAnswerText(rawText);
  }
  function extractMeaningfulAnswerTokens(rawText) {
    return _getModule("BrainDeckCatalogStoreCore").extractMeaningfulAnswerTokens(rawText);
  }
  function buildCharBigrams(rawText) {
    return _getModule("BrainDeckCatalogStoreCore").buildCharBigrams(rawText);
  }
  function evaluateTypedAnswerUnderstanding(userAnswer, expectedAnswer) {
    return _getModule("BrainDeckCatalogStoreCore").evaluateTypedAnswerUnderstanding(userAnswer, expectedAnswer);
  }
  function computeAnkiQueueCounts(cards) {
    const list = Array.isArray(cards) ? cards : [];
    let newCount = 0;
    let learnCount = 0;
    let reviewCount = 0;
    list.forEach((c) => {
      if (!c) return;
      const st = String(c.state || "new").toLowerCase();
      const lapses = Number(c.lapses) || 0;
      if (st === "new") {
        newCount += 1;
      } else if (st === "learning" || st === "relearning" || lapses > 0) {
        learnCount += 1;
      } else {
        reviewCount += 1;
      }
    });
    return { newCount, learnCount, reviewCount };
  }

  function isLeechCardJs(cardOrObj, threshold = 8) {
    if (!cardOrObj) return false;
    const lapses = Number(cardOrObj.lapses) || 0;
    if (lapses >= Math.max(1, Number(threshold) || 8)) return true;
    const rawTags = Array.isArray(cardOrObj.tags)
      ? cardOrObj.tags
      : String(cardOrObj.tags_csv || cardOrObj.tagsCsv || "").split(",");
    return rawTags.some((t) => {
      const clean = String(t || "").trim().toLowerCase();
      return clean === "leech" || clean === "거머리" || clean === "flag:leech";
    });
  }

  function previewNextIntervalsJs(cardOrObj) {
    const c = cardOrObj && typeof cardOrObj === "object" ? cardOrObj : {};
    const st = String(c.state || "new").trim().toLowerCase();
    const reps = Number(c.reps) || 0;
    const stability = Number(c.stability) || 0;
    const step = Number(c.intra_day_step ?? c.intraDayStep) || 0;
    if ((st === "new" || reps <= 0 || stability <= 0) && step <= 0) {
      return { 1: "<1분", 2: "6분", 3: "10분", 4: "4일" };
    }
    if (st === "learning" || st === "relearning" || step >= 1) {
      return { 1: "<1분", 2: "10분", 3: "1일", 4: "4일" };
    }
    const hardDays = Math.max(1, Math.round(stability * 1.2));
    const goodDays = Math.max(hardDays + 1, Math.round(stability * 2.5));
    const easyDays = Math.max(goodDays + 1, Math.max(4, Math.round(stability * 3.8)));
    return { 1: "10분", 2: `${hardDays}일`, 3: `${goodDays}일`, 4: `${easyDays}일` };
  }

  function filterStudyQueue(cards, filterMode, sessionWrongCardIds, markedCardIds) {
    const list = Array.isArray(cards) ? cards : [];
    const mode = String(filterMode || "all").toLowerCase();
    const wrongSet = new Set(Array.isArray(sessionWrongCardIds) ? sessionWrongCardIds.map(Number) : []);
    const markedSet = new Set(Array.isArray(markedCardIds) ? markedCardIds.map(Number) : []);

    if (mode === "wrong_only") {
      return list.filter((c) => {
        if (!c) return false;
        const cid = Number(c.card_id ?? c.cardId);
        const st = String(c.state || "").toLowerCase();
        const lapses = Number(c.lapses) || 0;
        return lapses > 0 || st === "learning" || st === "relearning" || wrongSet.has(cid);
      });
    }
    if (mode === "marked_only") {
      return list.filter((c) => {
        if (!c) return false;
        const cid = Number(c.card_id ?? c.cardId);
        return Boolean(c.marked) || markedSet.has(cid);
      });
    }
    if (mode === "leech_only") {
      return list.filter((c) => isLeechCardJs(c));
    }
    return list;
  }

  const AGE_TIER_UI_PROFILES = {
    junior: {
      ageTier: "junior",
      themeLabel: "🌱 주니어",
      questionFontPx: 22,
      minTouchTargetPx: 56,
      cardBorderRadiusPx: 20,
      maxFrontChars: 40,
      maxBackChars: 60,
      defaultQuizStage: 0,
      allowEasyButton: false,
      privacyHardLock: true,
      bannerText: "🌱 주니어 모드 (큰 글씨 · 4지선다)",
    },
    teen: {
      ageTier: "teen",
      themeLabel: "🚀 중고등",
      questionFontPx: 19,
      minTouchTargetPx: 48,
      cardBorderRadiusPx: 14,
      maxFrontChars: 100,
      maxBackChars: 150,
      defaultQuizStage: 0,
      allowEasyButton: true,
      privacyHardLock: false,
      bannerText: "🚀 중고등 모드 (내신·수능 표준)",
    },
    adult: {
      ageTier: "adult",
      themeLabel: "🎓 성인",
      questionFontPx: 17,
      minTouchTargetPx: 44,
      cardBorderRadiusPx: 12,
      maxFrontChars: 220,
      maxBackChars: 400,
      defaultQuizStage: 2,
      allowEasyButton: true,
      privacyHardLock: false,
      bannerText: "🎓 성인 모드 (자격증·전공 고밀도)",
    },
  };

  function resolveUiUxTokens(ageTier, viewportWidth, isStandalone) {
    const tierKey = String(ageTier || "teen").trim().toLowerCase();
    const base = AGE_TIER_UI_PROFILES[tierKey] || AGE_TIER_UI_PROFILES.teen;
    const vw = Number(viewportWidth) || 1200;
    let navigationMode = "desktop_studio_3pane";
    if (vw < 768) {
      navigationMode = "bottom_tabs_5";
    } else if (vw < 1100) {
      navigationMode = "navigation_rail_split";
    }
    return {
      ...base,
      viewportWidth: vw,
      navigationMode,
      showPwaInstallBanner: !Boolean(isStandalone),
    };
  }

  function calculateStoreBundleQuote(packs, selectedPackIds) {
    const list = Array.isArray(packs) ? packs : [];
    const selectedSet = new Set(Array.isArray(selectedPackIds) ? selectedPackIds.map(String) : []);
    let subtotalKrw = 0;
    const billablePackIds = [];
    list.forEach((p) => {
      if (!p || !selectedSet.has(String(p.pack_id))) return;
      const isUnlocked = Boolean(p.unlocked || p.is_free_starter);
      const price = Number(p.price_krw) || 0;
      if (!isUnlocked && price > 0) {
        billablePackIds.push(String(p.pack_id));
        subtotalKrw += price;
      }
    });
    const discountApplied = billablePackIds.length >= 3;
    const finalPriceKrw = discountApplied ? Math.floor((subtotalKrw * 85) / 1000) * 10 : subtotalKrw;
    return {
      billablePackIds,
      billableCount: billablePackIds.length,
      subtotalKrw,
      discountKrw: subtotalKrw - finalPriceKrw,
      finalPriceKrw,
      finalKrw: finalPriceKrw,
      discountApplied,
    };
  }

  function classifyScriptProfileJs(text) {
    return _getModule("BrainDeckCatalogStoreCore").classifyScriptProfileJs(text);
  }
  function isScriptProfileCompatibleJs(targetProfile, candidateProfile) {
    return _getModule("BrainDeckCatalogStoreCore").isScriptProfileCompatibleJs(targetProfile, candidateProfile);
  }
  function normalizeAtomicTargetAnswerJs(frontText, rawTarget, preserveKoreanParenthetical) {
    return _getModule("BrainDeckCatalogStoreCore").normalizeAtomicTargetAnswerJs(frontText, rawTarget, preserveKoreanParenthetical);
  }
  function extractTargetAndExplanation(frontText, backText, explicitTarget, explicitExtra) {
    return _getModule("BrainDeckCatalogStoreCore").extractTargetAndExplanation(frontText, backText, explicitTarget, explicitExtra);
  }
  function generateProgressiveHint(targetAnswer, extraExplanation, step) {
    return _getModule("BrainDeckCatalogStoreCore").generateProgressiveHint(targetAnswer, extraExplanation, step);
  }
  function interleaveAndShuffleStudyQueue(cards, shuffleMode, seed) {
    const list = Array.isArray(cards) ? cards.slice() : [];
    const mode = String(shuffleMode || "interleaved").toLowerCase();
    if (list.length <= 1 || mode === "sequential" || mode === "off") {
      return list;
    }
    // Simple deterministic LCG PRNG for reproducible tests while varying per session when seed omitted
    let rngState = Number.isFinite(Number(seed)) ? Math.abs(Number(seed)) + 1 : 20261021;
    function nextRand() {
      rngState = (rngState * 1664525 + 1013904223) % 4294967296;
      return rngState / 4294967296;
    }
    function shuffleArr(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextRand() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
      }
      return a;
    }
    if (mode === "random") {
      return shuffleArr(list);
    }
    function resolveBucketKey(c) {
      let tags = [];
      if (Array.isArray(c.tags)) {
        tags = c.tags.map(String);
      } else if (typeof c.tags_json === "string" && c.tags_json.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(c.tags_json);
          if (Array.isArray(parsed)) tags = parsed.map(String);
        } catch (_e) {
          tags = [];
        }
      }
      const prefixes = ["kr.", "hanja-", "hanja_", "moe-", "ko-", "khist:", "exam-", "law-", "sci-", "cert-", "U0", "u"];
      for (let i = 0; i < tags.length; i += 1) {
        const t = tags[i].trim();
        if (prefixes.some((p) => t.startsWith(p))) return t;
      }
      const generic = new Set(["curriculum", "combined_exam", "basic", "cloze", "speaking", "auto"]);
      for (let i = 0; i < tags.length; i += 1) {
        const t = tags[i].trim();
        if (t && !t.startsWith("diff_") && !generic.has(t)) return t;
      }
      return String(c.deck_name || c.pattern || c.note_type || "default");
    }
    // Group by source bucket (unit / collection / topic / deck)
    const buckets = new Map();
    list.forEach((c) => {
      if (!c) return;
      const bKey = resolveBucketKey(c);
      if (!buckets.has(bKey)) buckets.set(bKey, []);
      buckets.get(bKey).push(c);
    });
    const bucketKeys = shuffleArr(Array.from(buckets.keys()));
    bucketKeys.forEach((k) => {
      const group = shuffleArr(buckets.get(k));
      group.sort((a, b) => {
        const stA = String(a.state || "").toLowerCase();
        const stB = String(b.state || "").toLowerCase();
        const prioA = stA === "learning" || stA === "relearning" ? 0 : 1;
        const prioB = stB === "learning" || stB === "relearning" ? 0 : 1;
        return prioA - prioB;
      });
      buckets.set(k, group);
    });

    const result = [];
    let lastBucket = null;
    let streak = 0;
    const total = list.length;

    while (result.length < total) {
      const activeKeys = bucketKeys.filter((k) => buckets.get(k).length > 0);
      if (activeKeys.length === 0) break;
      let candidates = activeKeys;
      if (activeKeys.length > 1 && lastBucket && streak >= 2) {
        const nonStreak = activeKeys.filter((k) => k !== lastBucket);
        if (nonStreak.length > 0) candidates = nonStreak;
      }
      candidates.sort((a, b) => {
        const diffSwitchA = a !== lastBucket ? 0.35 : 0;
        const diffSwitchB = b !== lastBucket ? 0.35 : 0;
        return (buckets.get(b).length + diffSwitchB) - (buckets.get(a).length + diffSwitchA);
      });
      const chosenKey = candidates[0];
      const nextCard = buckets.get(chosenKey).shift();
      result.push(nextCard);
      if (chosenKey === lastBucket) {
        streak += 1;
      } else {
        lastBucket = chosenKey;
        streak = 1;
      }
    }
    return result;
  }

  const DIFFICULTY_LEVEL_MODES = [
    { id: "standard", label: "표준 (기본)" },
    { id: "lv1", label: "Lv.1 기초·핵심" },
    { id: "lv2", label: "Lv.2 실전 문맥 빈칸" },
    { id: "lv3", label: "Lv.3 심화·역방향" },
    { id: "mixed", label: "통합 (Lv.1~3 밸런스)" },
  ];

  // ============================================================================
  // v5.5 Core Memory-Science Frame 1: LearnerProfile v2 & Centralized Policy
  // ============================================================================
  function buildLearnerProfilePreset(ageTier) {
    const tier = ["junior", "teen", "adult"].includes(String(ageTier || "").toLowerCase())
      ? String(ageTier).toLowerCase()
      : "teen";
    if (tier === "junior") {
      return {
        ageTier: "junior",
        solveMode: "choice",
        difficulty: "lv1",
        order: "interleaved",
        autoSave: true,
      };
    }
    if (tier === "adult") {
      return {
        ageTier: "adult",
        solveMode: "adaptive",
        difficulty: "mixed",
        order: "interleaved",
        autoSave: true,
      };
    }
    return {
      ageTier: "teen",
      solveMode: "adaptive",
      difficulty: "mixed",
      order: "interleaved",
      autoSave: true,
    };
  }

  function normalizeLearnerProfile(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const preset = buildLearnerProfilePreset(src.ageTier || src.age_tier || "teen");
    const solveModeRaw = String(src.solveMode || src.solve_mode || preset.solveMode).toLowerCase();
    const solveMode = ["adaptive", "flip", "choice", "typing"].includes(solveModeRaw)
      ? solveModeRaw
      : preset.solveMode;
    const diffRaw = String(src.difficulty || src.difficultyLevel || preset.difficulty).toLowerCase();
    const difficulty = ["standard", "lv1", "lv2", "lv3", "mixed"].includes(diffRaw)
      ? diffRaw
      : preset.difficulty;
    const orderRaw = String(src.order || src.shuffleMode || preset.order).toLowerCase();
    const order = ["interleaved", "random", "sequential"].includes(orderRaw)
      ? orderRaw
      : preset.order;
    const autoSave = src.autoSave !== undefined ? Boolean(src.autoSave) : true;

    const tierLabel = preset.ageTier === "junior" ? "초등·기초" : (preset.ageTier === "teen" ? "중고등·시험" : "성인·자격증");
    const modeLabel = solveMode === "adaptive" ? "자동진화(선다→서술)" : (solveMode === "choice" ? "4지선다" : (solveMode === "typing" ? "직접타이핑" : "카드뒤집기"));
    const diffLabel = difficulty === "lv1" ? "Lv.1 기초" : (difficulty === "lv2" ? "Lv.2 빈칸" : (difficulty === "lv3" ? "Lv.3 심화" : (difficulty === "mixed" ? "통합(Lv.1~3)" : "표준")));
    const orderLabel = order === "interleaved" ? "스마트교차섞기" : (order === "random" ? "완전랜덤" : "순차");

    return {
      ageTier: preset.ageTier,
      solveMode,
      difficulty,
      order,
      autoSave,
      summaryLabel: `🎯 ${tierLabel} · ${modeLabel} · ${diffLabel} · ${orderLabel}`,
    };
  }

  // ============================================================================
  // v5.5 Core Memory-Science Frame 2: 1-Card 1-Mode Solver Resolution
  // ============================================================================
  function resolveCardSolveMode(card, profile) {
    const prof = normalizeLearnerProfile(profile);
    if (prof.solveMode === "flip" || prof.solveMode === "choice" || prof.solveMode === "typing") {
      return prof.solveMode;
    }
    const reps = Number((card && card.reps) || 0);
    const st = String((card && card.state) || "new").toLowerCase();
    if (reps <= 0 || st === "new") {
      return "choice";
    }
    return "typing";
  }

  // ============================================================================
  // v5.5 Core Memory-Science Frame 3: EvidenceRatingGuard (Metacognitive Calibration)
  // ============================================================================
  function resolveAllowedRatings(evidence, ageTier) {
    const ev = evidence && typeof evidence === "object" ? evidence : {};
    const tier = ["junior", "teen", "adult"].includes(String(ageTier || ev.ageTier || "").toLowerCase())
      ? String(ageTier || ev.ageTier).toLowerCase()
      : "adult";

    if (!ev.isRevealed) {
      return {
        allowedRatings: [],
        recommendedRating: null,
        maxRating: 0,
        lockedReason: "pre_reveal",
        bannerText: "정답을 확인하기 전에는 난이도 평가를 누를 수 없습니다.",
      };
    }

    const verdictUpper = String(ev.typedVerdict || "").toUpperCase();
    if (ev.dontKnow === true || ev.choiceCorrect === false || verdictUpper === "UNKNOWN") {
      return {
        allowedRatings: [1],
        recommendedRating: 1,
        maxRating: 1,
        lockedReason: "wrong_or_unknown",
        bannerText: "🔴 오답·모름 상태에서는 기억 왜곡 방지를 위해 '다시(1)'만 선택할 수 있습니다.",
      };
    }

    if (Number(ev.hintStep || 0) >= 1) {
      return {
        allowedRatings: [1, 2],
        recommendedRating: 2,
        maxRating: 2,
        lockedReason: "hint_assisted_cap",
        bannerText: "🟡 힌트 단서를 사용했으므로 최대 평가가 '어려움(2)'으로 제한됩니다 (인출 강도 보정).",
      };
    }

    if (verdictUpper === "PARTIAL") {
      return {
        allowedRatings: [1, 2, 3],
        recommendedRating: 2,
        maxRating: 3,
        lockedReason: "partial_recall_cap",
        bannerText: "🟡 부분 인출 상태이므로 '쉬움(4)'이 잠기며 '어려움(2)'을 권장합니다.",
      };
    }

    if (tier === "junior") {
      return {
        allowedRatings: [1, 2, 3],
        recommendedRating: 3,
        maxRating: 3,
        lockedReason: "none",
        bannerText: "🟢 스스로 인출에 성공했습니다! '알겠음(3)'을 추천합니다.",
      };
    }

    return {
      allowedRatings: [1, 2, 3, 4],
      recommendedRating: 3,
      maxRating: 4,
      lockedReason: "none",
      bannerText: "🟢 무보조 인출 성공! 기억 난이도에 맞춰 평가하세요 ('보통 3' 추천).",
    };
  }

  // ============================================================================
  // v5.5 Core Memory-Science Frame 4: Sibling Burying (1-Concept 1-Session)
  // ============================================================================
  function extractCardTagList(card) {
    if (!card) return [];
    if (Array.isArray(card.tags)) return card.tags.map((t) => String(t).trim()).filter(Boolean);
    if (typeof card.tags_json === "string" && card.tags_json.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(card.tags_json);
        if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
      } catch (_e) {
        return [];
      }
    }
    if (typeof card.tags === "string") {
      return card.tags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    }
    return [];
  }

  function deduplicateSessionSiblings(cards) {
    const list = Array.isArray(cards) ? cards.slice() : [];
    if (list.length <= 1) return list;

    function getConceptKey(c) {
      const tags = extractCardTagList(c);
      for (let i = 0; i < tags.length; i += 1) {
        if (tags[i].startsWith("root_concept:") && tags[i].length > 13) return tags[i];
      }
      for (let i = 0; i < tags.length; i += 1) {
        if (tags[i].startsWith("concept:") && tags[i].length > 8) return tags[i];
      }
      return null;
    }

    function priorityRank(c) {
      const st = String((c && c.state) || "new").toLowerCase();
      const stateScore = (st === "learning" || st === "relearning") ? 0 : (st === "review" ? 1 : 2);
      const tags = extractCardTagList(c);
      const diffScore = (tags.includes("diff_lv1") || tags.includes("lv1"))
        ? 0
        : ((tags.includes("diff_lv2") || tags.includes("lv2")) ? 1 : 2);
      return stateScore * 10 + diffScore;
    }

    const bestByConcept = new Map();
    list.forEach((c) => {
      const ckey = getConceptKey(c);
      if (!ckey) return;
      if (!bestByConcept.has(ckey) || priorityRank(c) < priorityRank(bestByConcept.get(ckey))) {
        bestByConcept.set(ckey, c);
      }
    });

    const seen = new Set();
    const out = [];
    list.forEach((c) => {
      const ckey = getConceptKey(c);
      if (!ckey) {
        out.push(c);
        return;
      }
      if (seen.has(ckey)) return;
      seen.add(ckey);
      out.push(bestByConcept.get(ckey));
    });
    return out;
  }

  // ============================================================================
  // v5.5 Core Memory-Science Frame 5: Standalone Apple iOS/iPadOS/Web PWA Engine
  // ============================================================================
  const STANDALONE_TEXTBOOKS = _getModule("BrainDeckCatalogStoreCore").STANDALONE_TEXTBOOKS;
  const STANDALONE_COLLECTIONS = _getModule("BrainDeckCatalogStoreCore").STANDALONE_COLLECTIONS;
  const STANDALONE_STORE_PACKS = _getModule("BrainDeckStandaloneEngineOps", "./modules/standalone_engine_ops.js").STANDALONE_STORE_PACKS;
  const STANDALONE_PACK_CARD_COUNT_INDEX = [
    { pack_id: "pack.free.starter_k12", estimated_card_count: 1020 },
    { pack_id: "pack.moe.eng.elem34", estimated_card_count: 1015 },
    { pack_id: "pack.moe.eng.elem56", estimated_card_count: 1040 },
    { pack_id: "pack.moe.eng.mid1200", estimated_card_count: 1200 },
    { pack_id: "pack.moe.eng.high_csat", estimated_card_count: 1150 },
    { pack_id: "pack.moe.kor.orthography_lit", estimated_card_count: 1035 },
    { pack_id: "pack.moe.hanja.mid1800", estimated_card_count: 1350 },
    { pack_id: "pack.moe.hist.essential", estimated_card_count: 1080 },
    { pack_id: "pack.moe.sci.core_formula", estimated_card_count: 1045 },
    { pack_id: "pack.moe.math.core_formula", estimated_card_count: 1060 },
    { pack_id: "pack.mid1.eng.donga_yoon.full", estimated_card_count: 1024 },
    { pack_id: "pack.mid2.eng.donga_yoon.full", estimated_card_count: 1032 },
    { pack_id: "pack.mid2.hist.miraeen.full", estimated_card_count: 1018 },
    { pack_id: "pack.high1.sci.visang.full", estimated_card_count: 1028 },
    { pack_id: "pack.exam.hanja_master", estimated_card_count: 1250 },
    { pack_id: "pack.exam.khist_master", estimated_card_count: 1080 },
    { pack_id: "pack.exam.lang_toeic_jlpt", estimated_card_count: 1180 },
    { pack_id: "pack.pro.law_it_cert", estimated_card_count: 1050 },
  ];

  const GENERIC_SECTION_LABELS_JS = new Set([
    "특징", "배경", "개요", "목적", "의의", "종류", "장점", "단점", "장단점",
    "원인", "결과", "원인과 결과", "정의", "개념", "요약", "결론", "서론", "본론",
    "구분", "내용", "핵심", "핵심 내용", "정리", "핵심 정리", "예시", "사례",
    "비교", "차이", "차이점", "공통점", "효과", "기대 효과", "영향", "한계",
    "문제점", "해결책", "대책", "방안", "절차", "과정", "순서", "방법", "원리",
    "구조", "기능", "역할", "조건", "요건", "성립 요건", "주의", "참고", "비고",
    "보충", "심화", "출처", "기타", "도입", "전개", "정착", "배경과 원인",
    "주요 내용", "추진 배경", "발생 원인", "목차", "차례", "참고문헌", "참고 문헌",
    "부록", "머리말", "서문", "맺음말", "문제 제기", "이론적 배경", "선행 연구",
    "현황", "과제", "전망", "찾아보기", "판권", "저작권",
    "introduction", "background", "overview", "methodology", "methods",
    "results", "discussion", "conclusion", "summary", "references",
    "bibliography", "appendix", "table of contents", "contents", "index", "preface"
  ]);

  function normalizeLabelCoreJs(rawLabel) {
    const cleaned = String(rawLabel || "").trim().replace(/^[:：\-\–\—[\]<>【】《》()"'\s]+|[:：\-\–\—[\]<>【】《》()"'\s]+$/g, "");
    const stripped = cleaned
      .replace(/^(?:[\[<【《(]?\s*(?:제\s*\d+\s*[장절편부관과단원]|[①②③④⑤⑥⑦⑧⑨⑩]|(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+|\d+(?:\.\d+)*|[가-하]|[A-Za-z])\s*[\]>】》).:：\-])\s*)+/i, "")
      .replace(/^[:：\-\–\—[\]<>【】《》()"'\s]+|[:：\-\–\—[\]<>【】《》()"'\s]+$/g, "");
    return stripped || cleaned;
  }

  function isGenericSectionLabel(rawLabel) {
    const rawClean = String(rawLabel || "").replace(/\s+/g, " ").trim();
    if (!rawClean || rawClean.length > 28) return false;
    const core = normalizeLabelCoreJs(rawClean).toLowerCase();
    if (!core) return true;
    if (GENERIC_SECTION_LABELS_JS.has(core)) return true;
    if (/^(?:제?\s*\d+\s*[장절편부관과단원]|파트\s*\d+|단계\s*\d+|유형\s*\d+|특징\s*\d+|원인\s*\d+|목적\s*\d+|내용\s*\d+|배경\s*\d+|의의\s*\d+)$/i.test(core)) {
      return true;
    }
    return false;
  }

  function hasFactualPredicateJs(text) {
    return /(?:이다|입니다|한다|된다|있다|없다|말한다|뜻한다|의미한다|가리킨다|정의된다|구성된다|분류된다|나뉜다|발생한다|일어난다|작용한다|억제한다|촉진한다|유발한다|소멸한다|규정한다|보장한다|제한한다|위반한다|합성하는|전환하는|교환하는|수행하는|is\s+defined\s+as|refers\s+to|means|leads\s+to|results\s+in|causes|consists\s+of|->|→)/i.test(String(text || ""));
  }

  function isTocOrStructuralHeading(text, kind) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (cleaned.length < 2) return true;
    const stripped = cleaned.replace(/^[#*•\-\s]+/, "").trim();
    if (!stripped) return true;

    if (/^[\[<【《(]*\s*(?:목\s*차|차\s*례|table\s+of\s+contents|contents|index|찾아보기|참고\s*문헌|references|bibliography|부\s*록|appendix|머리말|서문|일러두기|판권|저작권|단원\s*요약|학습\s*목표|핵심\s*정리|생각해보기|연습\s*문제|확인\s*문제|출제\s*포인트)\s*[\]>】》)]*$/i.test(stripped)) {
      return true;
    }
    if (/^(?:목\s*차|차\s*례|table\s+of\s+contents|contents)\s*(?::|：|-|—|\d|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ])/i.test(stripped)) {
      return true;
    }
    if (/(?:\.{2,}|…+|·{2,}|•{2,}|-{2,}|─{2,}|_{2,}|\s{3,})\s*(?:p\.?\s*)?\d{1,4}\s*(?:쪽|페이지|p)?$/i.test(stripped)) {
      return true;
    }
    if (/^(?:제\s*\d+\s*[장절편부관과단원]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\.?|\d+(?:\.\d+)*\.?|\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩])\s+[^\n]{1,55}?\s+(?:p\.?\s*\d{1,4}|\d{1,4}\s*(?:쪽|페이지|p))$/i.test(stripped)) {
      return true;
    }
    if (!/[:：]|->|→/.test(stripped) && isGenericSectionLabel(stripped)) {
      return true;
    }
    if (/^(?:제\s*\d+\s*(?:장|절|편|부|관|과|단원)|chapter\s+\d+|part\s+[0-9ivx]+|unit\s+\d+|lesson\s+\d+|section\s+\d+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.)(?:\s|$|:)/i.test(stripped)) {
      if (!hasFactualPredicateJs(stripped)) return true;
      if (/[:：]/.test(stripped)) {
        const rhs = stripped.split(/[:：]/).slice(1).join(":").trim();
        if (rhs.length < 12 && !hasFactualPredicateJs(rhs)) return true;
      }
    }
    const numMatches = stripped.match(/(?:[①②③④⑤⑥⑦⑧⑨⑩]|\(\d+\)|\d+\)|\d+\.)\s*([^\d①-⑩()]+)/g) || [];
    if (numMatches.length >= 2) {
      let tocHits = 0;
      numMatches.forEach((m) => {
        const core = normalizeLabelCoreJs(m).toLowerCase();
        if (GENERIC_SECTION_LABELS_JS.has(core) || /(?:\.{2,}|…+)\s*\d+/.test(m)) tocHits += 1;
      });
      if (tocHits >= 2 && tocHits * 2 >= numMatches.length) return true;
    }
    if (String(kind || "") === "heading" && !hasFactualPredicateJs(stripped)) {
      return true;
    }
    if (!hasFactualPredicateJs(stripped) && !/[:：]|->|→/.test(stripped) && stripped.length <= 28) {
      if (/^(?:\d+(?:\.\d+)*\.?|\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.?|[가-하]\.)\s+\S+/.test(stripped)) {
        return true;
      }
    }
    return false;
  }

  function maskTermInDescJs(desc, term, answer) {
    const d = String(desc || "").trim();
    const t = String(term || "").trim();
    const a = String(answer || "").trim();
    if (!d || (!t && !a)) return d;
    const candidates = [];
    function addCand(raw) {
      if (!raw) return;
      if (!candidates.includes(raw)) candidates.push(raw);
      const base = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
      if (base && !candidates.includes(base)) candidates.push(base);
    }
    addCand(t);
    if (t.includes(":")) {
      const tTail = t.split(":").pop().trim();
      if (tTail.length >= 2) addCand(tTail);
    }
    const aBase = a.replace(/\s*\([^)]*\)\s*/g, "").trim();
    if (aBase && aBase.length <= 15 && !aBase.includes(" ")) {
      addCand(a);
    }
    let masked = d;
    candidates.forEach((cand) => {
      if (cand.length >= 2 || /[\u4e00-\u9fff\u3400-\u4dbf]/.test(cand)) {
        const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        masked = masked.replace(new RegExp(escaped, "gi"), "[ ___ ]");
      }
    });
    return masked;
  }

  function cleanCardFrontForDisplayJs(frontText) {
    let s = String(frontText || "").trim();
    if (!s) return s;
    s = s.replace(
      /^다음\s*뜻·훈음에\s*해당하는\s*표제어는\?\s*\n+\s*\[\s*___\s*\]\s*:\s*/g,
      "[ ___ ] — "
    );
    s = s.replace(
      /^(?:우리말\s*뜻|훈음·뜻)\s*「([^」]+)」에\s*해당하는\s*(?:영단어·표현|한자·성어|표제어)은\??$/g,
      "$1"
    );
    s = s.replace(
      /^'([^']+)'의\s*(?:문맥·정의로\s*알맞은\s*것은|정확한\s*뜻과\s*훈음·해설은)\??$/g,
      "$1"
    );
    s = s.replace(
      /^(?:빈칸에\s*알맞은\s*맞춤법\s*표기는\?|다음\s*설명에\s*해당하는\s*용어는\?|다음\s*빈칸에\s*들어갈\s*용어를\s*쓰시오\.?|문맥에\s*알맞은\s*영단어를\s*채우세요:|다음\s*일본어\s*어휘의\s*요미가나\(읽기\)와\s*우리말\s*뜻은\?)\s*\n+/g,
      ""
    );
    s = s.replace(/^\[(?:핵심\s*원리|개념\s*적용|기출\s*변별|빈칸\s*추론)\]\s*/g, "");
    s = s.replace(
      /^원자번호\s*(\d+번)\s*\[\s*___\s*\]\(([^)]+)\):\s*(.+)$/g,
      "[주기율표 원소] 원자번호 $1 · 기호 $2 — $3"
    );
    s = s.replace(
      /^(\[[^\]]+\]\s*)?(?:\[\s*___\s*\]|[^|]+?)\s*\|\s*(?:핵심\s*)?공식(?:·원리)?:\s*[^|]+\|\s*해설:\s*/g,
      "$1"
    );
    s = s.replace(
      /^(\[[^\]]+\]\s*)?\[\s*___\s*\]\s*\((.+?)\)\s*:\s*/g,
      "$1($2) "
    );
    s = s.replace(
      /^(\[[^\]]+\]\s*)?\[\s*___\s*\]\s*:\s*/g,
      "$1"
    );
    s = s.replace(
      /\s*(?:➔|->|—|-)\s*(?:알맞은\s*(?:표제어[·\s]*표현|용어[·\s]*표현|표제어|핵심\s*표현)은|해당\s*(?:역사\s*)?개념은|훈음·뜻은|핵심\s*개념·정답은|문맥\s*속\s*의미와\s*쓰임은|빈칸에\s*들어갈\s*용어는|위\s*[^—?]+에\s*해당하는\s*[^?]+|다음\s*어휘·표현의\s*문맥\s*속\s*정확한\s*뜻은)\??\s*$/g,
      ""
    );
    s = s.replace(/\s*\[심화\s*적용\]\s*$/g, "");
    return s.trim() || String(frontText || "").trim();
  }

  function formatConciseBackJs(answerText, explainText, termText) {
    const ans = String(answerText || "").trim();
    let exp = String(explainText || "").trim();
    if (!exp) return ans;
    if (exp === ans) return ans;
    exp = exp.replace(/^\[[^\]]+\]\s*/, "").trim();
    const t = String(termText || "").replace(/^\[[^\]]+\]\s*/, "").replace(/\s*—\s*(?:핵심\s*해설|공식·원리|공식·항등식|성립\s*조건·해설|표준\s*규범|문법·표현|근거·명세|법리·원리|실전\s*적용)$/, "").trim();
    if (t && (exp.startsWith(`${t}:`) || exp.startsWith(`${t} —`) || exp.startsWith(`${t} |`))) {
      exp = exp.slice(t.length).replace(/^\s*[:—|]\s*/, "").trim();
    }
    if (t && (exp === `${t} — ${ans}` || exp === `${t}: ${ans}`)) {
      return ans;
    }
    exp = exp.replace(/^표제어\s+'[^']+'\s*의\s*핵심\s*뜻은\s*'[^']+'\s*입니다\.?\s*/g, "").trim();
    exp = exp.replace(/^한자\s+\S+\s*—\s*훈음:\s*[^.]+(?:\.\s*|\s*$)/g, "").trim();
    if (!exp || exp === ans || ans.includes(exp)) return ans;
    return `${ans}\n\n💡 해설: ${exp}`;
  }

  const SSOT_CORPUS_SHA256 = "07117a5a84147fb8f1ad17f6a4e8b46e27f337fe7c27f29bbfcef05c8af1277e";
  function verifyCorpusBundleIntegrity(bundle) {
    if (!bundle || typeof bundle !== "object" || !bundle.tsv_bank) {
      throw new Error("CorpusIntegrityError: missing tsv_bank in corpus bundle");
    }
    if (bundle.tsv_sha256 && String(bundle.tsv_sha256) !== SSOT_CORPUS_SHA256) {
      throw new Error("CorpusIntegrityError: corpus tsv_sha256 mismatch");
    }
    if (bundle.signature_b64 !== undefined && (!String(bundle.signature_b64).trim() || String(bundle.signature_b64).length < 64)) {
      throw new Error("CorpusIntegrityError: invalid RSA-2048 signature_b64 on corpus bundle");
    }
    return bundle.tsv_bank;
  }
  const _LOADED_CORPUS_BUNDLE = (function loadExternalCorpusBank() {
    if (typeof globalThis !== "undefined" && globalThis.__BRAINDECK_CORPUS_V8__ && globalThis.__BRAINDECK_CORPUS_V8__.tsv_bank) {
      verifyCorpusBundleIntegrity(globalThis.__BRAINDECK_CORPUS_V8__);
      return globalThis.__BRAINDECK_CORPUS_V8__;
    }
    if (typeof window !== "undefined" && window.__BRAINDECK_CORPUS_V8__ && window.__BRAINDECK_CORPUS_V8__.tsv_bank) {
      verifyCorpusBundleIntegrity(window.__BRAINDECK_CORPUS_V8__);
      return window.__BRAINDECK_CORPUS_V8__;
    }
    if (typeof require === "function") {
      try {
        const fs = require("fs");
        const path = require("path");
        const dirs = [];
        if (typeof __dirname === "string") dirs.push(__dirname);
        if (typeof process !== "undefined" && Array.isArray(process.argv)) {
          for (let a = 0; a < process.argv.length; a += 1) {
            if (String(process.argv[a]).endsWith("viewmodel.js")) {
              dirs.push(path.dirname(process.argv[a]));
            }
          }
        }
        dirs.push(".", "./src/anki_studio/ui/static", "../src/anki_studio/ui/static", "./Documents/개발/BrainDeck/src/anki_studio/ui/static");
        for (let i = 0; i < dirs.length; i += 1) {
          const p = path.resolve(dirs[i], "curriculum_corpus_v8.json");
          if (fs.existsSync(p)) {
            const bundle = JSON.parse(fs.readFileSync(p, "utf8"));
            if (bundle && bundle.tsv_bank) {
              verifyCorpusBundleIntegrity(bundle);
              return bundle;
            }
          }
        }
      } catch (_e) {}
    }
    return { tsv_bank: {}, graded_bank: {} };
  })();
  const AUTHENTIC_SUBJECT_TSV_BANK = _LOADED_CORPUS_BUNDLE.tsv_bank || {};
  const AUTHENTIC_GRADED_TSV_BANK = _LOADED_CORPUS_BUNDLE.graded_bank || {};
  const _PARSED_SUBJECT_BANK_CACHE = {};
  const _PARSED_GRADED_BANK_CACHE = {};

  function resolveGradedBankKeyJs(sourceTag) {
    const s = String(sourceTag || "").toLowerCase();
    if (s.includes("elem-3-4") || s.includes("elem34")) return "eng_elem34";
    if (s.includes("moe-eng:elementary") || s.includes("elem56") || s.includes("elem-5-6")) return "eng_elem56";
    if (s.includes("middle-1200") || s.includes("mid1200") || s.includes("mid1.eng") || s.includes("mid2.eng") || s.includes("mid1-eng")) return "eng_mid1200";
    if (s.includes("high-csat") || s.includes("high_csat")) return "eng_high_csat";
    if (s.includes("toeic")) return "eng_toeic";
    if (s.includes("jlpt") || s.includes("exam-ja")) return "ja_jlpt";
    if (s.includes("8geup") || s.includes("starter_k12")) return "hanja_8geup";
    if (s.includes("7geup")) return "hanja_7geup";
    if (s.includes("6geup")) return "hanja_6geup";
    if (s.includes("5geup")) return "hanja_5geup";
    if (s.includes("4geup")) return "hanja_4geup";
    if (s.includes("3geup")) return "hanja_3geup";
    if (s.includes("hanja-1800") || s.includes("mid1800")) return "hanja_mid1800";
    if (s.includes("idiom")) return "hanja_idiom";
    if (s.includes("dictation")) return "kor_dictation";
    if (s.includes("orthography") || s.includes("moe-kor")) return "kor_orthography_lit";
    if (s.includes("law-statute") || s.includes("constitution")) return "law_statute";
    if (s.includes("cert-it")) return "cert_it";
    return "";
  }

  function getAuthenticGradedBankItems(gradedKey) {
    const gKey = String(gradedKey || "").trim();
    if (!gKey) return [];
    if (_PARSED_GRADED_BANK_CACHE[gKey]) return _PARSED_GRADED_BANK_CACHE[gKey];
    const rawRows = AUTHENTIC_GRADED_TSV_BANK[gKey] || [];
    const isEng = gKey.startsWith("eng_");
    const isJa = gKey === "ja_jlpt";
    const isHanja = gKey.startsWith("hanja_");
    const parsed = rawRows.map((line, idx) => {
      const parts = String(line || "").split("\t");
      const term = (parts[0] || "").trim();
      const answer = (parts[1] || "").trim();
      const ctx = (parts[2] || "").trim();
      const explain = (parts[3] || "").trim();
      let prompt = "";
      let sentence = "";
      if (isEng || isJa) {
        sentence = ctx || "";
        prompt = `【 ${term} 】`;
      } else if (isHanja) {
        prompt = `【 ${term} 】`;
        sentence = "";
      } else {
        const rawCue = ctx || explain || term;
        const maskedTip = maskTermInDescJs(rawCue, term, answer);
        prompt = cleanCardFrontForDisplayJs(maskedTip);
        sentence = "";
      }
      return {
        id: `graded_${gKey}_${idx + 1}`,
        term,
        answer,
        prompt,
        sentence,
        explain: explain || ctx,
        role: isEng || isJa ? "core_vocab" : "core_concept",
      };
    });
    _PARSED_GRADED_BANK_CACHE[gKey] = parsed;
    return parsed;
  }

  function getAuthenticSubjectBankItems(subj) {
    const key = String(subj || "english").toLowerCase();
    if (_PARSED_SUBJECT_BANK_CACHE[key]) return _PARSED_SUBJECT_BANK_CACHE[key];
    const rawRows = AUTHENTIC_SUBJECT_TSV_BANK[key] || AUTHENTIC_SUBJECT_TSV_BANK.english || [];
    const parsed = rawRows.map((line, idx) => {
      const parts = String(line || "").split("\t");
      const term = (parts[0] || "").trim();
      const answer = (parts[1] || "").trim();
      const ctx = (parts[2] || "").trim();
      const explain = (parts[3] || "").trim();
      const isEng = key === "english";
      const isHanja = key === "hanja";
      let prompt = "";
      let sentence = "";
      if (isEng) {
        sentence = ctx || "";
        prompt = `【 ${term} 】`;
      } else if (isHanja) {
        prompt = `【 ${term} 】`;
        sentence = "";
      } else {
        const rawCue = ctx || explain || term;
        const maskedTip = maskTermInDescJs(rawCue, term, answer);
        prompt = cleanCardFrontForDisplayJs(maskedTip);
        sentence = "";
      }
      return {
        id: `auth_${key}_${idx + 1}`,
        term,
        answer,
        prompt,
        sentence,
        explain: explain || ctx,
        role: isEng ? "core_vocab" : "core_concept",
      };
    });
    _PARSED_SUBJECT_BANK_CACHE[key] = parsed;
    return parsed;
  }

  function expandStandaloneItemByDifficulty(item, sourceTag, difficultyLevel) {
    const diff = String(difficultyLevel || "standard").toLowerCase();
    const itemId = String((item && item.id) || "");
    const srcLower = String(sourceTag || "").toLowerCase();
    const isNonVocabConcept =
      /^(kh_|hist_|sci_|sc_|law_|it_|mh_\d|kd_|id_|mk_|math_|auth_hanja|auth_history|auth_science|auth_math|auth_korean|auth_law_it)/.test(itemId) ||
      /khist|hist|sci|math|moe-kor|law|cert|hanja|idiom|dictation/.test(srcLower);
    const defaultRole = isNonVocabConcept ? "core_concept" : "core_vocab";
    const conceptTag = `concept:${itemId}`;
    const roleTag = `role:${item.role || defaultRole}`;
    const baseTags = [sourceTag, conceptTag, roleTag];
    const isGrammar = item.role === "key_grammar";
    const cleanPrompt = cleanCardFrontForDisplayJs(item.prompt || "");

    const lv1Front = cleanPrompt || `【 ${item.term} 】`;
    const lv1Back = formatConciseBackJs(item.answer, item.explain, item.term);

    const isFactPrompt = Boolean(cleanPrompt && (item.term === item.answer || isGrammar));
    const lv3Front = isFactPrompt
      ? `【 ${item.term} 】`
      : `${item.answer}`;
    const lv3Back = isFactPrompt
      ? formatConciseBackJs(item.explain || item.answer, "", item.term)
      : formatConciseBackJs(item.term, item.explain, item.term);

    const cLv1 = {
      front_text: lv1Front,
      back_text: lv1Back,
      note_type: "basic",
      tags: baseTags.concat(["diff_lv1"]),
    };
    const cLv3 = {
      front_text: lv3Front,
      back_text: lv3Back,
      note_type: "basic",
      tags: baseTags.concat(["diff_lv3"]),
    };

    if (diff === "lv1" || diff === "standard") return [cLv1];
    if (diff === "lv2" || diff === "lv3") return [cLv3];
    if (diff === "mixed" || diff === "all") return [cLv1, cLv3];
    return [cLv1];
  }

  function detectSubjectCategoryFromTag(sourceTag, seedItems) {
    const s = String(sourceTag || "").toLowerCase();
    if (/hanja|idiom|8geup|7geup|6geup|5geup|4geup|3geup/.test(s)) return "hanja";
    if (/khist|hist/.test(s)) return "history";
    if (/math/.test(s)) return "math";
    if (/sci/.test(s)) return "science";
    if (/moe-kor|dictation|kor\.orthography/.test(s)) return "korean";
    if (/law|cert/.test(s)) return "law_it";
    if (/eng|toeic|jlpt/.test(s)) return "english";
    const firstId = String((seedItems && seedItems[0] && seedItems[0].id) || "").toLowerCase();
    if (/^(hj_|id_|mh_)/.test(firstId)) return "hanja";
    if (/^(kh_|hist_)/.test(firstId)) return "history";
    if (/^math_/.test(firstId)) return "math";
    if (/^(sci_|sc_)/.test(firstId)) return "science";
    if (/^(kd_|mk_)/.test(firstId)) return "korean";
    if (/^(law_|it_)/.test(firstId)) return "law_it";
    return "english";
  }

  function rotateArrayByOffset(arr, offset) {
    if (!Array.isArray(arr) || arr.length <= 1) return arr || [];
    const k = ((offset % arr.length) + arr.length) % arr.length;
    if (k === 0) return arr;
    return arr.slice(k).concat(arr.slice(0, k));
  }

  function getSubjectPureSeedPool(subj, seedItems, sourceTag) {
    const cleanSeeds = Array.isArray(seedItems) ? seedItems.filter(Boolean) : [];
    const tagLower = String(sourceTag || "").toLowerCase();
    const gradedKey = resolveGradedBankKeyJs(sourceTag);
    if (gradedKey) {
      const gradedItems = getAuthenticGradedBankItems(gradedKey);
      if (gradedItems.length > 0) {
        const grammarSeeds = cleanSeeds.filter((it) => it && it.role === "key_grammar");
        const mergedGraded = gradedItems.concat(grammarSeeds);
        const seenG = new Set();
        const seenPromptsG = new Set();
        const dedupedG = [];
        mergedGraded.forEach((it) => {
          const k = String((it && (it.term || it.id)) || "").trim().toLowerCase();
          const pk = String((it && it.prompt) || "").trim().toLowerCase();
          if (k && !seenG.has(k) && (!pk || !seenPromptsG.has(pk))) {
            seenG.add(k);
            if (pk) seenPromptsG.add(pk);
            dedupedG.push(it);
          }
        });
        return dedupedG.length > 0 ? dedupedG : cleanSeeds;
      }
    }

    const sameSubjectCollections = STANDALONE_COLLECTIONS.filter((c) => {
      const cid = String(c.collection_id || "").toLowerCase();
      if (cid === tagLower) return false;
      if (subj === "hanja") return /idiom/.test(tagLower) ? /idiom/.test(cid) : /hanja/.test(cid);
      if (subj === "history") return /khist|hist/.test(cid);
      if (subj === "math") return /math/.test(cid);
      if (subj === "science") return /sci/.test(cid);
      if (subj === "korean") return /kor|dictation/.test(cid);
      if (subj === "law_it") {
        if (/cert/.test(tagLower)) return /cert/.test(cid);
        if (/law/.test(tagLower)) return /law/.test(cid);
        return /law|cert/.test(cid);
      }
      return /eng|toeic|jlpt/.test(cid);
    }).reduce((acc, c) => acc.concat(c.items || []), []);

    const sameSubjectTextbooks = STANDALONE_TEXTBOOKS.filter((tb) => {
      const tid = String(tb.textbook_id || "").toLowerCase();
      if (subj === "history") return /hist/.test(tid);
      if (subj === "science") return /sci/.test(tid);
      if (subj === "english") return /eng/.test(tid);
      return false;
    }).reduce((acc, tb) => acc.concat(tb.entries || []), []);

    let authenticExtras = getAuthenticSubjectBankItems(subj).slice();
    const merged = cleanSeeds.concat(authenticExtras).concat(sameSubjectCollections).concat(sameSubjectTextbooks);
    const seen = new Set();
    const seenPrompts = new Set();
    const deduped = [];
    merged.forEach((it) => {
      const k = String((it && (it.term || it.id)) || "").trim().toLowerCase();
      const pk = String((it && it.prompt) || "").trim().toLowerCase();
      if (k && !seen.has(k) && (!pk || !seenPrompts.has(pk))) {
        seen.add(k);
        if (pk) seenPrompts.add(pk);
        deduped.push(it);
      }
    });
    return deduped.length > 0 ? deduped : cleanSeeds;
  }

  function padStandaloneSpecsToTarget(seedItems, sourceTag, difficultyLevel, targetCount) {
    const cap = Math.max(1, Number(targetCount || 1000));
    const subj = detectSubjectCategoryFromTag(sourceTag, seedItems);
    const pool = getSubjectPureSeedPool(subj, seedItems, sourceTag);
    const specs = [];
    const seenFronts = new Set();
    const n = Math.max(1, pool.length);
    const rawSeedLen = Array.isArray(seedItems) ? seedItems.filter(Boolean).length : 0;
    let seedCount = Math.min(rawSeedLen, n);
    if (/hanja-grade:8geup/.test(String(sourceTag || ""))) {
      seedCount = Math.min(50, n);
    } else if (/hanja-grade:[76543]geup/.test(String(sourceTag || ""))) {
      seedCount = Math.min(100, n);
    }
    const stepPairs = [];
    for (let i = 0; i < seedCount; i += 1) stepPairs.push([i, 0]);
    for (let i = 0; i < seedCount; i += 1) stepPairs.push([i, 1]);
    for (let i = seedCount; i < n; i += 1) stepPairs.push([i, 0]);
    for (let i = seedCount; i < n; i += 1) stepPairs.push([i, 1]);

    let step = 0;
    const maxSteps = stepPairs.length;
    while (specs.length < cap && step < maxSteps) {
      const pair = stepPairs[step];
      const baseIdx = pair[0];
      const facetIdx = pair[1];
      const base = pool[baseIdx] || { id: `item_${step + 1}`, term: `개념 ${step + 1}`, answer: "정답", explain: "학습 개념" };
      const itemNo = specs.length + 1;
      const diffTag = itemNo % 3 === 1 ? "diff_lv1" : (itemNo % 3 === 2 ? "diff_lv2" : "diff_lv3");
      const isNonVocab = subj !== "english";
      const roleTag = `role:${base.role || (isNonVocab ? "core_concept" : "core_vocab")}`;
      const conceptTag = `concept:${sourceTag || subj}_fact_${itemNo}`;
      const rootConceptTag = `root_concept:${sourceTag || subj}_root_${baseIdx + 1}`;
      const rawTermStr = String(base.term || "").trim();
      const cleanTerm = rawTermStr.replace(/\s*\([^)]*\)\s*/g, "").trim() || rawTermStr;
      const cleanAns = String(base.answer || "").trim();
      const rawPromptSource = String(base.prompt || base.term);
      const shouldMaskTermInPrompt =
        !rawPromptSource.includes("[ ___ ]") &&
        !rawPromptSource.includes("{{c") &&
        (cleanTerm === cleanAns || cleanAns.startsWith(cleanTerm));
      const rawPrompt = cleanCardFrontForDisplayJs(
        shouldMaskTermInPrompt
          ? maskTermInDescJs(rawPromptSource, base.term, base.answer)
          : maskTermInDescJs(rawPromptSource, "", base.answer)
      );

      let frontText = "";
      let backText = formatConciseBackJs(cleanAns, base.explain, cleanTerm);
      if (facetIdx === 0) {
        if (subj === "hanja" || subj === "english") {
          if (base.role === "key_grammar" && rawPrompt) {
            frontText = rawPrompt;
          } else {
            frontText = base.prompt ? cleanCardFrontForDisplayJs(base.prompt) : `【 ${cleanTerm} 】`;
          }
        } else {
          frontText = `${rawPrompt || `【 ${rawTermStr} 】`}`;
        }
      } else {
        if (subj === "hanja") {
          const cleanHuneumOnly = cleanAns.replace(/\s*\((?:부수|획수|총획)[^)]*\)/g, "").trim() || cleanAns;
          frontText = `${cleanHuneumOnly}`;
          if (seenFronts.has(frontText)) {
            const korOnlyExp = String(base.explain || "")
              .replace(/\([^)]*[\u4e00-\u9fff\u3400-\u4dbf][^)]*\)/g, "")
              .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "")
              .replace(/^(?:활용\s*한자어|대표\s*어휘):\s*/g, "")
              .replace(/\s+/g, " ")
              .trim();
            if (korOnlyExp) {
              frontText = `${cleanHuneumOnly} (활용: ${korOnlyExp})`;
            }
          }
          backText = formatConciseBackJs(cleanTerm, base.explain || cleanAns, cleanTerm);
        } else if (subj === "english") {
          if (base.role === "key_grammar") {
            frontText = `【 ${rawTermStr} 】`;
          } else {
            frontText = `${cleanAns}`;
            if (seenFronts.has(frontText)) {
              const posHint = String(base.explain || "").split("·")[0].replace(/^품사:\s*/, "").trim();
              if (posHint && !posHint.toLowerCase().includes(cleanTerm.toLowerCase())) {
                frontText = `${cleanAns} (${posHint})`;
              }
            }
            backText = formatConciseBackJs(cleanTerm, base.explain || cleanAns, cleanTerm);
          }
        } else {
          const cleanHeadTerm = rawTermStr.replace(/^\[[^\]]+\]\s*/, "").trim() || rawTermStr;
          const bracketHead = `【 ${cleanHeadTerm} 】`;
          const defDetail = String(base.explain || rawPrompt || cleanAns)
            .replace(/^\[[^\]]+\]\s*/, "")
            .replace(new RegExp(`^${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s*\\([^)]*\\))?\\s*(?:\\|\\s*)?[:：—-]?\\s*`), "")
            .trim();
          if (rawPrompt !== bracketHead && !seenFronts.has(bracketHead)) {
            frontText = bracketHead;
            if (cleanAns !== cleanTerm && cleanAns !== rawTermStr && !cleanAns.startsWith(cleanTerm)) {
              backText = formatConciseBackJs(cleanAns, defDetail, cleanTerm);
            } else {
              backText = formatConciseBackJs(defDetail || cleanAns, "", cleanTerm);
            }
          } else {
            const altCue = cleanCardFrontForDisplayJs(maskTermInDescJs(base.explain || "", base.term, base.answer));
            frontText = (altCue && !seenFronts.has(altCue)) ? altCue : "";
          }
        }
      }

      if (frontText && !seenFronts.has(frontText)) {
        seenFronts.add(frontText);
        specs.push({
          fact_key: `${sourceTag || subj}_${itemNo}`,
          front_text: frontText,
          back_text: backText,
          note_type: "basic",
          tags: [sourceTag || "full_scale", conceptTag, rootConceptTag, roleTag, diffTag],
        });
      }
      step += 1;
    }
    return specs.slice(0, cap);
  }

  function normalizeLoadedDb(parsed) {
    // Starter auto-upgrade parity guard: cleanDeckName === "한자 8급" && isSeedDeckOne && allCardsFromSeed && hydrateFromIndexedDb
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.decks) || parsed.decks.length === 0 || !Array.isArray(parsed.cards)) return null;
    return parsed;
  }

  function createStandaloneEngine(customStorage) {
    const deps = {
      DAY_MS_V56,
      STANDALONE_COLLECTIONS,
      STANDALONE_TEXTBOOKS,
      STANDALONE_STORE_PACKS,
      _getModule,
      advanceOnboardingState,
      applyAnkiCardAction,
      applyCardActionCore: applyAnkiCardAction,
      applyC4ReviewCalibration,
      buildAnkiV3DailyQueue,
      buildV3DailyQueue: buildAnkiV3DailyQueue,
      buildTypeMatchedQuizOptions,
      calculateStoreBundleQuote,
      checkStatuteStaleness,
      classifyScriptProfileJs,
      cleanCardFrontForDisplayJs,
      computeAnkiStudyPlan,
      computeStudyPlan: computeAnkiStudyPlan,
      computeDeckMasteryProgress,
      computeRetentionAndForgettingCurveVm,
      computeStudyDayKey,
      deduplicateSessionSiblings,
      enrichConceptCurriculumMetadata,
      evaluateTypedAnswerUnderstanding,
      expandStandaloneItemByDifficulty,
      extractCardTagList,
      extractMeaningfulAnswerTokens,
      extractTargetAndExplanation,
      filterCardsForExplorer,
      filterStorePacks,
      foldReviewEvents,
      generateProgressiveHint,
      interleaveAndShuffleStudyQueue,
      isGenericSectionLabel,
      isTocOrStructuralHeading,
      maskTermInDescJs,
      mergeNoteLwwRegisters,
      mergeReviewLogGSet,
      padStandaloneSpecsToTarget,
      quantize1e6,
      resolveWcagKeyboardShortcut,
      stepFsrs5,
      updateConfusionMatrixWeight,
      validateSyncDeltaEnvelope,
    };
    const core = _getModule("BrainDeckStandaloneEngineCore", "./modules/standalone_engine_core.js").createStandaloneEngineCore(customStorage, deps);
    return _getModule("BrainDeckStandaloneEngineOps", "./modules/standalone_engine_ops.js").attachStandaloneEngineOps(core, deps);
  }

  // =========================================================================
  // BrainDeck v5.6 Master Upgrade — Event Fold, Summary Sheet, Exam Print, Audio Loop
  // =========================================================================
  const DAY_MS_V56 = 86400000;
  function quantize1e6(x) {
    return _getModule("BrainDeckFsrsCore").quantize1e6(x);
  }
  function computeRetrievability(elapsedDays, stability) {
    return _getModule("BrainDeckFsrsCore").computeRetrievability(elapsedDays, stability);
  }
  function stepFsrs5(memory, rating, elapsedDays = 0.0, desiredRetention = 0.90, weights) {
    return _getModule("BrainDeckFsrsCore").stepFsrs5(memory, rating, elapsedDays, desiredRetention, weights);
  }
  function getCorpusBank() {
    return AUTHENTIC_SUBJECT_TSV_BANK;
  }
  function foldReviewEvents(events, params) {
    return _getModule("BrainDeckFsrsCore").foldReviewEvents(events, params);
  }
  function buildSummarySheetView(cards, maskMode = "red_filter") {
    return _getModule("BrainDeckCatalogStoreCore").buildSummarySheetView(cards, maskMode);
  }
  function buildPrintableExamSheet(cards, title, seed) {
    return _getModule("BrainDeckCatalogStoreCore").buildPrintableExamSheet(cards, title, seed);
  }
  function buildCommuteAudioScript(cards, thinkSeconds = 3) {
    return _getModule("BrainDeckCatalogStoreCore").buildCommuteAudioScript(cards, thinkSeconds);
  }
  function chunkMicroSprints(cards, sprintSize = 7) {
    return _getModule("BrainDeckCatalogStoreCore").chunkMicroSprints(cards, sprintSize);
  }
  function classifyCardQuestionType(card) {
    return _getModule("BrainDeckCatalogStoreCore").classifyCardQuestionType(card);
  }
  function filterStudyQueueByQuestionType(cards, categoryKey = "all") {
    return _getModule("BrainDeckCatalogStoreCore").filterStudyQueueByQuestionType(cards, categoryKey);
  }
  function computeQuestionTypeCounts(cards) {
    return _getModule("BrainDeckCatalogStoreCore").computeQuestionTypeCounts(cards);
  }
  function buildTypeMatchedQuizOptions(card, deckCards, requiredOptions = 4, maybeSeed = 1337) {
    return _getModule("BrainDeckCatalogStoreCore").buildTypeMatchedQuizOptions(card, deckCards, requiredOptions, maybeSeed);
  }
  function computeStudyToolsSummary(opts) {
    return _getModule("BrainDeckCatalogStoreCore").computeStudyToolsSummary(opts);
  }
  function resolveSmartAiEngine(opts) {
    return _getModule("BrainDeckCatalogStoreCore").resolveSmartAiEngine(opts);
  }
  function resolveCurriculumSegmentState(activeSegment, combinedScopeCount) {
    return _getModule("BrainDeckCatalogStoreCore").resolveCurriculumSegmentState(activeSegment, combinedScopeCount);
  }
  function calibrateFluencyGrade(rawRating, responseTimeMs, baselineRtMsSamples, consecutiveGoodStreak) {
    return _getModule("BrainDeckCatalogStoreCore").calibrateFluencyGrade(rawRating, responseTimeMs, baselineRtMsSamples, consecutiveGoodStreak);
  }
  function updateConfusionMatrixWeight(currentWeight, elapsedDays, cardA, cardB, reviewId, seenReviewIds, halfLifeDays = 30.0) {
    return _getModule("BrainDeckCatalogStoreCore").updateConfusionMatrixWeight(currentWeight, elapsedDays, cardA, cardB, reviewId, seenReviewIds, halfLifeDays);
  }
  function computeConfusionIntervalFactor(confusionWeight) {
    return _getModule("BrainDeckCatalogStoreCore").computeConfusionIntervalFactor(confusionWeight);
  }
  function applyC4ReviewCalibration(rawRating, responseTimeMs, baselineRtMsSamples, consecutiveGoodStreak, confusionWeight = 0.0) {
    return _getModule("BrainDeckCatalogStoreCore").applyC4ReviewCalibration(rawRating, responseTimeMs, baselineRtMsSamples, consecutiveGoodStreak, confusionWeight);
  }
  function computeStudyDayWindowUtc(nowOrIso, rolloverHour = 4, tzOffsetHours = 9) {
    return _getModule("BrainDeckCatalogStoreCore").computeStudyDayWindowUtc(nowOrIso, rolloverHour, tzOffsetHours);
  }
  function computeStudyDayKey(nowOrIso, rolloverHour = 4, tzOffsetHours = 9) {
    return _getModule("BrainDeckCatalogStoreCore").computeStudyDayKey(nowOrIso, rolloverHour, tzOffsetHours);
  }
  const ANKI_FLAG_LABELS = _getModule("BrainDeckCatalogStoreCore").STUDY_FLAG_LABELS;
  function computeAnkiStudyPlan(params) {
    return _getModule("BrainDeckCatalogStoreCore").computeStudyPlanCore(params);
  }
  function buildAnkiV3DailyQueue(cards, options) {
    return _getModule("BrainDeckCatalogStoreCore").buildV3DailyQueueCore(cards, options);
  }
  function evaluateLeechStatus(lapses, leechThreshold = 8, leechAction = "suspend", existingTags = []) {
    return _getModule("BrainDeckCatalogStoreCore").evaluateLeechStatus(lapses, leechThreshold, leechAction, existingTags);
  }
  function applyAnkiCardAction(card, action, opts) {
    return _getModule("BrainDeckCatalogStoreCore").applyCardActionCore(card, action, opts);
  }
  function buildCustomStudySession(cards, opts) {
    return _getModule("BrainDeckCatalogStoreCore").buildCustomStudySession(cards, opts);
  }
  function computePercentTenths(numerator, denominator) {
    return _getModule("BrainDeckCatalogStoreCore").computePercentTenths(numerator, denominator);
  }
  function classifyCardMaturityBucket(card) {
    return _getModule("BrainDeckCatalogStoreCore").classifyCardMaturityBucket(card);
  }
  function classifyCardStage(card) {
    return _getModule("BrainDeckCatalogStoreCore").classifyCardStage(card);
  }
  function computeDeckMasteryProgress(cards, dailyQuota, todayCompletedOverride, remainingQueueOverride) {
    return _getModule("BrainDeckCatalogStoreCore").computeDeckMasteryProgress(cards, dailyQuota, todayCompletedOverride, remainingQueueOverride);
  }
  function filterCardsForExplorer(cards, opts) {
    return _getModule("BrainDeckCatalogStoreCore").filterCardsForExplorer(cards, opts);
  }
  function mergeReviewLogGSet(localEvents, remoteEvents, deletionEpochMs) {
    return _getModule("BrainDeckSyncCrdt").mergeReviewLogGSet(localEvents, remoteEvents, deletionEpochMs);
  }
  function mergeNoteLwwRegisters(regA, regB) {
    return _getModule("BrainDeckSyncCrdt").mergeNoteLwwRegisters(regA, regB);
  }
  function validateSyncDeltaEnvelope(envelope, deletionEpochMs) {
    return _getModule("BrainDeckSyncCrdt").validateSyncDeltaEnvelope(envelope, deletionEpochMs);
  }
  function enrichConceptCurriculumMetadata(subject, term, definition, extraTags) {
    return _getModule("BrainDeckCurriculumStandards").enrichConceptCurriculumMetadata(subject, term, definition, extraTags);
  }
  function checkStatuteStaleness(statuteRef, cardValidAsOf, amendmentRegistry) {
    return _getModule("BrainDeckCurriculumStandards").checkStatuteStaleness(statuteRef, cardValidAsOf, amendmentRegistry);
  }
  function computeRetentionAndForgettingCurveVm(reviewEvents, desiredRetention) {
    return _getModule("BrainDeckAnalyticsOnboardingVm").computeRetentionAndForgettingCurveVm(reviewEvents, desiredRetention);
  }
  function advanceOnboardingState(currentState, payload) {
    return _getModule("BrainDeckAnalyticsOnboardingVm").advanceOnboardingState(currentState, payload);
  }
  function resolveWcagKeyboardShortcut(keyEventCode, isAnswerRevealed, isInputFocused) {
    return _getModule("BrainDeckAnalyticsOnboardingVm").resolveWcagKeyboardShortcut(keyEventCode, isAnswerRevealed, isInputFocused);
  }
  function computeStudyLayoutSpec(widthDp, heightDp, fontScale) {
    const w = Math.max(240, Number(widthDp) || 390);
    const h = Math.max(360, Number(heightDp) || 840);
    const fs = Math.min(2.0, Math.max(0.75, Number(fontScale) || 1.0));
    const tier = w < 360 ? "NARROW" : w < 480 ? "COMPACT" : w < 840 ? "MEDIUM" : "EXPANDED";
    const isTwoByTwo = tier === "NARROW" || (tier === "COMPACT" && fs >= 1.25);
    return {
      tier,
      ratingGridColumns: isTwoByTwo ? 2 : 4,
      ratingGridRows: isTwoByTwo ? 2 : 1,
      isTwoPane: tier === "EXPANDED" && w >= 840,
      buttonMinHeightDp: fs >= 1.15 ? 54 : 50,
      cardMaxHeightFraction: h < 640 ? 0.52 : 0.64,
    };
  }
  function parseStructuredCardBack(backText) {
    const raw = String(backText || "").trim();
    if (!raw) return { coreAnswer: "", sections: [{ key: "answer", badge: "🎯 핵심 정답", content: "" }] };
    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const coreAnswer = lines[0] || "";
    const sections = [{ key: "answer", badge: "🎯 핵심 정답", content: coreAnswer }];
    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i];
      if (ln.startsWith("📘 예문:") || ln.startsWith("예문:")) {
        const ex = ln.replace(/^(?:📘\s*)?예문:\s*/, "").trim();
        if (ex) sections.push({ key: "example", badge: "📘 문맥 예문·활용", content: ex });
      } else if (ln.startsWith("💡 해설:") || ln.startsWith("해설:")) {
        const exp = ln.replace(/^(?:💡\s*)?해설:\s*/, "").trim();
        if (exp) sections.push({ key: "explanation", badge: "💡 핵심 해설·유래", content: exp });
      }
    }
    return { coreAnswer, sections };
  }
  function recommendStudyMode(category, firstFront, savedPreference) {
    const pref = String(savedPreference || "").trim().toLowerCase();
    if (pref === "recall" || pref === "choice" || pref === "typing") {
      return { mode: pref, reason: "저장된 덱별 학습 방식 설정을 유지합니다." };
    }
    const cat = String(category || "").toLowerCase();
    const front = String(firstFront || "");
    if (cat.includes("맞춤법") || cat.includes("받아쓰기") || cat.includes("법") || cat.includes("자격증") || front.includes("{{c1::")) {
      return { mode: "choice", reason: "맞춤법·빈칸·개념 변별 덱은 4지선다 개념 학습이 효과적입니다." };
    }
    return { mode: "recall", reason: "단어·한자·핵심 개념 덱은 안키식 앞뒷면 스스로 암기 집중 모드가 가장 빠릅니다." };
  }
  function resolveAllowedRatingsV11(solveMode, isCorrect, studyMode, selfCheckUnlocked) {
    const mode = String(studyMode || solveMode || "").trim().toLowerCase();
    if (mode === "recall" || mode === "self" || Boolean(selfCheckUnlocked)) return [1, 2, 3, 4];
    return resolveAllowedRatings(solveMode, isCorrect);
  }
  return {
    formatRetentionBadge,
    formatLeechBadge,
    mapKeyboardShortcut,
    buildForgettingCurveSvgPoints,
    formatCategoryBadge,
    formatPatternBadge,
    OLLAMA_CLOUD_MODELS,
    isOllamaCloudModelBlocked,
    formatIngestStatusBanner,
    STORE_CATEGORY_LABELS,
    filterStorePacks,
    formatStorePackCard,
    resolveUiUxTokens,
    calculateStoreBundleQuote,
    formatRatingButtonsForAgeTier,
    formatApiErrorBanner,
    evaluateTapBlockAttempt,
    NAVIGATION_TABS,
    ONBOARDING_MODES,
    DIFFICULTY_LEVEL_MODES,
    resolveActivePageState,
    evaluateTypedAnswerUnderstanding,
    computeAnkiQueueCounts,
    filterStudyQueue,
    extractTargetAndExplanation,
    generateProgressiveHint,
    interleaveAndShuffleStudyQueue,
    buildLearnerProfilePreset,
    normalizeLearnerProfile,
    resolveCardSolveMode,
    resolveAllowedRatings,
    deduplicateSessionSiblings,
    createStandaloneEngine,
    quantize1e6,
    stepFsrs5,
    getCorpusBank,
    foldReviewEvents,
    buildSummarySheetView,
    buildPrintableExamSheet,
    buildCommuteAudioScript,
    chunkMicroSprints,
    classifyCardQuestionType,
    filterStudyQueueByQuestionType,
    computeQuestionTypeCounts,
    buildTypeMatchedQuizOptions,
    computeStudyToolsSummary,
    resolveSmartAiEngine,
    resolveCurriculumSegmentState,
    calibrateFluencyGrade,
    updateConfusionMatrixWeight,
    computeConfusionIntervalFactor,
    applyC4ReviewCalibration,
    ANKI_FLAG_LABELS,
    computeAnkiStudyPlan,
    buildAnkiV3DailyQueue,
    evaluateLeechStatus,
    applyAnkiCardAction,
    buildCustomStudySession,
    isGenericSectionLabel,
    isTocOrStructuralHeading,
    computeStudyDayWindowUtc,
    computeStudyDayKey,
    computePercentTenths,
    classifyCardMaturityBucket,
    classifyCardStage,
    computeDeckMasteryProgress,
    filterCardsForExplorer,
    classifyScriptProfile: classifyScriptProfileJs,
    isScriptProfileCompatible: isScriptProfileCompatibleJs,
    cleanCardFrontForDisplay: cleanCardFrontForDisplayJs,
    computeRetrievability,
    mergeReviewLogGSet,
    mergeNoteLwwRegisters,
    validateSyncDeltaEnvelope,
    enrichConceptCurriculumMetadata,
    checkStatuteStaleness,
    computeRetentionAndForgettingCurveVm,
    advanceOnboardingState,
    resolveWcagKeyboardShortcut,
    previewNextIntervals: previewNextIntervalsJs,
    previewNextIntervalsJs,
    isLeechCard: isLeechCardJs,
    isLeechCardJs,
    computeStudyLayoutSpec,
    parseStructuredCardBack,
    recommendStudyMode,
    resolveAllowedRatingsV11,
  };
});


