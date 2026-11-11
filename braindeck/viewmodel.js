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
        "./Documents/개발/BrainDeck/src/anki_studio/ui/static"
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

  function mapKeyboardShortcut(key, isAnswerRevealed, isTypingInInput, ageTier, recommendedRating) {
    const wcag = _getModule("BrainDeckAnalyticsOnboardingVm").resolveWcagKeyboardShortcut(
      key,
      Boolean(isTypingInInput),
      true
    );
    if (isTypingInInput) {
      return null;
    }
    const normalized = String(key || "").toLowerCase();
    const tierNorm = String(ageTier || "teen").toLowerCase();
    if (normalized === " " || normalized === "enter") {
      if (!isAnswerRevealed) {
        return _withWcagMeta({ action: "reveal" }, wcag);
      }
      const rawRec = [1, 2, 3, 4].includes(Number(recommendedRating)) ? Number(recommendedRating) : 3;
      const safeRec = tierNorm === "junior" ? Math.min(3, rawRec) : rawRec;
      return _withWcagMeta({ action: "rate", rating: safeRec }, wcag);
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
    if (normalized === "t" || normalized === "r") {
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

    if (ev.strokeScorePct !== null && ev.strokeScorePct !== undefined && Number.isFinite(Number(ev.strokeScorePct))) {
      const strokePct = Number(ev.strokeScorePct);
      if (strokePct < 60) {
        return {
          allowedRatings: [1, 2],
          recommendedRating: 1,
          maxRating: 2,
          lockedReason: "stroke_low_accuracy",
          bannerText: "🔴 한자 필기 정확도(" + Math.round(strokePct) + "%)가 낮아 '다시(1)' 복습을 권장합니다.",
        };
      }
      if (strokePct < 85) {
        return {
          allowedRatings: [1, 2, 3],
          recommendedRating: 2,
          maxRating: 3,
          lockedReason: "stroke_partial_accuracy",
          bannerText: "🟡 한자 필기 부분 일치(" + Math.round(strokePct) + "%) — '어려움(2)'을 권장합니다.",
        };
      }
    }

    if (ev.productionAccuracyPct !== null && ev.productionAccuracyPct !== undefined && Number.isFinite(Number(ev.productionAccuracyPct))) {
      const prodPct = Number(ev.productionAccuracyPct);
      if (prodPct < 65) {
        return {
          allowedRatings: [1, 2],
          recommendedRating: 1,
          maxRating: 2,
          lockedReason: "production_low_accuracy",
          bannerText: "🔴 능동 산출 정확도(" + Math.round(prodPct) + "%) 미달 — '다시(1)' 재인출을 권장합니다.",
        };
      }
      if (prodPct < 85) {
        return {
          allowedRatings: [1, 2, 3],
          recommendedRating: 2,
          maxRating: 3,
          lockedReason: "production_partial_accuracy",
          bannerText: "🟡 능동 산출 부분 정확(" + Math.round(prodPct) + "%) — '어려움(2)'을 권장합니다.",
        };
      }
    }

    const latencyMs = ev.latencyMs !== null && ev.latencyMs !== undefined ? Number(ev.latencyMs) : 0;
    if (Number.isFinite(latencyMs) && latencyMs > 15000) {
      return {
        allowedRatings: [1, 2, 3],
        recommendedRating: 2,
        maxRating: 3,
        lockedReason: "slow_latency_cap",
        bannerText: "🟡 인출 지연(" + (latencyMs / 1000).toFixed(1) + "초)이 감지되어 '어려움(2)' 또는 '보통(3)'을 권장합니다.",
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
      bannerText:
        Number.isFinite(latencyMs) && latencyMs > 0 && latencyMs <= 2500
          ? "🟢 빠른 무보조 인출 성공(" + (latencyMs / 1000).toFixed(1) + "초)! Space/Enter 또는 '보통 3'으로 즉시 다음 카드로 이동하세요."
          : "🟢 무보조 인출 성공! 기억 난이도에 맞춰 평가하세요 ('보통 3' 추천).",
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
    { pack_id: "pack.free.starter_k12", estimated_card_count: 100 },
    { pack_id: "pack.moe.eng.elem34", estimated_card_count: 240 },
    { pack_id: "pack.moe.eng.elem56", estimated_card_count: 400 },
    { pack_id: "pack.moe.eng.mid1200", estimated_card_count: 500 },
    { pack_id: "pack.moe.eng.high_csat", estimated_card_count: 500 },
    { pack_id: "pack.moe.kor.orthography_lit", estimated_card_count: 300 },
    { pack_id: "pack.moe.hanja.mid1800", estimated_card_count: 500 },
    { pack_id: "pack.moe.hist.essential", estimated_card_count: 300 },
    { pack_id: "pack.moe.sci.core_formula", estimated_card_count: 300 },
    { pack_id: "pack.moe.math.core_formula", estimated_card_count: 300 },
    { pack_id: "pack.mid1.eng.donga_yoon.full", estimated_card_count: 240 },
    { pack_id: "pack.mid2.eng.donga_yoon.full", estimated_card_count: 240 },
    { pack_id: "pack.mid2.hist.miraeen.full", estimated_card_count: 240 },
    { pack_id: "pack.high1.sci.visang.full", estimated_card_count: 240 },
    { pack_id: "pack.exam.hanja_master", estimated_card_count: 200 },
    { pack_id: "pack.exam.khist_master", estimated_card_count: 300 },
    { pack_id: "pack.exam.lang_toeic_jlpt", estimated_card_count: 500 },
    { pack_id: "pack.pro.law_it_cert", estimated_card_count: 300 },
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
    const stopWords = new Set(["정의", "성질", "원리", "구별", "구분", "비교", "공식", "법칙", "정리", "판별", "판정", "해설", "개념", "적용", "특징", "조건", "구조", "원소 기호"]);
    const candidates = [];
    function pushCand(s) {
      const clean = String(s || "").trim();
      if (!clean || stopWords.has(clean)) return;
      if (clean.includes("[") || clean.includes("]")) return;
      if (/^원자번호\s*\d+번$/.test(clean)) return;
      if (clean.length >= 2 || /[\u4e00-\u9fff\u3400-\u4dbf]/.test(clean)) {
        if (!candidates.includes(clean)) candidates.push(clean);
      }
    }
    function addCand(raw) {
      const r = String(raw || "").trim();
      if (!r) return;
      pushCand(r);
      const base = r.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim();
      pushCand(base);
      const headCore = r.split("(")[0].split("[")[0].split("—")[0].split("·")[0].trim();
      pushCand(headCore);
      const subParts = base.split(/\s*(?:—|·|과\s+|와\s+|및\s+|vs\s+|\/|,)\s*/);
      subParts.forEach((sp) => {
        const p = sp.trim();
        pushCand(p);
        const strippedSuffix = p
          .replace(/(?:의\s*(?:정의|세기|성질|원리|구별|구분|비교|적용|공식|법칙|유무|특성|조건|관계|변환)|판별|판정|공식)$/, "")
          .trim();
        pushCand(strippedSuffix);
      });
    }
    if (t.includes(":")) {
      const tTail = t.split(":").pop().trim();
      if (tTail.length >= 2) addCand(tTail);
    } else {
      addCand(t);
    }
    if (a && !a.startsWith("㉠")) {
      addCand(a);
    }
    candidates.sort((x, y) => y.length - x.length);
    let masked = d;
    candidates.forEach((cand) => {
      const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      masked = masked.replace(new RegExp(escaped, "gi"), "[ ___ ]");
    });
    masked = masked.replace(/\[\s*\[\s*___\s*\]\s*\]?/g, "[ ___ ]");
    masked = masked.replace(/\[\s*___\s*\](?:\s*\[\s*___\s*\])+/g, "[ ___ ]");
    masked = masked.replace(/\[\s*___\s*\]\s*\(\s*\[\s*___\s*\]\s*\)/g, "[ ___ ]");
    masked = masked.replace(/\[\s*___\s*\]\(/g, "[ ___ ] (");
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

  const SSOT_CORPUS_SHA256 = "55793ba015c042431aef29309f8f351e65bd8c30efe73bd365a89f70b1b40eb7";
  const SSOT_GRADED_BANK_SHA256 = "f2a1a46cc6460b708ce65f08a2f5c277807662770db79b1e365b113971274988";
  const WEB_MIN_REMEDIATED_VERSION_CODE = 109;
  const WEB_CLIENT_VERSION_CODE = 109;
  const WEB_PINNED_SIGNING_KEY_ID = "braindeck-ota-root-2026-v2";
  /**
   * Synchronous same-origin bundle pin & anti-rollback metadata gate (full RSA-2048 modular
   * signature & re-computed SHA-256 verification are enforced at build/OTA ingest by Python & Kotlin).
   */
  function verifyCorpusBundleIntegrity(bundle) {
    if (!bundle || typeof bundle !== "object" || !bundle.tsv_bank || typeof bundle.tsv_bank !== "object") {
      throw new Error("CorpusIntegrityError: missing tsv_bank in corpus bundle");
    }
    if (bundle.signing_key_id === "braindeck-ota-root-2026-v1") {
      throw new Error("CorpusIntegrityError: retired legacy v1 signing_key_id rejected on client >= 109");
    }
    if (typeof bundle.signing_key_id !== "string" || bundle.signing_key_id.trim() !== WEB_PINNED_SIGNING_KEY_ID) {
      throw new Error("CorpusIntegrityError: missing or untrusted signing_key_id");
    }
    if (
      !Number.isInteger(bundle.min_client_version_code) ||
      bundle.min_client_version_code < WEB_MIN_REMEDIATED_VERSION_CODE ||
      WEB_CLIENT_VERSION_CODE < bundle.min_client_version_code
    ) {
      throw new Error("CorpusIntegrityError: missing, non-integer, or incompatible min_client_version_code");
    }
    if (typeof bundle.corpus_sha256 !== "string" || bundle.corpus_sha256 !== SSOT_CORPUS_SHA256) {
      throw new Error("CorpusIntegrityError: missing or mismatched corpus_sha256");
    }
    if (bundle.tsv_sha256 !== undefined && String(bundle.tsv_sha256) !== SSOT_CORPUS_SHA256) {
      throw new Error("CorpusIntegrityError: corpus tsv_sha256 mismatch");
    }
    if (typeof bundle.graded_bank_sha256 !== "string" || bundle.graded_bank_sha256 !== SSOT_GRADED_BANK_SHA256) {
      throw new Error("CorpusIntegrityError: missing or mismatched graded_bank_sha256");
    }
    if (!bundle.graded_bank || typeof bundle.graded_bank !== "object" || Object.keys(bundle.graded_bank).length === 0) {
      throw new Error("CorpusIntegrityError: missing graded_bank for declared graded_bank_sha256");
    }
    if (typeof bundle.signature_rsa2048_hex !== "string" || !/^[0-9a-fA-F]{512}$/.test(bundle.signature_rsa2048_hex.trim())) {
      throw new Error("CorpusIntegrityError: missing or invalid RSA-2048 signature_rsa2048_hex on corpus bundle");
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

  const _DISCARD_MATH_SECTION_RE_JS =
    /\[(?:행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화|조합론·확률 표준값|정수론·수열 표준값|기하·해석 표준 공식|미적분 핵심 정적분|미적분 핵심 극한|삼각함수 특수각|정수론|조합론|그래프이론|기하학|선형대수|미분방정식|복소해석|푸리에해석|수치해석|이산수학|확률과정|통계학|집합론·위상|최적화|암호수학|대수학|이산수학·알고리즘|이산수학·조합|해석학|정보이론·수학|금융수학|대수·수론|기하·해석|조합·확률|통계·기계학습|수열·해석|집합·논리|대수·기하|대수·복소행렬|해석·수열극한|미적분·다변수벡터|미적분·미분방정식|확률통계·수리통계|확률통계·확률과정|정수론·이산수학|선형대수·행렬|선형대수·해석|해석·미적분심화|해석·복소수치|수치해석·최적화|추상대수·군론|추상대수·환체|위상·집합론|부등식·최적화|정수론·암호대수|조합·그래프이론|확률통계·정보이론|해석·미적분응용|미적분·함수해석|미분기하·곡선곡면|미적·선형보충|현대대수|조합·이산수학)\]/;
  const _DISCARD_MATH_OUT_OF_SCOPE_RE_JS =
    /로랑\s*급수|유수\s*정리|코시-리만|르베그|바나흐|힐베르트|무어-펜로즈|의사역행렬|고유값|고유벡터|특이값\s*분해|라플라스\s*변환|푸리에|야코비안|헤시안|가우스-마르코프|마르코프|갈루아|아벨\s*군|뇌터|위상수학|컴팩트|하우스도르프|측도론|보렐|비탈리|제타\s*함수|리만\s*가설|디리클레|페르마|오일러\s*피|중국인의\s*나머지|윌슨의\s*정리|비둘기집|생성함수|카탈랑|카탈란|스터링|벨\s*수|람세이|그래프\s*이론|오일러\s*경로|해밀턴\s*경로|평면\s*그래프|크루스칼|다익스트라|벨만-포드|플로이드-워셜|네트워크\s*플로우|심플렉스|쌍대성|테일러\s*급수|매클로린|편미분|중적분|선적분|면적분|발산\s*정리|스토크스|그린\s*정리|미분방정식|베르누이\s*미분|초기하|포아송\s*분포|감마\s*분포|베타\s*분포|카이제곱|스튜던트\s*t|F-분포|중심극한정리|우도함수|최대우도|베이즈\s*추정|신뢰구간\s*추정|가설검정|제1종\s*오류|p-값|회귀분석|최소제곱법|공분산\s*행렬|주성분\s*분석|PCA|케일리-해밀턴|조르당|그램-슈미트|직교행렬|유니터리|에르미트|정부호\s*행렬|텐서|다양체|리\s*군|호몰로지|호모토피|범주론|함자|초한기수|선택공리|체르멜로|괴델|튜링\s*기계|정지\s*문제|P-NP|볼차노|하이네-보렐|코시\s*평균값|로피탈|오일러\s*공식|드무아브르|쌍곡선함수|역삼각함수|바젤\s*문제|교대급수|이상적분|스튜어트\s*정리|체바의\s*정리|메넬라우스|톨레미|브라마굽타|픽의\s*정리|오일러\s*직선|구점원|방멱의\s*정리|현수선|사이클로이드|준원|젠센\s*부등식|베르누이\s*부등식|재배열\s*부등식|체비쇼프|완전순열|교란순열|다항정리|베주\s*항등식|메르센\s*소수|쌍둥이\s*소수|르장드르/;
  const _DISCARD_SCI_OUT_OF_SCOPE_RE_JS =
    /슈뢰딩거|디랙\s*방정식|클라인-고든|양자장론|파인만\s*다이어그램|게이지\s*대칭|히그스\s*메커니즘|크리스토펠|리만\s*곡률|아인슈타인\s*장방정식|슈바르츠실트|맥스웰\s*텐서|라그랑지안\s*역학|해밀토니안\s*역학|포아송\s*괄호|리우빌|볼츠만\s*H|분배함수|그랜드\s*캐노니컬|페르미-디랙|보즈-아인슈타인|샤논|기브스\s*듀헴|퓨개시티|활동도\s*계수|하트리-폭|밀도범함수|분자궤도\s*함수|리간드장\s*이론|얀-텔러|우드워드-호프만|미카엘리스-멘텐|라인위버-버크|알로스테릭|샤페론\s*단백질|유비퀴틴|크리스퍼|오페론\s*조절/;
  const _DISCARD_KOR_OUT_OF_SCOPE_RE_JS =
    /\[(?:독서이론|화법이론|작문이론|매체이론)\]|샤넌\s*정보량|칸트의\s*의무론|기준금리|초등\s*1·2학년\s*어휘·받아쓰기:|초등\s*감각어·모양말:/;

  function defaultTargetCountForSourceJs(sourceTag) {
    const s = String(sourceTag || "").toLowerCase();
    if (s.includes("8geup") || s.includes("starter_k12")) return 100;
    if (s.includes("dictation")) return 120;
    if (/hanja-grade:[76543]geup/.test(s) || s.includes("hanja_master")) return 200;
    if (s.includes("elem-3-4") || s.includes("elem34") || /^kr\./.test(s)) return 240;
    if (s.includes("moe-eng:elementary") || s.includes("elem56") || s.includes("elem-5-6")) return 400;
    if (s.includes("middle-1200") || s.includes("mid1200") || s.includes("high-csat") || s.includes("high_csat") || s.includes("toeic") || s.includes("jlpt") || s.includes("exam-ja") || s.includes("hanja-1800") || s.includes("mid1800")) return 500;
    return 300;
  }

  function filterAuthenticGradedRowsJs(gKey, rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (gKey === "hanja_8geup") {
      return list.filter((line) => String(line || "").split("\t")[0].trim().length === 1).slice(0, 50);
    }
    if (/^hanja_[76543]geup$/.test(gKey)) {
      return list.filter((line) => String(line || "").split("\t")[0].trim().length === 1).slice(0, 100);
    }
    if (gKey === "hanja_mid1800") {
      return list.filter((line) => String(line || "").split("\t")[0].trim().length === 1).slice(0, 250);
    }
    if (gKey === "hanja_idiom") {
      return list.filter((line) => String(line || "").split("\t")[0].trim().length === 4).slice(0, 300);
    }
    if (gKey === "eng_elem34") return list.slice(0, 240);
    if (gKey === "eng_elem56") return list.slice(0, 400);
    if (gKey === "eng_mid1200" || gKey === "eng_high_csat" || gKey === "eng_toeic" || gKey === "ja_jlpt") {
      return list.slice(0, 500);
    }
    if (gKey === "kor_dictation") {
      return list.filter((line) => {
        const s = String(line || "");
        return !s.startsWith("초등 바른 생활 문장 받아쓰기:");
      }).slice(0, 120);
    }
    if (gKey === "kor_orthography_lit") {
      return list.filter((line) => !_DISCARD_KOR_OUT_OF_SCOPE_RE_JS.test(String(line || ""))).slice(0, 300);
    }
    if (gKey === "law_statute" || gKey === "cert_it") {
      return list.filter((line) => {
        const s = String(line || "");
        const parts = s.split("\t");
        const term = (parts[0] || "").trim();
        const ctx = (parts[2] || "").trim();
        const exp = (parts[3] || "").trim();
        if (term.includes("채무불이행") && ctx.includes("채무자위험부담")) return false;
        return !exp.includes("보충") && !exp.includes("인공지능");
      }).slice(0, 300);
    }
    return list;
  }

  function filterAuthenticSubjectRowsJs(subjKey, rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (subjKey === "math") {
      return list.filter((line) => {
        const s = String(line || "");
        const term = (s.split("\t")[0] || "").trim();
        if (term.endsWith("의 정확한 값")) return false;
        return !_DISCARD_MATH_SECTION_RE_JS.test(s) && !_DISCARD_MATH_OUT_OF_SCOPE_RE_JS.test(s);
      }).slice(0, 300);
    }
    if (subjKey === "science") {
      return list.filter((line) => {
        const s = String(line || "");
        const m = s.match(/원자번호\s*(\d+)번/);
        if (m) {
          const num = Number(m[1]);
          if (num > 20 && num !== 26 && num !== 29 && num !== 47 && num !== 79) return false;
        }
        return !_DISCARD_SCI_OUT_OF_SCOPE_RE_JS.test(s);
      }).slice(0, 300);
    }
    if (subjKey === "korean") {
      return list.filter((line) => !_DISCARD_KOR_OUT_OF_SCOPE_RE_JS.test(String(line || ""))).slice(0, 300);
    }
    if (subjKey === "history") {
      return list.slice(0, 300);
    }
    if (subjKey === "hanja") {
      return list.filter((line) => {
        const t = (String(line || "").split("\t")[0] || "").trim();
        return t.length === 1 || t.length === 4;
      }).slice(0, 300);
    }
    if (subjKey === "law_it") {
      return list.filter((line) => {
        const s = String(line || "");
        const parts = s.split("\t");
        const term = (parts[0] || "").trim();
        const ctx = (parts[2] || "").trim();
        const exp = (parts[3] || "").trim();
        if (term.includes("채무불이행") && ctx.includes("채무자위험부담")) return false;
        return !exp.includes("보충") && !exp.includes("인공지능");
      }).slice(0, 300);
    }
    return list.slice(0, 500);
  }

  function getAuthenticGradedBankItems(gradedKey) {
    const gKey = String(gradedKey || "").trim();
    if (!gKey) return [];
    if (_PARSED_GRADED_BANK_CACHE[gKey]) return _PARSED_GRADED_BANK_CACHE[gKey];
    const rawRows = filterAuthenticGradedRowsJs(gKey, AUTHENTIC_GRADED_TSV_BANK[gKey] || []);
    const isEng = gKey.startsWith("eng_");
    const isJa = gKey === "ja_jlpt";
    const isHanja = gKey.startsWith("hanja_");
    const idiomFixMap = {
      "日中則昃": "일중즉측 (해가 중천에 이르면 기욺 · 기울 측)",
      "一葉片舟": "일엽편주 (나뭇잎 같은 작은 배 · 배 주)",
      "狡兎三窟": "교토삼굴 (위기에 대비해 굴을 세 개 팜 · 토끼 토)",
    };
    const parsed = rawRows.map((line, idx) => {
      const parts = String(line || "").split("\t");
      const term = (parts[0] || "").trim();
      let rawAns = (parts[1] || "").replace(/\(\s*:\s*/g, "(").trim();
      if (isHanja && idiomFixMap[term]) {
        rawAns = idiomFixMap[term];
      }
      const ctx = (parts[2] || "").replace(/\(\s*:\s*/g, "(").trim();
      const rawExplain = (parts[3] || "").replace(/\(\s*:\s*/g, "(").trim();
      let answer = rawAns;
      let explain = rawExplain || ctx;
      let prompt = "";
      let sentence = "";
      if (isEng || isJa) {
        sentence = ctx || "";
        prompt = `【 ${term} 】`;
      } else if (isHanja) {
        prompt = `【 ${term} 】`;
        sentence = "";
      } else {
        let cleanedTerm = term.replace(/\s*—\s*[^)]+(?=\))/g, "").split(" — ")[0].trim();
        let conciseTerm = cleanedTerm.length > 42
          ? (cleanedTerm.split(" · ")[0].split(" 및 ")[0].split("(")[0].trim() || cleanedTerm.slice(0, 42))
          : cleanedTerm;
        if (!conciseTerm.includes("(") && conciseTerm.includes(")")) {
          conciseTerm = conciseTerm.replace(/\)/g, "").trim();
        } else if (conciseTerm.includes("(") && !conciseTerm.includes(")")) {
          conciseTerm = conciseTerm.split("(")[0].trim();
        }
        const badge = rawExplain || "핵심 개념";
        let rawCue = ctx || rawExplain || term;
        if (rawAns.startsWith("㉠") && rawAns.split(" — ")[0].trim().length <= 48) {
          answer = rawAns.split(" — ")[0].trim();
          explain = rawExplain || (rawAns.includes(" — ") ? rawAns.split(" — ").slice(1).join(" — ").trim() : ctx);
          rawCue = ctx || rawExplain || term;
        } else if (term.startsWith("초등 1·2학년 어휘·받아쓰기:")) {
          answer = term.split(":").slice(1).join(":").trim();
          explain = rawExplain ? `${rawAns} · ${rawExplain}` : rawAns;
          rawCue = ctx || rawAns;
        } else if (term.startsWith("초등 감각어·모양말:")) {
          answer = term.split(":").slice(1).join(":").trim();
          explain = rawExplain ? `${rawAns} · ${rawExplain}` : rawAns;
          rawCue = `[초등 국어 감각어·모양말] '${rawAns}'을(를) 생생하게 표현하는 낱말은?`;
        } else if (term.startsWith("낱말 뜻 구별:") || term.startsWith("받아쓰기 구별:")) {
          const quoted = Array.from(rawAns.split("(")[0].matchAll(/'([^']+)'/g))
            .map((m) => m[1].trim())
            .filter(Boolean);
          answer = quoted.length >= 2 ? quoted.join(" / ") : rawAns.split(" — ")[0].trim();
          explain = rawExplain ? `${rawAns} · ${rawExplain}` : rawAns;
          rawCue = ctx || rawExplain || term;
        } else if (term.includes("받아쓰기")) {
          answer = rawAns.split(" — ")[0].trim();
          explain = rawExplain || ctx;
          rawCue = ctx || rawExplain || term;
        } else if (gKey === "law_statute" || gKey === "cert_it") {
          const meanHead = rawAns.split(" — ")[0].trim();
          answer = (rawAns.includes(" — ") && meanHead.length <= 20 && !conciseTerm.includes(meanHead) && (conciseTerm.length + meanHead.length + 3) <= 48)
            ? `${conciseTerm} (${meanHead})`
            : conciseTerm;
          explain = rawExplain ? `${rawAns} · ${rawExplain}` : rawAns;
          const ctxPrefixMatch = ctx.match(/^(\[[^\]]+\])\s*/);
          const ctxPrefix = ctxPrefixMatch ? ctxPrefixMatch[1] : `[${badge}]`;
          const ctxBody = ctx.replace(/^\[[^\]]+\]\s*/, "").trim();
          if (ctx && rawAns && !ctxBody.includes(rawAns.slice(0, Math.min(12, rawAns.length)))) {
            rawCue = `${ctxPrefix} ${rawAns} (${ctxBody})`;
          } else if (ctx) {
            rawCue = ctx;
          } else {
            rawCue = rawAns;
          }
        } else {
          answer = conciseTerm;
          explain = (rawExplain && rawExplain !== rawAns) ? `${rawAns} · ${rawExplain}` : (rawExplain || rawAns);
          const ctxPrefixMatch = ctx.match(/^(\[[^\]]+\])\s*/);
          const ctxPrefix = ctxPrefixMatch ? ctxPrefixMatch[1] : "";
          const ctxBody = ctx.replace(/^\[[^\]]+\]\s*/, "").trim();
          if (ctx && rawAns && rawAns !== term && !ctxBody.includes(rawAns.slice(0, Math.min(10, rawAns.length)))) {
            rawCue = ctxPrefix ? `${ctxPrefix} ${rawAns} (${ctxBody})` : `${rawAns} (${ctxBody})`;
          } else {
            rawCue = ctx || rawExplain || rawAns;
          }
        }
        if (answer.length > 48) answer = conciseTerm.slice(0, 48).trim();
        const maskAns = !answer.startsWith("㉠") ? answer : "";
        const maskedTip = maskTermInDescJs(rawCue, term, maskAns);
        prompt = cleanCardFrontForDisplayJs(maskedTip);
        sentence = "";
      }
      return {
        id: `graded_${gKey}_${idx + 1}`,
        term,
        answer,
        prompt,
        sentence,
        explain,
        role: isEng || isJa ? "core_vocab" : "core_concept",
      };
    });
    _PARSED_GRADED_BANK_CACHE[gKey] = parsed;
    return parsed;
  }

  function getAuthenticSubjectBankItems(subj) {
    const key = String(subj || "english").toLowerCase();
    if (_PARSED_SUBJECT_BANK_CACHE[key]) return _PARSED_SUBJECT_BANK_CACHE[key];
    const rawRows = filterAuthenticSubjectRowsJs(key, AUTHENTIC_SUBJECT_TSV_BANK[key] || AUTHENTIC_SUBJECT_TSV_BANK.english || []);
    const parsed = rawRows.map((line, idx) => {
      const parts = String(line || "").split("\t");
      const term = (parts[0] || "").trim();
      const rawAns = (parts[1] || "").trim();
      const ctx = (parts[2] || "").trim();
      const rawExplain = (parts[3] || "").trim();
      const isEng = key === "english";
      const isHanja = key === "hanja";
      let answer = rawAns;
      let explain = rawExplain || ctx;
      let prompt = "";
      let sentence = "";
      if (isEng) {
        sentence = ctx || "";
        prompt = `【 ${term} 】`;
      } else if (isHanja) {
        prompt = `【 ${term} 】`;
        sentence = "";
      } else if (term.endsWith("의 정확한 값")) {
        const suffixRaw = rawAns.startsWith(term)
          ? rawAns.slice(term.length).trim().replace(/^\(|\)$/g, "").trim()
          : rawAns;
        const conciseVal = suffixRaw.split(" (")[0].trim();
        answer = conciseVal.length <= 48 ? conciseVal : conciseVal.split(",").slice(0, 2).join(",").trim();
        prompt = `[수학 필수 표준값] ${term}은?`;
        explain = rawExplain ? `${ctx} · ${rawExplain}` : ctx;
      } else {
        let conciseTerm = term.length > 42
          ? (term.split(" — ")[0].split(" · ")[0].split(" 및 ")[0].split("(")[0].trim() || term.slice(0, 42))
          : term;
        if (!conciseTerm.includes("(") && conciseTerm.includes(")")) {
          conciseTerm = conciseTerm.replace(/\)/g, "").trim();
        } else if (conciseTerm.includes("(") && !conciseTerm.includes(")")) {
          conciseTerm = conciseTerm.split("(")[0].trim();
        }
        const candAns = rawAns.includes(" — ") ? rawAns.split(" — ")[0].trim() : rawAns;
        answer = candAns.length <= 48 ? candAns : conciseTerm.slice(0, 48).trim();
        explain = (rawExplain && rawExplain !== rawAns)
          ? `${rawAns} · ${rawExplain}`
          : (answer !== rawAns ? rawAns : (rawExplain || ctx));
        let rawCue = ctx || rawExplain || rawAns;
        if (candAns.length > 48 && rawExplain.includes("|")) {
          const afterPipe = rawExplain.split("|").slice(1).map((s) => s.trim()).filter(Boolean).join(" · ");
          const prefixTag = (ctx.match(/^\[[^\]]+\]/) || [""])[0];
          if (afterPipe) {
            rawCue = prefixTag ? `${prefixTag} ${afterPipe}` : afterPipe;
          }
        }
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
        explain,
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
      ? (cleanPrompt || lv1Front)
      : `${item.answer}`;
    const lv3Back = isFactPrompt
      ? lv1Back
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
        const isTextbookSource = /^kr\./.test(tagLower);
        const grammarSeeds = cleanSeeds.filter((it) => it && it.role === "key_grammar");
        const mergedGraded = isTextbookSource ? cleanSeeds.concat(gradedItems) : gradedItems.concat(grammarSeeds);
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
    const rawTarget = Number(targetCount || 0);
    const defaultCap = defaultTargetCountForSourceJs(sourceTag);
    const cap = Math.max(1, (rawTarget <= 0 || rawTarget >= 1000) ? defaultCap : Math.min(rawTarget, defaultCap));
    const subj = detectSubjectCategoryFromTag(sourceTag, seedItems);
    const pool = getSubjectPureSeedPool(subj, seedItems, sourceTag);
    const specs = [];
    const seenFronts = new Set();
    const n = Math.max(1, pool.length);
    const srcLower = String(sourceTag || "").toLowerCase();
    const isHanjaSingleCharGrade = subj === "hanja" && !srcLower.includes("idiom");
    let seedCount = n;
    if (srcLower.includes("8geup") || srcLower.includes("starter_k12")) {
      seedCount = Math.min(50, n);
    } else if (/hanja-grade:[76543]geup/.test(srcLower) || srcLower.includes("hanja_master")) {
      seedCount = Math.min(100, n);
    } else if (srcLower.includes("hanja-1800") || srcLower.includes("mid1800")) {
      seedCount = Math.min(250, n);
    }
    const stepPairs = [];
    if (isHanjaSingleCharGrade) {
      for (let i = 0; i < seedCount; i += 1) stepPairs.push([i, 0]);
      for (let i = 0; i < seedCount; i += 1) stepPairs.push([i, 1]);
    } else {
      for (let i = 0; i < n; i += 1) stepPairs.push([i, 0]);
      if (subj === "english") {
        for (let i = 0; i < n; i += 1) stepPairs.push([i, 1]);
      }
    }

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
            frontText = "";
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
          const defDetail = String(base.explain || rawPrompt || cleanAns)
            .replace(/^\[[^\]]+\]\s*/, "")
            .replace(new RegExp(`^${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s*\\([^)]*\\))?\\s*(?:\\|\\s*)?[:：—-]?\\s*`), "")
            .trim();
          const maskAns = !cleanAns.startsWith("㉠") ? cleanAns : "";
          const rawSecondCue = defDetail && defDetail !== rawPrompt
            ? `[핵심 개념 확인] ${defDetail}`
            : `[심화 확인] ${rawPrompt || rawTermStr}`;
          const altCue = cleanCardFrontForDisplayJs(maskTermInDescJs(rawSecondCue, base.term, maskAns));
          frontText = (altCue && !seenFronts.has(altCue)) ? altCue : "";
          backText = formatConciseBackJs(cleanAns, base.explain, cleanTerm);
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

  // =========================================================================
  // v13.0 Commercial Mastery & Retention Booster (Contracts C8 ~ C14)
  // =========================================================================

  const RECOGNITION_GAIN_DAMPING_V13 = 0.42;

  function stepDualMemoryFsrs(state, rating, modality, elapsedDays, desiredRetention) {
    const s = state || {};
    const grade = Math.max(1, Math.min(4, Number(rating) || 3));
    const modNorm = String(modality || "active_recall").trim().toLowerCase();
    const isRec = modNorm === "multiple_choice" || modNorm === "choice" || modNorm === "button_2" || modNorm === "recognition";
    const elapsed = Math.max(0, Number(elapsedDays) || 0);
    const reqRet = Math.max(0.7, Math.min(0.99, Number(desiredRetention) || 0.9));

    const prevRecS = Math.max(0, Number(s.recognition_stability) || 0);
    const prevCallS = Math.max(0, Number(s.recall_stability) || 0);
    const prevD = Math.max(0, Number(s.difficulty) || 0);
    const prevReps = Math.max(0, Number(s.reps) || 0);
    const prevLapses = Math.max(0, Number(s.lapses) || 0);
    const prevConsec = Math.max(0, Number(s.consecutive_recognition_successes) || 0);

    if (isRec) {
      const recStep = stepFsrs5(
        { difficulty: prevD, stability: prevRecS, reps: prevReps, lapses: prevLapses, state: s.state || "new" },
        grade,
        elapsed,
        reqRet
      );
      let nextRecS;
      let nextCallS;
      let nextConsec;
      if (grade === 1) {
        nextRecS = recStep.memory.stability;
        nextCallS = prevCallS > 0 ? Number(Math.max(0.1, prevCallS * 0.75).toFixed(4)) : 0;
        nextConsec = 0;
      } else {
        const rawS = recStep.memory.stability;
        nextRecS = prevRecS <= 0
          ? Number(Math.max(0.1, rawS * RECOGNITION_GAIN_DAMPING_V13).toFixed(4))
          : Number((prevRecS + Math.max(0, rawS - prevRecS) * RECOGNITION_GAIN_DAMPING_V13).toFixed(4));
        nextCallS = Number(prevCallS.toFixed(4));
        nextConsec = prevConsec + (grade >= 3 ? 1 : 0);
      }
      const effS = nextCallS > 0 && nextCallS >= nextRecS ? nextCallS : Math.max(0.1, nextRecS);
      const promote = nextConsec >= 2 || nextRecS >= 3.0;
      return {
        rating: grade,
        modality: modNorm,
        next_state: {
          difficulty: recStep.memory.difficulty,
          recognition_stability: nextRecS,
          recall_stability: nextCallS,
          reps: recStep.memory.reps,
          lapses: recStep.memory.lapses,
          state: recStep.memory.state,
          consecutive_recognition_successes: nextConsec,
        },
        effective_stability: Number(effS.toFixed(4)),
        retrievability_before: recStep.retrievability_before,
        scheduled_days: grade === 1 ? 0 : Math.max(1, Math.round(effS)),
        promotion_triggered: promote,
        recommended_next_modality: promote ? "active_recall" : "multiple_choice",
      };
    }

    const callStep = stepFsrs5(
      { difficulty: prevD, stability: prevCallS, reps: prevReps, lapses: prevLapses, state: s.state || "new" },
      grade,
      elapsed,
      reqRet
    );
    const nextCallS = callStep.memory.stability;
    const nextRecS = grade === 1
      ? Number(Math.max(0.1, Math.min(prevRecS || nextCallS, nextCallS)).toFixed(4))
      : Number(Math.max(prevRecS, nextCallS).toFixed(4));
    const nextConsec = grade === 1 ? 0 : prevConsec + 1;
    return {
      rating: grade,
      modality: modNorm,
      next_state: {
        difficulty: callStep.memory.difficulty,
        recognition_stability: nextRecS,
        recall_stability: nextCallS,
        reps: callStep.memory.reps,
        lapses: callStep.memory.lapses,
        state: callStep.memory.state,
        consecutive_recognition_successes: nextConsec,
      },
      effective_stability: nextCallS,
      retrievability_before: callStep.retrievability_before,
      scheduled_days: callStep.scheduled_days,
      promotion_triggered: false,
      recommended_next_modality: grade === 1 ? "multiple_choice" : "active_recall",
    };
  }

  function computeIrtExamPrediction(cards, examTrack) {
    const trackKey = String(examTrack || "toeic").trim().toLowerCase();
    const specs = {
      toeic: { label: "TOEIC (ETS 공인 어휘·독해 환산)", min: 200, max: 990, cut: 0.35 },
      csat: { label: "대학수학능력시험 (절대평가 등급 예측)", min: 0, max: 100, cut: 0.65 },
      hanja: { label: "한국어문회 국가공인 급수한자 합격 예측", min: 0, max: 100, cut: 0.20 },
      civil_service: { label: "공무원·자격증 필기 합격권 예측", min: 0, max: 100, cut: 0.50 },
    };
    const spec = specs[trackKey] || specs.toeic;
    const reviewed = Array.isArray(cards)
      ? cards.filter((c) => c && Number(c.reps || 0) > 0 && Number(c.stability || 0) > 0)
      : [];
    if (reviewed.length === 0) {
      return {
        status: "INSUFFICIENT_DATA",
        exam_track: trackKey,
        exam_label: spec.label,
        reviewed_cards: 0,
        theta: null,
        standard_error: null,
        predicted_score: null,
        confidence_interval: null,
        pass_probability_pct: null,
        csat_grade: null,
      };
    }

    let theta = 0.0;
    for (let iter = 0; iter < 12; iter++) {
      let grad = -theta;
      let info = 1.0;
      for (let i = 0; i < reviewed.length; i++) {
        const c = reviewed[i];
        const dFsrs = Math.max(1.0, Math.min(10.0, Number(c.difficulty) || 5.0));
        const bI = (dFsrs - 5.5) / 2.0;
        const reps = Math.max(1, Number(c.reps) || 1);
        const lapses = Math.max(0, Number(c.lapses) || 0);
        const aI = Math.max(0.6, Math.min(1.8, 1.0 + Math.min(0.5, reps * 0.06) - Math.min(0.3, lapses * 0.08)));
        const sI = Math.max(0.1, Number(c.stability) || 1.0);
        const tI = Math.max(0.0, Number(c.elapsed_days) || 0.0);
        const rNow = computeRetrievability(tI, sI);
        const maturity = Math.min(1.0, Math.log1p(sI) / Math.log1p(30.0));
        const yI = Math.max(0.02, Math.min(0.98, 0.55 * rNow + 0.45 * maturity - Math.min(0.25, lapses * 0.08)));
        const z = Math.max(-15.0, Math.min(15.0, aI * (theta - bI)));
        const pI = 1.0 / (1.0 + Math.exp(-z));
        grad += aI * (yI - pI);
        info += aI * aI * pI * (1.0 - pI);
      }
      const step = grad / Math.max(1e-6, info);
      theta = Math.max(-3.0, Math.min(3.0, theta + step));
      if (Math.abs(step) < 1e-5) break;
    }

    let totalInfo = 1.0;
    for (let i = 0; i < reviewed.length; i++) {
      const c = reviewed[i];
      const dFsrs = Math.max(1.0, Math.min(10.0, Number(c.difficulty) || 5.0));
      const bI = (dFsrs - 5.5) / 2.0;
      const reps = Math.max(1, Number(c.reps) || 1);
      const lapses = Math.max(0, Number(c.lapses) || 0);
      const aI = Math.max(0.6, Math.min(1.8, 1.0 + Math.min(0.5, reps * 0.06) - Math.min(0.3, lapses * 0.08)));
      const z = Math.max(-15.0, Math.min(15.0, aI * (theta - bI)));
      const pI = 1.0 / (1.0 + Math.exp(-z));
      totalInfo += aI * aI * pI * (1.0 - pI);
    }
    const se = 1.0 / Math.sqrt(Math.max(1.0, totalInfo));

    function thetaToScore(th) {
      const normP = 1.0 / (1.0 + Math.exp(-0.95 * th));
      const raw = spec.min + normP * (spec.max - spec.min);
      if (trackKey === "toeic") {
        return Math.max(200, Math.min(990, Math.round(raw / 5.0) * 5));
      }
      return Math.max(spec.min, Math.min(spec.max, Math.round(raw)));
    }

    const predScore = thetaToScore(theta);
    const ciLow = thetaToScore(Math.max(-3.5, theta - 1.96 * se));
    const ciHigh = thetaToScore(Math.min(3.5, theta + 1.96 * se));
    const zPass = (theta - spec.cut) / Math.max(0.15, se);
    const passProb = Number((100.0 / (1.0 + Math.exp(-1.702 * zPass))).toFixed(1));
    const csatGrade = Math.max(1, Math.min(9, 10 - Math.max(1, Math.min(9, Math.ceil(predScore / 11.0)))));

    return {
      status: "CALIBRATED",
      exam_track: trackKey,
      exam_label: spec.label,
      reviewed_cards: reviewed.length,
      theta: Number(theta.toFixed(4)),
      standard_error: Number(se.toFixed(4)),
      predicted_score: predScore,
      confidence_interval: [Math.min(ciLow, predScore), Math.max(ciHigh, predScore)],
      pass_probability_pct: passProb,
      csat_grade: csatGrade,
    };
  }

  function filterQueueWithSiblingBurying(queue) {
    const seen = new Set();
    const active = [];
    const buriedIds = [];
    const list = Array.isArray(queue) ? queue : [];
    for (let i = 0; i < list.length; i++) {
      const card = Object.assign({}, list[i]);
      const cid = card.card_id !== undefined ? card.card_id : i + 1;
      let key;
      if (card.note_id !== undefined && card.note_id !== null && String(card.note_id).trim() !== "") {
        key = "note:" + String(card.note_id);
      } else {
        const front = String(card.front_text || card.front || "").trim();
        if (front.includes("{{c") || front.includes("{{io")) {
          const stem = front.replace(/\{\{(?:c|io)\d+::([^}:]+)(?:::[^}]+)?\}\}/g, "$1");
          key = "stem:" + stem;
        } else {
          key = "card:" + String(cid);
        }
      }
      if (seen.has(key)) {
        buriedIds.push(cid);
      } else {
        seen.add(key);
        active.push(card);
      }
    }
    return {
      active_queue: active,
      buried_sibling_card_ids: buriedIds,
      buried_count: buriedIds.length,
    };
  }

  function parseImageOcclusionSpecs(text) {
    const re = /\{\{io(\d+)::(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?:::([^}]+))?\}\}/g;
    const masks = [];
    let m;
    const raw = String(text || "");
    while ((m = re.exec(raw)) !== null) {
      masks.push({
        ordinal: Number(m[1]),
        x: Number(m[2]),
        y: Number(m[3]),
        w: Math.max(8, Number(m[4])),
        h: Math.max(8, Number(m[5])),
        label: String(m[6] || `영역 #${m[1]}`).trim(),
      });
    }
    return masks;
  }

  function renderImageOcclusionSvg(text, activeOrdinal, reveal) {
    const masks = parseImageOcclusionSpecs(text);
    const activeOrd = Number(activeOrdinal) || 1;
    const cleanTitle = String(text || "")
      .replace(/\{\{io\d+::[^}]+\}\}/g, "")
      .replace(/[<>&"]/g, "")
      .trim() || "Image Occlusion Diagram";
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180" class="bd-io-svg" role="img" aria-label="${cleanTitle}">`,
      `<rect x="2" y="2" width="356" height="176" rx="12" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>`,
      `<text x="16" y="22" fill="#94a3b8" font-size="11" font-weight="bold" font-family="sans-serif">🖼️ 이미지 가리기: ${cleanTitle.slice(0, 28)}</text>`,
    ];
    for (let i = 0; i < masks.length; i++) {
      const mk = masks[i];
      const cx = (mk.x + mk.w / 2).toFixed(1);
      const cy = (mk.y + mk.h / 2 + 4).toFixed(1);
      const safeLabel = mk.label.replace(/[<>&"]/g, "");
      if (mk.ordinal === activeOrd) {
        if (reveal) {
          parts.push(`<rect x="${mk.x}" y="${mk.y}" width="${mk.w}" height="${mk.h}" rx="6" fill="#065f46" fill-opacity="0.88" stroke="#34d399" stroke-width="2"/>`);
          parts.push(`<text x="${cx}" y="${cy}" fill="#ecfdf5" font-size="11" font-weight="bold" text-anchor="middle">${safeLabel}</text>`);
        } else {
          parts.push(`<rect x="${mk.x}" y="${mk.y}" width="${mk.w}" height="${mk.h}" rx="6" fill="#be123c" stroke="#fda4af" stroke-width="2" stroke-dasharray="4,2"/>`);
          parts.push(`<text x="${cx}" y="${cy}" fill="#fff1f2" font-size="11" font-weight="bold" text-anchor="middle">[ ? #${mk.ordinal} ]</text>`);
        }
      } else {
        parts.push(`<rect x="${mk.x}" y="${mk.y}" width="${mk.w}" height="${mk.h}" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>`);
        parts.push(`<text x="${cx}" y="${cy}" fill="#94a3b8" font-size="10" text-anchor="middle">#${mk.ordinal}</text>`);
      }
    }
    parts.push("</svg>");
    return parts.join("");
  }

  function renderMathAndCodeMarkup(text) {
    let esc = String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    esc = esc.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (_, lang, body) {
      return `<pre class="bd-code-block" data-lang="${lang || "text"}"><code class="bd-code">${body.trim()}</code></pre>`;
    });
    esc = esc.replace(/\$\$([\s\S]+?)\$\$/g, function (_, expr) {
      return `<div class="bd-math-block" role="math"><math display="block"><mrow>${expr.trim()}</mrow></math></div>`;
    });
    esc = esc.replace(/\$([^$\n]+?)\$/g, function (_, expr) {
      return `<span class="bd-math" role="math"><math display="inline"><mrow>${expr.trim()}</mrow></math></span>`;
    });
    return esc;
  }

  function resolveMobileErgonomicsSpec(dxPx, dyPx, minSwipePx, themeMode) {
    const dx = Number(dxPx) || 0;
    const dy = Number(dyPx) || 0;
    const thresh = Math.max(24, Number(minSwipePx) || 64);
    let swipeRating = null;
    let swipeDirection = "NONE";
    let hapticMs = [];
    if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) >= thresh) {
      if (dx < 0) {
        swipeRating = 1;
        swipeDirection = "LEFT";
        hapticMs = [40, 30, 40];
      } else {
        swipeRating = 3;
        swipeDirection = "RIGHT";
        hapticMs = [18];
      }
    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= thresh) {
      if (dy > 0) {
        swipeRating = 2;
        swipeDirection = "DOWN";
        hapticMs = [28];
      } else {
        swipeRating = 4;
        swipeDirection = "UP";
        hapticMs = [12, 20, 25];
      }
    }
    const modeNorm = String(themeMode || "light").trim().toLowerCase();
    const isOled = modeNorm === "oled" || modeNorm === "oled_dark" || modeNorm === "dark";
    return {
      swipe_direction: swipeDirection,
      swipe_rating: swipeRating,
      haptic_pattern_ms: hapticMs,
      theme_mode: modeNorm,
      theme_tokens: isOled
        ? { bg: "#000000", panel: "#0b0f19", border: "#1e293b", text: "#f8fafc", muted: "#94a3b8", accent: "#38bdf8" }
        : { bg: "#f2f4f6", panel: "#ffffff", border: "#e5e8eb", text: "#191f28", muted: "#4e5968", accent: "#1b64da" },
    };
  }

  function getTrademarkCleanroomDisclaimers() {
    return {
      toeic: "TOEIC®은 Educational Testing Service(ETS)의 등록상표입니다. 본 앱의 모든 어휘·예문은 ETS와 무관하게 자체 클린룸(Clean-Room) 방식으로 집필된 독립 학습 콘텐츠입니다.",
      csat: "대학수학능력시험(수능) 및 모의평가 명칭은 교육부·한국교육과정평가원(KICE)의 공개 성취기준을 참고한 학습 분류 표기이며, 수록된 모든 문항과 해설은 자체 창작물입니다.",
      publishers: "교과서 출판사명(동아출판·미래엔·비상교육 등) 및 검정·자격 시험명(어문회·JLPT 등)은 학생의 학습 진도 호환 및 시험 대비 범위를 안내하기 위한 설명적 표기이며, 해당 출판사·주관사와 제휴되거나 공식 보증받지 않은 비공식 독립 콘텐츠입니다.",
      anki: "BrainDeck은 Anki® / Ankitects Pty Ltd와 제휴되거나 보증받지 않은 독립 소프트웨어이며, 공개된 FSRS-5 학술 수식 및 오픈 호환 규격을 준수합니다.",
      general: "BrainDeck의 모든 어휘 뜻풀이·예문·해설·시각 도식은 외부 출판사 교과서나 기출문제를 복제하지 않은 100% 독립 집필(Clean-Room) 자산입니다.",
    };
  }

  function formatTrademarkDisclaimerSummary(headerText) {
    const header = String(headerText || "⚖️ 상표권 비제휴 및 클린룸 독립 콘텐츠 고지");
    const obj = getTrademarkCleanroomDisclaimers();
    const lines = Object.keys(obj).map((k) => "• " + obj[k]).join("\n");
    return header + "\n" + lines;
  }

  const CANONICAL_THIRD_PARTY_NOTICES_SHA256 = "971c7299467d06f7d28a3d4d89bf55e8788dc56b1af865747bcd2bf377ffbf0b";
  const FULL_THIRD_PARTY_NOTICES_VERBATIM = [
    "# BrainDeck (브레인덱) — 오픈소스 소프트웨어 · 데이터 라이선스 및 상표권 고지 (Third-Party Notices)",
    "",
    "본 문서는 BrainDeck(웹 PWA, macOS `BrainDeck.app`, Android 네이티브 앱 `com.braindeck.app`)에 포함된 오픈소스 컴포넌트, 공개 어학·유니코드 데이터셋, 온디바이스 SDK 및 설명적 상표 사용(Nominative Fair Use) 고지 사항을 명시합니다.",
    "",
    "---",
    "",
    "## 0. 독립 클린룸 개발 및 비제휴(Non-Affiliation) 상표권 고지",
    "",
    "- **Anki® 비제휴 고지**: BrainDeck은 **Anki® / Ankitects Pty Ltd**와 제휴되거나 공식 보증받지 않은 독립 소프트웨어이며, AGPLv3 소스코드를 일절 포함하지 않고 공개된 FSRS-5 학술 수식 및 오픈 호환 규격을 자체 클린룸(Clean-Room) 방식으로 구현합니다.",
    "- **TOEIC® / JLPT 비제휴 고지**: `TOEIC®`은 **Educational Testing Service(ETS)**의 등록상표입니다. 본 앱의 어휘·예문·해설은 ETS 및 시험 주관사(일본국제교류기금·일본국제교육지원협회, 한국어문회 등)와 무관하게 자체 집필된 비공식 시험 대비 콘텐츠입니다.",
    "- **교과서 출판사 비제휴 및 호환 표기 고지**: 교과서 출판사명(동아출판·미래엔·비상교육 등)은 학생의 학교 진도 호환 단원을 안내하기 위한 설명적 표기(Descriptive Fair Use)이며, 해당 출판사와 제휴되거나 공식 인증받지 않은 비공식 독립 학습 보조 콘텐츠입니다.",
    "- **수능·교육부 성취기준 및 문학 해설 고지**: 대학수학능력시험(수능) 및 교육과정 성취기준 분류는 교육부·한국교육과정평가원(KICE)의 공개 교육과정을 참고한 것이며, 보호기간 내 한국 현대문학(시·소설·희곡·수필) 학습 카드는 원문 전문 또는 다행 발췌 없이 저작권법 제28조(공표된 저작물의 인용)에 부합하는 독자적 문학 비평·표현기법 분석과 1~2어절 핵심 어구 최소 인용으로만 구성됩니다(1962년까지 작고하여 구 저작권법 사후 50년 보호기간 만료로 2013년 7월 1일 사후 70년 연장 시행 전 만료 확정된 공유저작물 제외).",
    "",
    "---",
    "",
    "## 1. CMU Pronouncing Dictionary (`cmudict-0.7b`) — BSD 2-Clause License",
    "",
    "영단어 음소·IPA 발음 기호 변환에 사용된 CMU Pronouncing Dictionary 데이터는 아래 BSD 2-Clause 라이선스를 따릅니다.",
    "",
    "```text",
    "Copyright (C) 1993-2015 Carnegie Mellon University. All rights reserved.",
    "",
    "Redistribution and use in source and binary forms, with or without",
    "modification, are permitted provided that the following conditions",
    "are met:",
    "",
    "1. Redistributions of source code must retain the above copyright",
    "   notice, this list of conditions and the following disclaimer.",
    "2. Redistributions in binary form must reproduce the above copyright",
    "   notice, this list of conditions and the following disclaimer in",
    "   the documentation and/or other materials provided with the",
    "   distribution.",
    "",
    "THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY ``AS IS'' AND",
    "ANY EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,",
    "THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR",
    "PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL CARNEGIE MELLON UNIVERSITY",
    "NOR ITS EMPLOYEES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,",
    "SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT",
    "LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,",
    "DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY",
    "THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT",
    "(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE",
    "OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.",
    "```",
    "",
    "---",
    "",
    "## 2. Unicode® Unihan Database (`kRSUnicode` / `kTotalStrokes`) — Unicode License v3",
    "",
    "한자 부수 및 총획수 검증 데이터(`unihan_irg_radical_strokes.txt`, `unihan_ktotalstrokes_ref.json`)는 Unicode® Unihan Database로부터 추출되었으며 Unicode License v3를 따릅니다.",
    "",
    "```text",
    "UNICODE LICENSE V3",
    "",
    "COPYRIGHT AND PERMISSION NOTICE",
    "",
    "Copyright © 1991-2026 Unicode, Inc.",
    "",
    "NOTICE TO USER: Carefully read the following legal agreement. BY",
    "DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR",
    "SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE",
    "TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT",
    "DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.",
    "",
    "Permission is hereby granted, free of charge, to any person obtaining a",
    "copy of data files and any associated documentation (the \"Data Files\") or",
    "software and any associated documentation (the \"Software\") to deal in the",
    "Data Files or Software without restriction, including without limitation",
    "the rights to use, copy, modify, merge, publish, distribute, and/or sell",
    "copies of the Data Files or Software, and to permit persons to whom the",
    "Data Files or Software are furnished to do so, provided that either (a)",
    "this copyright and permission notice appear with all copies of the Data",
    "Files or Software, or (b) this copyright and permission notice appear in",
    "associated Documentation.",
    "",
    "THE DATA FILES AND SOFTWARE ARE PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY",
    "KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF",
    "MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF",
    "THIRD PARTY RIGHTS.",
    "",
    "IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE",
    "BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,",
    "OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,",
    "WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,",
    "ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA",
    "FILES OR SOFTWARE.",
    "",
    "Except as contained in this notice, the name of a copyright holder shall",
    "not be used in advertising or otherwise to promote the sale, use or other",
    "dealings in these Data Files or Software without prior written",
    "authorization of the copyright holder.",
    "",
    "SPDX-License-Identifier: Unicode-3.0",
    "```",
    "",
    "---",
    "",
    "## 3. FSRS-5 Mathematical Specification (`open-spaced-repetition`) & PyYAML — MIT License",
    "",
    "FSRS-5 기본 19개 가중치 수학 명세(Jarrett Ye / `open-spaced-repetition`) 및 Python 백엔드·빌드 파이프라인의 YAML 파서(`PyYAML`)는 MIT License를 따릅니다.",
    "",
    "```text",
    "MIT License",
    "",
    "Copyright (c) 2022-2025 Jarrett Ye & Open Spaced Repetition Contributors",
    "Copyright (c) 2017-2021 Ingy döt Net",
    "Copyright (c) 2006-2016 Kirill Simonov",
    "",
    "Permission is hereby granted, free of charge, to any person obtaining a copy",
    "of this software and associated documentation files (the \"Software\"), to deal",
    "in the Software without restriction, including without limitation the rights",
    "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
    "copies of the Software, and to permit persons to whom the Software is",
    "furnished to do so, subject to the following conditions:",
    "",
    "The above copyright notice and this permission notice shall be included in all",
    "copies or substantial portions of the Software.",
    "",
    "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR",
    "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
    "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE",
    "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER",
    "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,",
    "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE",
    "SOFTWARE.",
    "```",
    "",
    "---",
    "",
    "## 4. Python Cryptography (`pyca/cryptography`) — Dual Apache License 2.0 / BSD 3-Clause License",
    "",
    "Python 백엔드 및 코퍼스 서명 검증 파이프라인에서 사용되는 `pyca/cryptography` 패키지는 **Apache License, Version 2.0**(제5절 전문 수록) 또는 아래 **BSD 3-Clause License** 중 선택 적용되는 이중 라이선스 소프트웨어입니다.",
    "",
    "```text",
    "This software is made available under the terms of *either* of the licenses",
    "found in LICENSE.APACHE or LICENSE.BSD. Contributions to cryptography are made",
    "under the terms of *both* these licenses.",
    "",
    "Copyright (c) Individual contributors.",
    "All rights reserved.",
    "",
    "Redistribution and use in source and binary forms, with or without",
    "modification, are permitted provided that the following conditions are met:",
    "",
    "    1. Redistributions of source code must retain the above copyright notice,",
    "       this list of conditions and the following disclaimer.",
    "",
    "    2. Redistributions in binary form must reproduce the above copyright",
    "       notice, this list of conditions and the following disclaimer in the",
    "       documentation and/or other materials provided with the distribution.",
    "",
    "    3. Neither the name of PyCA Cryptography nor the names of its contributors",
    "       may be used to endorse or promote products derived from this software",
    "       without specific prior written permission.",
    "",
    "THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS \"AS IS\" AND",
    "ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED",
    "WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE",
    "DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR",
    "ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES",
    "(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;",
    "LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON",
    "ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT",
    "(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS",
    "SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.",
    "```",
    "",
    "---",
    "",
    "## 5. AndroidX · Jetpack Compose · Room · Window · Kotlin Standard Library & Coroutines — Apache License 2.0",
    "",
    "Android 네이티브 앱(`com.braindeck.app`)에 직접 및 전이적(Transitive)으로 포함된 아래 컴포넌트들은 **Apache License, Version 2.0** 하에 배포됩니다(Rust/WebAssembly 코어 `braindeck-core`는 외부 서드파티 크레이트 의존성 없이 표준 라이브러리만으로 빌드됨):",
    "",
    "- **AndroidX Core / Lifecycle / Activity / Window / SavedState**: `androidx.core:core`, `androidx.core:core-ktx`, `androidx.activity:activity`, `androidx.activity:activity-compose`, `androidx.lifecycle:lifecycle-common`, `androidx.lifecycle:lifecycle-runtime-ktx`, `androidx.lifecycle:lifecycle-viewmodel`, `androidx.lifecycle:lifecycle-viewmodel-compose`, `androidx.lifecycle:lifecycle-viewmodel-savedstate`, `androidx.savedstate:savedstate`, `androidx.window:window`, `androidx.annotation:annotation`, `androidx.collection:collection`, `androidx.arch.core:core-common`, `androidx.arch.core:core-runtime`",
    "- **Jetpack Compose Material 3 & UI Foundation**: `androidx.compose.runtime:runtime`, `androidx.compose.ui:ui`, `androidx.compose.ui:ui-graphics`, `androidx.compose.ui:ui-text`, `androidx.compose.ui:ui-unit`, `androidx.compose.ui:ui-tooling-preview`, `androidx.compose.foundation:foundation`, `androidx.compose.foundation:foundation-layout`, `androidx.compose.animation:animation`, `androidx.compose.material3:material3`",
    "- **AndroidX Room & SQLite Wrapper**: `androidx.room:room-common`, `androidx.room:room-runtime`, `androidx.room:room-ktx`, `androidx.sqlite:sqlite`, `androidx.sqlite:sqlite-framework`",
    "- **JetBrains Kotlin & Coroutines**: `org.jetbrains.kotlin:kotlin-stdlib`, `org.jetbrains:annotations`, `org.jetbrains.kotlinx:kotlinx-coroutines-core`, `org.jetbrains.kotlinx:kotlinx-coroutines-android`, `org.jetbrains.kotlinx:kotlinx-coroutines-play-services`",
    "- **Google Transport / Firebase Encoders / ODML / Javax Inject (ML Kit Transitive Apache-2.0 Runtime)**: `com.google.android.datatransport:transport-api`, `com.google.android.datatransport:transport-backend-cct`, `com.google.android.datatransport:transport-runtime`, `com.google.firebase:firebase-components`, `com.google.firebase:firebase-encoders`, `com.google.firebase:firebase-encoders-json`, `com.google.android.odml:image`, `javax.inject:javax.inject`",
    "",
    "```text",
    "Copyright (C) 2018-2026 The Android Open Source Project (AndroidX, Jetpack Compose Material 3, Room, SQLite, Window)",
    "Copyright (C) 2010-2026 JetBrains s.r.o. and Kotlin Programming Language Contributors (Kotlin Standard Library, Annotations & Kotlinx Coroutines)",
    "",
    "                                 Apache License",
    "                           Version 2.0, January 2004",
    "                        http://www.apache.org/licenses/",
    "",
    "   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION",
    "",
    "   1. Definitions.",
    "",
    "      \"License\" shall mean the terms and conditions for use, reproduction,",
    "      and distribution as defined by Sections 1 through 9 of this document.",
    "",
    "      \"Licensor\" shall mean the copyright owner or entity authorized by",
    "      the copyright owner that is granting the License.",
    "",
    "      \"Legal Entity\" shall mean the union of the acting entity and all",
    "      other entities that control, are controlled by, or are under common",
    "      control with that entity. For the purposes of this definition,",
    "      \"control\" means (i) the power, direct or indirect, to cause the",
    "      direction or management of such entity, whether by contract or",
    "      otherwise, or (ii) ownership of fifty percent (50%) or more of the",
    "      outstanding shares, or (iii) beneficial ownership of such entity.",
    "",
    "      \"You\" (or \"Your\") shall mean an individual or Legal Entity",
    "      exercising permissions granted by this License.",
    "",
    "      \"Source\" form shall mean the preferred form for making modifications,",
    "      including but not limited to software source code, documentation",
    "      source, and configuration files.",
    "",
    "      \"Object\" form shall mean any form resulting from mechanical",
    "      transformation or translation of a Source form, including but",
    "      not limited to compiled object code, generated documentation,",
    "      and conversions to other media types.",
    "",
    "      \"Work\" shall mean the work of authorship, whether in Source or",
    "      Object form, made available under the License, as indicated by a",
    "      copyright notice that is included in or attached to the work",
    "      (an example is provided in the Appendix below).",
    "",
    "      \"Derivative Works\" shall mean any work, whether in Source or Object",
    "      form, that is based on (or derived from) the Work and for which the",
    "      editorial revisions, annotations, elaborations, or other modifications",
    "      represent, as a whole, an original work of authorship. For the purposes",
    "      of this License, Derivative Works shall not include works that remain",
    "      separable from, or merely link (or bind by name) to the interfaces of,",
    "      the Work and Derivative Works thereof.",
    "",
    "      \"Contribution\" shall mean any work of authorship, including",
    "      the original version of the Work and any modifications or additions",
    "      to that Work or Derivative Works thereof, that is intentionally",
    "      submitted to Licensor for inclusion in the Work by the copyright owner",
    "      or by an individual or Legal Entity authorized to submit on behalf of",
    "      the copyright owner. For the purposes of this definition, \"submitted\"",
    "      means any form of electronic, verbal, or written communication sent",
    "      to the Licensor or its representatives, including but not limited to",
    "      communication on electronic mailing lists, source code control systems,",
    "      and issue tracking systems that are managed by, or on behalf of, the",
    "      Licensor for the purpose of discussing and improving the Work, but",
    "      excluding communication that is conspicuously marked or otherwise",
    "      designated in writing by the copyright owner as \"Not a Contribution.\"",
    "",
    "      \"Contributor\" shall mean Licensor and any individual or Legal Entity",
    "      on behalf of whom a Contribution has been received by Licensor and",
    "      subsequently incorporated within the Work.",
    "",
    "   2. Grant of Copyright License. Subject to the terms and conditions of",
    "      this License, each Contributor hereby grants to You a perpetual,",
    "      worldwide, non-exclusive, no-charge, royalty-free, irrevocable",
    "      copyright license to reproduce, prepare Derivative Works of,",
    "      publicly display, publicly perform, sublicense, and distribute the",
    "      Work and such Derivative Works in Source or Object form.",
    "",
    "   3. Grant of Patent License. Subject to the terms and conditions of",
    "      this License, each Contributor hereby grants to You a perpetual,",
    "      worldwide, non-exclusive, no-charge, royalty-free, irrevocable",
    "      (except as stated in this section) patent license to make, have made,",
    "      use, offer to sell, sell, import, and otherwise transfer the Work,",
    "      where such license applies only to those patent claims licensable",
    "      by such Contributor that are necessarily infringed by their",
    "      Contribution(s) alone or by combination of their Contribution(s)",
    "      with the Work to which such Contribution(s) was submitted. If You",
    "      institute patent litigation against any entity (including a",
    "      cross-claim or counterclaim in a lawsuit) alleging that the Work",
    "      or a Contribution incorporated within the Work constitutes direct",
    "      or contributory patent infringement, then any patent licenses",
    "      granted to You under this License for that Work shall terminate",
    "      as of the date such litigation is filed.",
    "",
    "   4. Redistribution. You may reproduce and distribute copies of the",
    "      Work or Derivative Works thereof in any medium, with or without",
    "      modifications, and in Source or Object form, provided that You",
    "      meet the following conditions:",
    "",
    "      (a) You must give any other recipients of the Work or",
    "          Derivative Works a copy of this License; and",
    "",
    "      (b) You must cause any modified files to carry prominent notices",
    "          stating that You changed the files; and",
    "",
    "      (c) You must retain, in the Source form of any Derivative Works",
    "          that You distribute, all copyright, patent, trademark, and",
    "          attribution notices from the Source form of the Work,",
    "          excluding those notices that do not pertain to any part of",
    "          the Derivative Works; and",
    "",
    "      (d) If the Work includes a \"NOTICE\" text file as part of its",
    "          distribution, then any Derivative Works that You distribute must",
    "          include a readable copy of the attribution notices contained",
    "          within such NOTICE file, excluding those notices that do not",
    "          pertain to any part of the Derivative Works, in at least one",
    "          of the following places: within a NOTICE text file distributed",
    "          as part of the Derivative Works; within the Source form or",
    "          documentation, if provided along with the Derivative Works; or,",
    "          within a display generated by the Derivative Works, if and",
    "          wherever such third-party notices normally appear. The contents",
    "          of the NOTICE file are for informational purposes only and",
    "          do not modify the License. You may add Your own attribution",
    "          notices within Derivative Works that You distribute, alongside",
    "          or as an addendum to the NOTICE text from the Work, provided",
    "          that such additional attribution notices cannot be construed",
    "          as modifying the License.",
    "",
    "      You may add Your own copyright statement to Your modifications and",
    "      may provide additional or different license terms and conditions",
    "      for use, reproduction, or distribution of Your modifications, or",
    "      for any such Derivative Works as a whole, provided Your use,",
    "      reproduction, and distribution of the Work otherwise complies with",
    "      the conditions stated in this License.",
    "",
    "   5. Submission of Contributions. Unless You explicitly state otherwise,",
    "      any Contribution intentionally submitted for inclusion in the Work",
    "      by You to the Licensor shall be under the terms and conditions of",
    "      this License, without any additional terms or conditions.",
    "      Notwithstanding the above, nothing herein shall supersede or modify",
    "      the terms of any separate license agreement you may have executed",
    "      with Licensor regarding such Contributions.",
    "",
    "   6. Trademarks. This License does not grant permission to use the trade",
    "      names, trademarks, service marks, or product names of the Licensor,",
    "      except as required for reasonable and customary use in describing the",
    "      origin of the Work and reproducing the content of the NOTICE file.",
    "",
    "   7. Disclaimer of Warranty. Unless required by applicable law or",
    "      agreed to in writing, Licensor provides the Work (and each",
    "      Contributor provides its Contributions) on an \"AS IS\" BASIS,",
    "      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or",
    "      implied, including, without limitation, any warranties or conditions",
    "      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A",
    "      PARTICULAR PURPOSE. You are solely responsible for determining the",
    "      appropriateness of using or redistributing the Work and assume any",
    "      risks associated with Your exercise of permissions under this License.",
    "",
    "   8. Limitation of Liability. In no event and under no legal theory,",
    "      whether in tort (including negligence), contract, or otherwise,",
    "      unless required by applicable law (such as deliberate and grossly",
    "      negligent acts) or agreed to in writing, shall any Contributor be",
    "      liable to You for damages, including any direct, indirect, special,",
    "      incidental, or consequential damages of any character arising as a",
    "      result of this License or out of the use or inability to use the",
    "      Work (including but not limited to damages for loss of goodwill,",
    "      work stoppage, computer failure or malfunction, or any and all",
    "      other commercial damages or losses), even if such Contributor",
    "      has been advised of the possibility of such damages.",
    "",
    "   9. Accepting Warranty or Additional Liability. While redistributing",
    "      the Work or Derivative Works thereof, You may choose to offer,",
    "      and charge a fee for, acceptance of support, warranty, indemnity,",
    "      or other liability obligations and/or rights consistent with this",
    "      License. However, in accepting such obligations, You may act only",
    "      on Your own behalf and on Your sole responsibility, not on behalf",
    "      of any other Contributor, and only if You agree to indemnify,",
    "      defend, and hold each Contributor harmless for any liability",
    "      incurred by, or claims asserted against, such Contributor by reason",
    "      of your accepting any such warranty or additional liability.",
    "",
    "   END OF TERMS AND CONDITIONS",
    "```",
    "",
    "---",
    "",
    "## 6. SQLite Database Engine — Public Domain",
    "",
    "로컬 학습 원장 및 읽기 전용 레퍼런스 브레인팩 저장에 사용되는 **SQLite** 엔진(D. Richard Hipp 및 기여자)은 저작권 제한 없는 퍼블릭 도메인(Public Domain) 자산입니다.",
    "",
    "```text",
    "The author disclaims copyright to SQLite source code. In place of a legal notice,",
    "here is a blessing:",
    "  May you do good and not evil.",
    "  May you find forgiveness for yourself and forgive others.",
    "  May you share freely, never taking more than you give.",
    "```",
    "",
    "---",
    "",
    "## 7. Google ML Kit Text Recognition Korean & Play Services Tasks On-Device SDK",
    "",
    "Android 앱의 사진·교재 온디바이스 한국어/라틴 문자 광학문자인식(OCR) 기능은 **Google ML Kit** 및 전이적 온디바이스 런타임 SDK(`com.google.mlkit:text-recognition-korean:16.0.1`, `com.google.mlkit:vision-common`, `com.google.android.gms:play-services-mlkit-text-recognition-korean`, `com.google.android.gms:play-services-base`, `com.google.android.gms:play-services-basement`, `com.google.android.gms:play-services-tasks`)를 사용합니다. 이미지 및 텍스트 추출은 외부 서버 전송 없이 사용자 기기 내부에서만 처리되며, 해당 SDK 컴포넌트는 Google APIs Terms of Service(`https://developers.google.com/terms`) 및 ML Kit Terms of Service(`https://developers.google.com/ml-kit/terms`)의 적용을 받습니다.",
    "",
    "---",
    "",
    "## 8. 공공저작물(KOGL · 저작권법 제24조의2) 및 저작권 만료 공유저작물(제39조)",
    "",
    "- **교육부 초·중·고 기본 어휘 목록 및 교육용 한자 1,800자 자종 목록 / 국립국어원·법제처 국가법령정보**: 대한민국 저작권법 제24조의2 및 공공누리(KOGL 제1유형, 출처표시)에 의거해 사실적 어휘·자종 기준을 참고하였으며, 모든 뜻풀이·예문·해설은 자체 집필하였습니다.",
    "- **저작권 보호기간 만료 한국 근대문학(저작권법 제39조)**: 나도향(1926 작고), 최서해(1932 작고), 김소월(1934 작고), 심훈(1936 작고), 이상(1937 작고), 김유정(1937 작고), 박용철(1938 작고), 이효석(1942 작고), 이상화(1943 작고), 현진건(1943 작고), 이육사(1944 작고), 한용운(1944 작고), 윤동주(1945 작고), 정지용(1950 작고), 김영랑(1950 작고), 이광수(1950 작고), 채만식(1950 작고), 김동인(1951 작고), 최남선(1957 작고), 노천명(1957 작고) 등 1962년까지 작고(구 저작권법 사후 50년 보호기간 만료로 2013년 7월 1일 사후 70년 연장 시행 전 만료 확정)한 문인 20인의 공유저작물(Public Domain) 작품만을 원문 인용 대상으로 사용합니다."
  ].join("\n");
  const CANONICAL_THIRD_PARTY_NOTICES_NORMALIZED = FULL_THIRD_PARTY_NOTICES_VERBATIM.replace(/\r\n/g, "\n").trim();

  function getFullThirdPartyNoticesText() {
    return FULL_THIRD_PARTY_NOTICES_VERBATIM;
  }

  function resolveThirdPartyNoticesModalPayload(fetchedInput, allowOfflineEmbeddedFallback) {
    const useEmbedded = allowOfflineEmbeddedFallback !== false;
    let rawCandidate = "";
    if (fetchedInput && typeof fetchedInput === "object") {
      if (fetchedInput.source === "offline_embedded" && useEmbedded) {
        rawCandidate =
          fetchedInput.rawText !== undefined && fetchedInput.rawText !== null
            ? String(fetchedInput.rawText)
            : FULL_THIRD_PARTY_NOTICES_VERBATIM;
      } else {
        rawCandidate = fetchedInput.ok === false ? "" : String(fetchedInput.rawText || "");
      }
    } else {
      rawCandidate =
        fetchedInput !== undefined && fetchedInput !== null
          ? String(fetchedInput)
          : (useEmbedded ? FULL_THIRD_PARTY_NOTICES_VERBATIM : "");
    }
    const candidate = rawCandidate.replace(/\r\n/g, "\n").trim();
    if (!candidate || candidate !== CANONICAL_THIRD_PARTY_NOTICES_NORMALIZED) {
      return {
        ok: false,
        sha256: null,
        colorToken: "var(--rose)",
        text: "FAIL_CLOSED: THIRD_PARTY_NOTICES.txt 전문을 확인할 수 없거나 무결성 검증에 실패했습니다.",
      };
    }
    return {
      ok: true,
      sha256: CANONICAL_THIRD_PARTY_NOTICES_SHA256,
      colorToken: "var(--text)",
      text: formatTrademarkDisclaimerSummary() + "\n\n" + candidate,
    };
  }

  // Contract C16 (v13.1): Natural Native Prosody & Bilingual TTS Engine
  const NOVELTY_OR_ROBOTIC_VOICE_KEYWORDS_JS = [
    "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos",
    "wobble", "eddy", "flo", "fred", "good news", "grandma", "grandpa",
    "jester", "junior", "organ", "superstar", "ralph", "reed", "rocko",
    "sandy", "shelley", "trinoids", "whisper", "zarvox", "compact", "espeak"
  ];

  function sanitizeTextForNaturalTts(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    let s = raw.replace(/\{\{io\d+::[^}]+\}\}/g, " ");
    s = s.replace(/\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/g, "$1");
    s = s.replace(/\[([^\]]*?(?:#\d+|\d+급|필수\s*영단어|빈출\s*핵심|한자\s*\d*급|(?:초등|중학|고등|수능|토익|공무원|필수|빈출)\s*(?:영단어|어휘|한자|한국사|과학|수학|국어|법률))[^\]]*?)\]/g, " ");
    s = s.replace(/【([^】]*?(?:#\d+|\d+급|필수\s*영단어|빈출\s*핵심|한자\s*\d*급|(?:초등|중학|고등|수능|토익|공무원|필수|빈출)\s*(?:영단어|어휘|한자|한국사|과학|수학|국어|법률))[^】]*?)】/g, " ");
    s = s.replace(/\[([^\]]+)\]/g, " $1 ").replace(/【([^】]+)】/g, " $1 ");
    s = s.replace(/\(\s*\/[^/]+\/\s*\)/g, " ");
    s = s.replace(/(?:^|\s)\/[ˈˌːɪʊɛɔæɑəʌθðʃʒŋa-zA-Z.\-\s]{2,}\/(?=\s|$|[,.!?;:)])/g, " ");
    s = s.replace(/\(\s*(?:부수|획수|총\s*\d+\s*획)[^)]*\)/g, " ");
    s = s.replace(/\(\s*(?:교과부|수능\s*(?:필수|빈출)|평가원|토익\s*(?:필수|빈출)|공무원\s*(?:필수|빈출)|(?:고등|중학|초등)\s*필수|필수\s*영단어)[^)]*\)/g, " ");
    s = s.replace(/[📘💡🎯🔊🏫📚✍️🖼️⏰🚨✅⚠️🚩🧬🧪🎲🛒🎁❄️🔍]+/g, " ");
    s = s.replace(/(?:문맥\s*)?예문(?:·활용)?\s*:\s*/g, " ");
    s = s.replace(/(?:핵심\s*)?(?:정답|해설(?:·유래)?)\s*:\s*/g, " ");
    s = s.replace(/^(?:다음\s*(?:빈칸에\s*알맞은\s*(?:단어|말|표현)는\??|뜻에\s*해당하는\s*영단어는\??|한자의\s*뜻과\s*음은\??|설명에\s*해당하는\s*(?:개념|용어|단어)은\??|문장의\s*빈칸을\s*채우시오\.?))\s*/i, "");
    s = s.replace(/_{2,}/g, ", ").replace(/\s*(?:➔|→|↔|—|--)\s*/g, ", ");
    s = s.replace(/[*`#$~]+/g, " ").replace(/\s+/g, " ").replace(/^[ ,;:\-]+|[ ,;:\-]+$/g, "");
    return s;
  }

  function splitLineIntoBilingualClauses(line) {
    const cleaned = sanitizeTextForNaturalTts(line);
    if (!cleaned) return [];
    const parts = cleaned.split(/(\([^)]+\))/g);
    const clauses = [];
    for (let i = 0; i < parts.length; i++) {
      let p = (parts[i] || "").trim();
      if (!p) continue;
      if (p.startsWith("(") && p.endsWith(")")) {
        const inner = p.slice(1, -1).trim();
        if (!inner) continue;
        const hasKoIn = /[가-힣一-龥]/.test(inner);
        const hasEnIn = /[A-Za-z]{2,}/.test(inner);
        if (hasKoIn && !hasEnIn) {
          clauses.push({ lang: "ko-KR", text: inner });
          continue;
        }
        if (hasEnIn && !hasKoIn) {
          clauses.push({ lang: "en-US", text: inner });
          continue;
        }
        p = inner;
      }
      const hasKo = /[가-힣一-龥]/.test(p);
      const hasEn = /[A-Za-z]{2,}/.test(p);
      if (hasEn && !hasKo) {
        clauses.push({ lang: "en-US", text: p.replace(/^[ ,;:\-]+|[ ,;:\-]+$/g, "") });
      } else if (hasKo && !hasEn) {
        clauses.push({ lang: "ko-KR", text: p.replace(/^[ ,;:\-]+|[ ,;:\-]+$/g, "") });
      } else if (hasEn && hasKo) {
        let curLang = null;
        let curTokens = [];
        const tokens = p.split(/\s+/);
        for (let t = 0; t < tokens.length; t++) {
          const tok = tokens[t];
          if (!tok) continue;
          const isKoTok = /[가-힣一-龥]/.test(tok);
          const isEnTok = /[A-Za-z]/.test(tok);
          const tokLang = isKoTok ? "ko-KR" : (isEnTok ? "en-US" : (curLang || "ko-KR"));
          if (!curLang || tokLang === curLang) {
            curLang = tokLang;
            curTokens.push(tok);
          } else {
            const segTxt = curTokens.join(" ").replace(/^[ ,;:\-]+|[ ,;:\-]+$/g, "");
            if (segTxt) clauses.push({ lang: curLang, text: segTxt });
            curLang = tokLang;
            curTokens = [tok];
          }
        }
        if (curLang && curTokens.length) {
          const segTxt = curTokens.join(" ").replace(/^[ ,;:\-]+|[ ,;:\-]+$/g, "");
          if (segTxt) clauses.push({ lang: curLang, text: segTxt });
        }
      } else if (/\d/.test(p)) {
        clauses.push({ lang: "ko-KR", text: p.replace(/^[ ,;:\-]+|[ ,;:\-]+$/g, "") });
      }
    }
    const merged = [];
    for (let j = 0; j < clauses.length; j++) {
      const c = clauses[j];
      const cleanTxt = (c.text || "").replace(/^[ ,;:\-]+|[ ,;:\-]+$/g, "");
      if (!cleanTxt) continue;
      if (merged.length > 0 && merged[merged.length - 1].lang === c.lang) {
        const prev = merged[merged.length - 1].text;
        const sep = /[.!?,]$/.test(prev) ? " " : ". ";
        merged[merged.length - 1].text = prev + sep + cleanTxt;
      } else {
        merged.push({ lang: c.lang, text: cleanTxt });
      }
    }
    return merged;
  }

  function buildNaturalTtsSegments(rawText, frontText, backText, isRevealed) {
    const candidateLines = [];
    if (isRevealed && (frontText || backText)) {
      const frontRawLines = String(frontText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const deferredExamples = [];
      if (frontRawLines.length > 0) {
        const headClean = sanitizeTextForNaturalTts(frontRawLines[0]);
        if (headClean) {
          if (/[A-Za-z]{2,}/.test(headClean)) {
            const enHead = splitLineIntoBilingualClauses(headClean)
              .filter((c) => c.lang === "en-US")
              .map((c) => c.text);
            candidateLines.push(enHead.length ? enHead.join(" ") : headClean);
          } else {
            candidateLines.push(headClean);
          }
        }
        for (let f = 1; f < frontRawLines.length; f++) {
          const exClean = sanitizeTextForNaturalTts(frontRawLines[f]);
          if (exClean && /[A-Za-z]{2,}/.test(exClean)) {
            deferredExamples.push(frontRawLines[f]);
          }
        }
      }
      const backSrc = String(backText || rawText || "").trim();
      const rawLines = backSrc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const meaningLines = [];
      for (let b = 0; b < rawLines.length; b++) {
        const ln = rawLines[b];
        if (b === 0) meaningLines.push(ln);
        else if (/^\s*(?:💡\s*)?(?:핵심\s*)?해설(?:·유래)?\s*[:：]/.test(ln)) continue;
        else if (ln.includes("예문")) deferredExamples.push(ln);
        else {
          const lnClean = sanitizeTextForNaturalTts(ln);
          const enCount = (lnClean.match(/[A-Za-z]/g) || []).length;
          const koCount = (lnClean.match(/[가-힣一-龥]/g) || []).length;
          if (enCount >= 6 && enCount > koCount * 2) deferredExamples.push(ln);
          else meaningLines.push(ln);
        }
      }
      candidateLines.push.apply(candidateLines, meaningLines.length ? meaningLines : rawLines);
      candidateLines.push.apply(candidateLines, deferredExamples);
    } else {
      const src = String(rawText || frontText || backText || "").trim();
      const rawLines = src.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const filtered = rawLines.filter((ln, idx) => idx === 0 || !/^\s*(?:💡\s*)?(?:핵심\s*)?해설(?:·유래)?\s*[:：]/.test(ln));
      candidateLines.push.apply(candidateLines, filtered.length ? filtered : rawLines);
    }
    const segments = [];
    const seen = new Set();
    for (let i = 0; i < candidateLines.length; i++) {
      const clauses = splitLineIntoBilingualClauses(candidateLines[i]);
      for (let j = 0; j < clauses.length; j++) {
        const cl = clauses[j];
        const key = cl.lang + ":" + cl.text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const isEn = cl.lang === "en-US";
        const wordCount = cl.text.split(/\s+/).length;
        segments.push({
          text: cl.text,
          lang: cl.lang,
          voice: isEn ? "en-US-AvaMultilingualNeural" : "ko-KR-SunHiNeural",
          macos_voice: isEn ? "Samantha" : "Yuna",
          rate: isEn ? (wordCount <= 3 ? 0.92 : 0.96) : 0.98,
          pitch: 1.0,
        });
      }
    }
    if (segments.length === 0) {
      const fb = sanitizeTextForNaturalTts(rawText || frontText || backText) || "vocabulary";
      const isKo = /[가-힣]/.test(fb);
      segments.push({
        text: fb,
        lang: isKo ? "ko-KR" : "en-US",
        voice: isKo ? "ko-KR-SunHiNeural" : "en-US-AvaMultilingualNeural",
        macos_voice: isKo ? "Yuna" : "Samantha",
        rate: isKo ? 0.98 : 0.94,
        pitch: 1.0,
      });
    }
    return segments;
  }

  function selectBestBrowserVoice(voices, lang) {
    const list = Array.isArray(voices) ? voices : [];
    const targetPrefix = String(lang || "en-US").toLowerCase().startsWith("ko") ? "ko" : "en";
    const enPref = ["ava", "andrew", "aria", "jenny", "guy", "google us english", "samantha", "alex", "allison", "daniel"];
    const koPref = ["sunhi", "injoon", "hyunsu", "google 한국의", "yuna", "유나", "sora", "소라", "jian", "지안", "minsu", "민수"];
    let bestVoice = null;
    let bestScore = -10000;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v) continue;
      const vLang = String(v.lang || "").trim().toLowerCase().replace(/_/g, "-");
      if (!vLang.startsWith(targetPrefix)) continue;
      const combined = (String(v.name || "") + " " + String(v.voiceURI || "")).toLowerCase();
      let score = 0;
      for (let b = 0; b < NOVELTY_OR_ROBOTIC_VOICE_KEYWORDS_JS.length; b++) {
        if (combined.includes(NOVELTY_OR_ROBOTIC_VOICE_KEYWORDS_JS[b])) {
          score -= 1000;
          break;
        }
      }
      if (combined.includes("natural") || combined.includes("neural")) score += 140;
      if (combined.includes("premium") || combined.includes("enhanced") || combined.includes("siri")) score += 95;
      if (combined.includes("online") || combined.includes("cloud") || v.localService === false) score += 45;
      if (targetPrefix === "en") {
        if (vLang === "en-us") score += 30;
        else if (vLang === "en-gb" || vLang === "en-au" || vLang === "en-ca") score += 15;
        for (let p = 0; p < enPref.length; p++) {
          if (combined.includes(enPref[p])) {
            score += 75 - p * 4;
            break;
          }
        }
      } else {
        if (vLang === "ko-kr") score += 30;
        for (let p = 0; p < koPref.length; p++) {
          if (combined.includes(koPref[p])) {
            score += 75 - p * 4;
            break;
          }
        }
      }
      if (v.default) score += 5;
      if (score > bestScore) {
        bestScore = score;
        bestVoice = v;
      }
    }
    return bestVoice;
  }

  function levenshteinDistJs(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let cur = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur.push(Math.min(cur[cur.length - 1] + 1, prev[j] + 1, prev[j - 1] + cost));
      }
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  function gradeDictationResponse(targetWord, userInput) {
    const t = String(targetWord || "").trim().toLowerCase().replace(/[^\w가-힣一-龥\s]/g, "");
    const u = String(userInput || "").trim().toLowerCase().replace(/[^\w가-힣一-龥\s]/g, "");
    if (!u) return { is_correct: false, accuracy_pct: 0.0, recommended_rating: 1, verdict: "AGAIN" };
    const dist = levenshteinDistJs(t, u);
    const maxLen = Math.max(1, t.length, u.length);
    const acc = Number((Math.max(0, 1.0 - dist / maxLen) * 100.0).toFixed(1));
    // Single acceptance rule: exact match, 1 typo with >=80% accuracy, or >=85% accuracy on longer phrases.
    const isCorrect = Boolean(dist === 0 || (dist <= 1 && acc >= 80.0) || acc >= 85.0);
    const rating = dist === 0 ? 4 : (isCorrect ? 3 : (acc >= 65.0 ? 2 : 1));
    return { is_correct: isCorrect, accuracy_pct: acc, recommended_rating: rating, verdict: isCorrect ? "PASS" : "RETRY" };
  }

  function buildSentenceChunkChallenge(sentence) {
    const words = String(sentence || "The captain refused to abandon the ship").trim().split(/\s+/).filter(Boolean);
    const canonical = words.map((w, idx) => ({ index: idx, text: w }));
    const scrambled = canonical.slice().sort((a, b) => (a.text.localeCompare(b.text) || (b.index - a.index)));
    if (scrambled.length > 1 && scrambled.every((c, idx) => c.index === idx)) {
      const tmp = scrambled[0];
      scrambled[0] = scrambled[scrambled.length - 1];
      scrambled[scrambled.length - 1] = tmp;
    }
    return { canonical_chunks: canonical, scrambled_chunks: scrambled };
  }

  function gradeSentenceChunkOrdering(canonicalSeq, submittedSeq) {
    const can = Array.isArray(canonicalSeq) ? canonicalSeq.map((s) => String(s || "").trim()) : [];
    const sub = Array.isArray(submittedSeq) ? submittedSeq.map((s) => String(s || "").trim()) : [];
    if (!can.length || !sub.length) return { is_correct: false, accuracy_pct: 0.0, recommended_rating: 1 };
    let matches = 0;
    const n = Math.max(can.length, sub.length);
    for (let i = 0; i < Math.min(can.length, sub.length); i++) {
      if (can[i].toLowerCase() === sub[i].toLowerCase()) matches++;
    }
    const acc = Number(((matches / n) * 100.0).toFixed(1));
    const exact = can.length === sub.length && matches === can.length;
    return { is_correct: exact, accuracy_pct: acc, recommended_rating: exact ? 4 : (acc >= 75 ? 3 : (acc >= 50 ? 2 : 1)) };
  }

  function evaluateSpeechShadowing(targetText, spokenTranscript, durationMs) {
    const res = gradeDictationResponse(targetText, spokenTranscript);
    return {
      is_correct: res.is_correct,
      accuracy_pct: res.accuracy_pct,
      recommended_rating: res.recommended_rating,
      duration_ms: Number(durationMs) || 1500,
      verdict: res.accuracy_pct >= 90 ? "EXCELLENT" : (res.accuracy_pct >= 70 ? "GOOD" : "RETRY"),
    };
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
    stepDualMemoryFsrs,
    computeIrtExamPrediction,
    filterQueueWithSiblingBurying,
    parseImageOcclusionSpecs,
    renderImageOcclusionSvg,
    renderMathAndCodeMarkup,
    resolveMobileErgonomicsSpec,
    getTrademarkCleanroomDisclaimers,
    formatTrademarkDisclaimerSummary,
    getFullThirdPartyNoticesText,
    resolveThirdPartyNoticesModalPayload,
    verifyCorpusBundleIntegrity,
    sanitizeTextForNaturalTts,
    buildNaturalTtsSegments,
    selectBestBrowserVoice,
    gradeDictationResponse,
    buildSentenceChunkChallenge,
    gradeSentenceChunkOrdering,
    evaluateSpeechShadowing,
  };
});


