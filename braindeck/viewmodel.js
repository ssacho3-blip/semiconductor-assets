/**
 * Pure Presentation ViewModel for BrainDeck 2.0 (MVVM Architecture).
 * Zero DOM dependencies — 100% deterministic functions testable in Node/Browser.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    root.AnkiStudioViewModel = api;
    root.BrainDeckViewModel = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function formatRetentionBadge(retentionPct) {
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

  function mapKeyboardShortcut(key, isAnswerRevealed, isTypingInInput, ageTier) {
    if (isTypingInInput) {
      return null;
    }
    const normalized = String(key || "").toLowerCase();
    const tierNorm = String(ageTier || "teen").toLowerCase();
    if (normalized === " " || normalized === "enter") {
      return isAnswerRevealed ? { action: "rate", rating: 3 } : { action: "reveal" };
    }
    if (isAnswerRevealed && ["1", "2", "3", "4"].includes(normalized)) {
      if (normalized === "4" && tierNorm === "junior") {
        return null;
      }
      return { action: "rate", rating: Number(normalized) };
    }
    if (normalized === "q") {
      return { action: "quiz" };
    }
    if (normalized === "h") {
      return { action: "hint" };
    }
    if (normalized === "t") {
      return { action: "tts" };
    }
    if (normalized === "z") {
      return { action: "undo" };
    }
    if (normalized === "-") {
      return { action: "bury" };
    }
    if (normalized === "@" || normalized === "!") {
      return { action: "suspend" };
    }
    if (normalized === "f") {
      return { action: "cycle_flag" };
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

  const KO_STOPWORDS = new Set([
    "the", "a", "an", "is", "are", "to", "of", "in", "on", "for", "and", "or",
    "이", "그", "저", "것", "수", "등", "및", "또는", "이다", "입니다", "하는", "있는"
  ]);

  function cleanExpectedAnswerText(rawText) {
    let text = String(rawText || "");
    const commentaryIdx = text.indexOf("💡 해설:");
    if (commentaryIdx >= 0) {
      text = text.slice(0, commentaryIdx);
    }
    const clozeFocus = [];
    const bracketRe = /【([^】]+)】/g;
    let m;
    while ((m = bracketRe.exec(text)) !== null) {
      clozeFocus.push(m[1]);
    }
    if (clozeFocus.length > 0) {
      return clozeFocus.join(" ").trim();
    }
    text = text.replace(/\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/g, "$1");
    text = text.replace(/[【】\[\]]/g, " ");
    return text.trim();
  }

  function extractMeaningfulAnswerTokens(rawText) {
    const cleaned = cleanExpectedAnswerText(rawText).toLowerCase();
    const matches = cleaned.match(/[a-z0-9가-힣]+/g) || [];
    const suffixes = ["에서는", "으로서", "입니다", "한다", "에서", "으로", "에게", "까지", "부터", "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과"];
    const result = [];
    matches.forEach((word) => {
      let w = word;
      for (let i = 0; i < suffixes.length; i += 1) {
        const sfx = suffixes[i];
        if (w.length > sfx.length + 1 && w.endsWith(sfx)) {
          w = w.slice(0, -sfx.length);
          break;
        }
      }
      if (w.length >= 1 && !KO_STOPWORDS.has(w)) {
        result.push(w);
      }
    });
    return Array.from(new Set(result));
  }

  function buildCharBigrams(rawText) {
    const compact = cleanExpectedAnswerText(rawText).toLowerCase().replace(/\s+/g, "");
    if (!compact) return new Set();
    if (compact.length === 1) return new Set([compact]);
    const set = new Set();
    for (let i = 0; i < compact.length - 1; i += 1) {
      set.add(compact.slice(i, i + 2));
    }
    return set;
  }

  function evaluateTypedAnswerUnderstanding(userAnswer, expectedAnswer) {
    const userRaw = String(userAnswer || "").trim();
    const targetClean = cleanExpectedAnswerText(expectedAnswer);
    const primaryTarget = targetClean.replace(/\s*\([^)]*\)\s*$/g, "").trim() || targetClean;
    const refTokens = extractMeaningfulAnswerTokens(primaryTarget);

    if (!userRaw || userRaw === "?" || userRaw === "모름" || userRaw === "모르겠어요") {
      return {
        verdict: "UNKNOWN",
        badgeLabel: "❓ 모름 · 오답 (다시 학습 추천)",
        tone: "rose",
        scorePct: 0,
        recommendedRating: 1,
        matchedTerms: [],
        missingTerms: refTokens.slice(0, 5),
        feedback: `핵심 정답 키워드(${refTokens.slice(0, 4).join(", ") || primaryTarget.slice(0, 24)})를 확인하고 '다시(10분)'로 복습하세요.`,
      };
    }

    const normUser = userRaw.toLowerCase().replace(/[\s()[\],·]+/g, "");
    const normTarget = targetClean.toLowerCase().replace(/[\s()[\],·]+/g, "");
    const normPrimary = primaryTarget.toLowerCase().replace(/[\s()[\],·]+/g, "");

    const userNums = userRaw.match(/\d+/g) || [];
    const targetNums = targetClean.match(/\d+/g) || [];
    const primaryNums = primaryTarget.match(/\d+/g) || [];
    let numericConflict = false;
    if (primaryNums.length > 0 && !primaryNums.every((n) => userNums.includes(n))) {
      numericConflict = true;
    }
    if (userNums.length > 0 && targetNums.length > 0 && !userNums.every((n) => targetNums.includes(n))) {
      numericConflict = true;
    }

    if (
      !numericConflict &&
      normUser &&
      (normUser === normTarget ||
        normUser === normPrimary ||
        (normUser.length >= 2 && normPrimary.includes(normUser) && normUser.length / normPrimary.length >= 0.85) ||
        (normUser.length >= 2 && normTarget.includes(normUser) && normUser.length / normTarget.length >= 0.85))
    ) {
      return {
        verdict: "EXACT",
        badgeLabel: "🎯 정답 · 완벽 이해",
        tone: "emerald",
        scorePct: 100,
        recommendedRating: 4,
        matchedTerms: refTokens,
        missingTerms: [],
        feedback: "✅ 정답을 정확하게 이해하고 인출했습니다! '알맞음(Good)' 또는 '쉬움(Easy)'을 눌러주세요.",
      };
    }

    const userTokens = new Set(extractMeaningfulAnswerTokens(userRaw));
    const userLower = userRaw.toLowerCase();
    const matched = [];
    const missing = [];
    refTokens.forEach((tok) => {
      if (userTokens.has(tok) || userLower.includes(tok)) {
        matched.push(tok);
      } else {
        missing.push(tok);
      }
    });
    if (numericConflict) {
      missing.push(...targetNums.filter((n) => !userNums.includes(n)));
    }

    const tokenRecall = refTokens.length > 0 ? matched.length / refTokens.length : 0;
    const refBigrams = buildCharBigrams(primaryTarget);
    const userBigrams = buildCharBigrams(userRaw);
    let bigramOverlap = 0;
    if (refBigrams.size > 0 && userBigrams.size > 0) {
      let hit = 0;
      refBigrams.forEach((bg) => {
        if (userBigrams.has(bg)) hit += 1;
      });
      bigramOverlap = hit / refBigrams.size;
    }

    let scorePct = Math.round(Math.min(100, Math.max(0, (tokenRecall * 0.65 + bigramOverlap * 0.35) * 100)));
    if (numericConflict) {
      scorePct = Math.min(scorePct, 55);
    }

    if (!numericConflict && scorePct >= 82 && missing.length === 0) {
      return {
        verdict: "EXACT",
        badgeLabel: "🎯 정답 · 완벽 이해",
        tone: "emerald",
        scorePct,
        recommendedRating: scorePct >= 94 ? 4 : 3,
        matchedTerms: matched,
        missingTerms: missing,
        feedback: `✅ 핵심 개념(${matched.slice(0, 3).join(", ")})을 정확히 이해하고 있습니다!`,
      };
    }

    if (scorePct >= 35 || (matched.length >= 1 && missing.length >= 1)) {
      const floorScore = tokenRecall >= 0.45 ? 46 : 40;
      return {
        verdict: "PARTIAL",
        badgeLabel: "💡 약간 이해 · 부분 일치",
        tone: "amber",
        scorePct: Math.max(floorScore, scorePct),
        recommendedRating: 2,
        matchedTerms: matched,
        missingTerms: missing,
        feedback: `💡 일부분(${matched.slice(0, 3).join(", ") || "유사 표현"})은 이해했지만 핵심 키워드(${missing.slice(0, 3).join(", ") || "세부 표현"})가 빠졌습니다. '어려움(Hard)'을 추천합니다.`,
      };
    }

    return {
      verdict: "UNKNOWN",
      badgeLabel: "❓ 모름 · 오답 (재학습 필요)",
      tone: "rose",
      scorePct,
      recommendedRating: 1,
      matchedTerms: matched,
      missingTerms: missing.length > 0 ? missing : [targetClean.slice(0, 24)],
      feedback: `❓ 정답과 차이가 큽니다. 누락된 핵심어(${(missing.length > 0 ? missing : [targetClean]).slice(0, 3).join(", ")})를 확인하고 '다시(Again)'로 복습하세요.`,
    };
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

  const HANGUL_CHOSEONG = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
    "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];

  function extractTargetAndExplanation(frontText, backText, explicitTarget, explicitExtra) {
    const front = String(frontText || "").trim();
    const back = String(backText || "").trim();
    let mainBack = back;
    let extraExp = String(explicitExtra || "").trim();
    if (back.includes("💡 해설:")) {
      const parts = back.split("💡 해설:");
      mainBack = String(parts[0] || "").trim();
      if (!extraExp) {
        extraExp = String(parts.slice(1).join("💡 해설:") || "").trim();
      }
    }
    if (explicitTarget && String(explicitTarget).trim()) {
      return {
        targetAnswer: String(explicitTarget).trim(),
        extraExplanation: extraExp || (mainBack !== String(explicitTarget).trim() ? mainBack : ""),
      };
    }
    const clozeMatches = [];
    const clozeRe = /\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/gi;
    let m;
    while ((m = clozeRe.exec(front)) !== null) {
      if (m[1] && m[1].trim()) clozeMatches.push(m[1].trim());
    }
    if (clozeMatches.length > 0) {
      return {
        targetAnswer: clozeMatches.join(", "),
        extraExplanation: extraExp || mainBack,
      };
    }
    const bracketMatches = [];
    const bracketRe = /【([^】]+)】/g;
    while ((m = bracketRe.exec(mainBack)) !== null) {
      if (m[1] && m[1].trim()) bracketMatches.push(m[1].trim());
    }
    if (bracketMatches.length > 0) {
      return {
        targetAnswer: bracketMatches.join(", "),
        extraExplanation: extraExp || mainBack,
      };
    }
    const firstLine = (mainBack.split("\n")[0] || mainBack).trim();
    return {
      targetAnswer: firstLine,
      extraExplanation: extraExp,
    };
  }

  function generateProgressiveHint(targetAnswer, extraExplanation, step) {
    const cleanTarget = cleanExpectedAnswerText(targetAnswer) || "핵심 정답";
    const withoutParen = cleanTarget.replace(/\s*\([^)]*\)\s*$/g, "").trim() || cleanTarget;
    const primary = withoutParen.split(/\s*(?:\/|·|,|\()\s*/)[0].trim() || withoutParen;
    const stepNum = Math.max(1, Number(step) || 1);
    const chars = Array.from(primary);
    let nonSpaceCount = 0;
    const maskedTokens = chars.map((ch, idx) => {
      if (/\s/.test(ch)) return " ";
      nonSpaceCount += 1;
      if (stepNum >= 2 && idx === 0) return ch;
      const code = ch.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        const choIdx = Math.floor((code - 0xac00) / 588);
        return HANGUL_CHOSEONG[choIdx] || "ㅇ";
      }
      if (/[a-zA-Z]/.test(ch)) {
        return idx === 0 ? ch : "_";
      }
      if (/[0-9]/.test(ch)) {
        return idx === 0 ? ch : "□";
      }
      return ch;
    });
    const maskStr = maskedTokens.join(" ").replace(/\s+/g, " ").trim();
    let contextCue = "";
    if (extraExplanation && String(extraExplanation).trim()) {
      let safe = String(extraExplanation).trim();
      if (primary.length >= 2) {
        const escaped = primary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        safe = safe.replace(new RegExp(escaped, "gi"), "[ ___ ]");
      }
      contextCue = safe.slice(0, 85);
    }
    if (stepNum === 1) {
      return {
        step: 1,
        mask: maskStr,
        charCount: nonSpaceCount,
        cueText: `💡 1단계 힌트: [${maskStr}] (${nonSpaceCount}글자) — 한 번 더 누르면 첫 글자와 문맥 단서가 공개됩니다.`,
      };
    }
    return {
      step: 2,
      mask: maskStr,
      charCount: nonSpaceCount,
      cueText: `💡 2단계 힌트 (앞글자 공개): [${maskStr}] (${nonSpaceCount}글자)${contextCue ? ` · 단서: ${contextCue}` : ""}`,
    };
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
  const STANDALONE_TEXTBOOKS = [
    {
      textbook_id: "kr.mid1.eng.donga_yoon.2022",
      title: "중1 영어 (동아 윤정미)",
      subject_code: "eng",
      unlocked: true,
      units: [
        { unit_id: "kr.mid1.eng.donga_yoon.2022:U01", unit_code: "Lesson 1", unit_title: "My Happy School Life", page_start: 10, page_end: 27, entry_count: 6 },
        { unit_id: "kr.mid1.eng.donga_yoon.2022:U02", unit_code: "Lesson 2", unit_title: "Discover Your Culture", page_start: 28, page_end: 45, entry_count: 5 },
        { unit_id: "kr.mid1.eng.donga_yoon.2022:U03", unit_code: "Lesson 3", unit_title: "Spend Smart, Save Smart", page_start: 46, page_end: 63, entry_count: 4 },
        { unit_id: "kr.mid1.eng.donga_yoon.2022:U04", unit_code: "Lesson 4", unit_title: "Walk Around the World", page_start: 64, page_end: 81, entry_count: 4 },
      ],
      entries: [
        { id: "m1_u1_1", unit_id: "kr.mid1.eng.donga_yoon.2022:U01", term: "introduce", answer: "소개하다", pos: "동사", sentence: "Let me {{c1::introduce::소개하다}} myself to the class.", explain: "Let me introduce myself (나를 소개할게)" },
        { id: "m1_u1_2", unit_id: "kr.mid1.eng.donga_yoon.2022:U01", term: "favorite", answer: "가장 좋아하는", pos: "형용사", sentence: "My {{c1::favorite::가장 좋아하는}} subject is PE.", explain: "favorite subject (가장 좋아하는 과목)" },
        { id: "m1_u1_3", unit_id: "kr.mid1.eng.donga_yoon.2022:U01", term: "instrument", answer: "악기", pos: "명사", sentence: "Do you play any musical {{c1::instrument::악기}}?", explain: "musical instrument (악기)" },
        { id: "m1_u1_4", unit_id: "kr.mid1.eng.donga_yoon.2022:U01", term: "together", answer: "함께", pos: "부사", sentence: "We eat lunch {{c1::together::함께}} every day.", explain: "do ~ together (함께 ~하다)" },
        { id: "m1_u1_5", unit_id: "kr.mid1.eng.donga_yoon.2022:U01", term: "be good at ~", answer: "~을 잘하다", pos: "숙어", role: "core_vocab", sentence: "She {{c1::is good at::~을 잘하다}} playing basketball.", explain: "전치사 at 뒤에는 명사/동명사(-ing)가 옵니다." },
        { id: "m1_u1_g1", unit_id: "kr.mid1.eng.donga_yoon.2022:U01", term: "[Lesson 1 핵심문법] 3인칭 단수 일반동사 부정문", answer: "doesn't (does not) + 동사원형", prompt: "[Lesson 1 핵심문법] 주어가 3인칭 단수(he/she/it)일 때 일반동사 현재형 부정문의 올바른 형태는?", role: "key_grammar", sentence: "He {{c1::doesn't play::3인칭 단수 부정문}} computer games on weekdays.", explain: "주어가 3인칭 단수일 때 doesn't 뒤에는 반드시 동사원형을 씁니다." },
        { id: "m1_u2_1", unit_id: "kr.mid1.eng.donga_yoon.2022:U02", term: "delicious", answer: "맛있는", pos: "형용사", role: "core_vocab", sentence: "This traditional soup smells really {{c1::delicious::맛있는}}.", explain: "감각동사 smell + 형용사 보어" },
        { id: "m1_u2_2", unit_id: "kr.mid1.eng.donga_yoon.2022:U02", term: "popular", answer: "인기 있는", pos: "형용사", role: "core_vocab", sentence: "K-pop is very {{c1::popular::인기 있는}} around the world.", explain: "be popular with (~에게 인기가 있다)" },
        { id: "m1_u2_3", unit_id: "kr.mid1.eng.donga_yoon.2022:U02", term: "traditional", answer: "전통적인", pos: "형용사", role: "core_vocab", sentence: "Hanbok is Korean {{c1::traditional::전통적인}} clothing.", explain: "tradition(전통) + -al(형용사 접미사)" },
        { id: "m1_u2_g1", unit_id: "kr.mid1.eng.donga_yoon.2022:U02", term: "[Lesson 2 핵심문법] 현재진행형 어순", answer: "am / are / is + 동사원형-ing", prompt: "[Lesson 2 핵심문법] '지금 ~하고 있는 중이다'를 나타내는 현재진행형의 올바른 문법 형태는?", role: "key_grammar", sentence: "They {{c1::are making::현재진행형}} songpyeon together now.", explain: "be동사(am/are/is) + 동사원형-ing" },
        { id: "m1_u3_1", unit_id: "kr.mid1.eng.donga_yoon.2022:U03", term: "volunteer", answer: "자원봉사하다", pos: "동사", role: "core_vocab", sentence: "We {{c1::volunteer::자원봉사하다}} at the animal shelter.", explain: "자원봉사자(명사) / 자원봉사하다(동사)" },
        { id: "m1_u4_1", unit_id: "kr.mid1.eng.donga_yoon.2022:U04", term: "ancient", answer: "고대의", pos: "형용사", role: "core_vocab", sentence: "They visited an {{c1::ancient::고대의}} palace in Rome.", explain: "반의어: modern (현대의)" },
      ],
    },
    {
      textbook_id: "kr.mid2.eng.donga_yoon.2022",
      title: "중2 영어 (동아 윤정미)",
      subject_code: "eng",
      unlocked: true,
      units: [
        { unit_id: "kr.mid2.eng.donga_yoon.2022:U01", unit_code: "Lesson 1", unit_title: "Express Yourself", page_start: 10, page_end: 29, entry_count: 5 },
        { unit_id: "kr.mid2.eng.donga_yoon.2022:U02", unit_code: "Lesson 2", unit_title: "Eat Right, Be Happy", page_start: 30, page_end: 49, entry_count: 4 },
      ],
      entries: [
        { id: "m2_u1_1", unit_id: "kr.mid2.eng.donga_yoon.2022:U01", term: "communicate", answer: "의사소통하다", pos: "동사", role: "core_vocab", sentence: "We {{c1::communicate::의사소통하다}} with friends through emojis.", explain: "communicate with (~와 소통하다)" },
        { id: "m2_u1_2", unit_id: "kr.mid2.eng.donga_yoon.2022:U01", term: "experience", answer: "경험하다", pos: "동사", role: "core_vocab", sentence: "Traveling helps you {{c1::experience::경험하다}} new cultures.", explain: "경험(명사) / 경험하다(동사)" },
        { id: "m2_u1_g1", unit_id: "kr.mid2.eng.donga_yoon.2022:U01", term: "[Lesson 1 핵심문법] 감각동사 + 형용사", answer: "감각동사(look/sound/smell/taste/feel) + 형용사 보어", prompt: "[Lesson 1 핵심문법] 감각동사(look, sound, smell, taste, feel) 뒤에 보어로 반드시 와야 하는 품사는?", role: "key_grammar", sentence: "That idea sounds {{c1::great::감각동사+형용사}}! (부사 greatly 불가)", explain: "감각동사 뒤에는 부사(-ly)가 아니라 형용사 보어가 옵니다." },
        { id: "m2_u2_1", unit_id: "kr.mid2.eng.donga_yoon.2022:U02", term: "balanced", answer: "균형 잡힌", pos: "형용사", role: "core_vocab", sentence: "Eating a {{c1::balanced::균형 잡힌}} diet is important for health.", explain: "a balanced diet (균형 잡힌 식단)" },
        { id: "m2_u2_2", unit_id: "kr.mid2.eng.donga_yoon.2022:U02", term: "nutrient", answer: "영양소", pos: "명사", role: "core_vocab", sentence: "Vegetables contain essential {{c1::nutrients::영양소}}.", explain: "nutrition(영양) / nutrient(영양소)" },
      ],
    },
    {
      textbook_id: "kr.mid2.hist.miraeen.2022",
      title: "중학 역사 1·2 (미래엔 핵심 한국사·세계사)",
      subject_code: "hist",
      unlocked: true,
      units: [
        { unit_id: "kr.mid2.hist.miraeen.2022:U01", unit_code: "Ⅰ-1", unit_title: "문명의 발생과 고대 세계", page_start: 12, page_end: 45, entry_count: 4 },
        { unit_id: "kr.mid2.hist.miraeen.2022:U02", unit_code: "Ⅱ-1", unit_title: "조선의 건국과 문화 발전", page_start: 46, page_end: 88, entry_count: 4 },
      ],
      entries: [
        { id: "hist_u1_1", unit_id: "kr.mid2.hist.miraeen.2022:U01", term: "함무라비 법전", answer: "함무라비 법전", prompt: "고대 바빌로니아 왕국이 제정한 '눈에는 눈, 이에는 이' 보복주의 원칙의 성문법은?", sentence: "고대 바빌로니아의 {{c1::함무라비 법전::성문법}}은 신분에 따라 처벌을 달리한 보복주의 법전이다.", explain: "메소포타미아 바빌로니아 왕국 함무라비 왕 통치기 편찬" },
        { id: "hist_u1_2", unit_id: "kr.mid2.hist.miraeen.2022:U01", term: "카스트제", answer: "카스트제", prompt: "고대 인도 아리아인이 정복 과정에서 브라만·크샤트리아·바이샤·수드라로 구분한 엄격한 신분 제도는?", sentence: "고대 인도 사회는 브라만 중심의 4성 계급인 {{c1::카스트제::인도 신분제}}를 바탕으로 유지되었다.", explain: "브라만(사제)·크샤트리아(귀족/무사)·바이샤(평민)·수드라(예속민)" },
        { id: "hist_u2_1", unit_id: "kr.mid2.hist.miraeen.2022:U02", term: "훈민정음", answer: "훈민정음", prompt: "조선 세종 25년(1443) 백성을 가르치는 바른 소리라는 뜻으로 창제한 우리 고유 문자는?", sentence: "조선 세종은 집현전 학자들과 함께 백성을 위한 문자 {{c1::훈민정음::1443 창제}}을 창제하였다.", explain: "1443년 창제, 1446년 반포 (해례본 국보 지정)" },
        { id: "hist_u2_2", unit_id: "kr.mid2.hist.miraeen.2022:U02", term: "경국대전", answer: "경국대전", prompt: "조선 세조 때 편찬을 시작하여 성종 때 완성·반포된 조선 왕조의 최고 기본 법전은?", sentence: "성종 때 완성된 {{c1::경국대전::조선 기본 법전}}은 이·호·예·병·형·공 6전 체제로 통치 규범을 확립했다.", explain: "조선 성종 16년(1485) 반포된 통치 기본 법전" },
      ],
    },
    {
      textbook_id: "kr.high1.sci.visang.2022",
      title: "고1 통합과학 (비상교육 2022 개정)",
      subject_code: "sci",
      unlocked: true,
      units: [
        { unit_id: "kr.high1.sci.visang.2022:U01", unit_code: "Ⅰ-1", unit_title: "물질의 규칙성과 결합", page_start: 10, page_end: 52, entry_count: 4 },
        { unit_id: "kr.high1.sci.visang.2022:U02", unit_code: "Ⅱ-2", unit_title: "생명 시스템과 화학 반응", page_start: 53, page_end: 96, entry_count: 4 },
      ],
      entries: [
        { id: "sci_u1_1", unit_id: "kr.high1.sci.visang.2022:U01", term: "공유 결합", answer: "공유 결합", prompt: "비금속 원자들이 전자쌍을 서로 내놓아 함께 공유하면서 형성하는 화학 결합은?", sentence: "물(H₂O)과 이산화탄소(CO₂)는 비금속 원소들이 전자쌍을 나누어 갖는 {{c1::공유 결합::비금속 간 결합}} 물질이다.", explain: "비금속 + 비금속 원소 간 전자쌍 공유 (옥텟 규칙 충족)" },
        { id: "sci_u1_2", unit_id: "kr.high1.sci.visang.2022:U01", term: "이온 결합", answer: "이온 결합", prompt: "금속 양이온과 비금속 음이온 사이의 정전기적 인력으로 형성되는 화학 결합은?", sentence: "염화 나트륨(NaCl)은 나트륨 양이온(Na⁺)과 염화 이온(Cl⁻) 사이의 {{c1::이온 결합::정전기적 인력}}으로 이루어진다.", explain: "고체 상태에서 전기 전도성이 없으나 수용액/용융 상태에서 전기가 통함" },
        { id: "sci_u2_1", unit_id: "kr.high1.sci.visang.2022:U02", term: "활성화 에너지", answer: "활성화 에너지", prompt: "화학 반응이 일어나기 위해 반응물이 넘어야 하는 최소한의 에너지 장벽은?", sentence: "생체 촉매인 효소는 화학 반응의 {{c1::활성화 에너지::최소 에너지 장벽}}를 낮추어 반응 속도를 빠르게 한다.", explain: "효소는 반응열(ΔH)은 바꾸지 않고 활성화 에너지만 낮춤" },
        { id: "sci_u2_2", unit_id: "kr.high1.sci.visang.2022:U02", term: "미토콘드리아", answer: "미토콘드리아", prompt: "세포호흡을 통해 포도당 등 유기물을 분해하여 생명 활동에 필요한 ATP를 합성하는 세포 소기관은?", sentence: "{{c1::미토콘드리아::ATP 합성 소기관}}는 세포 내 발전소로서 산소를 이용해 ATP 에너지를 생성한다.", explain: "이중막 구조, 자체 DNA와 리보솜 보유" },
      ],
    },
  ];

  const STANDALONE_COLLECTIONS = [
    {
      collection_id: "hanja-grade:8geup",
      level_label: "어문회 한자능력검정 8급 (기초 50자 핵심)",
      item_count: 6,
      unlocked: true,
      items: [
        { id: "hj8_1", term: "學", answer: "배울 학", sentence: "學校({{c1::배울 학::學}}·교)에서 새로운 지식을 배운다.", explain: "부수: 子(아들 자) · 활용: 학습(學習), 학생(學生)" },
        { id: "hj8_2", term: "校", answer: "학교 교", sentence: "우리 學{{c1::校::학교 교}} 교정에는 큰 나무가 있다.", explain: "부수: 木(나무 목) · 활용: 학교(學校), 교장(校長)" },
        { id: "hj8_3", term: "生", answer: "날 생", sentence: "선생님과 학{{c1::생::날 생(生)}}이 함께 인사한다.", explain: "부수: 生(날 생) · 활용: 생명(生命), 생활(生活)" },
        { id: "hj8_4", term: "國", answer: "나라 국", sentence: "대한민{{c1::국::나라 국(國)}}은 민주공화국이다.", explain: "부수: 囗(큰입구 몸) · 활용: 국가(國家), 국민(國民)" },
        { id: "hj8_5", term: "民", answer: "백성 민", sentence: "주권은 국{{c1::민::백성 민(民)}}에게 있다.", explain: "부수: 氏(각시 씨) · 활용: 시민(市民), 민주(民主)" },
        { id: "hj8_6", term: "敎", answer: "가르칠 교", sentence: "{{c1::가르칠 교::敎}}육(敎育)의 기본은 인성이다.", explain: "부수: 攴(칠 복) · 활용: 교실(敎室), 교사(敎師)" },
      ],
    },
    {
      collection_id: "hanja-grade:7geup",
      level_label: "어문회 한자능력검정 7급",
      item_count: 4,
      unlocked: true,
      items: [
        { id: "hj7_1", term: "家", answer: "집 가", sentence: "온 {{c1::가::집 가(家)}}족이 저녁 식사를 함께했다.", explain: "활용: 가족(家族), 국가(國家)" },
        { id: "hj7_2", term: "族", answer: "겨레 족", sentence: "한민{{c1::족::겨레 족(族)}}의 역사와 문화를 배운다.", explain: "활용: 민족(民族), 가족(家族)" },
        { id: "hj7_3", term: "心", answer: "마음 심", sentence: "진{{c1::심::마음 심(心)}}은 언제나 통한다.", explain: "활용: 심리(心理), 중심(中心)" },
        { id: "hj7_4", term: "動", answer: "움직일 동", sentence: "규칙적인 운{{c1::동::움직일 동(動)}}으로 건강을 지킨다.", explain: "활용: 운동(運動), 활동(活動)" },
      ],
    },
    {
      collection_id: "hanja-grade:6geup",
      level_label: "어문회 한자능력검정 6급",
      item_count: 4,
      unlocked: true,
      items: [
        { id: "hj6_1", term: "成", answer: "이룰 성", sentence: "꾸준한 노력이 {{c1::성::이룰 성(成)}}공을 만든다.", explain: "활용: 성공(成功), 완성(完成)" },
        { id: "hj6_2", term: "功", answer: "공 공", sentence: "성{{c1::공::공 공(功)}}의 비결은 성실함이다.", explain: "활용: 공로(功勞), 성공(成功)" },
        { id: "hj6_3", term: "信", answer: "믿을 신", sentence: "친구 사이에 {{c1::신::믿을 신(信)}}뢰가 가장 중요하다.", explain: "활용: 신뢰(信賴), 자신(自信)" },
        { id: "hj6_4", term: "義", answer: "옳을 의", sentence: "사회 정{{c1::의::옳을 의(義)}}를 실천한다.", explain: "활용: 정의(正義), 의무(義務)" },
      ],
    },
    {
      collection_id: "khist:essential",
      level_label: "한국사능력검정 핵심 필수 개념",
      item_count: 5,
      unlocked: true,
      items: [
        { id: "kh_1", term: "강화도 조약", answer: "강화도 조약", prompt: "1876년 운요호 사건을 계기로 일본과 체결한 조선 최초의 근대적 불평등 조약은?", sentence: "1876년 체결된 {{c1::강화도 조약::조일수호조규}}은 부산 외 2개 항구 개항과 영사재판권을 포함했다.", explain: "정식 명칭: 조·일 수호 조규 (자주국 규정, 해안측량권, 치외법권)" },
        { id: "kh_2", term: "갑신정변", answer: "갑신정변", prompt: "1884년 김옥균·박영효 등 급진개화파가 우정총국 개국 축하연을 이용해 일으킨 근대화 개혁 운동은?", sentence: "급진개화파는 1884년 {{c1::갑신정변::우정총국 정변}}을 일으켜 14개조 개혁 정강을 발표했다.", explain: "청에 대한 사대 관계 청산, 인민 평등권 확립, 호조 재정 일원화 주장" },
        { id: "kh_3", term: "동학 농민 운동", answer: "동학 농민 운동", prompt: "1894년 전봉준 등을 중심으로 제폭구민·보국안민을 내걸고 반봉건·반외세를 외친 농민 봉기는?", sentence: "1894년 {{c1::동학 농민 운동::전봉준·집강소}}은 황토현·황룡촌 전투 승리 후 전주 화약을 맺고 집강소를 설치했다.", explain: "고부 농민 봉기 → 백산 봉기 → 황토현 승리 → 전주화약(집강소) → 우금치 전투" },
        { id: "kh_4", term: "독립협회", answer: "독립협회", prompt: "1896년 서재필 등이 중심이 되어 독립문 건립과 만민공동회 개최를 주도한 근대 민권 단체는?", sentence: "{{c1::독립협회::만민공동회·헌의6조}}는 러시아의 절영도 조차 요구를 저지하고 관민공동회에서 헌의 6조를 결의했다.", explain: "기관지 독립신문 발행, 자주국권·자유민권·자강개혁 운동 전개" },
        { id: "kh_5", term: "3·1 운동", answer: "3·1 운동", prompt: "1919년 일제의 무단 통치에 맞서 민족자결주의와 고종 인산일을 계기로 전국에서 일어난 최대 규모의 독립 만세 운동은?", sentence: "1919년 {{c1::3·1 운동::대한민국 임시정부 수립 계기}}의 결과 일제는 통치 방식을 이른바 문화 통치로 바꾸고 상하이에 대한민국 임시정부가 수립되었다.", explain: "비폭력 평화 시위에서 전국적·전 계층적 항일 운동으로 확산" },
      ],
    },
    {
      collection_id: "exam-eng:toeic-core",
      level_label: "TOEIC 실전 빈출 핵심 어휘",
      item_count: 4,
      unlocked: true,
      items: [
        { id: "toeic_1", term: "mandatory", answer: "의무적인", sentence: "Attendance at the safety orientation is {{c1::mandatory::의무적인}} for all new employees.", explain: "동의어: compulsory, required, obligatory" },
        { id: "toeic_2", term: "reimburse", answer: "변제하다 (환급하다)", sentence: "The company will {{c1::reimburse::변제하다}} travel expenses upon receipt submission.", explain: "reimburse A for B (A에게 B 비용을 환급하다)" },
        { id: "toeic_3", term: "tentative", answer: "잠정적인", sentence: "We have set a {{c1::tentative::잠정적인}} schedule for the product launch.", explain: "tentative schedule/agreement (잠정 일정/합의)" },
        { id: "toeic_4", term: "comply", answer: "준수하다", sentence: "All contractors must {{c1::comply::준수하다}} with environmental regulations.", explain: "comply with (~을 준수하다) = abide by, conform to" },
      ],
    },
    {
      collection_id: "ko-idiom:essential",
      level_label: "필수 사자성어·고사성어 핵심",
      item_count: 4,
      unlocked: true,
      items: [
        { id: "idiom_1", term: "대기만성 (大器晩成)", answer: "큰 그릇은 늦게 이루어진다", prompt: "큰 인물이 되기 위해서는 많은 노력과 시간이 필요하여 늦게 이루어진다는 뜻의 사자성어는?", sentence: "지금 당장 성과가 없더라도 {{c1::대기만성::大器晩成}}의 자세로 꾸준히 실력을 쌓아라.", explain: "大(큰 대) 器(그릇 기) 晩(늦을 만) 成(이룰 성)" },
        { id: "idiom_2", term: "역지사지 (易地思之)", answer: "처지를 바꾸어 생각함", prompt: "상대방과 처지나 입장을 바꾸어 놓고 생각한다는 뜻의 사자성어는?", sentence: "갈등을 해결하려면 먼저 상대방의 입장에서 생각하는 {{c1::역지사지::易地思之}}의 태도가 필요하다.", explain: "易(바꿀 역) 地(땅 지) 思(생각 사) 之(갈 지)" },
        { id: "idiom_3", term: "유비무환 (有備無患)", answer: "준비가 있으면 근심이 없다", prompt: "미리 철저히 준비해 두면 뒷날 걱정할 우환이 없다는 뜻의 사자성어는?", sentence: "재난에 대비해 평소 훈련을 반복하는 것은 {{c1::유비무환::有備無患}}의 지혜이다.", explain: "有(있을 유) 備(갖출 비) 無(없을 무) 患(근심 환)" },
        { id: "idiom_4", term: "일석이조 (一石二鳥)", answer: "돌 하나로 새 두 마리를 잡음", prompt: "한 가지 일을 해서 두 가지 이익을 동시에 얻는다는 뜻의 사자성어는?", sentence: "자전거 출퇴근은 건강도 챙기고 교통비도 아끼는 {{c1::일석이조::一石二鳥}}의 방법이다.", explain: "동의어: 일거양득(一擧兩得)" },
      ],
    },
    {
      collection_id: "law-statute:constitution",
      level_label: "대한민국 헌법 및 필수 법학 조문",
      item_count: 4,
      unlocked: true,
      items: [
        { id: "law_1", term: "헌법 제1조 제2항 (국민주권)", answer: "국민", prompt: "대한민국 헌법 제1조 제2항: '대한민국의 주권은 [ ___ ]에게 있고, 모든 권력은 [ ___ ]으로부터 나온다.' 빈칸에 공통으로 들어갈 말은?", sentence: "대한민국의 주권은 {{c1::국민::주권의 주체}}에게 있고, 모든 권력은 {{c1::국민}}으로부터 나온다.", explain: "헌법 제1조 제1항(민주공화국) · 제2항(국민주권주의)" },
        { id: "law_2", term: "헌법 제10조 (인간의 존엄과 가치)", answer: "행복을 추구할 권리", prompt: "헌법 제10조: '모든 국민은 인간으로서의 존엄과 가치를 가지며, [ ___ ]를 가진다.' 빈칸에 들어갈 기본권은?", sentence: "모든 국민은 인간으로서의 존엄과 가치를 가지며, {{c1::행복을 추구할 권리::헌법 제10조}}를 가진다.", explain: "국가는 개인이 가지는 불가침의 기본적 인권을 확인하고 보장할 의무를 진다." },
        { id: "law_3", term: "죄형법정주의", answer: "죄형법정주의", prompt: "'법률이 없으면 범죄도 없고 형벌도 없다'는 형사법의 대원칙은?", sentence: "{{c1::죄형법정주의::형법 대원칙}}에 따라 관습형법금지, 소급효금지, 유추해석금지, 명확성의 원칙이 도출된다.", explain: "헌법 제12조 제1항 및 제13조 제1항 근거" },
        { id: "law_4", term: "신의성실의 원칙", answer: "신의성실의 원칙", prompt: "민법 제2조 제1항: 권리의 행사와 의무의 이행은 신의에 좇아 성실히 하여야 한다는 원칙은?", sentence: "민법 제2조 제1항의 {{c1::신의성실의 원칙::민법 대원칙}}에서 금반언의 원칙과 사정변경의 원칙이 파생된다.", explain: "민법 전반을 지배하는 최고 지도 원리" },
      ],
    },
    {
      collection_id: "cert-it:core",
      level_label: "정보처리기사·CS 핵심 컴퓨터공학",
      item_count: 4,
      unlocked: true,
      items: [
        { id: "it_1", term: "트랜잭션 ACID", answer: "원자성·일관성·격리성·지속성", prompt: "데이터베이스 트랜잭션이 안전하게 수행되기 위해 보장해야 하는 4대 특성(ACID)은?", sentence: "트랜잭션의 ACID 속성은 {{c1::원자성(Atomicity)::All or Nothing}}, 일관성(Consistency), 격리성(Isolation), 지속성(Durability)이다.", explain: "Atomicity, Consistency, Isolation, Durability" },
        { id: "it_2", term: "데드락 (교착상태) 4조건", answer: "상호배제·점유대기·비선점·환형대기", prompt: "운영체제에서 교착상태(Deadlock)가 발생하기 위한 4가지 필요충분조건은?", sentence: "교착상태 발생 조건 4가지는 상호배제, 점유와 대기, 비선점, {{c1::환형 대기::Circular Wait}}이다.", explain: "4가지 조건 중 하나만 제거해도 교착상태를 예방할 수 있음" },
        { id: "it_3", term: "정규화 (BCNF)", answer: "결정자가 후보키가 아닌 함수 종속 제거", prompt: "제3정규형(3NF)을 만족하면서 모든 결정자가 후보키가 되도록 이행적·비후보키 함수 종속을 제거하는 정규화 단계는?", sentence: "{{c1::BCNF::보이스-코드 정규형}}는 강한 제3정규형으로 모든 결정자가 후보키(Candidate Key)이어야 한다.", explain: "도부이결다조 (1NF -> 2NF -> 3NF -> BCNF -> 4NF -> 5NF)" },
        { id: "it_4", term: "OSI 7계층 전송 계층", answer: "전송 계층 (Transport Layer)", prompt: "TCP와 UDP 프로토콜이 동작하며 종단 간(End-to-End) 신뢰성 있는 데이터 전송과 포트 번호 기반 다중화를 담당하는 OSI 계층은?", sentence: "OSI 4계층인 {{c1::전송 계층::TCP/UDP 계층}}은 세그먼트(Segment) 단위로 종단 간 오류 복구와 흐름 제어를 수행한다.", explain: "물리(1)-데이터링크(2)-네트워크(3)-전송(4)-세션(5)-표현(6)-응용(7)" },
      ],
    },
    {
      collection_id: "moe-hanja-1800:middle",
      level_label: "교육부 고시 한문 교육용 기초 한자 1,800자 핵심 (중·고등)",
      item_count: 6,
      unlocked: true,
      items: [
        { id: "mh_1", term: "仁", answer: "어질 인", sentence: "{{c1::어질 인::仁}}은 공자 사상의 핵심 덕목이다.", explain: "부수: 亻(사람인변) · 활용: 인의(仁義), 인자(仁慈)" },
        { id: "mh_2", term: "義", answer: "옳을 의", sentence: "견리사의(見利思{{c1::義::옳을 의}})는 이익을 보면 의로움을 먼저 생각한다는 뜻이다.", explain: "부수: 羊(양양) · 활용: 정의(正義), 의무(義務)" },
        { id: "mh_3", term: "禮", answer: "예도 예", sentence: "동방{{c1::예::예도 예(禮)}}의지국의 전통을 이어간다.", explain: "부수: 示(보일시) · 활용: 예절(禮節), 예의(禮儀)" },
        { id: "mh_4", term: "智", answer: "지혜 지", sentence: "어려울 때일수록 {{c1::지::지혜 지(智)}}혜를 모아야 한다.", explain: "부수: 日(날일) · 활용: 지혜(智慧), 지식(知識)" },
        { id: "mh_5", term: "信", answer: "믿을 신", sentence: "붕우유신(朋友有{{c1::信::믿을 신}})은 벗 사이에 믿음이 있어야 함을 뜻한다.", explain: "부수: 亻(사람인변) · 활용: 신뢰(信賴), 신의(信義)" },
        { id: "mh_6", term: "溫故知新", answer: "온고지신 — 옛것을 익히고 새것을 안다", prompt: "《논어》에서 유래한 성어로 '옛것을 익히고 그것을 미루어 새것을 안다'는 뜻의 사자성어는?", sentence: "전통을 바탕으로 현대를 창조하는 자세를 {{c1::온고지신::溫故知新}}이라 한다.", explain: "익힐 온(溫) · 옛 고(故) · 알 지(知) · 새 신(新)" },
      ],
    },
    {
      collection_id: "ko-dictation:grade1-2",
      level_label: "초등 1~2학년 급수별 받아쓰기 핵심",
      item_count: 3,
      unlocked: true,
      items: [
        { id: "kd_1", term: "맑고 따뜻합니다", answer: "맑고 따뜻합니다", prompt: "소리 나는 대로 '[말꼬 따뜨탑니다]'를 바른 맞춤법으로 쓰면?", sentence: "오늘 날씨가 참 {{c1::맑고::[말꼬]}} {{c2::따뜻합니다::[따뜨탑니다]}}.", explain: "겹받침 ㄺ을 밝혀 '맑고'로 적습니다." },
        { id: "kd_2", term: "할머니께 썼습니다", answer: "할머니께 썼습니다", prompt: "웃어른에게 편지를 드릴 때 '[할머니에게 써씀니다]'의 바른 높임·맞춤법 표기는?", sentence: "{{c1::할머니께::높임 조사}} 예쁜 편지를 {{c2::썼습니다::[써씀니다]}}.", explain: "윗사람에게는 부사격 조사 '-께'를 씁니다." },
        { id: "kd_3", term: "조용히 읽어요", answer: "조용히 읽어요", prompt: "도서관에서 책을 '[조용이 일거요]'의 바른 맞춤법 표기는?", sentence: "도서관에서 {{c1::조용히::부사}} 책을 {{c2::읽어요::[일거요]}}.", explain: "'-하다'가 붙는 어근 뒤에는 '-히'(조용히)를 적습니다." },
      ],
    },
    {
      collection_id: "moe-eng:elem-3-4",
      level_label: "교육부 고시 초등 3~4학년 기초 필수 영단어 (기본 어휘표)",
      item_count: 12,
      unlocked: true,
      items: [
        { id: "e34_01", term: "morning", answer: "아침", role: "core_vocab", sentence: "Good {{c1::morning::아침}}! How are you today?", explain: "in the morning (아침에) · 반대: evening(저녁), night(밤)" },
        { id: "e34_02", term: "weather", answer: "날씨", role: "core_vocab", sentence: "How is the {{c1::weather::날씨}} today? It is sunny.", explain: "sunny(맑은), cloudy(흐린), rainy(비 오는), snowy(눈 오는)" },
        { id: "e34_03", term: "friend", answer: "친구", role: "core_vocab", sentence: "She is my best {{c1::friend::친구}} at school.", explain: "make friends with (~와 친구가 되다)" },
        { id: "e34_04", term: "teacher", answer: "선생님", role: "core_vocab", sentence: "Our English {{c1::teacher::선생님}} is very kind.", explain: "teach(가르치다) + -er(사람) = teacher(선생님)" },
        { id: "e34_05", term: "hungry", answer: "배고픈", role: "core_vocab", sentence: "I am {{c1::hungry::배고픈}}. Let's have lunch!", explain: "thirsty(목마른), full(배부른), tired(피곤한)" },
        { id: "e34_06", term: "thirsty", answer: "목마른", role: "core_vocab", sentence: "I am {{c1::thirsty::목마른}}. Can I have some water?", explain: "drink water(물을 마시다)와 자주 함께 쓰이는 초등 필수 형용사" },
        { id: "e34_07", term: "listen", answer: "귀 기울여 듣다", role: "core_vocab", sentence: "Please {{c1::listen::듣다}} to the teacher carefully.", explain: "listen to (~을 귀 기울여 듣다, 't'는 묵음)" },
        { id: "e34_08", term: "borrow", answer: "빌리다", role: "core_vocab", sentence: "May I {{c1::borrow::빌리다}} your pencil?", explain: "borrow(빌려 오다) ↔ lend(빌려주다)" },
        { id: "e34_09", term: "animal", answer: "동물", role: "core_vocab", sentence: "What is your favorite {{c1::animal::동물}} at the zoo?", explain: "wild animals (야생 동물)" },
        { id: "e34_10", term: "umbrella", answer: "우산", role: "core_vocab", sentence: "It's raining outside. Take your {{c1::umbrella::우산}}.", explain: "모음 소리로 시작하므로 부정관사 an umbrella로 사용" },
        { id: "e34_11", term: "breakfast", answer: "아침 식사", role: "core_vocab", sentence: "I eat bread and milk for {{c1::breakfast::아침 식사}}.", explain: "breakfast(아침) - lunch(점심) - dinner(저녁)" },
        { id: "e34_12", term: "clean", answer: "청소하다", role: "core_vocab", sentence: "Let's {{c1::clean::청소하다}} our classroom together.", explain: "형용사(깨끗한)와 동사(청소하다)로 모두 쓰임" },
      ],
    },
    {
      collection_id: "moe-eng:elementary",
      level_label: "교육부 고시 초등 5~6학년 필수 영단어 800 핵심",
      item_count: 12,
      unlocked: true,
      items: [
        { id: "me_1", term: "library", answer: "도서관", role: "core_vocab", sentence: "I borrow books from the school {{c1::library::도서관}}.", explain: "school library (학교 도서관)" },
        { id: "me_2", term: "hospital", answer: "병원", role: "core_vocab", sentence: "Doctors and nurses work at the {{c1::hospital::병원}}.", explain: "go to the hospital (병원에 가다)" },
        { id: "me_3", term: "tomorrow", answer: "내일", role: "core_vocab", sentence: "See you {{c1::tomorrow::내일}} morning!", explain: "yesterday(어제) - today(오늘) - tomorrow(내일)" },
        { id: "me_4", term: "museum", answer: "박물관", role: "core_vocab", sentence: "We visited the science {{c1::museum::박물관}} on our field trip.", explain: "art museum (미술관), history museum (역사 박물관)" },
        { id: "me_5", term: "vacation", answer: "방학", role: "core_vocab", sentence: "What will you do this summer {{c1::vacation::방학}}?", explain: "summer vacation (여름방학), winter vacation (겨울방학)" },
        { id: "me_6", term: "exercise", answer: "운동하다", role: "core_vocab", sentence: "I {{c1::exercise::운동하다}} every day to stay healthy.", explain: "do exercise (운동하다), regular exercise (규칙적인 운동)" },
        { id: "me_7", term: "delicious", answer: "맛있는", role: "core_vocab", sentence: "This Korean bulgogi tastes really {{c1::delicious::맛있는}}!", explain: "감각동사 taste/look/smell 뒤에 형용사 보어로 자주 출제" },
        { id: "me_8", term: "straight", answer: "곧장", role: "core_vocab", sentence: "Go {{c1::straight::곧장}} two blocks and turn left.", explain: "길 찾기 필수 표현: go straight (직진하다)" },
        { id: "me_9", term: "between", answer: "사이에", role: "core_vocab", sentence: "The bakery is {{c1::between::사이에}} the bank and the post office.", explain: "between A and B (A와 B 사이에)" },
        { id: "me_10", term: "famous", answer: "유명한", role: "core_vocab", sentence: "Gyeongju is {{c1::famous::유명한}} for its historical temples.", explain: "be famous for (~로 유명하다)" },
        { id: "me_11", term: "practice", answer: "연습하다", role: "core_vocab", sentence: "I {{c1::practice::연습하다}} playing the piano every afternoon.", explain: "Practice makes perfect (연습이 완벽을 만든다)" },
        { id: "me_12", term: "future", answer: "미래", role: "core_vocab", sentence: "What do you want to be in the {{c1::future::미래}}?", explain: "in the future (장래에, 미래에)" },
      ],
    },
    {
      collection_id: "moe-eng:middle-1200",
      level_label: "교육부 고시 중학교 학년별 필수 영단어 1,200 & 내신 핵심 문법",
      item_count: 12,
      unlocked: true,
      items: [
        { id: "mm_01", term: "introduce", answer: "소개하다", role: "core_vocab", sentence: "Let me {{c1::introduce::소개하다}} myself to the class.", explain: "introduce A to B (A를 B에게 소개하다)" },
        { id: "mm_02", term: "communicate", answer: "의사소통하다", role: "core_vocab", sentence: "We use language to {{c1::communicate::의사소통하다}} with others.", explain: "명사형: communication (의사소통)" },
        { id: "mm_03", term: "volunteer", answer: "자원봉사하다", role: "core_vocab", sentence: "She works as a {{c1::volunteer::자원봉사자}} at the local library.", explain: "volunteer work (자원봉사 활동)" },
        { id: "mm_04", term: "environment", answer: "환경", role: "core_vocab", sentence: "We must reduce plastic waste to protect the {{c1::environment::환경}}.", explain: "environmental protection (환경 보호)" },
        { id: "mm_05", term: "experience", answer: "경험하다", role: "core_vocab", sentence: "Traveling abroad is a valuable {{c1::experience::경험}}.", explain: "명사(경험)와 동사(경험하다) 모두 핵심 출제" },
        { id: "mm_06", term: "opportunity", answer: "기회", role: "core_vocab", sentence: "Don't miss this great {{c1::opportunity::기회}} to learn.", explain: "take the opportunity (기회를 잡다), 동의어: chance" },
        { id: "mm_07", term: "achievement", answer: "성취", role: "core_vocab", sentence: "King Sejong's greatest {{c1::achievement::업적}} was creating Hunminjeongeum.", explain: "동사 achieve(성취하다) + -ment(명사화 접미사)" },
        { id: "mm_08", term: "cooperate", answer: "협력하다", role: "core_vocab", sentence: "Team members need to {{c1::cooperate::협력하다}} with one another.", explain: "명사형: cooperation (협력, 협동)" },
        { id: "mm_09", term: "persuade", answer: "설득하다", role: "core_vocab", sentence: "He tried to {{c1::persuade::설득하다}} his parents to allow the trip.", explain: "persuade + 목적어 + to부정사 (~가 …하도록 설득하다)" },
        { id: "mm_10", term: "sustainable", answer: "지속 가능한", role: "core_vocab", sentence: "Solar and wind power are {{c1::sustainable::지속 가능한}} energy sources.", explain: "sustainable development (지속 가능한 발전)" },
        { id: "mm_11", term: "[중학 핵심문법] 감각동사 + 형용사 보어", answer: "감각동사(look/sound/smell/taste/feel) + 형용사 보어", role: "key_grammar", prompt: "[중학 핵심문법] 감각동사(look, sound, smell, taste, feel) 뒤에 보어로 반드시 와야 하는 품사는?", sentence: "The cookies smell {{c1::good::형용사 보어(well 불가)}}.", explain: "감각동사 뒤에는 부사(-ly)가 올 수 없고 형용사만 보어로 옴" },
        { id: "mm_12", term: "[중학 핵심문법] 현재완료 (have/has + p.p.)", answer: "have / has + 과거분사(p.p.) (현재완료)", role: "key_grammar", prompt: "[중학 핵심문법] 과거에 시작된 동작이나 상태가 현재까지 이어질 때(경험·계속·완료·결과) 사용하는 시제 형태는?", sentence: "I {{c1::have lived::현재완료(계속)}} in Seoul for five years.", explain: "for + 기간 / since + 과거 시점과 함께 쓰이면 현재완료 계속 용법" },
      ],
    },
    {
      collection_id: "moe-eng:high-csat",
      level_label: "교육부 고시 고등학교·수능 필수 학술 어휘 (평가원 최빈출)",
      item_count: 10,
      unlocked: true,
      items: [
        { id: "mh_eng_01", term: "hypothesis", answer: "가설", role: "core_vocab", sentence: "Scientists conducted experiments to test their {{c1::hypothesis::가설}}.", explain: "복수형: hypotheses · 동사: hypothesize(가설을 세우다)" },
        { id: "mh_eng_02", term: "empirical", answer: "실증적인", role: "core_vocab", sentence: "The theory is supported by strong {{c1::empirical::실증적인}} evidence.", explain: "empirical evidence (실증적·실험적 증거) ↔ theoretical(이론적인)" },
        { id: "mh_eng_03", term: "correlation", answer: "상관관계", role: "core_vocab", sentence: "There is a strong {{c1::correlation::상관관계}} between sleep quality and memory retention.", explain: "correlation does not imply causation (상관관계가 인과관계를 의미하지는 않는다)" },
        { id: "mh_eng_04", term: "cognitive", answer: "인지의", role: "core_vocab", sentence: "Active recall strengthens {{c1::cognitive::인지의}} pathways in the brain.", explain: "cognitive psychology (인지 심리학), cognitive load (인지 부하)" },
        { id: "mh_eng_05", term: "intrinsic", answer: "내재적인", role: "core_vocab", sentence: "Curiosity provides {{c1::intrinsic::내재적인}} motivation for learning.", explain: "intrinsic(내재적인) ↔ extrinsic(외재적인)" },
        { id: "mh_eng_06", term: "inevitable", answer: "피할 수 없는", role: "core_vocab", sentence: "Technological change is {{c1::inevitable::피할 수 없는}} in modern society.", explain: "동의어: unavoidable" },
        { id: "mh_eng_07", term: "ambiguity", answer: "모호함", role: "core_vocab", sentence: "Legal contracts must be written clearly to avoid {{c1::ambiguity::모호함}}.", explain: "형용사: ambiguous (애매모호한)" },
        { id: "mh_eng_08", term: "paradox", answer: "역설", role: "core_vocab", sentence: "The {{c1::paradox::역설}} of choice suggests that too many options can reduce satisfaction.", explain: "형용사: paradoxical (역설적인)" },
        { id: "mh_eng_09", term: "undermine", answer: "약화시키다", role: "core_vocab", sentence: "Rumors can {{c1::undermine::약화시키다}} mutual trust within a team.", explain: "반의어: reinforce, strengthen (강화하다)" },
        { id: "mh_eng_10", term: "facilitate", answer: "촉진하다", role: "core_vocab", sentence: "Spaced repetition {{c1::facilitates::촉진하다}} long-term memory consolidation.", explain: "명사형: facilitator (촉진자, 진행자)" },
      ],
    },
    {
      collection_id: "moe-kor:orthography-lit",
      level_label: "교육부 국어과 필수 한글 맞춤법·표준어 & 문학 핵심 개념어",
      item_count: 6,
      unlocked: true,
      items: [
        { id: "mk_01", term: "며칠", answer: "며칠", role: "core_concept", prompt: "'오늘이 몇 월 [ ___ ]이지?'에서 어원이 분명하지 아니하여 소리 나는 대로 적는 바른 맞춤법 표기는? ('몇일'은 틀린 표기)", sentence: "오늘이 몇 월 {{c1::며칠::맞춤법 주의('몇일' 아님)}}인지 달력을 확인해 보자.", explain: "한글 맞춤법 제27항 붙임2: 언제나 '며칠'로만 적습니다." },
        { id: "mk_02", term: "금세", answer: "금세", role: "core_concept", prompt: "'지금 바로'를 뜻하는 '금시에'가 줄어든 말의 바른 맞춤법 표기는? ('금새'는 틀린 표기)", sentence: "소나기가 내리더니 {{c1::금세::'금새'가 아님}} 하늘이 맑게 개었다.", explain: "'금시에'가 줄어든 말이므로 '금세'(ㅡ+ㅔ)가 맞습니다." },
        { id: "mk_03", term: "되다 / 돼다 구분", answer: "되어(돼) · 되었다(됐다)", role: "core_concept", prompt: "어간 '되-' 뒤에 어미 '-어/-었-'이 결합하여 줄어들 때의 바른 맞춤법 표기 원칙은?", sentence: "벌써 봄이 {{c1::돼::되어}} 날씨가 따뜻해졌다.", explain: "'하-'를 넣어 말이 되면 '돼(되어)', '하니/하고'가 자연스러우면 '되'를 씁니다." },
        { id: "mk_04", term: "로서 / 로써 구분", answer: "로서(자격·신분) · 로써(수단·도구)", role: "core_concept", prompt: "조사 '로서'와 '로써'의 맞춤법 의미 차이를 구분하시오.", sentence: "학생{{c1::으로서::자격·신분}} 본분을 지키고, 대화{{c2::로써::수단·방법}} 갈등을 해결한다.", explain: "로서 = 지위·신분·자격 / 로써 = 수단·도구" },
        { id: "mk_05", term: "역설법", answer: "역설법", role: "core_concept", prompt: "'이것은 소리 없는 아우성'처럼 겉으로는 모순되지만 그 속에 진리를 담는 문학 표현 기법은?", sentence: "유치환의 〈깃발〉에서 '소리 없는 아우성'은 모순 속에 진실을 담은 {{c1::역설법::수사법}}이다.", explain: "역설법(문장 자체에 논리적 모순 존재) ↔ 반어법(속마음과 반대로 표현)" },
        { id: "mk_06", term: "객관적 상관물", answer: "객관적 상관물", role: "core_concept", prompt: "문학 작품에서 화자의 정서나 사상을 간접적으로 환기·구체화하기 위해 끌어들인 구체적 자연물·사물을 무엇이라 하는가?", sentence: "황조가의 '꾀꼬리'처럼 화자의 정서를 환기하는 대상을 {{c1::객관적 상관물::문학 개념어}}이라 한다.", explain: "화자와 대비되거나 감정이 이입된 자연물 모두 객관적 상관물에 포함됩니다." },
      ],
    },
    {
      collection_id: "sci-element-formula:core",
      level_label: "교육부 과학과 필수 주기율표 원소·물리법칙·생명·지구과학 핵심",
      item_count: 6,
      unlocked: true,
      items: [
        { id: "sc_1", term: "공유 결합", answer: "공유 결합", role: "core_concept", prompt: "비금속 원자들이 전자쌍을 내놓아 공동으로 소유하면서 형성하는 화학 결합은?", sentence: "물(H₂O)과 이산화 탄소(CO₂)는 비금속 원자들이 전자쌍을 공유하는 {{c1::공유 결합::비금속+비금속}} 물질이다.", explain: "공유 결합(비금속+비금속) ↔ 이온 결합(금속+비금속)" },
        { id: "sc_2", term: "이온 결합", answer: "이온 결합", role: "core_concept", prompt: "금속 양이온과 비금속 음이온 사이의 정전기적 인력으로 형성되는 화학 결합은?", sentence: "염화 나트륨(NaCl)은 나트륨 양이온과 염화 이온 사이의 {{c1::이온 결합::정전기적 인력}}으로 이루어진다.", explain: "수용액이나 용융 상태에서 전기 전도성이 있음" },
        { id: "sc_3", term: "미토콘드리아", answer: "미토콘드리아", role: "core_concept", prompt: "세포 호흡을 통해 포도당 등 유기물을 분해하여 생명 활동에 필요한 에너지(ATP)를 생산하는 세포 소기관은?", sentence: "{{c1::미토콘드리아::세포 호흡·ATP 합성}}는 산소를 이용해 ATP를 합성한다.", explain: "세포 호흡의 중심 소기관 (이중막 구조)" },
        { id: "sc_4", term: "옴의 법칙", answer: "V = I × R", role: "core_concept", prompt: "전기 회로에서 전압(V), 전류(I), 저항(R) 사이의 관계를 나타내는 '옴의 법칙' 관계식은?", sentence: "옴의 법칙에 따르면 전압·전류·저항의 관계식은 {{c1::V = I × R::전압 = 전류 × 저항}}이다.", explain: "전류(I)는 전압(V)에 비례하고 저항(R)에 반비례함" },
        { id: "sc_5", term: "뉴턴 운동 제2법칙", answer: "F = m × a", role: "core_concept", prompt: "물체의 가속도(a)는 알짜힘(F)에 비례하고 질량(m)에 반비례한다는 가속도 법칙 공식은?", sentence: "뉴턴의 가속도 법칙은 {{c1::F = m × a::가속도 법칙}}로 나타낸다.", explain: "제1법칙: 관성 법칙 · 제2법칙: 가속도 법칙 · 제3법칙: 작용·반작용 법칙" },
        { id: "sc_6", term: "발산형 경계", answer: "발산형 경계 (해령·열곡대)", role: "core_concept", prompt: "맨틀 대류의 상승부에서 새로운 해양 지각이 생성되며 두 판이 서로 멀어지는 판의 경계는?", sentence: "대서양 중앙 해령과 동아프리카 열곡대는 {{c1::발산형 경계::맨틀 대류 상승부}}에 해당한다.", explain: "천발 지진과 화산 활동 활발" },
      ],
    },
    {
      collection_id: "moe-math:core-formulas",
      level_label: "교육부 수학과 학년별 필수 공식 (방정식·피타고라스·삼각비·수열·미분)",
      item_count: 7,
      unlocked: true,
      items: [
        { id: "math_01", term: "피타고라스 정리", answer: "a² + b² = c²", role: "core_concept", prompt: "직각삼각형에서 직각을 낀 두 변의 길이를 a, b라 하고 빗변의 길이를 c라 할 때 성립하는 피타고라스 정리 관계식은?", sentence: "직각삼각형의 피타고라스 정리 공식은 {{c1::a² + b² = c²::피타고라스 정리}}이다.", explain: "대표 피타고라스 수: (3, 4, 5), (5, 12, 13), (8, 15, 17)" },
        { id: "math_02", term: "이차방정식의 근의 공식", answer: "x = (-b ± √(b² - 4ac)) / 2a", role: "core_concept", prompt: "이차방정식 ax² + bx + c = 0 (a ≠ 0)의 해를 구하는 근의 공식은?", sentence: "이차방정식의 해는 {{c1::x = (-b ± √(b² - 4ac)) / 2a::근의 공식}}이다.", explain: "판별식 D = b² - 4ac > 0(서로 다른 두 실근), D = 0(중근), D < 0(허근)" },
        { id: "math_03", term: "근과 계수의 관계", answer: "α + β = -b/a, αβ = c/a", role: "core_concept", prompt: "이차방정식 ax² + bx + c = 0의 두 근을 α, β라 할 때 두 근의 합(α + β)과 곱(αβ)은?", sentence: "이차방정식 두 근의 합과 곱은 {{c1::α + β = -b/a, αβ = c/a::근과 계수의 관계}}이다.", explain: "이차방정식 인수분해 항등식 비교로 유도" },
        { id: "math_04", term: "삼각함수 제곱 관계", answer: "sin²θ + cos²θ = 1", role: "core_concept", prompt: "단위원 위에서 임의의 각 θ에 대하여 항상 성립하는 사인(sin θ)과 코사인(cos θ)의 제곱의 합 공식은?", sentence: "삼각함수 기본 항등식에 의해 {{c1::sin²θ + cos²θ = 1::삼각함수 제곱 공식}}이 성립한다.", explain: "tan θ = sin θ / cos θ" },
        { id: "math_05", term: "원의 방정식 표준형", answer: "(x - a)² + (y - b)² = r²", role: "core_concept", prompt: "좌표평면 위에서 중심이 (a, b)이고 반지름이 r인 원의 방정식 표준형은?", sentence: "중심이 (a, b)이고 반지름이 r인 원의 방정식은 {{c1::(x - a)² + (y - b)² = r²::원의 방정식}}이다.", explain: "중심이 원점 (0, 0)이면 x² + y² = r²" },
        { id: "math_06", term: "등차수열의 일반항", answer: "aₙ = a + (n - 1)d", role: "core_concept", prompt: "첫째항이 a이고 공차가 d인 등차수열의 제n항(일반항 aₙ)을 구하는 공식은?", sentence: "첫째항이 a, 공차가 d인 등차수열의 일반항은 {{c1::aₙ = a + (n - 1)d::등차수열 일반항}}이다.", explain: "등차수열의 합: Sₙ = n(a + l)/2 = n{2a + (n-1)d}/2" },
        { id: "math_07", term: "미분계수(순간변화율)와 도함수", answer: "f'(a) = lim(h→0) [f(a+h) - f(a)] / h", role: "core_concept", prompt: "함수 y = f(x)에서 x = a에서의 미분계수(순간변화율, 접선의 기울기) f'(a)의 정의식은?", sentence: "함수 f(x)의 x = a에서의 미분계수는 {{c1::f'(a) = lim(h→0) [f(a+h) - f(a)] / h::순간변화율·접선의 기울기}}로 정의된다.", explain: "다항함수 미분법: y = xⁿ 이면 y' = n·xⁿ⁻¹" },
      ],
    },
  ];

  const STANDALONE_STORE_PACKS = [
    {
      pack_id: "pack.free.starter_k12",
      title: "[무료 기본] 초등 받아쓰기·기초 영단어 & 한자 8급 입문 브레인팩",
      subtitle: "앱 설치 즉시 기본 탑재되는 무료 스타터 데이터팩 (본인 사진/PDF 업로드 무제한 무료 포함)",
      category: "starter_free",
      age_tier: "all",
      price_krw: 0,
      is_free_starter: true,
      link_kind: "collection",
      primary_ref_id: "hanja-grade:8geup",
      covered_ref_ids: ["hanja-grade:8geup", "ko-dictation:grade1-2", "moe-eng:elementary"],
      estimated_card_count: 1020,
      badge_label: "무료 기본 탑재",
      features: ["어문회 8급 기초 한자 + 초등 받아쓰기 기본 내장", "사진·PDF 업로드 무제한 무료"],
      sample_cards: [{ front: "韓", back: "나라 한 (부수: 韋 · 17획)", tag: "hanja_8geup" }],
    },
    {
      pack_id: "pack.moe.eng.elem34",
      title: "[교육부 1 · 초등 3~4] 초등 3~4학년 기초 필수 영단어 브레인팩",
      subtitle: "2022 개정 교육과정 초등 3~4학년군 기본 어휘표 · 생활·학교·자연·동작 필수 영단어",
      category: "k12_textbook",
      age_tier: "junior",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:elem-3-4",
      covered_ref_ids: ["moe-eng:elem-3-4"],
      estimated_card_count: 1015,
      badge_label: "교육부 초등 3~4",
      features: ["초등 3~4학년 기초 필수 영단어(morning, weather, borrow 등)", "Lv.1~3 단계별 카드 & 예문 해설"],
      sample_cards: [{ front: "weather", back: "날씨 — How is the weather today?", tag: "초등 3~4" }],
    },
    {
      pack_id: "pack.moe.eng.elem56",
      title: "[교육부 2 · 초등 5~6] 초등 5~6학년 필수 영단어 800 핵심 브레인팩",
      subtitle: "2022 개정 교육과정 초등 5~6학년군 필수 영단어 800 핵심 어휘 & 의사소통 표현",
      category: "k12_textbook",
      age_tier: "junior",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:elementary",
      covered_ref_ids: ["moe-eng:elementary"],
      estimated_card_count: 1040,
      badge_label: "교육부 초등 5~6",
      features: ["초등 5~6학년 필수 영단어 800 핵심(library, museum, vacation, between 등)", "중학 진학 전 필수 마스터"],
      sample_cards: [{ front: "museum", back: "박물관, 미술관 — We visited the science museum.", tag: "초등 5~6" }],
    },
    {
      pack_id: "pack.moe.eng.mid1200",
      title: "[교육부 3 · 중학교] 중학교 1~3학년 필수 영단어 1,200 & 내신 8대 핵심 영문법 브레인팩",
      subtitle: "2022 개정 중학 필수 영단어 1,200 핵심 + 현재완료·관계대명사·감각동사 등 내신 8대 영문법",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:middle-1200",
      covered_ref_ids: ["moe-eng:middle-1200"],
      estimated_card_count: 1200,
      badge_label: "교육부 중학 영단어·문법",
      features: ["중학 필수 영단어 1,200 핵심 + 내신 8대 핵심 영문법 동시 수록", "단어·문법 분리형 4지선다"],
      sample_cards: [{ front: "[중학 핵심문법] 감각동사(look/smell/taste) 뒤 보어 품사는?", back: "형용사 (부사 -ly 불가)", tag: "중학 영문법" }],
    },
    {
      pack_id: "pack.moe.eng.high_csat",
      title: "[교육부 4 · 고교·수능] 고등학교·수능 필수 학술 어휘 브레인팩",
      subtitle: "2022 개정 고등학교 공통영어 및 평가원 모의고사·수능 최빈출 추상·학술 어휘",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:high-csat",
      covered_ref_ids: ["moe-eng:high-csat"],
      estimated_card_count: 1150,
      badge_label: "교육부 고교·수능",
      features: ["평가원·수능 최빈출 학술 어휘(hypothesis, empirical, correlation, cognitive 등)", "반의어·파생어 해설"],
      sample_cards: [{ front: "empirical", back: "경험적인, 실증적인 (↔ theoretical 이론적인)", tag: "수능 학술" }],
    },
    {
      pack_id: "pack.moe.kor.orthography_lit",
      title: "[교육부 5 · 국어] 초·중·고 국어 한글 맞춤법·표준어 규정 & 필수 문학 개념어 브레인팩",
      subtitle: "자주 틀리는 한글 맞춤법(며칠/금세/되·돼/로서·로써) & 내신·수능 필수 문학 개념어",
      category: "k12_textbook",
      age_tier: "all",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-kor:orthography-lit",
      covered_ref_ids: ["moe-kor:orthography-lit"],
      estimated_card_count: 1035,
      badge_label: "교육부 국어·문학",
      features: ["한글 맞춤법·표준어 규정 혼동 어휘 & 필수 문학 개념어(역설법, 객관적 상관물 등)"],
      sample_cards: [{ front: "'오늘이 몇 월 [ ___ ]이지?' 바른 맞춤법 표기는?", back: "며칠 ('몇일'은 틀린 표기)", tag: "한글 맞춤법" }],
    },
    {
      pack_id: "pack.moe.hanja.mid1800",
      title: "[교육부 6 · 한문] 중·고교 한문 교육부 기초한자 1,800 핵심 브레인팩",
      subtitle: "교육부 고시 한문 교육용 기초한자 1,800자 핵심(중등 900·고등 900) & 교과서 필수 성어",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-hanja-1800:middle",
      covered_ref_ids: ["moe-hanja-1800:middle"],
      estimated_card_count: 1350,
      badge_label: "교육부 한자 1,800",
      features: ["교육부 고시 중·고교 기초한자 1,800 핵심 훈음·부수·획수 & 사자성어(온고지신 등)"],
      sample_cards: [{ front: "溫故知新 (온고지신)", back: "옛것을 익히고 그것을 미루어 새것을 안다", tag: "기초한자 1800" }],
    },
    {
      pack_id: "pack.moe.hist.essential",
      title: "[교육부 7 · 한국사] 한국사 시대별 필수 연표·사건 브레인팩",
      subtitle: "2022 개정 초·중·고 한국사 시대별 필수 연표·조약·개혁·유네스코 세계유산 총정리",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "khist:essential",
      covered_ref_ids: ["khist:essential"],
      estimated_card_count: 1080,
      badge_label: "교육부 한국사 연표",
      features: ["시대별 핵심 사건·조약·개혁·문화재 연표 총정리"],
      sample_cards: [{ front: "1876년 체결된 조선 최초의 근대적 조약이자 불평등 조약은?", back: "강화도 조약 (조일수호조규)", tag: "한국사 연표" }],
    },
    {
      pack_id: "pack.moe.sci.core_formula",
      title: "[교육부 8 · 과학] 과학 물리·화학·생명·지구과학 핵심 법칙·공식 브레인팩",
      subtitle: "중·고등학교 과학 4대 영역(물리·화학·생명·지구과학) 필수 법칙·화학결합·공식 마스터",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "sci-element-formula:core",
      covered_ref_ids: ["sci-element-formula:core"],
      estimated_card_count: 1045,
      badge_label: "교육부 과학 법칙·공식",
      features: ["옴의 법칙(V=IR), 뉴턴 가속도 법칙(F=ma), 화학 결합, 미토콘드리아 ATP, 판구조론"],
      sample_cards: [{ front: "뉴턴 운동 제2법칙(가속도 법칙) 공식은?", back: "F = m × a (알짜힘 = 질량 × 가속도)", tag: "물리 법칙" }],
    },
    {
      pack_id: "pack.moe.math.core_formula",
      title: "[교육부 9 · 수학] 수학 중·고교 필수 공식 (피타고라스·근의 공식·삼각함수·등차수열·미분계수) 브레인팩",
      subtitle: "중·고등학교 수학과 대수·기하·삼각함수·수열·미적분 핵심 공식 완벽 암기",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-math:core-formulas",
      covered_ref_ids: ["moe-math:core-formulas"],
      estimated_card_count: 1060,
      badge_label: "교육부 수학 필수공식",
      features: ["피타고라스 정리, 근의 공식·판별식, 삼각함수 제곱 관계, 등차수열 일반항, 미분계수 정의"],
      sample_cards: [{ front: "첫째항 a, 공차 d인 등차수열의 일반항 aₙ과 미분계수 f'(a)는?", back: "aₙ = a + (n - 1)d · f'(a) = lim(h→0)[f(a+h)-f(a)]/h", tag: "수학 공식" }],
    },
    {
      pack_id: "pack.mid1.eng.donga_yoon.full",
      title: "[중1 내신] 동아(윤정미) 영어 Lesson 1~8 전 단원 마스터 브레인팩",
      subtitle: "2022 개정 교육과정 · 단원별·쪽수별 시험범위 슬라이싱 + 핵심 영단어·문법 함정선지 완비",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid1.eng.donga_yoon.2022",
      covered_ref_ids: ["kr.mid1.eng.donga_yoon.2022"],
      estimated_card_count: 1024,
      badge_label: "중1 내신 베스트",
      features: ["Lesson 1 ~ Lesson 8 전 단원 필수 어휘·숙어·핵심 문법 완벽 매핑 (1,000+ 카드)"],
      sample_cards: [{ front: "introduce (p.12)", back: "소개하다 (동사)", tag: "Lesson 1" }],
    },
    {
      pack_id: "pack.mid2.eng.donga_yoon.full",
      title: "[중2 내신] 동아(윤정미) 영어 전 단원·쪽수 마스터 브레인팩",
      subtitle: "중학교 2학년 내신 만점 대비 · 단원/쪽수 슬라이싱 & 4지선다 유의어 함정 방어",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid2.eng.donga_yoon.2022",
      covered_ref_ids: ["kr.mid2.eng.donga_yoon.2022"],
      estimated_card_count: 1032,
      badge_label: "중2 내신 필수",
      features: ["중2 동아(윤정미) 단원별 어휘·문법 수록 (1,000+ 카드)"],
      sample_cards: [{ front: "confident (p.16)", back: "자신감 있는 (형용사)", tag: "Lesson 1" }],
    },
    {
      pack_id: "pack.mid2.hist.miraeen.full",
      title: "[중2 내신] 미래엔 역사① 연표·사료·문화재 브레인팩",
      subtitle: "중학교 역사 내신 출판사 단원 매핑 · 동시대 사건 함정 보기 자동 구성",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid2.hist.miraeen.2022",
      covered_ref_ids: ["kr.mid2.hist.miraeen.2022"],
      estimated_card_count: 1018,
      badge_label: "역사 내신 특화",
      features: ["미래엔 중학교 역사① 단원·쪽수별 사건·연표·조약·문화재 정리 (1,000+ 카드)"],
      sample_cards: [{ front: "훈민정음 창제 (1443, 반포 1446)", back: "조선 세종 대 백성을 가르치는 바른 소리 28자 창제", tag: "Ⅰ단원" }],
    },
    {
      pack_id: "pack.high1.sci.visang.full",
      title: "[고1 내신] 비상 통합과학1 공식·핵심개념 브레인팩",
      subtitle: "고등학교 1학년 통합과학 물리·화학·생명·지구과학 필수 공식 및 원소 완벽 대비",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.high1.sci.visang.2022",
      covered_ref_ids: ["kr.high1.sci.visang.2022", "sci-element-formula:core"],
      estimated_card_count: 1028,
      badge_label: "고1 내신 1등급",
      features: ["비상교육 고1 통합과학1 단원별 핵심 공식 및 원소 매핑 (1,000+ 카드)"],
      sample_cards: [{ front: "옴의 법칙: V = I × R", back: "전압(V)은 전류(I)와 저항(R)의 곱에 비례한다", tag: "통합과학1" }],
    },
    {
      pack_id: "pack.exam.hanja_master",
      title: "[급수한자] 어문회 7급~3급 필수 한자 & 사자성어 올인원 브레인팩",
      subtitle: "동음이의어·유사한자 함정선지 완벽 방어 + 두음법칙/다음자(樂 락·악·요) 정밀 채점",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 1500,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "hanja-grade:7geup",
      covered_ref_ids: ["hanja-grade:7geup", "hanja-grade:6geup", "hanja-grade:5geup", "hanja-grade:4geup", "hanja-grade:3geup", "ko-idiom:essential"],
      estimated_card_count: 1250,
      badge_label: "급수시험 올인원",
      features: ["한자 7급~3급 급수별 필수 한자 및 사자성어 전체 잠금해제 (1,200+ 카드)"],
      sample_cards: [{ front: "樂 (3급 대표 다음자)", back: "즐길 락(낙) / 노래 악 / 좋아할 요 (부수: 木 · 15획)", tag: "hanja_3geup" }],
    },
    {
      pack_id: "pack.exam.khist_master",
      title: "[한국사] 한국사능력검정 심화(1~3급) 핵심 연표·사료·문화재 브레인팩",
      subtitle: "고려·조선·근현대사 핵심 사건·조약·유네스코 문화재 완벽 총정리",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 1500,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "khist:essential",
      covered_ref_ids: ["khist:essential"],
      estimated_card_count: 1080,
      badge_label: "한능검 단기합격",
      features: ["시대별·왕대별 핵심 사건·조약·문화재 연표 양방향 Cloze (1,000+ 카드)"],
      sample_cards: [{ front: "갑신정변 (1884)", back: "김옥균·박영효 등 급진개화파가 일으킨 근대화 개혁 운동", tag: "khist" }],
    },
    {
      pack_id: "pack.exam.lang_toeic_jlpt",
      title: "[어학] 토익(TOEIC) 고득점 빈출 & JLPT N5~N3 필수 어휘 브레인팩",
      subtitle: "비즈니스 영어 핵심 어휘 + 일본어 한자·히라가나 발음/원어민 TTS 스피킹 드릴",
      category: "language_exam",
      age_tier: "adult",
      price_krw: 1900,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "exam-eng:toeic-core",
      covered_ref_ids: ["exam-eng:toeic-core", "exam-ja:jlpt-n5-n3"],
      estimated_card_count: 1180,
      badge_label: "어학 베스트셀러",
      features: ["토익 빈출 어휘 및 JLPT 핵심 어휘 동시 수록 (1,200+ 카드)"],
      sample_cards: [{ front: "reimburse", back: "(경비를) 변제하다, 환급하다 (동사 · C1)", tag: "TOEIC" }],
    },
    {
      pack_id: "pack.pro.law_it_cert",
      title: "[성인/전문] 헌법 핵심 조문 & 정보처리기사·컴활 마스터 브레인팩",
      subtitle: "공무원·법학 시험 필수 헌법 조문 + IT 자격증(정처기·컴활) 핵심 팩트 완벽 수록",
      category: "pro_cert",
      age_tier: "adult",
      price_krw: 1900,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "cert-it:core",
      covered_ref_ids: ["cert-it:core", "law-statute:constitution"],
      estimated_card_count: 1050,
      badge_label: "수험·자격증 프로",
      features: ["대한민국 헌법 핵심 조문 & 정보처리기사·컴활 필수 개념 완벽 정리 (1,000+ 카드)"],
      sample_cards: [{ front: "데이터베이스 트랜잭션의 4대 특성 (ACID)", back: "원자성, 일관성, 격리성, 영속성", tag: "정처기" }],
    },
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

  function maskTermInDescJs(desc, term) {
    const d = String(desc || "").trim();
    const t = String(term || "").trim();
    if (!d || !t) return d;
    const candidates = [t];
    const baseTerm = t.replace(/\s*\([^)]*\)\s*/g, "").trim();
    if (baseTerm && baseTerm.length >= 2 && !candidates.includes(baseTerm)) {
      candidates.push(baseTerm);
    }
    let masked = d;
    candidates.forEach((cand) => {
      if (cand.length >= 2) {
        const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        masked = masked.replace(new RegExp(escaped, "gi"), "[ ___ ]");
      }
    });
    return masked;
  }

  function formatConciseBackJs(answerText, explainText, termText) {
    const ans = String(answerText || "").trim();
    let exp = String(explainText || "").trim();
    if (!exp) return ans;
    if (exp === ans) return ans;
    const t = String(termText || "").trim();
    if (t && (exp === `${t} — ${ans}` || exp === `${t}: ${ans}`)) {
      return ans;
    }
    exp = exp.replace(/^표제어\s+'[^']+'\s*의\s*핵심\s*뜻은\s*'[^']+'\s*입니다\.?\s*/g, "").trim();
    exp = exp.replace(/^한자\s+\S+\s*—\s*훈음:\s*[^.]+(?:\.\s*|\s*$)/g, "").trim();
    if (!exp || exp === ans || ans.includes(exp)) return ans;
    return `${ans}\n\n💡 해설: ${exp}`;
  }

  const AUTHENTIC_SUBJECT_TSV_BANK = {"english": ["morning\t아침\t\"Every student should pay close attention to [ morning ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "afternoon\t오후\t\"We learned practical facts about [ afternoon ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "evening\t저녁\t\"Having a reliable [ evening ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "night\t밤\t\"They shared interesting stories about [ night ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "today\t오늘\t\"Living in a [ today ] environment helps people stay healthy and active.\"\t환경·조건 특성 수식 형용사 · 초등 교육부 필수 어휘", "tomorrow\t내일\t\"She found a creative way to use [ tomorrow ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "yesterday\t어제\t\"The team proposed a very [ yesterday ] approach to overcome the challenge.\"\t성격·태도·방법 수식 형용사 · 초등 교육부 필수 어휘", "weekend\t주말\t\"We learned practical facts about [ weekend ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "spring\t봄\t\"Having a reliable [ spring ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "summer\t여름\t\"They shared interesting stories about [ summer ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "autumn\t가을\t\"Please check the details regarding [ autumn ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "winter\t겨울\t\"She found a creative way to use [ winter ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "season\t계절\t\"Every student should pay close attention to [ season ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "weather\t날씨\t\"We learned practical facts about [ weather ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "sunny\t화창한, 맑은\t\"It is [ sunny ] for learners to review core concepts regularly.\"\t필수·중요성 판단 서술 형용사 · 초등 교육부 필수 어휘", "cloudy\t구름 낀, 흐린\t\"She remained [ cloudy ] and focused even under tight deadlines.\"\t인물의 심리·상태 묘사 형용사 · 초등 교육부 필수 어휘", "rainy\t비가 오는\t\"Living in a [ rainy ] environment helps people stay healthy and active.\"\t환경·조건 특성 수식 형용사 · 초등 교육부 필수 어휘", "snowy\t눈이 오는\t\"The speaker presented a [ snowy ] argument supported by clear data.\"\t논증·주장의 타당성 수식 형용사 · 초등 교육부 필수 어휘", "windy\t바람이 부는\t\"The team proposed a very [ windy ] approach to overcome the challenge.\"\t성격·태도·방법 수식 형용사 · 초등 교육부 필수 어휘", "warm\t따뜻한\t\"Scientists observed a [ warm ] change in the experimental results.\"\t결과·변화 양상 묘사 형용사 · 초등 교육부 필수 어휘", "cool\t시원한, 멋진\t\"Having a reliable [ cool ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "cold\t추운, 차가운\t\"She remained [ cold ] and focused even under tight deadlines.\"\t인물의 심리·상태 묘사 형용사 · 초등 교육부 필수 어휘", "hot\t더운, 뜨거운\t\"Living in a [ hot ] environment helps people stay healthy and active.\"\t환경·조건 특성 수식 형용사 · 초등 교육부 필수 어휘", "humid\t습한\t\"The speaker presented a [ humid ] argument supported by clear data.\"\t논증·주장의 타당성 수식 형용사 · 초등 교육부 필수 어휘", "rainbow\t무지개\t\"Every student should pay close attention to [ rainbow ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "umbrella\t우산\t\"We learned practical facts about [ umbrella ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "thunder\t천둥\t\"Having a reliable [ thunder ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "lightning\t번개\t\"They shared interesting stories about [ lightning ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "storm\t폭풍우\t\"Please check the details regarding [ storm ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "fog\t안개\t\"She found a creative way to use [ fog ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "shower\t소나기, 샤워\t\"Every student should pay close attention to [ shower ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "breeze\t산들바람\t\"We learned practical facts about [ breeze ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "family\t가족\t\"It is [ family ] for learners to review core concepts regularly.\"\t필수·중요성 판단 서술 형용사 · 초등 교육부 필수 어휘", "parent\t부모님\t\"She remained [ parent ] and focused even under tight deadlines.\"\t인물의 심리·상태 묘사 형용사 · 초등 교육부 필수 어휘", "father\t아버지\t\"Please check the details regarding [ father ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "mother\t어머니\t\"She found a creative way to use [ mother ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "brother\t형, 오빠, 남동생\t\"Every student should pay close attention to [ brother ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "sister\t언니, 누나, 여동생\t\"We learned practical facts about [ sister ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "uncle\t삼촌, 외삼촌\t\"Having a reliable [ uncle ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "aunt\t이모, 고모\t\"They shared interesting stories about [ aunt ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "cousin\t사촌\t\"Please check the details regarding [ cousin ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "grandparent\t조부모님\t\"The speaker presented a [ grandparent ] argument supported by clear data.\"\t논증·주장의 타당성 수식 형용사 · 초등 교육부 필수 어휘", "grandfather\t할아버지\t\"Every student should pay close attention to [ grandfather ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "grandmother\t할머니\t\"We learned practical facts about [ grandmother ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "baby\t아기\t\"It is [ baby ] for learners to review core concepts regularly.\"\t필수·중요성 판단 서술 형용사 · 초등 교육부 필수 어휘", "child\t어린이, 자녀\t\"They shared interesting stories about [ child ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "adult\t어른, 성인\t\"Please check the details regarding [ adult ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "neighbor\t이웃 사람\t\"She found a creative way to use [ neighbor ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "friend\t친구\t\"Every student should pay close attention to [ friend ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "classmate\t반 친구\t\"We learned practical facts about [ classmate ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "teacher\t선생님\t\"Having a reliable [ teacher ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "student\t학생\t\"She remained [ student ] and focused even under tight deadlines.\"\t인물의 심리·상태 묘사 형용사 · 초등 교육부 필수 어휘", "doctor\t의사\t\"Please check the details regarding [ doctor ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "nurse\t간호사\t\"She found a creative way to use [ nurse ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "dentist\t치과의사\t\"Every student should pay close attention to [ dentist ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "pilot\t비행기 조종사\t\"We learned practical facts about [ pilot ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "police officer\t경찰관\t\"Successful learners know how to [ police officer ] when facing unfamiliar problems.\"\t문제 해결·실천 핵심 숙어/표현 · 초등 교육부 필수 어휘", "firefighter\t소방관\t\"They shared interesting stories about [ firefighter ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "scientist\t과학자\t\"Please check the details regarding [ scientist ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "astronaut\t우주비행사\t\"She found a creative way to use [ astronaut ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "artist\t예술가, 화가\t\"Every student should pay close attention to [ artist ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "musician\t음악가\t\"We learned practical facts about [ musician ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "actor\t배우\t\"Having a reliable [ actor ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "singer\t가수\t\"They shared interesting stories about [ singer ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "writer\t작가\t\"Please check the details regarding [ writer ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "chef\t요리사\t\"She found a creative way to use [ chef ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "baker\t제빵사\t\"Every student should pay close attention to [ baker ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "farmer\t농부\t\"We learned practical facts about [ farmer ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "driver\t운전기사\t\"Having a reliable [ driver ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "engineer\t기술자, 엔지니어\t\"They shared interesting stories about [ engineer ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "reporter\t기자\t\"Please check the details regarding [ reporter ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "librarian\t사서\t\"She found a creative way to use [ librarian ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "school\t학교\t\"Every student should pay close attention to [ school ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "classroom\t교실\t\"We learned practical facts about [ classroom ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "playground\t운동장\t\"Having a reliable [ playground ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "library\t도서관\t\"She remained [ library ] and focused even under tight deadlines.\"\t인물의 심리·상태 묘사 형용사 · 초등 교육부 필수 어휘", "gym\t체육관\t\"Please check the details regarding [ gym ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "cafeteria\t구내식당, 급식실\t\"She found a creative way to use [ cafeteria ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "office\t사무실, 교무실\t\"Every student should pay close attention to [ office ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "restroom\t화장실\t\"We learned practical facts about [ restroom ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "hospital\t병원\t\"It is [ hospital ] for learners to review core concepts regularly.\"\t필수·중요성 판단 서술 형용사 · 초등 교육부 필수 어휘", "pharmacy\t약국\t\"Recent studies highlight the importance of [ pharmacy ] in human development.\"\t실험·연구 요약문 핵심 명사 · 초등 교육부 필수 어휘", "bakery\t빵집, 제과점\t\"Living in a [ bakery ] environment helps people stay healthy and active.\"\t환경·조건 특성 수식 형용사 · 초등 교육부 필수 어휘", "market\t시장\t\"She found a creative way to use [ market ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "supermarket\t슈퍼마켓\t\"Every student should pay close attention to [ supermarket ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "department store\t백화점\t\"We need to [ department store ] in order to achieve sustainable progress.\"\t목표 달성·협력 필수 연어(Collocation) · 초등 교육부 필수 어휘", "bank\t은행\t\"Having a reliable [ bank ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "post office\t우체국\t\"The guidelines advise all participants to [ post office ] throughout the session.\"\t규칙·절차 안내 필수 표현 · 초등 교육부 필수 어휘", "police station\t경찰서\t\"Successful learners know how to [ police station ] when facing unfamiliar problems.\"\t문제 해결·실천 핵심 숙어/표현 · 초등 교육부 필수 어휘", "fire station\t소방서\t\"We need to [ fire station ] in order to achieve sustainable progress.\"\t목표 달성·협력 필수 연어(Collocation) · 초등 교육부 필수 어휘", "museum\t박물관\t\"Every student should pay close attention to [ museum ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "art gallery\t미술관\t\"The guidelines advise all participants to [ art gallery ] throughout the session.\"\t규칙·절차 안내 필수 표현 · 초등 교육부 필수 어휘", "theater\t극장, 영화관\t\"Having a reliable [ theater ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "cinema\t영화관\t\"They shared interesting stories about [ cinema ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "stadium\t경기장\t\"Please check the details regarding [ stadium ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "park\t공원\t\"She found a creative way to use [ park ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "zoo\t동물원\t\"Every student should pay close attention to [ zoo ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "aquarium\t수족관\t\"We learned practical facts about [ aquarium ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "amusement park\t놀이공원\t\"In daily conversation, people often use '[ amusement park ]' to express this idea clearly.\"\t회화·독해 빈출 핵심 구문 · 초등 교육부 필수 어휘", "airport\t공항\t\"They shared interesting stories about [ airport ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "station\t역, 정거장\t\"Without sufficient [ station ], the project could not achieve its goal.\"\t조건·인과 구문 핵심 명사 · 초등 교육부 필수 어휘", "harbor\t항구\t\"She found a creative way to use [ harbor ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "bridge\t다리\t\"Every student should pay close attention to [ bridge ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "crosswalk\t횡단보도\t\"We learned practical facts about [ crosswalk ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "sidewalk\t보도, 인도\t\"Having a reliable [ sidewalk ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "street\t거리, 도로\t\"They shared interesting stories about [ street ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "corner\t모퉁이\t\"Please check the details regarding [ corner ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "block\t구역, 블록\t\"She found a creative way to use [ block ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "building\t건물, 빌딩\t\"Every student should pay close attention to [ building ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "apartment\t아파트\t\"A clear understanding of [ apartment ] is essential for solving this problem.\"\t독해 지문 주제·핵심 개념어 · 초등 교육부 필수 어휘", "house\t집, 주택\t\"Having a reliable [ house ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "yard\t마당, 뜰\t\"They shared interesting stories about [ yard ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "garden\t정원, 텃밭\t\"Please check the details regarding [ garden ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "kitchen\t부엌, 주방\t\"She found a creative way to use [ kitchen ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "living room\t거실\t\"In daily conversation, people often use '[ living room ]' to express this idea clearly.\"\t회화·독해 빈출 핵심 구문 · 초등 교육부 필수 어휘", "bedroom\t침실\t\"We learned practical facts about [ bedroom ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "bathroom\t욕실\t\"Having a reliable [ bathroom ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "basement\t지하실\t\"Recent studies highlight the importance of [ basement ] in human development.\"\t실험·연구 요약문 핵심 명사 · 초등 교육부 필수 어휘", "attic\t다락방\t\"Living in a [ attic ] environment helps people stay healthy and active.\"\t환경·조건 특성 수식 형용사 · 초등 교육부 필수 어휘", "roof\t지붕\t\"She found a creative way to use [ roof ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "window\t창문\t\"Every student should pay close attention to [ window ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "door\t문\t\"We learned practical facts about [ door ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "wall\t벽\t\"Having a reliable [ wall ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "floor\t바닥, 층\t\"They shared interesting stories about [ floor ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "ceiling\t천장\t\"Please check the details regarding [ ceiling ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "stairs\t계단\t\"She found a creative way to use [ stairs ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "elevator\t엘리베이터\t\"Every student should pay close attention to [ elevator ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "mirror\t거울\t\"We learned practical facts about [ mirror ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "table\t식탁, 탁자\t\"It is [ table ] for learners to review core concepts regularly.\"\t필수·중요성 판단 서술 형용사 · 초등 교육부 필수 어휘", "desk\t책상\t\"They shared interesting stories about [ desk ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "chair\t의자\t\"Please check the details regarding [ chair ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "sofa\t소파\t\"She found a creative way to use [ sofa ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "bed\t침대\t\"Every student should pay close attention to [ bed ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "blanket\t담요, 이불\t\"We learned practical facts about [ blanket ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "pillow\t베개\t\"Having a reliable [ pillow ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "closet\t옷장\t\"They shared interesting stories about [ closet ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "clock\t벽시계\t\"Please check the details regarding [ clock ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "watch\t손목시계, 지켜보다\t\"To [ watch ] effectively, you should focus on the main context first.\"\t학습·전략 지문 핵심 동사/표제어 · 초등 교육부 필수 어휘", "calendar\t달력\t\"Every student should pay close attention to [ calendar ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "lamp\t스탠드, 등\t\"We learned practical facts about [ lamp ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "computer\t컴퓨터\t\"Having a reliable [ computer ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "keyboard\t키보드, 건반\t\"They shared interesting stories about [ keyboard ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "screen\t화면, 스크린\t\"Please check the details regarding [ screen ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "telephone\t전화기\t\"She found a creative way to use [ telephone ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "camera\t카메라\t\"Every student should pay close attention to [ camera ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "television\t텔레비전\t\"A clear understanding of [ television ] is essential for solving this problem.\"\t독해 지문 주제·핵심 개념어 · 초등 교육부 필수 어휘", "refrigerator\t냉장고\t\"Having a reliable [ refrigerator ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "microwave\t전자레인지\t\"They shared interesting stories about [ microwave ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "stove\t가스레인지, 난로\t\"Please check the details regarding [ stove ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "sink\t싱크대, 가라앉다\t\"To [ sink ] effectively, you should focus on the main context first.\"\t학습·전략 지문 핵심 동사/표제어 · 초등 교육부 필수 어휘", "washing machine\t세탁기\t\"In daily conversation, people often use '[ washing machine ]' to express this idea clearly.\"\t회화·독해 빈출 핵심 구문 · 초등 교육부 필수 어휘", "vacuum\t진공청소기\t\"We learned practical facts about [ vacuum ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "book\t책\t\"Having a reliable [ book ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "notebook\t공책\t\"They shared interesting stories about [ notebook ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "diary\t일기, 수첩\t\"Living in a [ diary ] environment helps people stay healthy and active.\"\t환경·조건 특성 수식 형용사 · 초등 교육부 필수 어휘", "dictionary\t사전\t\"The speaker presented a [ dictionary ] argument supported by clear data.\"\t논증·주장의 타당성 수식 형용사 · 초등 교육부 필수 어휘", "textbook\t교과서\t\"Every student should pay close attention to [ textbook ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "newspaper\t신문\t\"We learned practical facts about [ newspaper ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "magazine\t잡지\t\"Having a reliable [ magazine ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "letter\t편지, 글자\t\"They shared interesting stories about [ letter ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "pencil\t연필\t\"Please check the details regarding [ pencil ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "eraser\t지우개\t\"She found a creative way to use [ eraser ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "ruler\t자, 통치자\t\"Every student should pay close attention to [ ruler ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "scissors\t가위\t\"We learned practical facts about [ scissors ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "glue\t풀, 접착제\t\"Having a reliable [ glue ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "tape\t테이프\t\"They shared interesting stories about [ tape ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "crayon\t크레용\t\"Please check the details regarding [ crayon ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "paintbrush\t붓\t\"She found a creative way to use [ paintbrush ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "backpack\t배낭, 책가방\t\"Every student should pay close attention to [ backpack ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "pocket\t주머니\t\"We learned practical facts about [ pocket ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "wallet\t지갑\t\"Having a reliable [ wallet ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "glasses\t안경\t\"They shared interesting stories about [ glasses ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "hat\t모자\t\"Please check the details regarding [ hat ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "cap\t야구모자\t\"She found a creative way to use [ cap ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "helmet\t헬멧, 안전모\t\"Every student should pay close attention to [ helmet ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "gloves\t장갑\t\"We learned practical facts about [ gloves ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "scarf\t목도리, 스카프\t\"Having a reliable [ scarf ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "coat\t코트, 외투\t\"They shared interesting stories about [ coat ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "jacket\t재킷, 상의\t\"Please check the details regarding [ jacket ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "shirt\t셔츠\t\"She found a creative way to use [ shirt ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "sweater\t스웨터\t\"Every student should pay close attention to [ sweater ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "pants\t바지\t\"We learned practical facts about [ pants ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "skirt\t치마\t\"Having a reliable [ skirt ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "dress\t원피스, 드레스\t\"They shared interesting stories about [ dress ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "shoes\t신발\t\"Please check the details regarding [ shoes ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "boots\t장화, 부츠\t\"She found a creative way to use [ boots ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "sneakers\t운동화\t\"Every student should pay close attention to [ sneakers ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "socks\t양말\t\"We learned practical facts about [ socks ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "uniform\t교복, 제복\t\"Having a reliable [ uniform ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "belt\t허리띠, 벨트\t\"They shared interesting stories about [ belt ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "ring\t반지, 울리다\t\"The passage explains why people [ ring ] differently in various cultures.\"\t문화·행동 비교 지문 필수 어휘 · 초등 교육부 필수 어휘", "necklace\t목걸이\t\"She found a creative way to use [ necklace ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "breakfast\t아침 식사\t\"Every student should pay close attention to [ breakfast ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "lunch\t점심 식사\t\"We learned practical facts about [ lunch ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "dinner\t저녁 식사\t\"Having a reliable [ dinner ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "snack\t간식\t\"They shared interesting stories about [ snack ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "dessert\t후식, 디저트\t\"Please check the details regarding [ dessert ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "water\t물\t\"She found a creative way to use [ water ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "milk\t우유\t\"Every student should pay close attention to [ milk ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "juice\t주스\t\"We learned practical facts about [ juice ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "tea\t차(茶)\t\"Having a reliable [ tea ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "bread\t빵\t\"They shared interesting stories about [ bread ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "rice\t쌀, 밥\t\"Please check the details regarding [ rice ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "noodle\t국수, 면\t\"She found a creative way to use [ noodle ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "soup\t수프, 국\t\"Every student should pay close attention to [ soup ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "salad\t샐러드\t\"We learned practical facts about [ salad ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "sandwich\t샌드위치\t\"Having a reliable [ sandwich ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "pizza\t피자\t\"They shared interesting stories about [ pizza ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "cheese\t치즈\t\"Please check the details regarding [ cheese ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "butter\t버터\t\"She found a creative way to use [ butter ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "egg\t달걀\t\"Every student should pay close attention to [ egg ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "meat\t고기\t\"We learned practical facts about [ meat ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "beef\t소고기\t\"Having a reliable [ beef ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "pork\t돼지고기\t\"They shared interesting stories about [ pork ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "chicken\t닭고기, 닭\t\"Please check the details regarding [ chicken ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "fish\t물고기, 생선\t\"The speaker presented a [ fish ] argument supported by clear data.\"\t논증·주장의 타당성 수식 형용사 · 초등 교육부 필수 어휘", "vegetable\t채소, 야채\t\"The team proposed a very [ vegetable ] approach to overcome the challenge.\"\t성격·태도·방법 수식 형용사 · 초등 교육부 필수 어휘", "carrot\t당근\t\"We learned practical facts about [ carrot ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "onion\t양파\t\"Having a reliable [ onion ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "potato\t감자\t\"They shared interesting stories about [ potato ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "tomato\t토마토\t\"Please check the details regarding [ tomato ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "cucumber\t오이\t\"She found a creative way to use [ cucumber ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "cabbage\t양배추\t\"Every student should pay close attention to [ cabbage ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "garlic\t마늘\t\"Scientists observed a [ garlic ] change in the experimental results.\"\t결과·변화 양상 묘사 형용사 · 초등 교육부 필수 어휘", "pepper\t고추, 후추\t\"Having a reliable [ pepper ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "mushroom\t버섯\t\"They shared interesting stories about [ mushroom ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "corn\t옥수수\t\"Please check the details regarding [ corn ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "bean\t콩\t\"She found a creative way to use [ bean ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "fruit\t과일\t\"Every student should pay close attention to [ fruit ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "apple\t사과\t\"We learned practical facts about [ apple ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "banana\t바나나\t\"Having a reliable [ banana ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "orange\t오렌지, 주황색\t\"They shared interesting stories about [ orange ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "grape\t포도\t\"Please check the details regarding [ grape ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "strawberry\t딸기\t\"The speaker presented a [ strawberry ] argument supported by clear data.\"\t논증·주장의 타당성 수식 형용사 · 초등 교육부 필수 어휘", "watermelon\t수박\t\"Every student should pay close attention to [ watermelon ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "peach\t복숭아\t\"We learned practical facts about [ peach ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "pear\t배(과일)\t\"Having a reliable [ pear ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "lemon\t레몬\t\"They shared interesting stories about [ lemon ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "melon\t멜론\t\"Please check the details regarding [ melon ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "cherry\t체리\t\"The speaker presented a [ cherry ] argument supported by clear data.\"\t논증·주장의 타당성 수식 형용사 · 초등 교육부 필수 어휘", "sugar\t설탕\t\"Every student should pay close attention to [ sugar ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "salt\t소금\t\"We learned practical facts about [ salt ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "oil\t기름, 석유\t\"Having a reliable [ oil ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "sauce\t소스\t\"They shared interesting stories about [ sauce ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "honey\t꿀\t\"Living in a [ honey ] environment helps people stay healthy and active.\"\t환경·조건 특성 수식 형용사 · 초등 교육부 필수 어휘", "chocolate\t초콜릿\t\"She found a creative way to use [ chocolate ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "cookie\t쿠키, 과자\t\"Every student should pay close attention to [ cookie ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "candy\t사탕\t\"Scientists observed a [ candy ] change in the experimental results.\"\t결과·변화 양상 묘사 형용사 · 초등 교육부 필수 어휘", "cake\t케이크\t\"Having a reliable [ cake ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "pie\t파이\t\"They shared interesting stories about [ pie ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "ice cream\t아이스크림\t\"In daily conversation, people often use '[ ice cream ]' to express this idea clearly.\"\t회화·독해 빈출 핵심 구문 · 초등 교육부 필수 어휘", "fork\t포크\t\"She found a creative way to use [ fork ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "spoon\t숟가락\t\"Every student should pay close attention to [ spoon ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "chopsticks\t젓가락\t\"We learned practical facts about [ chopsticks ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘", "knife\t칼, 나이프\t\"Having a reliable [ knife ] makes daily tasks much easier and safer.\"\t실용 회화·생활 밀착 명사 · 초등 교육부 필수 어휘", "plate\t접시\t\"They shared interesting stories about [ plate ] with their neighbors.\"\t스토리텔링·대화문 빈출 명사 · 초등 교육부 필수 어휘", "bowl\t그릇, 사발\t\"Please check the details regarding [ bowl ] before making a decision.\"\t안내문·실용문 필수 명사 · 초등 교육부 필수 어휘", "cup\t컵\t\"She found a creative way to use [ cup ] for her science project.\"\t탐구·과제 수행 핵심 어휘 · 초등 교육부 필수 어휘", "glass\t유리잔, 유리\t\"Every student should pay close attention to [ glass ] during the lesson.\"\t학교·일상 생활 필수 명사 · 초등 교육부 필수 어휘", "bottle\t병\t\"We learned practical facts about [ bottle ] in today's class.\"\t교과서 본문 핵심 소재 명사 · 초등 교육부 필수 어휘"], "hanja": ["天\t하늘 천\t【 天 】 (활용: 天地, 天下)\t활용 한자어: 천지(天地), 천하(天下)", "地\t땅 지\t【 地 】 (활용: 土地, 地球)\t활용 한자어: 토지(土地), 지구(地球)", "人\t사람 인\t【 人 】 (활용: 人間, 人類)\t활용 한자어: 인간(人間), 인류(人類)", "日\t날 일\t【 日 】 (활용: 日記, 日月)\t활용 한자어: 일기(日記), 일월(日月)", "月\t달 월\t【 月 】 (활용: 月曜日, 歲月)\t활용 한자어: 월요일(月曜日), 세월(歲月)", "火\t불 화\t【 火 】 (활용: 火災, 火山)\t활용 한자어: 화재(火災), 화산(火山)", "水\t물 수\t【 水 】 (활용: 水分, 山水)\t활용 한자어: 수분(水分), 산수(山水)", "木\t나무 목\t【 木 】 (활용: 木材, 樹木)\t활용 한자어: 목재(木材), 수목(樹木)", "金\t쇠 금, 성씨 김\t【 金 】 (활용: 金屬, 黃金)\t활용 한자어: 금속(金屬), 황금(黃金)", "土\t흙 토\t【 土 】 (활용: 土壤, 國土)\t활용 한자어: 토양(土壤), 국토(國土)", "山\t뫼 산\t【 山 】 (활용: 山脈, 登山)\t활용 한자어: 산맥(山脈), 등산(登山)", "川\t내 천\t【 川 】 (활용: 河川, 山川)\t활용 한자어: 하천(河川), 산천(山川)", "江\t강 강\t【 江 】 (활용: 漢江)\t활용 한자어: 강물, 한강(漢江)", "海\t바다 해\t【 海 】 (활용: 海洋, 東海)\t활용 한자어: 해양(海洋), 동해(東海)", "風\t바람 풍\t【 風 】 (활용: 風俗, 颱風)\t활용 한자어: 풍속(風俗), 태풍(颱風)", "雲\t구름 운\t【 雲 】 (활용: 雲海, 風雲)\t활용 한자어: 운해(雲海), 풍운(風雲)", "雨\t비 우\t【 雨 】 (활용: 雨天, 暴雨)\t활용 한자어: 우천(雨天), 폭우(暴雨)", "雪\t눈 설\t【 雪 】 (활용: 雪景, 暴雪)\t활용 한자어: 설경(雪景), 폭설(暴雪)", "氷\t얼음 빙\t【 氷 】 (활용: 氷山, 結氷)\t활용 한자어: 빙산(氷山), 결빙(結氷)", "霜\t서리 상\t【 霜 】 (활용: 風霜, 雪上加霜)\t활용 한자어: 풍상(風霜), 설상가상(雪上加霜)", "露\t이슬 로\t【 露 】 (활용: 玉露, 暴露)\t활용 한자어: 옥로(玉露), 폭로(暴露)", "雷\t우레 뢰\t【 雷 】 (활용: 雷聲, 落雷)\t활용 한자어: 뇌성(雷聲), 낙뢰(落雷)", "電\t번개 전\t【 電 】 (활용: 電氣, 電波)\t활용 한자어: 전기(電氣), 전파(電波)", "星\t별 성\t【 星 】 (활용: 星座, 行星)\t활용 한자어: 성좌(星座), 행성(行星)", "辰\t별 진, 때 신\t【 辰 】 (활용: 星辰, 生辰)\t활용 한자어: 성진(星辰), 생신(生辰)", "宙\t집 주\t【 宙 】 (활용: 宇宙)\t활용 한자어: 우주(宇宙)", "宇\t집 우\t【 宇 】 (활용: 宇宙, 堂宇)\t활용 한자어: 우주(宇宙), 당우(堂宇)", "洪\t넓을 홍\t【 洪 】 (활용: 洪水, 洪福)\t활용 한자어: 홍수(洪水), 홍복(洪福)", "荒\t거칠 황\t【 荒 】 (활용: 荒蕪地)\t활용 한자어: 황무지(荒蕪地), 미증유", "盈\t찰 영\t【 盈 】 (활용: 盈虛, 充盈)\t활용 한자어: 영허(盈虛), 충영(充盈)", "昃\t기울 측\t【 昃 】 (활용: 日中則昃)\t활용 한자어: 일중즉측(日中則昃)", "宿\t잘 숙, 별자리 수\t【 宿 】 (활용: 宿泊, 寄宿舍)\t활용 한자어: 숙박(宿泊), 기숙사(寄宿舍)", "列\t벌 열\t【 列 】 (활용: 列車, 配列)\t활용 한자어: 열차(列車), 배열(配列)", "張\t베풀 장\t【 張 】 (활용: 擴張, 緊張)\t활용 한자어: 확장(擴張), 긴장(緊張)", "寒\t찰 한\t【 寒 】 (활용: 寒波, 惡寒)\t활용 한자어: 한파(寒波), 오한(惡寒)", "來\t올 래\t【 來 】 (활용: 未來, 往來)\t활용 한자어: 미래(未來), 왕래(往來)", "暑\t더울 서\t【 暑 】 (활용: 暑氣, 避暑)\t활용 한자어: 서기(暑氣), 피서(避暑)", "往\t갈 왕\t【 往 】 (활용: 往復, 旣往)\t활용 한자어: 왕복(往復), 기왕(旣往)", "秋\t가을 추\t【 秋 】 (활용: 秋收, 春秋)\t활용 한자어: 추수(秋收), 춘추(春秋)", "收\t거둘 수\t【 收 】 (활용: 收穫, 吸收)\t활용 한자어: 수확(收穫), 흡수(吸收)", "冬\t겨울 동\t【 冬 】 (활용: 冬眠, 冬節期)\t활용 한자어: 동면(冬眠), 동절기(冬節期)", "藏\t감출 장\t【 藏 】 (활용: 貯藏, 所藏)\t활용 한자어: 저장(貯藏), 소장(所藏)", "閏\t윤달 윤\t【 閏 】 (활용: 閏年)\t활용 한자어: 윤년(閏年), 윤달", "餘\t남을 여\t【 餘 】 (활용: 餘裕, 餘暇)\t활용 한자어: 여유(餘裕), 여가(餘暇)", "成\t이룰 성\t【 成 】 (활용: 成功, 完成)\t활용 한자어: 성공(成功), 완성(完成)", "歲\t해 세\t【 歲 】 (활용: 歲月, 年歲)\t활용 한자어: 세월(歲月), 연세(年歲)", "春\t봄 춘\t【 春 】 (활용: 春分, 青春)\t활용 한자어: 춘분(春分), 청춘(青春)", "夏\t여름 하\t【 夏 】 (활용: 夏節期, 夏季)\t활용 한자어: 하절기(夏節期), 하계(夏季)", "東\t동녘 동\t【 東 】 (활용: 東方, 東洋)\t활용 한자어: 동방(東方), 동양(東洋)", "西\t서녘 서\t【 西 】 (활용: 西洋, 東西)\t활용 한자어: 서양(西洋), 동서(東西)", "南\t남녘 남\t【 南 】 (활용: 南方, 南北)\t활용 한자어: 남방(南方), 남북(南北)", "北\t북녘 북\t【 北 】 (활용: 北方, 敗北)\t활용 한자어: 북방(北方), 패배(敗北)", "中\t가운데 중\t【 中 】 (활용: 中心, 中央)\t활용 한자어: 중심(中心), 중앙(中央)", "外\t바깥 외\t【 外 】 (활용: 外部, 海外)\t활용 한자어: 외부(外部), 해외(海外)", "內\t안 내\t【 內 】 (활용: 內部, 國內)\t활용 한자어: 내부(內部), 국내(國內)", "上\t위 상\t【 上 】 (활용: 上下, 向上)\t활용 한자어: 상하(上下), 향상(向上)", "下\t아래 하\t【 下 】 (활용: 下流, 天下)\t활용 한자어: 하류(下流), 천하(天下)", "左\t왼 좌\t【 左 】 (활용: 左右, 左側)\t활용 한자어: 좌우(左右), 좌측(左側)", "右\t오른 우\t【 右 】 (활용: 右側, 座右銘)\t활용 한자어: 우측(右側), 좌우명(座右銘)", "前\t앞 전\t【 前 】 (활용: 前後, 前進)\t활용 한자어: 전후(前後), 전진(前進)", "後\t뒤 후\t【 後 】 (활용: 後方, 最後)\t활용 한자어: 후방(後方), 최후(最後)", "先\t먼저 선\t【 先 】 (활용: 先後, 先生)\t활용 한자어: 선후(先後), 선생(先生)", "生\t날 생\t【 生 】 (활용: 生命, 生活)\t활용 한자어: 생명(生命), 생활(生活)", "死\t죽을 사\t【 死 】 (활용: 生死, 死亡)\t활용 한자어: 생사(生死), 사망(死亡)", "老\t늙을 로\t【 老 】 (활용: 老人, 敬老)\t활용 한자어: 노인(老人), 경로(敬老)", "少\t적을 소, 젊을 소\t【 少 】 (활용: 少年, 多少)\t활용 한자어: 소년(少年), 다소(多少)", "男\t사내 남\t【 男 】 (활용: 男女, 長男)\t활용 한자어: 남녀(男女), 장남(長男)", "女\t여자 녀(여)\t【 女 】 (활용: 女性, 子女)\t활용 한자어: 여성(女性), 자녀(子女)", "父\t아비 부\t【 父 】 (활용: 父母, 父親)\t활용 한자어: 부모(父母), 부친(父親)", "母\t어미 모\t【 母 】 (활용: 母親, 母國)\t활용 한자어: 모친(母親), 모국(母國)", "兄\t형 형\t【 兄 】 (활용: 兄弟, 父兄)\t활용 한자어: 형제(兄弟), 부형(父兄)", "弟\t아우 제\t【 弟 】 (활용: 弟子, 子弟)\t활용 한자어: 제자(弟子), 자제(子弟)", "姉\t손위누이 자\t【 姉 】 (활용: 姉妹)\t활용 한자어: 자매(姉妹)", "妹\t손아래누이 매\t【 妹 】 (활용: 姉妹, 男妹)\t활용 한자어: 자매(姉妹), 남매(男妹)", "夫\t지아비 부\t【 夫 】 (활용: 夫婦, 農夫)\t활용 한자어: 부부(夫婦), 농부(農夫)", "婦\t며느리 부, 아내 부\t【 婦 】 (활용: 婦人, 主婦)\t활용 한자어: 부인(婦人), 주부(主婦)", "子\t아들 자\t【 子 】 (활용: 君子)\t활용 한자어: 자식( 자식), 군자(君子)", "孫\t손자 손\t【 孫 】 (활용: 子孫, 後孫)\t활용 한자어: 자손(子孫), 후손(後孫)", "祖\t할아비 조\t【 祖 】 (활용: 祖上, 祖國)\t활용 한자어: 조상(祖上), 조국(祖國)", "宗\t마루 종\t【 宗 】 (활용: 宗家, 宗敎)\t활용 한자어: 종가(宗家), 종교(宗敎)", "族\t겨레 족\t【 族 】 (활용: 家族, 民族)\t활용 한자어: 가족(家族), 민족(民族)", "親\t어버이 친, 친할 친\t【 親 】 (활용: 親戚, 親切)\t활용 한자어: 친척(親戚), 친절(親切)", "友\t벗 우\t【 友 】 (활용: 友情, 親舊)\t활용 한자어: 우정(友情), 친구(親舊)", "朋\t벗 붕\t【 朋 】 (활용: 朋友, 朋黨)\t활용 한자어: 붕우(朋友), 붕당(朋黨)", "主\t주인 주\t【 主 】 (활용: 主人, 民主)\t활용 한자어: 주인(主人), 민주(民主)", "客\t손 객\t【 客 】 (활용: 顧客, 乘客)\t활용 한자어: 고객(顧客), 승객(乘客)", "君\t임금 군\t【 君 】 (활용: 君主, 聖君)\t활용 한자어: 군주(君主), 성군(聖君)", "臣\t신하 신\t【 臣 】 (활용: 忠臣, 君臣)\t활용 한자어: 충신(忠臣), 군신(君臣)", "民\t백성 민\t【 民 】 (활용: 國民, 市民)\t활용 한자어: 국민(國民), 시민(市民)", "王\t임금 왕\t【 王 】 (활용: 國王, 王朝)\t활용 한자어: 국왕(國王), 왕조(王朝)", "皇\t임금 황\t【 皇 】 (활용: 皇帝, 皇室)\t활용 한자어: 황제(皇帝), 황실(皇室)", "帝\t임금 제\t【 帝 】 (활용: 帝國, 皇帝)\t활용 한자어: 제국(帝國), 황제(皇帝)", "國\t나라 국\t【 國 】 (활용: 國家, 愛國)\t활용 한자어: 국가(國家), 애국(愛國)", "家\t집 가\t【 家 】 (활용: 家庭, 專門家)\t활용 한자어: 가정(家庭), 전문가(專門家)", "鄕\t시골 향\t【 鄕 】 (활용: 故鄕, 鄕土)\t활용 한자어: 고향(故鄕), 향토(鄕土)", "村\t마을 촌\t【 村 】 (활용: 農村, 村落)\t활용 한자어: 농촌(農村), 촌락(村落)", "里\t마을 리, 이수 리\t【 里 】 (활용: 鄕里, 千里)\t활용 한자어: 향리(鄕里), 천리(千里)", "읍\t고을 읍\t【 읍 】 (활용: 邑內, 都邑)\t활용 한자어: 읍내(邑內), 도읍(都邑)", "都\t도읍 도, 모두 도\t【 都 】 (활용: 都市, 首都)\t활용 한자어: 도시(都市), 수도(首都)", "市\t저자 시\t【 市 】 (활용: 市場, 市民)\t활용 한자어: 시장(市場), 시민(市民)", "京\t서울 경\t【 京 】 (활용: 上京, 京城)\t활용 한자어: 상경(上京), 경성(京城)", "城\t재 성\t【 城 】 (활용: 城郭, 山城)\t활용 한자어: 성곽(城郭), 산성(山城)", "宮\t집 궁\t【 宮 】 (활용: 宮闕, 王宮)\t활용 한자어: 궁궐(宮闕), 왕궁(王宮)", "殿\t큰집 전\t【 殿 】 (활용: 宮殿, 殿下)\t활용 한자어: 궁전(宮殿), 전하(殿下)", "堂\t집 당\t【 堂 】 (활용: 講堂, 敬老堂)\t활용 한자어: 강당(講堂), 경로당(敬老堂)", "室\t집 실\t【 室 】 (활용: 敎室, 室內)\t활용 한자어: 교실(敎室), 실내(室內)", "屋\t집 옥\t【 屋 】 (활용: 家屋, 屋上)\t활용 한자어: 가옥(家屋), 옥상(屋上)", "門\t문 문\t【 門 】 (활용: 正門, 家門)\t활용 한자어: 정문(正門), 가문(家門)", "戶\t지게 호\t【 戶 】 (활용: 戶口, 門戶)\t활용 한자어: 호구(戶口), 문호(門戶)", "窓\t창 창\t【 窓 】 (활용: 窓門, 同窓)\t활용 한자어: 창문(窓門), 동창(同窓)", "墻\t담 장\t【 墻 】 (활용: 牆壁)\t활용 한자어: 담장(牆壁)", "庭\t뜰 정\t【 庭 】 (활용: 庭園, 家庭)\t활용 한자어: 정원(庭園), 가정(家庭)", "道\t길 도, 도리 도\t【 道 】 (활용: 道路, 道德)\t활용 한자어: 도로(道路), 도덕(道德)", "路\t길 로\t【 路 】 (활용: 徑路, 街路)\t활용 한자어: 경로(徑路), 가로(街路)", "街\t거리 가\t【 街 】 (활용: 市街地)\t활용 한자어: 시가지(市街地), 거리", "橋\t다리 교\t【 橋 】 (활용: 橋梁, 陸橋)\t활용 한자어: 교량(橋梁), 육교(陸橋)", "車\t수레 차(거)\t【 車 】 (활용: 自動車, 停車場)\t활용 한자어: 자동차(自動車), 정거장(停車場)", "船\t배 선\t【 船 】 (활용: 船舶, 漁船)\t활용 한자어: 선박(船舶), 어선(漁船)", "舟\t배 주\t【 舟 】 (활용: 舟船, 一葉片舟)\t활용 한자어: 주선(舟船), 일엽편주(一葉片舟)", "馬\t말 마\t【 馬 】 (활용: 騎馬, 馬車)\t활용 한자어: 기마(騎馬), 마차(馬車)", "牛\t소 우\t【 牛 】 (활용: 牛乳, 韓牛)\t활용 한자어: 우유(牛乳), 한우(韓牛)", "羊\t양 양\t【 羊 】 (활용: 羊毛, 綿羊)\t활용 한자어: 양모(羊毛), 면양(綿羊)", "犬\t개 견\t【 犬 】 (활용: 愛犬, 犬公)\t활용 한자어: 애견(愛犬), 견공(犬公)", "鷄\t닭 계\t【 鷄 】 (활용: 鷄卵, 養鷄)\t활용 한자어: 계란(鷄卵), 양계(養鷄)", "豚\t돼지 돈\t【 豚 】 (활용: 養豚, 豚肉)\t활용 한자어: 양돈(養豚), 돈육(豚肉)", "鳥\t새 조\t【 鳥 】 (활용: 鳥類, 白鳥)\t활용 한자어: 조류(鳥類), 백조(白鳥)", "魚\t물고기 어\t【 魚 】 (활용: 魚類, 漁夫)\t활용 한자어: 어류(魚類), 어부(漁夫)", "蟲\t벌레 충\t【 蟲 】 (활용: 昆蟲, 害蟲)\t활용 한자어: 곤충(昆蟲), 해충(害蟲)", "虎\t범 호\t【 虎 】 (활용: 猛虎)\t활용 한자어: 호랑이, 맹호(猛虎)", "龍\t용 룡(용)\t【 龍 】 (활용: 龍貌, 登龍門)\t활용 한자어: 용모(龍貌), 등용문(登龍門)", "龜\t거북 귀(구)\t【 龜 】 (활용: 龜船, 龜鑑)\t활용 한자어: 거북선(龜船), 귀감(龜鑑)", "鶴\t학 학\t【 鶴 】 (활용: 白鶴, 鶴首苦待)\t활용 한자어: 백학(白鶴), 학수고대(鶴首苦待)", "鹿\t사슴 록\t【 鹿 】 (활용: 鹿茸)\t활용 한자어: 녹용(鹿茸), 사슴", "兎\t토끼 토\t【 兎 】 (활용: 狡兎三窟)\t활용 한자어: 토끼, 교토삼굴(狡兎三窟)", "蛇\t뱀 사\t【 蛇 】 (활용: 龍頭蛇尾)\t활용 한자어: 용두사미(龍頭蛇尾)", "蠶\t누에 잠\t【 蠶 】 (활용: 養蠶, 蠶室)\t활용 한자어: 양잠(養蠶), 잠실(蠶室)", "草\t풀 초\t【 草 】 (활용: 草原, 雜草)\t활용 한자어: 초원(草原), 잡초(雜草)", "花\t꽃 화\t【 花 】 (활용: 花草, 菊花)\t활용 한자어: 화초(花草), 국화(菊花)", "華\t빛날 화\t【 華 】 (활용: 華麗, 榮華)\t활용 한자어: 화려(華麗), 영화(榮華)", "葉\t잎 엽\t【 葉 】 (활용: 落葉, 葉綠素)\t활용 한자어: 낙엽(落葉), 엽록소(葉綠素)", "根\t뿌리 근\t【 根 】 (활용: 根本, 根源)\t활용 한자어: 근본(根本), 근원(根源)", "莖\t줄기 경\t【 莖 】 (활용: 球莖)\t활용 한자어: 구경(球莖)", "枝\t가지 지\t【 枝 】 (활용: 枝葉)\t활용 한자어: 가지, 지엽(枝葉)", "實\t열매 실, 참 실\t【 實 】 (활용: 果實, 眞實)\t활용 한자어: 과실(果實), 진실(眞實)", "果\t열매 과, 결과 과\t【 果 】 (활용: 結果, 果樹)\t활용 한자어: 결과(結果), 과수(果樹)", "種\t씨 종\t【 種 】 (활용: 種子, 種類)\t활용 한자어: 종자(種子), 종류(種類)", "苗\t모 묘\t【 苗 】 (활용: 苗木, 種苗)\t활용 한자어: 묘목(苗木), 종묘(種苗)", "竹\t대 죽\t【 竹 】 (활용: 竹林, 雨後竹筍)\t활용 한자어: 죽림(竹林), 우후죽순(雨後竹筍)", "松\t소나무 송\t【 松 】 (활용: 松林)\t활용 한자어: 송림(松林), 낙락장송", "梅\t매화 매\t【 梅 】 (활용: 梅花, 梅實)\t활용 한자어: 매화(梅花), 매실(梅實)", "蘭\t난초 란\t【 蘭 】 (활용: 蘭草)\t활용 한자어: 난초(蘭草), 사군자", "菊\t국화 국\t【 菊 】 (활용: 菊花, 秋菊)\t활용 한자어: 국화(菊花), 추국(秋菊)", "米\t쌀 미\t【 米 】 (활용: 米穀, 白米)\t활용 한자어: 미곡(米穀), 백미(白米)", "麥\t보리 맥\t【 麥 】 (활용: 麥酒, 小麥)\t활용 한자어: 맥주(麥酒), 소맥(小麥)", "豆\t콩 두\t【 豆 】 (활용: 豆腐, 大豆)\t활용 한자어: 두부(豆腐), 대두(大豆)", "穀\t곡식 곡\t【 穀 】 (활용: 穀物, 五穀)\t활용 한자어: 곡물(穀物), 오곡(五穀)", "禾\t벼 화\t【 禾 】 (활용: 禾本科)\t활용 한자어: 화본과(禾本科)", "稻\t벼 도\t【 稻 】 (활용: 稻作, 水稻)\t활용 한자어: 도작(稻作), 수도(水稻)", "粟\t조 속\t【 粟 】 (활용: 滄海一粟)\t활용 한자어: 창해일속(滄海一粟)", "菜\t나물 채\t【 菜 】 (활용: 菜蔬, 野菜)\t활용 한자어: 채소(菜蔬), 야채(野菜)", "身\t몸 신\t【 身 】 (활용: 身體, 自身)\t활용 한자어: 신체(身體), 자신(自身)", "體\t몸 체\t【 體 】 (활용: 體力, 團體)\t활용 한자어: 체력(體力), 단체(團體)", "頭\t머리 두\t【 頭 】 (활용: 頭腦, 先頭)\t활용 한자어: 두뇌(頭腦), 선두(先頭)", "首\t머리 수\t【 首 】 (활용: 首相, 首都)\t활용 한자어: 수상(首相), 수도(首都)", "面\t낯 면\t【 面 】 (활용: 顔面, 表面)\t활용 한자어: 안면(顔面), 표면(表面)", "顔\t얼굴 안\t【 顔 】 (활용: 顔色, 童顔)\t활용 한자어: 안색(顔色), 동안(童顔)", "目\t눈 목\t【 目 】 (활용: 眼目, 目的)\t활용 한자어: 안목(眼目), 목적(目的)", "眼\t눈 안\t【 眼 】 (활용: 眼鏡, 眼科)\t활용 한자어: 안경(眼鏡), 안과(眼科)", "耳\t귀 이\t【 耳 】 (활용: 耳目, 中耳炎)\t활용 한자어: 이목(耳目), 중이염(中耳炎)", "鼻\t코 비\t【 鼻 】 (활용: 鼻炎)\t활용 한자어: 비염(鼻炎), 이비인후과", "口\t입 구\t【 口 】 (활용: 人口, 出入口)\t활용 한자어: 인구(人口), 출입구(出入口)", "脣\t입술 순\t【 脣 】 (활용: 口脣, 脣亡齒寒)\t활용 한자어: 구순(口脣), 순망치한(脣亡齒寒)", "齒\t이 치\t【 齒 】 (활용: 齒牙, 齒科)\t활용 한자어: 치아(齒牙), 치과(齒科)", "舌\t혀 설\t【 舌 】 (활용: 舌戰, 口舌數)\t활용 한자어: 설전(舌戰), 구설수(口舌數)", "手\t손 수\t【 手 】 (활용: 手段, 拍手)\t활용 한자어: 수단(手段), 박수(拍手)", "足\t발 족, 넉넉할 족\t【 足 】 (활용: 手足, 滿足)\t활용 한자어: 수족(手足), 만족(滿足)", "心\t마음 심\t【 心 】 (활용: 心理, 中心)\t활용 한자어: 심리(心理), 중심(中心)", "胸\t가슴 흉\t【 胸 】 (활용: 胸部)\t활용 한자어: 흉부(胸部), 도량", "腹\t배 복\t【 腹 】 (활용: 腹部, 空腹)\t활용 한자어: 복부(腹部), 공복(空腹)", "背\t등 배\t【 背 】 (활용: 背景, 背後)\t활용 한자어: 배경(背景), 배후(背後)", "骨\t뼈 골\t【 骨 】 (활용: 骨格, 氣骨)\t활용 한자어: 골격(骨格), 기골(氣骨)", "肉\t고기 육\t【 肉 】 (활용: 筋肉, 肉類)\t활용 한자어: 근육(筋肉), 육류(肉類)", "皮\t가죽 피\t【 皮 】 (활용: 皮膚, 表皮)\t활용 한자어: 피부(皮膚), 표피(表皮)", "毛\t털 모\t【 毛 】 (활용: 毛髮, 羊毛)\t활용 한자어: 모발(毛髮), 양모(羊毛)", "血\t피 혈\t【 血 】 (활용: 血液, 血統)\t활용 한자어: 혈액(血液), 혈통(血統)", "汗\t땀 한\t【 汗 】 (활용: 汗蒸, 血汗)\t활용 한자어: 한증(汗蒸), 혈한(血汗)", "淚\t눈물 루\t【 淚 】 (활용: 落淚, 血淚)\t활용 한자어: 낙루(落淚), 혈루(血淚)", "聲\t소리 성\t【 聲 】 (활용: 音聲, 名聲)\t활용 한자어: 음성(音聲), 명성(名聲)", "音\t소리 음\t【 音 】 (활용: 音樂, 發音)\t활용 한자어: 음악(音樂), 발음(發音)", "色\t빛 색\t【 色 】 (활용: 色彩, 特色)\t활용 한자어: 색채(色彩), 특색(特色)", "形\t모양 형\t【 形 】 (활용: 形態, 形式)\t활용 한자어: 형태(形態), 형식(形式)", "影\t그림자 영\t【 影 】 (활용: 影響, 撮影)\t활용 한자어: 영향(影響), 촬영(撮影)", "光\t빛 광\t【 光 】 (활용: 光線, 榮光)\t활용 한자어: 광선(光線), 영광(榮光)", "明\t밝을 명\t【 明 】 (활용: 明朗, 說明)\t활용 한자어: 명랑(明朗), 설명(說明)", "暗\t어두울 암\t【 暗 】 (활용: 暗黑, 暗示)\t활용 한자어: 암흑(暗黑), 암시(暗示)", "白\t흰 백\t【 白 】 (활용: 白色, 潔白)\t활용 한자어: 백색(白色), 결백(潔白)", "黑\t검을 흑\t【 黑 】 (활용: 黑白, 黑夜)\t활용 한자어: 흑백(黑白), 흑야(黑夜)", "赤\t붉을 적\t【 赤 】 (활용: 赤色, 赤道)\t활용 한자어: 적색(赤色), 적도(赤道)", "紅\t붉을 홍\t【 紅 】 (활용: 紅茶)\t활용 한자어: 홍차(紅茶), 단풍", "靑\t푸를 청\t【 靑 】 (활용: 靑年, 靑春)\t활용 한자어: 청년(靑年), 청춘(靑春)", "綠\t푸를 록\t【 綠 】 (활용: 綠色, 新綠)\t활용 한자어: 녹색(綠色), 신록(新綠)", "藍\t쪽 람\t【 藍 】 (활용: 藍色, 靑出於藍)\t활용 한자어: 남색(藍色), 청출어람(靑出於藍)", "黃\t누렇다 황\t【 黃 】 (활용: 黃金, 黃砂)\t활용 한자어: 황금(黃金), 황사(黃砂)", "紫\t자주 자\t【 紫 】 (활용: 紫外線, 紫色)\t활용 한자어: 자외선(紫外線), 자색(紫色)", "朱\t붉을 주\t【 朱 】 (활용: 朱紅)\t활용 한자어: 주홍(朱紅), 근묵자흑", "灰\t재 회\t【 灰 】 (활용: 灰色, 石灰)\t활용 한자어: 회색(灰色), 석회(石灰)", "素\t희다 소, 바탕 소\t【 素 】 (활용: 素朴, 要素)\t활용 한자어: 소박(素朴), 요소(要素)", "玄\t검을 현\t【 玄 】 (활용: 玄關, 玄米)\t활용 한자어: 현관(玄關), 현미(玄米)", "一\t한 일\t【 一 】 (활용: 第一, 統一)\t활용 한자어: 제일(第一), 통일(統一)", "二\t두 이\t【 二 】 (활용: 二重, 第二)\t활용 한자어: 이중(二重), 제이(第二)", "三\t석 삼\t【 三 】 (활용: 三國, 三角)\t활용 한자어: 삼국(三國), 삼각(三角)", "四\t넉 사\t【 四 】 (활용: 四方, 四季節)\t활용 한자어: 사방(四方), 사계절(四季節)", "五\t다섯 오\t【 五 】 (활용: 五感, 五穀)\t활용 한자어: 오감(五感), 오곡(五穀)", "六\t여섯 륙(육)\t【 六 】 (활용: 六十, 大陸)\t활용 한자어: 육십(六十), 대륙(大陸)", "七\t일곱 칠\t【 七 】 (활용: 七夕)\t활용 한자어: 칠석(七夕), 북두칠성", "八\t여덟 팔\t【 八 】 (활용: 八方, 八道)\t활용 한자어: 팔방(八方), 팔도(八道)", "九\t아홉 구\t【 九 】 (활용: 九死一生)\t활용 한자어: 구사일생(九死一生)", "十\t열 십\t【 十 】 (활용: 十分, 十字)\t활용 한자어: 십분(十分), 십자(十字)", "百\t일백 백\t【 百 】 (활용: 百姓)\t활용 한자어: 백성(百姓), 백과사전", "千\t일천 천\t【 千 】 (활용: 千萬, 千里)\t활용 한자어: 천만(千萬), 천리(千里)", "萬\t일만 만\t【 萬 】 (활용: 萬物, 萬歲)\t활용 한자어: 만물(萬物), 만세(萬歲)", "億\t억 억\t【 億 】 (활용: 億萬)\t활용 한자어: 억만(億萬)", "半\t반 반\t【 半 】 (활용: 折半, 半島)\t활용 한자어: 절반(折半), 반도(半島)", "雙\t둘 쌍\t【 雙 】 (활용: 無雙)\t활용 한자어: 쌍둥이, 무쌍(無雙)", "大\t큰 대\t【 大 】 (활용: 大型, 大學)\t활용 한자어: 대형(大型), 대학(大學)", "小\t작을 소\t【 小 】 (활용: 小型, 縮小)\t활용 한자어: 소형(小型), 축소(縮小)", "多\t많을 다\t【 多 】 (활용: 多數, 多樣)\t활용 한자어: 다수(多數), 다양(多樣)", "高\t높을 고\t【 高 】 (활용: 高度, 最高)\t활용 한자어: 고도(高度), 최고(最高)", "低\t낮을 저\t【 低 】 (활용: 低溫, 最低)\t활용 한자어: 저온(低溫), 최저(最低)", "長\t길 장, 어른 장\t【 長 】 (활용: 長短, 成長)\t활용 한자어: 장단(長短), 성장(成長)", "短\t짧을 단\t【 短 】 (활용: 短點, 短期)\t활용 한자어: 단점(短點), 단기(短期)", "廣\t넓을 광\t【 廣 】 (활용: 廣場, 廣告)\t활용 한자어: 광장(廣場), 광고(廣告)", "狹\t좁을 협\t【 狹 】 (활용: 狹小, 狹谷)\t활용 한자어: 협소(狹小), 협곡(狹谷)", "深\t깊을 심\t【 深 】 (활용: 深海, 深化)\t활용 한자어: 심해(深海), 심화(深化)", "淺\t얕을 천\t【 淺 】 (활용: 淺薄, 深淺)\t활용 한자어: 천박(淺薄), 심천(深淺)", "厚\t두꺼울 후\t【 厚 】 (활용: 厚德, 濃厚)\t활용 한자어: 후덕(厚德), 농후(濃厚)", "薄\t얇을 박\t【 薄 】 (활용: 薄氷, 輕薄)\t활용 한자어: 박빙(薄氷), 경박(輕薄)", "重\t무거울 중\t【 重 】 (활용: 重量, 重要)\t활용 한자어: 중량(重量), 중요(重要)", "輕\t가벼울 경\t【 輕 】 (활용: 輕量, 輕率)\t활용 한자어: 경량(輕量), 경솔(輕率)", "遠\t멀 원\t【 遠 】 (활용: 遠距離, 永遠)\t활용 한자어: 원거리(遠距離), 영원(永遠)", "近\t가까울 근\t【 近 】 (활용: 近處, 最近)\t활용 한자어: 근처(近處), 최근(最近)", "速\t빠를 속\t【 速 】 (활용: 速度, 高速)\t활용 한자어: 속도(速度), 고속(高速)", "遲\t더딜 지\t【 遲 】 (활용: 遲延, 遲刻)\t활용 한자어: 지연(遲延), 지각(遲刻)", "早\t이를 조\t【 早 】 (활용: 早期, 朝夕)\t활용 한자어: 조기(早期), 조석(朝夕)", "晩\t늦을 만\t【 晩 】 (활용: 晩年, 晩餐)\t활용 한자어: 만년(晩年), 만찬(晩餐)", "新\t새 신\t【 新 】 (활용: 新規, 革新)\t활용 한자어: 신규(新規), 혁신(革新)", "舊\t예 구\t【 舊 】 (활용: 舊式, 復舊)\t활용 한자어: 구식(舊式), 복구(復舊)", "古\t예 고\t【 古 】 (활용: 古代, 古典)\t활용 한자어: 고대(古代), 고전(古典)", "今\t이제 금\t【 今 】 (활용: 今日, 只今)\t활용 한자어: 금일(今日), 지금(只今)", "昔\t예 석\t【 昔 】 (활용: 昔日)\t활용 한자어: 석일(昔日), 금석지감", "朝\t아침 조, 조정 조\t【 朝 】 (활용: 朝夕, 王朝)\t활용 한자어: 조석(朝夕), 왕조(王朝)", "晝\t낮 주\t【 晝 】 (활용: 晝夜, 白晝)\t활용 한자어: 주야(晝夜), 백주(白晝)", "夕\t저녁 석\t【 夕 】 (활용: 夕陽, 秋夕)\t활용 한자어: 석양(夕陽), 추석(秋夕)", "夜\t밤 야\t【 夜 】 (활용: 夜間, 深夜)\t활용 한자어: 야간(夜間), 심야(深夜)", "午\t낮 오\t【 午 】 (활용: 正午, 午前)\t활용 한자어: 정오(正午), 오전(午前)", "時\t때 시\t【 時 】 (활용: 時間, 時代)\t활용 한자어: 시간(時間), 시대(時代)", "分\t나눌 분\t【 分 】 (활용: 分配, 區分)\t활용 한자어: 분배(分配), 구분(區分)", "秒\t초 초\t【 秒 】 (활용: 秒針)\t활용 한자어: 초침(秒針), 촌각", "年\t해 년(연)\t【 年 】 (활용: 年度, 靑年)\t활용 한자어: 연도(年度), 청년(靑年)", "期\t기약할 기\t【 期 】 (활용: 期間, 期待)\t활용 한자어: 기간(期間), 기대(期待)"], "history": ["주먹도끼\t주먹도끼\t\t아슐리안형 양면 핵석기로 연천 전곡리에서 출토되어 동아시아 구석기 연구사를 바꾼 뗀석기", "슴베찌르개\t슴베찌르개\t\t자루에 묶어 창처럼 사냥에 사용한 후기 구석기의 대표적인 뗀석기", "찍개\t찍개\t\t자갈돌의 한쪽 끝을 깨뜨려 날을 만든 전기 구석기의 사냥·조리 도구", "긁개\t긁개\t\t짐승의 가죽을 벗기거나 나무를 다듬을 때 사용한 격지 석기", "밀개\t밀개\t\t뼈나 나무를 대패처럼 밀어서 다듬는 데 사용한 후기 구석기 도구", "연천 전곡리 유적\t연천 전곡리 유적\t\t한탄강 유역에서 아슐리안형 양면 핵석기가 최초로 발견된 전기 구석기 유적지", "공주 석장리 유적\t공주 석장리 유적\t\t금강 유역에서 남한 최초로 발굴 조사된 전기~후기 구석기 층위 유적지", "단양 수양개 유적\t단양 수양개 유적\t\t남한강 유역에서 석기 제작소와 물고기 모양 예술품이 출토된 후기 구석기 유적지", "청원 두루봉 동굴\t청원 두루봉 동굴\t\t어린이 인골 화석과 동굴곰 뼈가 발굴된 구석기 시대 동굴 유적", "상원 검은모루 동굴\t상원 검은모루 동굴\t\t평양 인근에서 발견된 한반도 최고(最古) 시기의 전기 구석기 동굴 유적", "단양 금굴 유적\t단양 금굴 유적\t\t전기부터 후기까지의 구석기 문화층이 고루 확인된 충북 지역의 동굴 유적", "동굴과 막집\t동굴과 막집\t\t구석기인들이 무리 지어 이동 생활을 하며 추위와 맹수를 피하던 주요 거주 형태", "빗살무늬 토기\t빗살무늬 토기\t\t강가나 바닷가 유적에서 주로 출토되며 뾰족하거나 둥근 바닥에 선 무늬를 새긴 대표 토기", "이른 민무늬 토기\t이른 민무늬 토기\t\t신석기 초기 동해안과 남해안 유적에서 출토되는 무늬 없는 고대 토기", "덧무늬 토기\t덧무늬 토기\t\t아가리 부분에 진흙 띠를 덧붙여 무늬를 낸 신석기 전기의 대표 토기", "눌러찍기무늬 토기\t눌러찍기무늬 토기\t\t토기 표면을 도구나 손톱으로 눌러 찍어 장식한 신석기 시대의 토기", "가락바퀴\t가락바퀴\t\t가운데 구멍에 막대를 꽂아 회전시키며 실을 뽑던 원시 수공업 도구", "뼈바늘\t뼈바늘\t\t동물의 뼈를 갈아 구멍을 뚫어 그물이나 옷을 깁는 데 사용한 바늘", "갈돌과 갈판\t갈돌과 갈판\t\t도토리나 곡식의 껍질을 벗기고 가루로 빻는 데 사용한 간석기 조리 도구", "결합식 작살\t결합식 작살\t\t돌과 뼈를 묶어 큰 물고기를 잡는 데 사용한 신석기 시대의 어로 도구", "조개더미 패총\t조개더미 패총\t\t신석기·철기 시대 바닷가 사람들이 먹고 버린 조개껍데기가 쌓인 생활 쓰레기 유적", "서울 암사동 유적\t서울 암사동 유적\t\t한강 유역에서 원형 움집터와 뾰족 밑 토기가 대량 발굴된 대표 유적지", "부산 동삼동 유적\t부산 동삼동 유적\t\t남해안에서 조개껍데기 가면과 외래 흑요석 교류 흔적이 출토된 패총 유적지", "양양 오산리 유적\t양양 오산리 유적\t\t동해안에서 흙으로 구운 얼굴 모양 토우와 집터가 발굴된 초기 유적지", "제주 고산리 유적\t제주 고산리 유적\t\t한반도에서 가장 이른 시기의 토기와 타제 석기가 출토된 제주 서부 유적지", "봉산 지탑리 유적\t봉산 지탑리 유적\t\t불에 탄 탄화 조(좁쌀)가 발견되어 잡곡 농경의 시작을 입증한 유적지", "애니미즘\t애니미즘\t\t태양, 물, 나무 등 자연물에도 영혼이 깃들어 있다고 믿은 원시 신앙", "샤머니즘\t샤머니즘\t\t무당(샤먼)이 하늘과 인간을 연결하여 재앙을 물리친다고 믿은 주술 신앙", "토테미즘\t토테미즘\t\t곰이나 호랑이 등 특정 동식물을 부족의 시조나 수호신으로 숭배한 신앙", "조개껍데기 가면\t조개껍데기 가면\t\t부산 영도 패총에서 출토된 사람의 눈과 입 모양을 뚫은 예술 유물", "민무늬 토기\t민무늬 토기\t\t겉면에 무늬가 없고 밑이 평평하여 저장과 조리에 쓰인 청동기 대표 토기", "미송리식 토기\t미송리식 토기\t\t양쪽에 손잡이가 달리고 목이 잘록하여 고조선의 세력 범위를 보여주는 토기", "붉은간 토기\t붉은간 토기\t\t표면에 산화철을 발라 매끄럽게 갈아 제사 의식용으로 사용한 토기", "가지무늬 토기\t가지무늬 토기\t\t검은색 가지 모양 그림을 그려 넣은 청동기 시대의 특수 채색 토기", "비파형 동검\t비파형 동검\t\t칼몸 아래쪽이 볼록하여 비파 악기를 닮았으며 고조선 세력권을 알려주는 청동 검", "거친무늬 거울\t거친무늬 거울\t\t뒷면에 굵은 기하학적 선을 새기고 꼭지가 두 개 달린 전기 청동 거울", "반달돌칼\t반달돌칼\t\t곡식의 이삭을 따서 수확할 때 손가락에 끈을 끼워 사용한 반달 모양 간석기", "홈자귀\t홈자귀\t\t나무를 찍거나 다듬기 위해 몸체에 홈을 파서 자루에 묶은 간석기 공구", "바퀴날도끼\t바퀴날도끼\t\t가운데 구멍을 뚫고 가장자리를 톱니바퀴처럼 깎아 만든 권위 상징용 돌도끼", "탁자식 고인돌\t탁자식 고인돌\t\t판석 여러 개를 땅 위에 세우고 큰 덮개돌을 얹은 북방식 지배자 무덤", "바둑판식 고인돌\t바둑판식 고인돌\t\t땅속에 돌방을 만들고 작은 받침돌 위에 거대한 덮개돌을 얹은 남방식 무덤", "돌널무덤\t돌널무덤\t\t판판한 돌을 상자 모양으로 짜 맞추어 시신과 부장품을 안치한 무덤", "부여 송국리 유적\t부여 송국리 유적\t\t타원형 구덩이가 있는 집터와 벼농사 흔적이 대규모로 발굴된 충남 유적지", "여주 흔암리 유적\t여주 흔암리 유적\t\t탄화된 쌀·보리·조·수수 등 오곡이 출토되어 벼농사 발달을 증명한 유적지", "울주 대곡리 반구대 암각화\t울주 대곡리 반구대 암각화\t\t고래와 육지 동물, 사냥 장면을 바위에 새겨 풍요를 기원한 바위그림", "고령 장기리 암각화\t고령 장기리 암각화\t\t동심원과 십자형 등 태양 신앙과 다산을 기원하는 기하학 무늬를 새긴 바위그림", "농경문 청동기\t농경문 청동기\t\t따비로 밭을 가는 남성과 항아리에 곡식을 담는 모습을 새긴 의식용 도구", "세형 동검\t세형 동검\t\t한반도 안에서 독자적인 청동기 문화가 발전했음을 보여주는 좁고 날카로운 동검", "잔무늬 거울\t잔무늬 거울\t\t뒷면에 정교하고 세밀한 선을 촘촘히 새겨 넣은 뛰어난 주조 기술의 청동 거울", "거푸집\t거푸집\t\t녹인 청동이나 철을 부어 칼이나 도끼를 대량 제작하던 돌·흙 틀", "명도전\t명도전\t\t중국 전국 시대 연나라의 칼 모양 화폐로 고조선과의 활발한 교역을 보여주는 유물", "반량전\t반량전\t\t중국 진·한 시대의 둥글고 네모난 구멍이 뚫린 화폐로 한반도 남부까지 출토된 유물", "오수전\t오수전\t\t중국 한나라 무제 때 주조되어 한반도와의 국제 무역을 증명하는 동전", "창원 다호리 유적\t창원 다호리 유적\t\t통나무 널무덤에서 붓과 오수전이 출토되어 한자 사용을 입증한 경남 유적지", "널무덤\t널무덤\t\t나무로 짠 관을 땅속에 묻고 각종 철제 무기와 칠기를 부장한 무덤 양식", "독무덤\t독무덤\t\t크고 작은 토기 항아리 두 개를 맞붙여 관으로 사용한 무덤 양식", "단군왕검\t단군왕검\t\t제정일치 사회에서 제사장(단군)과 정치적 지배자(왕검)를 아울러 부르던 칭호", "8조법\t8조법\t\t살인자 처형, 상해자 곡물 배상, 절도자 노비 전락 등을 규정한 고대 사회 법률", "번한과 진번\t번한과 진번\t\t고조선 후기 주변에 위치하며 한사군 설치 이전 철기 문화를 공유한 지역 세력", "부왕과 준왕\t부왕과 준왕\t\t기원전 3세기경 고조선에서 왕위를 세습하며 상·대부·박사 관직을 두었던 국왕들", "위만조선\t위만조선\t\t기원전 194년 중국 유민 출신 세력이 왕검성을 장악하고 중계 무역으로 번영한 왕조", "왕검성\t왕검성\t\t한나라 무제의 침입에 맞서 1년 동안 결사항전을 벌였던 고조선의 수도", "부여 사출도\t부여 사출도\t\t왕이 중앙을 다스리고 마가·우가·저가·구가가 네 방향의 행정 구역을 다스린 제도", "부여 영고\t부여 영고\t\t수렵 사회의 전통이 남아 매년 12월에 하늘에 제사를 지내고 죄수를 풀어준 행사", "순장 풍습\t순장 풍습\t\t지배자가 죽으면 거느리던 노비나 시종, 수레와 물건을 함께 무덤에 묻던 장례 관습", "형사취수제\t형사취수제\t\t형이 죽으면 동생이 형수를 아내로 삼아 가족 노동력과 재산을 유지하던 혼인 풍습", "1책 12법\t1책 12법\t\t남의 물건을 훔치면 그 가치의 12배를 배상하게 한 고대 연맹 왕국의 엄격한 형벌", "제가회의\t제가회의\t\t고구려의 대가들이 모여 국가의 중대사와 사형수 처벌을 결정하던 귀족 회의", "서옥제\t서옥제\t\t신부 집 뒤뜰에 작은 사위 집을 지어 자식이 장성할 때까지 머물다 돌아오던 혼인 풍습", "고구려 동맹\t고구려 동맹\t\t매년 10월 추수를 마치고 국동대혈에 모여 주몽과 유화부인에게 제사 지낸 행사", "부경\t부경\t\t고구려 지배층이 약탈물과 곡식을 저장하기 위해 집집마다 지었던 작은 창고", "옥저 민며느리제\t옥저 민며느리제\t\t어린 여자아이를 미리 시집에 데려다 길러 성인이 되면 혼인시키던 매매혼 풍습", "가족 공동묘 골장제\t가족 공동묘 골장제\t\t시신을 가매장하여 뼈만 추린 뒤 큰 나무 곽 하나에 가족을 함께 안치한 장례법", "동예 무천\t동예 무천\t\t매년 10월 하늘에 제사를 지내며 밤낮으로 술 마시고 노래하고 춤추던 제천 행사", "동예 책화\t동예 책화\t\t부족 간의 경계를 엄격히 지켜 다른 부족의 영역을 침범하면 노비나 소·말로 배상한 풍습", "단궁과 과하마\t단궁과 과하마\t\t동예 지역에서 생산되어 중국에까지 널리 알려졌던 작은 활과 키 작은 말 특산물", "삼한 신지와 읍차\t삼한 신지와 읍차\t\t마한·진한·변한의 크고 작은 소국을 다스리던 정치적 지배자의 칭호", "천군과 소도\t천군과 소도\t\t삼한에서 하늘에 제사를 지내던 제사장과 죄인이 도망쳐도 잡아가지 못한 신성 구역", "5월 수릿날과 10월 계절제\t5월 수릿날과 10월 계절제\t\t삼한의 농경 주기에 맞추어 씨뿌리기 후와 추수 후에 두 차례 지낸 제천 행사", "동명성왕 주몽\t동명성왕 주몽\t\t부여에서 남하하여 졸본 지역의 토착 세력과 결합해 기원전 37년 나라를 세운 시조", "유리왕 국내성 천도\t유리왕 국내성 천도\t\t기원후 3년 졸본에서 압록강변의 교통·방어 요충지로 수도를 옮긴 정책", "태조왕 옥저 정복\t태조왕 옥저 정복\t\t1세기 후반 동해안 방면으로 진출하여 해산물과 소금 공납을 확보한 정복 활동", "고국천왕 진대법\t고국천왕 진대법\t\t국상 을파소의 건의로 봄에 곡식을 빌려주고 가을에 갚게 한 빈민 구제 제도", "을파소\t을파소\t\t유리왕 대의 명재상 이후 고국천왕 때 압록강변 농부에서 국상으로 발탁된 정치가", "동천왕\t동천왕\t\t위나라 관구검의 침입으로 환도성이 함락되는 시련을 겪고 서안평을 공격한 국왕", "미천왕 낙랑군 축출\t미천왕 낙랑군 축출\t\t313년 대동강 유역에 남아 있던 중국 군현 세력을 몰아내고 영토를 확장한 업적", "고국원왕\t고국원왕\t\t전연 모용황의 침입과 백제 근초고왕의 평양성 공격으로 전사하며 국가 위기를 겪은 국왕", "소수림왕 태학 설립\t소수림왕 태학 설립\t\t전진으로부터 불교를 수용하고 율령을 반포하며 유학 교육 기관을 세운 체제 정비", "광개토대왕 영락 연호\t광개토대왕 영락 연호\t\t독자적 천하관을 바탕으로 자주적 연호를 사용하고 만주와 한강 이북을 정복한 군주", "신라 구원 출병\t신라 구원 출병\t\t400년 보병과 기병 5만을 보내 신라에 침입한 왜와 가야 연합 세력을 격퇴한 사건", "호우명 그릇\t호우명 그릇\t\t경주 호우총에서 출토되어 5세기 초 고구려의 대신라 영향력을 보여주는 청동 용기", "장수왕 평양 천도\t장수왕 평양 천도\t\t427년 귀족 세력을 약화시키고 한반도 남쪽으로 진출하기 위해 단행한 수도 이전", "충주 고구려비\t충주 고구려비\t\t남한강 유역까지 진출하여 신라를 압박했음을 보여주는 남한 유일의 고구려 석비", "문자명왕 부여 복속\t문자명왕 부여 복속\t\t494년 북방의 잔존 세력을 완전히 병합하여 고구려 최대 판도를 완성한 국왕", "영양왕 살수대첩\t영양왕 살수대첩\t\t612년 수 양제의 113만 대군을 청천강 유역에서 크게 물리친 구국 승첩", "을지문덕\t을지문덕\t\t수나라 우중문에게 여수장우중문시를 보내 적을 유인하고 대승을 거둔 명장", "천리장성 축조\t천리장성 축조\t\t당나라의 침입에 대비하여 부여성에서 비사성까지 16년에 걸쳐 쌓은 국경 방어 성곽", "연개소문\t연개소문\t\t642년 영류왕과 귀족들을 제거하고 대막리지에 올라 대당 강경책을 펼친 집권자", "안시성 전투\t안시성 전투\t\t645년 당 태종의 대군을 성주와 백성이 일치단결하여 88일간 막아낸 방어전", "고구려 경당\t고구려 경당\t\t지방에 설치되어 평민과 미혼 자제들에게 한학과 활쏘기 무예를 함께 가르친 교육 기관", "광개토대왕릉비\t광개토대왕릉비\t\t장수왕이 414년 부왕의 정복 업적과 건국 신화를 기록하여 집안에 세운 거대 비석", "장군총\t장군총\t\t만주 집안 지역에 위치한 계단식 피라미드 형태의 대표적인 초기 돌무지무덤", "무용총 수렵도\t무용총 수렵도\t\t굴식 돌방무덤 벽화로 말을 타고 활을 쏘며 호랑이와 사슴을 사냥하는 역동적 그림", "강서대묘 사신도\t강서대묘 사신도\t\t무덤 방 네 벽에 청룡·백호·주작·현무를 생동감 있게 그린 후기 도교 계열 고분 벽화", "연가 7년명 금동여래입상\t연가 7년명 금동여래입상\t\t경남 의령에서 출토된 광배 뒷면에 고구려 연호와 평양 제작 기록이 새겨진 불상", "온조왕 위례성 건국\t온조왕 위례성 건국\t\t기원전 18년 한강 유역 토착 세력과 결합하여 십제를 세우고 국가 기틀을 마련한 시조", "고이왕 6좌평 16관등\t고이왕 6좌평 16관등\t\t3세기 중엽 한강 유역을 장악하고 중앙 관제와 관리 복색 및 율령을 정비한 국왕", "근초고왕\t근초고왕\t\t4세기 중엽 마한 전역을 병합하고 고구려 평양성을 공격해 전성기를 이룬 정복 군주", "아직기와 왕인\t아직기와 왕인\t\t왜에 건너가 천자문과 논어를 전수하여 일본 아스카 문화 성립에 기여한 학자들", "고흥 서기 편찬\t고흥 서기 편찬\t\t4세기 후반 백제의 왕실 계보와 국력을 과시하기 위해 편찬한 역사서", "침류왕 불교 공인\t침류왕 불교 공인\t\t384년 동진에서 온 인도 승려 마라난타를 통해 불교를 공식 수용한 사건", "비유왕 나제동맹\t비유왕 나제동맹\t\t433년 장수왕의 남진 정책에 공동 대응하기 위해 신라 눌지마립간과 맺은 동맹", "개로왕 한성 함락\t개로왕 한성 함락\t\t475년 북위에 국서를 보냈으나 고구려 장수왕의 기습 공격으로 수도를 잃은 사건", "문주왕 웅진 천도\t문주왕 웅진 천도\t\t한성 상실 직후 금강 유역의 산간 방어 요충지인 공주로 수도를 옮긴 조치", "동성왕 결혼 동맹\t동성왕 결혼 동맹\t\t493년 신라 소지마립간 시기에 이찬 비지의 딸을 왕비로 맞아 대고구려 연대를 강화한 정책", "무령왕 22담로\t무령왕 22담로\t\t지방의 요충지에 왕족을 파견하여 지방 통제를 강화하고 중국 남조 양나라와 교류한 국왕", "무령왕릉\t무령왕릉\t\t중국 남조 영향을 받은 벽돌무덤으로 지석이 발견되어 무덤 주인공이 명확히 밝혀진 공주 고분", "성왕 사비 천도\t성왕 사비 천도\t\t538년 넓은 평야와 수운이 발달한 부여로 도읍을 옮기고 국호를 남부여로 고친 중흥 정책", "22부 중앙 관청\t22부 중앙 관청\t\t사비 시대 수도 5부와 지방 5방 체제와 함께 왕실 업무와 국가 행정을 세분화한 관제", "노리사치계\t노리사치계\t\t성왕 때 일본에 불경과 불상을 전파하여 왜의 불교 수용에 결정적 역할을 한 인물", "관산성 전투\t관산성 전투\t\t554년 한강 하류 유역을 둘러싸고 신라 진흥왕과 벌인 전투에서 성왕이 전사한 사건", "무왕 미륵사 창건\t무왕 미륵사 창건\t\t7세기 초 익산에 왕궁리 유적과 함께 동양 최대 규모의 3원 3탑 가람을 세운 사업", "의자왕 대야성 함락\t의자왕 대야성 함락\t\t642년 신라 서부 전선의 핵심 요충지를 포함한 40여 성을 빼앗아 기세를 올린 군사 행동", "계백 황산벌 전투\t계백 황산벌 전투\t\t660년 신라 김유신의 5만 대군에 맞서 5천 결사대로 네 차례 승리하며 끝까지 싸운 전투", "흑치상지 임존성\t흑치상지 임존성\t\t백제 멸망 직후 복신·도침의 주류성과 함께 유민들을 모아 당군에 맞선 부흥 운동 거점", "백강 전투\t백강 전투\t\t663년 백제 부흥군과 왜의 수군 연합이 나당 연합군과 금강 하구에서 벌인 최후의 해전", "칠지도\t칠지도\t\t근초고왕 시기 백제 왕이 왜왕에게 하사하여 양국의 상하 교류 관계를 보여주는 일곱 가지 철검", "백제 금동대향로\t백제 금동대향로\t\t부여 능산리 절터에서 출토된 도교의 신선 사상과 불교의 연꽃·봉황이 조화된 예술 걸작", "미륵사지 석탑\t미륵사지 석탑\t\t목조 탑의 건축 양식을 화강암으로 재현한 현존하는 우리나라 최고(最古)·최대의 석탑", "정림사지 5층석탑\t정림사지 5층석탑\t\t부여에 남아 있는 백제 특유의 단정하고 우아한 비례미를 보여주는 대표 석탑", "서산 용현리 마애여래삼존상\t서산 용현리 마애여래삼존상\t\t빛의 각도에 따라 달라지는 온화하고 자비로운 백제의 미소가 새겨진 바위 불상", "사택지적비\t사택지적비\t\t백제 귀족이 노년에 절을 세우며 인생의 무상함을 세련된 사륙변려체로 기록한 비석", "공주 송산리 6호분\t공주 송산리 6호분\t\t중국 남조 영향을 받아 벽돌을 쌓고 사신도를 그린 무령왕릉 인근의 고분", "박혁거세 거서간\t박혁거세 거서간\t\t기원전 57년 경주 6촌 세력의 추대로 사로국을 건국한 시조", "석탈해 이사금\t석탈해 이사금\t\t철기 제작 기술을 가진 이주민 집단이 박씨·김씨와 함께 왕위를 교대로 차지한 시기", "내물마립간\t내물마립간\t\t4세기 후반 김씨의 왕위 세습권을 확립하고 대군장을 뜻하는 왕호를 사용한 국왕", "눌지마립간\t눌지마립간\t\t고구려의 간섭에서 벗어나 백제와 동맹을 맺고 부자 상속제를 확립한 국왕", "지증왕 우산국 복속\t지증왕 우산국 복속\t\t512년 이사부 장군을 보내 울릉도와 독도 지역을 신라 영토로 편입한 업적", "순장 금지와 우경 보급\t순장 금지와 우경 보급\t\t지증왕 대에 노동력 확보를 위해 악습을 폐지하고 소를 이용한 깊은 갈이를 장려한 정책", "법흥왕 율령 반포\t법흥왕 율령 반포\t\t520년 17관등과 백관의 공복을 제정하고 골품제 사회 질서를 법제화한 국왕", "이차돈 순교\t이차돈 순교\t\t527년 귀족들의 반대를 극복하고 신라에서 불교가 공인되는 계기가 된 사건", "건원 연호와 병부 설치\t건원 연호와 병부 설치\t\t법흥왕이 자주적 연호를 사용하고 군사권을 장악하기 위해 중앙 군사 기구를 둔 조치", "금관가야 병합\t금관가야 병합\t\t532년 김해 지역의 김구해 왕실이 신라에 투항하여 진골 귀족으로 편입된 사건", "진흥왕 화랑도 개편\t진흥왕 화랑도 개편\t\t원시 청소년 집단을 국가적 인재 양성 조직으로 개편하여 삼국 통일의 원동력으로 삼은 정책", "단양 신라 적성비\t단양 신라 적성비\t\t진흥왕이 고구려 영토였던 남한강 상류로 진출하면서 주민 회유를 위해 세운 비석", "순수비 4기\t순수비 4기\t\t진흥왕이 한강 유역과 함경도까지 영토를 넓힌 뒤 창녕·북한산·황초령·마운령에 세운 비석", "거칠부 국사 편찬\t거칠부 국사 편찬\t\t545년 진흥왕의 명으로 신라의 발전상을 정리하여 왕권을 높인 역사서", "대가야 정복\t대가야 정복\t\t562년 이사부와 사다함이 고령 지역의 가야 연맹 맹주를 복속시켜 낙동강 서쪽을 장악한 사건", "원광 법사 세속오계\t원광 법사 세속오계\t\t사군이충·사친이효·교우이신·임전무퇴·살생유택의 화랑 행동 규범을 제시한 승려", "진평왕\t진평왕\t\t위화부를 비롯한 중앙 행정 기구를 대폭 확충하고 수·당과 활발히 외교를 펼친 국왕", "선덕여왕 첨성대\t선덕여왕 첨성대\t\t경주에 천문 관측 기구를 세우고 분황사와 황룡사 9층 목탑을 건립한 신라 최초의 여왕", "진덕여왕\t진덕여왕\t\t김춘추를 당나라에 파견하여 나당 군사 동맹을 성사시키고 집사부를 정비한 여왕", "무열왕 김춘추\t무열왕 김춘추\t\t외교 활동으로 나당 동맹을 체결하고 최초로 진골 출신으로 왕위에 오른 군주", "화백회의\t화백회의\t\t상대등이 의장을 맡아 국가 중대사를 만장일치제(전원 합의)로 결정하던 신라 귀족 회의", "골품제\t골품제\t\t혈연에 따라 관등 승진 상한선부터 가옥 크기와 수레까지 일상생활을 엄격히 규제한 신분제", "황룡사 9층 목탑\t황룡사 9층 목탑\t\t자장 율사의 건의로 주변 9개국의 조공과 평화를 기원하며 선덕여왕 때 세운 거대 목탑", "임신서기석\t임신서기석\t\t신라의 두 청년이 유교 경전을 3년 안에 습득하고 국가에 충성할 것을 맹세한 비석", "천마총 천마도\t천마총 천마도\t\t경주 돌무지덧널무덤에서 출토된 자작나무 껍질에 흰 말의 비상하는 모습을 그린 말다래 그림", "금관총과 호우총\t금관총과 호우총\t\t이사지왕 칼과 광개토대왕 명문 청동 그릇이 각각 발굴된 경주의 대표 고분", "김해 대성동 고분군\t김해 대성동 고분군\t\t철제 갑옷과 투구, 덩이쇠가 대량 출토되어 전기 가야 연맹을 주도한 중심지 유적", "고령 지산동 고분군\t고령 지산동 고분군\t\t산능선을 따라 대형 순장 무덤이 조성되어 후기 가야 연맹을 이끈 대가야 유적", "우륵과 가야금\t우륵과 가야금\t\t대가야 가실왕 때 12현 현악기를 만들고 신라에 망명하여 음악을 전수한 악사", "문무왕 삼국 통일\t문무왕 삼국 통일\t\t676년 매소성 전투와 기벌포 해전에서 당군을 격퇴하고 대동강~원산만 이남을 통일한 군주", "매소성 전투\t매소성 전투\t\t675년 연천 지역에서 당나라 이근행의 20만 대군을 격파하여 통일 전쟁의 승기를 잡은 전투", "기벌포 해전\t기벌포 해전\t\t676년 금강 하구에서 설인귀가 이끄는 당나라 수군을 섬멸하여 나당 전쟁을 종결한 해전", "신문왕 김흠돌의 난 진압\t신문왕 김흠돌의 난 진압\t\t장인의 모반 사건을 계기로 진골 귀족들을 대거 숙청하고 전제 왕권을 확립한 사건", "국학 설립\t국학 설립\t\t682년 유교 정치 이념을 보급하고 실무 관리를 양성하기 위해 세운 국립 최고 교육 기관", "관료전 지급과 녹읍 폐지\t관료전 지급과 녹읍 폐지\t\t신문왕이 귀족들의 농민 노동력 징발 특권을 폐지하고 조세 수취권만 지급한 토지 개혁", "9주 5소경\t9주 5소경\t\t통일 후 넓어진 영토를 효율적으로 다스리기 위해 전국을 9개 주로 나누고 지방 거점 도시를 둔 제도", "9서당 10정\t9서당 10정\t\t고구려·백제·말갈 유민까지 포함한 중앙군과 지방의 군사 거점 부대로 편성한 군사 조직", "성덕왕 정전 지급\t성덕왕 정전 지급\t\t722년 국가 재정 확보와 농민 생활 안정을 위해 일반 백성에게 토지를 나누어 준 정책", "성덕대왕 신종\t성덕대왕 신종\t\t경덕왕이 부왕의 공덕을 기리기 위해 시작하여 혜공왕 때 완성한 비천상 조각의 범종", "경덕왕 한화 정책\t경덕왕 한화 정책\t\t중앙 관청과 지방 군현의 명칭을 중국식 한자 이름으로 개편하고 국학을 태학감으로 바꾼 정책", "신라 촌락 문서\t신라 촌락 문서\t\t일본 도다이지 정창원에서 발견된 서원경 부근 4개 촌락의 인구·토지·가축·유실수 조사 문서", "혜공왕 피살\t혜공왕 피살\t\t780년 귀족들의 반란으로 피살되면서 무열왕계 직계 왕통이 끊기고 하대 혼란기가 시작된 사건", "원성왕 독서삼품과\t원성왕 독서삼품과\t\t788년 국학 학생들의 유교 경전 이해 수준을 상·중·하로 평가하여 관리로 채용한 제도", "김헌창의 난\t김헌창의 난\t\t822년 아버지 김주원이 왕위에 오르지 못한 것에 불만을 품고 웅주에서 국호를 장안이라 하며 일으킨 반란", "장보고 청해진\t장보고 청해진\t\t828년 완도에 설치하여 해적을 소탕하고 한·중·일 삼각 해상 무역을 독점한 해상 기지", "원효 대승기신론소\t원효 대승기신론소\t\t일심 사상과 화쟁 사상을 바탕으로 종파 간 대립을 융합하고 아미타 신앙을 대중화한 승려", "의상 화엄일승법계도\t의상 화엄일승법계도\t\t당나라 유학 후 부석사를 창건하고 하나가 곧 전체라는 화엄 사상을 정립한 승려", "혜초 왕오천축국전\t혜초 왕오천축국전\t\t8세기 초 인도와 중앙아시아 5개 천축국을 순례하고 기록을 남긴 신라 승려", "설총 화왕계\t설총 화왕계\t\t원효의 아들로 이두를 정리하고 꽃들의 왕인 모란에 비유하여 임금에게 바른 정치를 간언한 유학자", "강수\t강수\t\t외교 문서 작성에 뛰어나 삼국 통일 과정에서 답설인귀서 등 명문을 남긴 문장가", "김대문\t김대문\t\t화랑세기, 고승전, 한산기 등 신라 고유의 전통 문화를 기록한 진골 귀족 학자", "최치원 계원필경\t최치원 계원필경\t\t당나라 빈공과에 급제하여 황소의 난 토벌 격문을 짓고 귀국 후 시무 10여 조를 올린 6두품 학자", "도선 비보풍수설\t도선 비보풍수설\t\t신라 말 지리적 결함을 사찰이나 탑으로 보완할 수 있다는 풍수지리설을 도입한 선종 승려", "불국사 3층석탑(석가탑)\t불국사 3층석탑(석가탑)\t\t통일신라 석탑의 전형으로 해체 수리 중 세계 최고(最古) 목판 인쇄물인 무구정광대다라니경이 나온 탑", "다보탑\t다보탑\t\t불국사 대웅전 앞에 세워진 목조 건축의 화려한 기법을 화강암으로 정교하게 구현한 특수형 석탑", "석굴암 본존불\t석굴암 본존불\t\t김대성이 창건한 인공 석굴 사원으로 치밀한 수학적 비례와 숭고한 조각미를 자랑하는 불상", "대조영 동모산 건국\t대조영 동모산 건국\t\t698년 고구려 유민과 말갈족을 이끌고 천문령에서 당군을 격파한 뒤 발해를 세운 고왕", "발해 무왕 장문휴\t발해 무왕 장문휴\t\t732년 당의 산둥반도 등주를 선제공격하고 돌궐·일본과 연결하여 당·신라를 견제한 군주", "발해 문왕 상경 천도\t발해 문왕 상경 천도\t\t당과 친선 관계를 맺어 문물을 수용하고 3성 6부 체제와 주자감을 정비한 군주", "발해 선왕 해동성국\t발해 선왕 해동성국\t\t9세기 초 말갈족 대부분을 복속하고 요동과 연해주까지 5경 15부 62주의 최대 영토를 이룬 군주", "정효공주 묘\t정효공주 묘\t\t문왕의 넷째 딸 무덤으로 고구려식 모줄임천장과 불로장생을 기원하는 벽화가 그려진 벽돌무덤", "정혜공주 묘\t정혜공주 묘\t\t고구려 전통의 굴식 돌방무덤 양식에 사자상과 황상(황제) 칭호가 기록된 묘지석이 나온 고분", "발해 3성 6부\t발해 3성 6부\t\t정당성·선조성·중대성과 충·인·의·지·예·신의 명칭을 사용하여 독자적으로 운영한 중앙 관제", "이불병좌상\t이불병좌상\t\t발해 상경 용천부 절터에서 출토된 고구려 불교 미술의 전통을 계승한 두 부처 나란히 앉은 조각상", "태조 왕건\t태조 왕건\t\t918년 송악을 도읍으로 고려를 세우고 936년 후삼국을 재통일한 초대 국왕", "훈요 10조\t훈요 10조\t\t태조가 후대 왕들에게 불교 숭상, 북진 정책, 서경 중시, 차현 이남 등용 주의 등을 당부한 유훈", "사심관 제도와 기인 제도\t사심관 제도와 기인 제도\t\t신라 경순왕 김부를 경주 사심관으로 삼고 호족 자제를 개경에 머물게 한 지방 통제책", "취민유도\t취민유도\t\t태조가 백성에게 거두는 세금을 10분의 1로 낮추어 민생을 안정시킨 조세 정책", "혜종 왕규의 난\t혜종 왕규의 난\t\t태조 사후 외척 세력과 왕자들의 왕위 계승 다툼으로 일어난 정치적 내분", "광종 노비안검법\t광종 노비안검법\t\t956년 호족들이 불법으로 거느리던 노비를 조사하여 양인으로 해방시킨 왕권 강화 정책", "광종 과거제 실시\t광종 과거제 실시\t\t958년 후주 출신 쌍기의 건의를 받아들여 유교적 소양으로 신진 관료를 선발한 제도", "칭제건원\t칭제건원\t\t광종이 개경을 황도라 부르고 광덕·준풍 등의 독자적인 연호를 사용한 자주적 조치", "경종 시정전시과\t경종 시정전시과\t\t관직 복무와 인품을 기준으로 관리들에게 전지(논밭)와 시지(땔감 임야)를 지급한 토지 제도", "성종 최승로 시무 28조\t성종 최승로 시무 28조\t\t유교 정치 이념을 국정의 근본으로 삼고 불교 행사의 폐단을 줄이도록 건의한 개혁안", "12목 설치와 향리제 개편\t12목 설치와 향리제 개편\t\t성종이 지방에 외관을 처음 파견하고 토착 호족을 지방 행정 실무자로 편제한 조치", "국자감과 비서성\t국자감과 비서성\t\t성종 대에 개경에 설립된 국립 최고 유학 교육 기관과 국가 도서 관리 기관", "목종 개정전시과\t목종 개정전시과\t\t인품 기준을 없애고 오직 관직의 높낮이만을 기준으로 18등급으로 개편한 토지 제도", "서희 강동 6주\t서희 강동 6주\t\t993년 거란 소손녕의 1차 침입 때 고구려 계승 의식과 송과의 단교를 내세워 담판으로 획득한 압록강 동쪽 땅", "강감찬 귀주대첩\t강감찬 귀주대첩\t\t1019년 거란 소배압의 10만 대군을 귀주에서 섬멸하여 동북아 세력 균형을 이룬 대승", "초조대장경\t초조대장경\t\t현종 대에 거란의 침입을 부처의 힘으로 물리치기 위해 조판을 시작한 대장경", "나성 축조\t나성 축조\t\t거란 침입 이후 수도 개경 외곽을 둘러싸 방어력을 높이기 위해 쌓은 성곽", "문종 경정전시과\t문종 경정전시과\t\t현직 관리에게만 수조권을 지급하도록 개편하여 고려 전기 토지 제도를 완성한 제도", "최충 9재학당\t최충 9재학당\t\t문종 대 해동공자로 불린 문하시중 출신 학자가 세워 사학 12도 융성의 계기가 된 사립 학교", "숙종 주전도감\t숙종 주전도감\t\t의천의 건의를 받아들여 해동통보·삼한통보·활구(은병) 등 화폐를 주조한 관청", "윤관 별무반\t윤관 별무반\t\t신기군(기병)·신보군(보병)·항마군(승병)으로 편성하여 여진족을 정벌하고 동북 9성을 쌓은 특수군", "의천 해동 천태종\t의천 해동 천태종\t\t문종의 아들로 국청사를 중심으로 교종을 통합하고 교관겸수를 제창하며 속장경을 간행한 승려", "이자겸의 난\t이자겸의 난\t\t1126년 경원 이씨 문벌귀족이 척준경과 함께 왕권을 위협하며 궁궐을 불태운 사건", "묘청의 서경 천도 운동\t묘청의 서경 천도 운동\t\t1135년 풍수지리설과 칭제건원·금국정벌을 내세워 서경에서 대위국을 선포한 자주적 운동", "김부식 삼국사기\t김부식 삼국사기\t\t1145년 인종의 명으로 유교적 합리주의 사관에 입각하여 기전체로 편찬한 현존 최고(最古) 역사서", "정중부 무신정변\t정중부 무신정변\t\t1170년 문신 중심의 차별 대우와 군인전 미지급에 반발한 무신들이 정권을 장악한 사건", "망이·망소이의 난\t망이·망소이의 난\t\t1176년 공주 명학소 주민들이 특수 행정 구역의 과중한 수탈에 저항하여 일으킨 봉기", "만적의 난\t만적의 난\t\t1198년 최충헌의 사노비가 개경 북산에서 왕후장상의 씨가 따로 없다며 신분 해방을 도모한 사건", "최충헌 교정도감\t최충헌 교정도감\t\t최씨 무신 정권의 최고 집권 기구로 국정 전반과 인사·감찰권을 장악한 기구", "최우 정방과 삼별초\t최우 정방과 삼별초\t\t인사 행정을 담당하는 사적 기구와 야별초에서 분리된 좌별초·우별초·신의를군 군사 조직", "지눌 수선사 결사\t지눌 수선사 결사\t\t무신 집권기 불교계의 타락을 비판하며 순천 송광사에서 정혜쌍수와 돈오점수를 제창한 선종 운동", "요세 백련사 결사\t요세 백련사 결사\t\t강진 만덕사에서 참회와 법화 신앙을 통해 지방민과 천민까지 포용한 불교 개혁 운동", "박서 귀주성 전투\t박서 귀주성 전투\t\t1231년 몽골 1차 침입 당시 김경손과 함께 성을 끝까지 지켜낸 항전", "김윤후 처인성 전투\t김윤후 처인성 전투\t\t1232년 몽골 2차 침입 때 부곡민들과 함께 적장 살리타를 사살한 승첩", "팔만대장경(재조대장경)\t팔만대장경(재조대장경)\t\t강화도 천도 시기 몽골군 격퇴를 기원하며 16년간 판각하여 현재 해인사에 보관된 세계기록유산", "배중손 삼별초 항쟁\t배중손 삼별초 항쟁\t\t개경 환도에 반대하여 강화도에서 진도 용장성, 제주도 항파두리성으로 옮기며 끝까지 맞선 대몽 항쟁", "일연 삼국유사\t일연 삼국유사\t\t충렬왕 대 단군 건국 신화와 향가, 불교 설화를 수록하여 민족 자주의식을 고취한 역사서", "이승휴 제왕운기\t이승휴 제왕운기\t\t중국 역사와 우리 역사를 대등하게 서술하고 단군을 우리 민족의 시조로 노래한 역사 시", "상정고금예문\t상정고금예문\t\t최우 집권기 강화도에서 금속활자로 인쇄하였다는 기록이 동국이상국집에 전해지는 예법서", "직지심체요절\t직지심체요절\t\t1377년 청주 흥덕사에서 인쇄된 현존하는 세계에서 가장 오래된 금속활자본", "안향\t안향\t\t충렬왕 때 원나라에서 성리학을 고려에 최초로 도입하고 섬학전을 설치한 유학자", "만권당\t만권당\t\t충선왕이 원의 수도 연경에 세워 고려의 이제현과 원의 조맹부 등 학자들이 교류한 학문 연구소", "공민왕 전민변정도감\t공민왕 전민변정도감\t\t승려 신돈을 판사로 임명하여 권문세족이 불법으로 빼앗은 토지와 노비를 원래대로 돌려준 개혁 기구", "쌍성총관부 수복\t쌍성총관부 수복\t\t1356년 공민왕이 무력으로 철령 이북의 옛 영토를 원나라로부터 되찾은 사건", "문익점 목화 전래\t문익점 목화 전래\t\t공민왕 때 원나라에서 목화씨를 가져와 정천익과 함께 재배·보급하여 의생활 혁명을 이룬 인물", "최무선 화통도감\t최무선 화통도감\t\t1377년 화약과 화포를 자체 개발하여 진포 해전에서 왜선 500여 척을 격파한 과학자이자 장군", "이성계 위화도 회군\t이성계 위화도 회군\t\t1388년 요동 정벌군을 이끌고 4불가론을 내세워 압록강 하류에서 군대를 돌려 권력을 장악한 사건", "박위 쓰시마섬 토벌\t박위 쓰시마섬 토벌\t\t1389년 창왕 때 전함 100여 척을 이끌고 왜구의 소굴인 대마도를 정벌한 군사 작전", "과전법\t과전법\t\t1391년 공양왕 때 조준·정도전 등 신진사대부가 경기 지방의 토지에 한해 수조권을 지급하도록 개혁한 토지 제도", "태조 이성계\t태조 이성계\t\t1392년 신진사대부와 손잡고 조선을 건국하여 한양 천도와 국호 제정을 단행한 초대 국왕", "정도전 조선경국전\t정도전 조선경국전\t\t재상 중심의 정치 체제와 법전의 기틀을 마련하고 불씨잡변으로 성리학 통치 이념을 확립한 개국공신", "태종 6조 직계제\t태종 6조 직계제\t\t의정부의 권한을 축소하고 6조 판서가 국왕에게 직접 업무를 보고하게 하여 왕권을 강화한 제도", "호패법과 사병 혁파\t호패법과 사병 혁파\t\t태종이 16세 이상 남정에게 신분증을 차게 하여 인구를 파악하고 군사권을 국가로 일원화한 정책", "신문고 설치\t신문고 설치\t\t태종 대에 억울한 일을 당한 백성이 북을 쳐서 국왕에게 호소할 수 있도록 설치한 제도", "세종 집현전\t세종 집현전\t\t경연과 서연을 담당하고 학문을 연구하며 훈민정음 창제와 편찬 사업을 주도한 왕실 연구 기관", "4군 6진 개척\t4군 6진 개척\t\t세종 대에 최윤덕과 김종서를 파견하여 여진족을 몰아내고 압록강·두만강 유역의 국경선을 확정한 업적", "쓰시마섬 정벌(기해동정)\t쓰시마섬 정벌(기해동정)\t\t1419년 이종무를 보내 왜구의 근거지를 토벌하고 이후 계해약조로 제한적 무역을 허용한 사건", "전분6등법과 연분9등법\t전분6등법과 연분9등법\t\t세종이 토지의 비옥도를 6등급, 풍흉을 9등급으로 나누어 공평하게 전세를 거둔 공법", "훈민정음\t훈민정음\t\t1443년 백성들이 쉽게 익혀 쓸 수 있도록 발음 기관을 본떠 만든 28자의 과학적 문자", "농사직설\t농사직설\t\t세종 때 정초 등이 우리 풍토에 맞는 고유의 농법을 노농들의 경험을 모아 편찬한 농서", "칠정산\t칠정산\t\t한양을 기준으로 태양과 달, 오행성의 운동을 계산하여 만든 자주적 역법서", "장영실 자격루와 앙부일구\t장영실 자격루와 앙부일구\t\t관노 출신 과학자가 제작한 자동으로 시각을 알리는 물시계와 가마솥 모양 해시계", "측우기\t측우기\t\t세계 최초로 전국의 군현에 설치하여 강우량을 과학적으로 측정하고 농정에 활용한 기구"], "science": ["원소 기호 H (원자번호 1번)\t수소 (H, 원자번호 1번)\t\t원자번호 1번 수소(H): 우주에 가장 풍부한 가벼운 비금속 원소로 연료전지와 물(H₂O)의 구성 원소", "원소 기호 He (원자번호 2번)\t헬륨 (He, 원자번호 2번)\t\t원자번호 2번 헬륨(He): 비활성 기체(18족)로 반응성이 거의 없고 공기보다 가벼워 비행선·초전도 냉각에 쓰이는 원소", "원소 기호 Li (원자번호 3번)\t리튬 (Li, 원자번호 3번)\t\t원자번호 3번 리튬(Li): 가장 가벼운 알칼리 금속(1족)으로 스마트폰·전기차 이차전지 양극재의 핵심 원소", "원소 기호 Be (원자번호 4번)\t베릴륨 (Be, 원자번호 4번)\t\t원자번호 4번 베릴륨(Be): 2족 알칼리 토금속으로 가볍고 단단하며 X선을 잘 투과시켜 제임스웹 우주망원경 거울에 쓰이는 원소", "원소 기호 B (원자번호 5번)\t붕소 (B, 원자번호 5번)\t\t원자번호 5번 붕소(B): 13족 준금속으로 내열 유리(붕규산 유리)와 반도체 p형 도핑 불순물·원자로 제어봉에 쓰이는 원소", "원소 기호 C (원자번호 6번)\t탄소 (C, 원자번호 6번)\t\t원자번호 6번 탄소(C): 14족 비금속으로 공유 결합을 통해 유기물·다이아몬드·흑연·그래핀을 이루는 생명체의 중심 원소", "원소 기호 N (원자번호 7번)\t질소 (N, 원자번호 7번)\t\t원자번호 7번 질소(N): 대기 부피의 약 78%를 차지하며 삼중 결합(N≡N)으로 안정하고 단백질·핵산·암모니아 합성에 필수인 원소", "원소 기호 O (원자번호 8번)\t산소 (O, 원자번호 8번)\t\t원자번호 8번 산소(O): 대기의 약 21% 및 지각 질량비 1위 원소로 세포 호흡과 연소·산화 반응의 핵심 비금속 원소", "원소 기호 F (원자번호 9번)\t플루오린 (F, 원자번호 9번)\t\t원자번호 9번 플루오린(F): 17족 할로젠 중 전기음성도가 가장 큰(4.0) 원소로 치약 충치 예방과 테플론 코팅에 쓰이는 원소", "원소 기호 Ne (원자번호 10번)\t네온 (Ne, 원자번호 10번)\t\t원자번호 10번 네온(Ne): 18족 비활성 기체로 방전관에 넣고 전압을 걸면 붉은빛을 내어 조명 간판에 쓰이는 원소", "원소 기호 Na (원자번호 11번)\t나트륨(소듐) (Na, 원자번호 11번)\t\t원자번호 11번 나트륨(소듐)(Na): 1족 알칼리 금속으로 물과 격렬히 반응해 수소 기체를 내고 노란색 불꽃 반응을 보이는 원소", "원소 기호 Mg (원자번호 12번)\t마그네슘 (Mg, 원자번호 12번)\t\t원자번호 12번 마그네슘(Mg): 2족 알칼리 토금속으로 엽록소의 중심 금속이자 합금·제산제(수산화 마그네슘)에 쓰이는 원소", "원소 기호 Al (원자번호 13번)\t알루미늄 (Al, 원자번호 13번)\t\t원자번호 13번 알루미늄(Al): 지각에 가장 많은 금속 원소(보크사이트 제련)로 가볍고 산화 피막이 부식을 막는 13족 금속", "원소 기호 Si (원자번호 14번)\t규소(실리콘) (Si, 원자번호 14번)\t\t원자번호 14번 규소(실리콘)(Si): 지각에서 산소 다음으로 많은 준금속으로 규산염 광물의 주성분이자 반도체 웨이퍼의 핵심 원소", "원소 기호 P (원자번호 15번)\t인 (P, 원자번호 15번)\t\t원자번호 15번 인(P): DNA·RNA의 인산 골격과 생체 에너지 화폐 ATP, 세포막 인지질을 구성하는 15족 비금속 원소", "원소 기호 S (원자번호 16번)\t황 (S, 원자번호 16번)\t\t원자번호 16번 황(S): 화산 지대에 분포하며 황산(H₂SO₄) 제조와 고무 가황 처리, 시스테인 아미노산의 이황화 결합을 이루는 원소", "원소 기호 Cl (원자번호 17번)\t염소 (Cl, 원자번호 17번)\t\t원자번호 17번 염소(Cl): 17족 할로젠 황록색 기체로 수돗물 살균·소독 및 염산(HCl), 소금(NaCl)을 구성하는 원소", "원소 기호 Ar (원자번호 18번)\t아르곤 (Ar, 원자번호 18번)\t\t원자번호 18번 아르곤(Ar): 공기 중 세 번째로 많은(0.93%) 비활성 기체로 백열전구·형광등 충전 및 용접 보호 가스에 쓰이는 원소", "원소 기호 K (원자번호 19번)\t칼륨(포타슘) (K, 원자번호 19번)\t\t원자번호 19번 칼륨(포타슘)(K): 1족 알칼리 금속으로 보라색 불꽃 반응을 보이며 신경 세포막의 휴지 전위·활동 전위 유지에 필수인 원소", "원소 기호 Ca (원자번호 20번)\t칼슘 (Ca, 원자번호 20번)\t\t원자번호 20번 칼슘(Ca): 뼈와 치아, 석회암·산호(CaCO₃)의 주성분이며 주황색 불꽃 반응과 근육 수축·혈액 응고에 관여하는 2족 원소", "원소 기호 Sc (원자번호 21번)\t스칸듐 (Sc, 원자번호 21번)\t\t원자번호 21번 스칸듐(Sc): 4주기 3족 전이 금속으로 알루미늄과 합금하여 항공기·고급 자전거 프레임의 강도를 높이는 원소", "원소 기호 Ti (원자번호 22번)\t타이타늄 (Ti, 원자번호 22번)\t\t원자번호 22번 타이타늄(Ti): 강철만큼 단단하면서 가볍고 내식성·생체 적합성이 뛰어나 항공우주와 인공관절 임플란트에 쓰이는 전이 금속", "원소 기호 V (원자번호 23번)\t바나듐 (V, 원자번호 23번)\t\t원자번호 23번 바나듐(V): 강철에 소량 첨가해 내마모성을 높인 크로뮴-바나듐 공구강과 대용량 레독스 흐름 전지에 쓰이는 전이 금속", "원소 기호 Cr (원자번호 24번)\t크로뮴 (Cr, 원자번호 24번)\t\t원자번호 24번 크로뮴(Cr): 철에 섞어 녹슬지 않는 스테인리스강을 만들고 루비·에메랄드의 색을 내는 6족 전이 금속", "원소 기호 Mn (원자번호 25번)\t망가니즈 (Mn, 원자번호 25번)\t\t원자번호 25번 망가니즈(Mn): 건전지 감극제(MnO₂)와 과망가니즈산 칼륨 산화제, 심해 망가니즈 단괴에 풍부한 7족 전이 금속", "원소 기호 Fe (원자번호 26번)\t철 (Fe, 원자번호 26번)\t\t원자번호 26번 철(Fe): 지구 전체와 핵에 가장 많은 원소이자 헤모글로빈 산소 운반과 강철 산업의 기반이 되는 강자성 전이 금속", "원소 기호 Co (원자번호 27번)\t코발트 (Co, 원자번호 27번)\t\t원자번호 27번 코발트(Co): 강자성 금속으로 비타민 B₁₂의 중심 원소이자 리튬 이온 배터리 양극재·푸른색 안료에 쓰이는 원소", "원소 기호 Ni (원자번호 28번)\t니켈 (Ni, 원자번호 28번)\t\t원자번호 28번 니켈(Ni): 부식에 강한 강자성 전이 금속으로 스테인리스강, 주화, 하이니켈 배터리 양극재 및 수소 첨가 촉매에 쓰이는 원소", "원소 기호 Cu (원자번호 29번)\t구리 (Cu, 원자번호 29번)\t\t원자번호 29번 구리(Cu): 전기·열 전도성이 은 다음으로 뛰어난 붉은빛 금속으로 전선·청동·황동 합금에 쓰이며 청록색 불꽃 반응을 보이는 원소", "원소 기호 Zn (원자번호 30번)\t아연 (Zn, 원자번호 30번)\t\t원자번호 30번 아연(Zn): 철판 부식을 막는 토건 아연도금(함석)과 황동 합금, 볼타·다니엘 전지의 음극(-) 및 생체 효소 보조인자에 쓰이는 금속", "원소 기호 Ga (원자번호 31번)\t갈륨 (Ga, 원자번호 31번)\t\t원자번호 31번 갈륨(Ga): 녹는점이 약 29.8°C로 손바닥 위에서 녹으며 질화갈륨(GaN)·비소화갈륨(GaAs) 청색 LED·전력 반도체에 쓰이는 원소", "원소 기호 Ge (원자번호 32번)\t저마늄(게르마늄) (Ge, 원자번호 32번)\t\t원자번호 32번 저마늄(게르마늄)(Ge): 14족 준금속으로 초기 트랜지스터와 광섬유 코어, 적외선 광학 렌즈에 사용되는 반도체 원소", "원소 기호 As (원자번호 33번)\t비소 (As, 원자번호 33번)\t\t원자번호 33번 비소(As): 15족 준금속으로 독성이 강하나 갈륨과 결합한 화합물 반도체(GaAs) 및 n형 도핑 원소로 쓰이는 원소", "원소 기호 Se (원자번호 34번)\t셀레늄 (Se, 원자번호 34번)\t\t원자번호 34번 셀레늄(Se): 빛을 받으면 전기 전도도가 변하는 광전도성 비금속으로 복사기 드럼과 체내 항산화 효소(글루타치온 과산화효소)에 필수인 원소", "원소 기호 Br (원자번호 35번)\t브로민 (Br, 원자번호 35번)\t\t원자번호 35번 브로민(Br): 상온에서 유일하게 액체 상태인 비금속(적갈색) 할로젠 원소로 탄소 이중결합(불포화 탄화수소) 검출 시 탈색 반응을 보이는 원소", "원소 기호 Kr (원자번호 36번)\t크립톤 (Kr, 원자번호 36번)\t\t원자번호 36번 크립톤(Kr): 18족 비활성 기체로 고효율 복층 유리 단열 충전 가스 및 고속 사진 촬영용 섬광등에 쓰이는 원소", "원소 기호 Rb (원자번호 37번)\t루비듐 (Rb, 원자번호 37번)\t\t원자번호 37번 루비듐(Rb): 1족 알칼리 금속으로 진한 붉은색 불꽃 반응을 보이며 GPS 위성의 루비듐 원자시계에 사용되는 원소", "원소 기호 Sr (원자번호 38번)\t스트론튬 (Sr, 원자번호 38번)\t\t원자번호 38번 스트론튬(Sr): 2족 알칼리 토금속으로 선명한 진홍색 불꽃 반응을 보여 불꽃놀이와 조명탄에 사용되는 원소", "원소 기호 Y (원자번호 39번)\t이트륨 (Y, 원자번호 39번)\t\t원자번호 39번 이트륨(Y): 희토류 전이 금속으로 고온 초전도체(YBCO)와 의료·산업용 YAG 레이저 결정에 사용되는 원소", "원소 기호 Zr (원자번호 40번)\t지르코늄 (Zr, 원자번호 40번)\t\t원자번호 40번 지르코늄(Zr): 열중성자 흡수 단면적이 매우 작고 내열·내식성이 뛰어나 원자력 발전소 핵연료 피복관과 인공 다이아몬드(큐빅)에 쓰이는 원소", "원소 기호 Nb (원자번호 41번)\t나이오븀 (Nb, 원자번호 41번)\t\t원자번호 41번 나이오븀(Nb): 초전도 자석 합금(Nb-Ti)으로 MRI 의료기기와 입자가속기 코일에 필수적으로 사용되는 5족 전이 금속", "원소 기호 Mo (원자번호 42번)\t몰리브데넘 (Mo, 원자번호 42번)\t\t원자번호 42번 몰리브데넘(Mo): 녹는점이 매우 높은 전이 금속으로 고온 합금강·윤활제(MoS₂) 및 콩과식물 질소 고정 효소의 활성 중심에 쓰이는 원소", "원소 기호 Tc (원자번호 43번)\t테크네튬 (Tc, 원자번호 43번)\t\t원자번호 43번 테크네튬(Tc): 원자번호가 가장 작은 인공 방사성 원소로 반감기가 짧은 준안정 동위원소(⁹⁹ᵐTc)가 핵의학 영상 진단에 널리 쓰이는 원소", "원소 기호 Ru (원자번호 44번)\t루테늄 (Ru, 원자번호 44번)\t\t원자번호 44번 루테늄(Ru): 백금족 귀금속으로 하드디스크 기록층과 암모니아 합성·유기 합성(그럽스 복분해 촉매)에 쓰이는 전이 금속", "원소 기호 Rh (원자번호 45번)\t로듐 (Rh, 원자번호 45번)\t\t원자번호 45번 로듐(Rh): 백금족 귀금속으로 자동차 삼원 촉매 변환기에서 질소 산화물(NOx)을 질소 기체로 환원시키는 핵심 촉매 원소", "원소 기호 Pd (원자번호 46번)\t팔라듐 (Pd, 원자번호 46번)\t\t원자번호 46번 팔라듐(Pd): 자신의 부피의 900배에 달하는 수소를 흡수하는 성질이 있으며 자동차 배기가스 정화 촉매와 교차 짝지음 반응(스즈키 반응)에 쓰이는 원소", "원소 기호 Ag (원자번호 47번)\t은 (Ag, 원자번호 47번)\t\t원자번호 47번 은(Ag): 모든 금속 중 전기 전도성과 열 전도성, 가시광선 반사율이 가장 뛰어난 귀금속이며 염화 이온(Cl⁻)과 흰색 앙금(AgCl)을 만드는 원소", "원소 기호 Cd (원자번호 48번)\t카드뮴 (Cd, 원자번호 48번)\t\t원자번호 48번 카드뮴(Cd): 니켈-카드뮴 충전지와 황색 안료에 쓰였으나 중금속 중독 질환인 이타이이타이병의 원인이 되는 12족 금속", "원소 기호 In (원자번호 49번)\t인듐 (In, 원자번호 49번)\t\t원자번호 49번 인듐(In): 무르고 가공하기 쉬운 금속으로 산화 인듐 주석(ITO) 투명 전극 필름을 만들어 스마트폰 터치스크린과 디스플레이에 필수인 원소", "원소 기호 Sn (원자번호 50번)\t주석 (Sn, 원자번호 50번)\t\t원자번호 50번 주석(Sn): 구리와 합금하여 청동(Bronze)을 만들고 통조림 캔 코팅(양철)과 무연 납땜(솔더)에 사용되는 14족 금속", "원소 기호 Sb (원자번호 51번)\t안티모니 (Sb, 원자번호 51번)\t\t원자번호 51번 안티모니(Sb): 15족 준금속으로 난연제(불에 타지 않게 하는 첨가제)와 납 축전지 극판 합금, p형/n형 반도체 도핑에 쓰이는 원소", "원소 기호 Te (원자번호 52번)\t텔루륨 (Te, 원자번호 52번)\t\t원자번호 52번 텔루륨(Te): 16족 준금속으로 카드뮴 텔루라이드(CdTe) 박막 태양전지와 상변화 메모리(PRAM) 소자에 쓰이는 원소", "원소 기호 I (원자번호 53번)\t아이오딘(요오드) (I, 원자번호 53번)\t\t원자번호 53번 아이오딘(요오드)(I): 보라색 승화성 고체 할로젠 원소로 녹말과 만나 청남색(아이오딘-녹말 반응)을 띠며 갑상샘 호르몬(티록신)의 구성 성분인 원소", "원소 기호 Xe (원자번호 54번)\t제논(크세논) (Xe, 원자번호 54번)\t\t원자번호 54번 제논(크세논)(Xe): 무거운 비활성 기체로 자동차 고휘도 방전등(HID)과 우주선 이온 추진 엔진의 추진제, 전신 마취제 연구에 쓰이는 원소", "원소 기호 Cs (원자번호 55번)\t세슘 (Cs, 원자번호 55번)\t\t원자번호 55번 세슘(Cs): 반응성이 매우 큰 알칼리 금속으로 ¹³³Cs 원자의 초미세 전이 진동수가 국제단위계(SI) 1초(s)를 정의하는 기준이 되는 원소", "원소 기호 Ba (원자번호 56번)\t바륨 (Ba, 원자번호 56번)\t\t원자번호 56번 바륨(Ba): 2족 알칼리 토금속으로 황산(SO₄²⁻)과 반응해 물과 산에 녹지 않는 흰색 앙금(BaSO₄, 위장 X선 조영제)을 생성하며 황록색 불꽃 반응을 보이는 원소", "원소 기호 La (원자번호 57번)\t란타넘 (La, 원자번호 57번)\t\t원자번호 57번 란타넘(La): 란타넘족 희토류의 첫 원소로 카메라 고급 광학 렌즈 유리의 굴절률을 높이고 석유 접촉 분해 촉매에 쓰이는 원소", "원소 기호 Ce (원자번호 58번)\t세륨 (Ce, 원자번호 58번)\t\t원자번호 58번 세륨(Ce): 희토류 중 지각에 가장 풍부하며 반도체 웨이퍼 화학적 기계적 연마제(CMP 슬러리)와 라이터 부싯돌 합금에 쓰이는 원소", "원소 기호 Pr (원자번호 59번)\t프라세오디뮴 (Pr, 원자번호 59번)\t\t원자번호 59번 프라세오디뮴(Pr): 네오디뮴 자석의 내열성을 높이는 첨가제와 용접공 보안경의 노란빛 차단 유리 착색제에 쓰이는 희토류 원소", "원소 기호 Nd (원자번호 60번)\t네오디뮴 (Nd, 원자번호 60번)\t\t원자번호 60번 네오디뮴(Nd): 현존하는 가장 강력한 영구자석(Nd₂Fe₁₄B)을 만들어 전기차 구동 모터·풍력 발전기·이어폰 스피커에 필수인 희토류 원소", "원소 기호 Pm (원자번호 61번)\t프로메튬 (Pm, 원자번호 61번)\t\t원자번호 61번 프로메튬(Pm): 안정한 동위원소가 없는 란타넘족 방사성 원소로 우주 탐사선과 인공심장 박동기의 원자력 베타전지 연구에 쓰인 원소", "원소 기호 Sm (원자번호 62번)\t사마륨 (Sm, 원자번호 62번)\t\t원자번호 62번 사마륨(Sm): 고온에서도 자성을 잃지 않는 사마륨-코발트(SmCo) 영구자석과 암 통증 완화 방사성 의약품에 쓰이는 희토류 원소", "원소 기호 Eu (원자번호 63번)\t유로퓸 (Eu, 원자번호 63번)\t\t원자번호 63번 유로퓸(Eu): 자외선을 받으면 선명한 적색·청색 형광을 내어 디스플레이 형광체와 유로화 지폐의 위조 방지 잉크에 쓰이는 희토류 원소", "원소 기호 Gd (원자번호 64번)\t가돌리늄 (Gd, 원자번호 64번)\t\t원자번호 64번 가돌리늄(Gd): 강한 상자성을 띠어 병원 자기공명영상(MRI) 촬영 시 혈관과 조직 대조도를 높이는 조영제로 사용되는 희토류 원소", "원소 기호 Tb (원자번호 65번)\t터븀 (Tb, 원자번호 65번)\t\t원자번호 65번 터븀(Tb): 녹색 발광 형광체와 자기장을 걸면 길이가 변하는 초자기변형 합금(소나 음향 변환기)에 쓰이는 희토류 원소", "원소 기호 Dy (원자번호 66번)\t디스프로슘 (Dy, 원자번호 66번)\t\t원자번호 66번 디스프로슘(Dy): 네오디뮴 영구자석이 전기차 모터의 고온 환경에서도 자력을 유지하도록 첨가하는 핵심 중희토류 원소", "원소 기호 Ho (원자번호 67번)\t홀뮴 (Ho, 원자번호 67번)\t\t원자번호 67번 홀뮴(Ho): 자연계 원소 중 가장 큰 자기 모멘트를 가져 고자장 자석의 자극편과 의료용 결석 파쇄 홀뮴 레이저에 쓰이는 희토류 원소", "원소 기호 Er (원자번호 68번)\t어븀 (Er, 원자번호 68번)\t\t원자번호 68번 어븀(Er): 광섬유 통신망에서 빛 신호를 전기 변환 없이 직접 증폭하는 어븀 첨가 광섬유 증폭기(EDFA)에 필수인 희토류 원소", "원소 기호 Tm (원자번호 69번)\t툴륨 (Tm, 원자번호 69번)\t\t원자번호 69번 툴륨(Tm): 자연계 희토류 중 매우 희귀하며 휴대용 X선 발생 장치와 전립선 수술용 툴륨 레이저에 쓰이는 원소", "원소 기호 Yb (원자번호 70번)\t이터븀 (Yb, 원자번호 70번)\t\t원자번호 70번 이터븀(Yb): 차세대 초정밀 광격자 원자시계와 고출력 산업용 광섬유 레이저에 사용되는 란타넘족 원소", "원소 기호 Lu (원자번호 71번)\t루테튬 (Lu, 원자번호 71번)\t\t원자번호 71번 루테튬(Lu): 란타넘족의 마지막 원소로 양전자 방출 단층촬영(PET) 검출기 섬광체 결정과 표적 방사선 항암제(¹⁷⁷Lu)에 쓰이는 원소", "원소 기호 Hf (원자번호 72번)\t하프늄 (Hf, 원자번호 72번)\t\t원자번호 72번 하프늄(Hf): 중성자 흡수 능력이 뛰어나 원자로 제어봉에 쓰이며 최신 미세공정 CPU 트랜지스터의 고유전율(High-k) 절연막(HfO₂)에 쓰이는 원소", "원소 기호 Ta (원자번호 73번)\t탄탈럼 (Ta, 원자번호 73번)\t\t원자번호 73번 탄탈럼(Ta): 산에 전혀 부식되지 않고 정전 용량이 커서 스마트폰 기판의 초소형 탄탈럼 축전지(커패시터)에 필수인 5족 전이 금속", "원소 기호 W (원자번호 74번)\t텅스텐 (W, 원자번호 74번)\t\t원자번호 74번 텅스텐(W): 모든 금속 중 녹는점(3,422°C)이 가장 높아 필라멘트, 초경합금 절삭공구, 반도체 배선 플러그에 쓰이는 6족 전이 금속", "원소 기호 Re (원자번호 75번)\t레늄 (Re, 원자번호 75번)\t\t원자번호 75번 레늄(Re): 녹는점이 세 번째로 높은 희소 금속으로 항공기 제트 엔진 터빈 블레이드 초내열 합금에 사용되는 원소", "원소 기호 Os (원자번호 76번)\t오스뮴 (Os, 원자번호 76번)\t\t원자번호 76번 오스뮴(Os): 자연계에 존재하는 모든 원소 중 밀도(약 22.59 g/cm³)가 가장 높은 백금족 금속으로 만년필 촉 합금에 쓰이는 원소", "원소 기호 Ir (원자번호 77번)\t이리듐 (Ir, 원자번호 77번)\t\t원자번호 77번 이리듐(Ir): 부식에 가장 강한 백금족 금속으로 백악기-팔레오기(K-Pg) 경계 지층에 농집되어 공룡 멸종 소행성 충돌설의 핵심 증거가 된 원소", "원소 기호 Pt (원자번호 78번)\t백금(플래티넘) (Pt, 원자번호 78번)\t\t원자번호 78번 백금(플래티넘)(Pt): 반응성이 낮고 촉매 활성이 뛰어나 수소 연료전지 전극 촉매, 자동차 배기가스 정화, 항암제 시스플라틴에 쓰이는 귀금속", "원소 기호 Au (원자번호 79번)\t금 (Au, 원자번호 79번)\t\t원자번호 79번 금(Au): 반응성이 매우 낮아 자연에서 순수한 상태로 산출되며 전성(펴짐성)과 연성(뽑힘성)이 가장 뛰어나 반도체 본딩 와이어에 쓰이는 귀금속", "원소 기호 Hg (원자번호 80번)\t수은 (Hg, 원자번호 80번)\t\t원자번호 80번 수은(Hg): 상온에서 유일하게 액체 상태인 금속 원소로 온도계·기압계(토리첼리 실험)에 쓰였으나 미나마타병을 유발하는 중금속", "원소 기호 Tl (원자번호 81번)\t탈륨 (Tl, 원자번호 81번)\t\t원자번호 81번 탈륨(Tl): 13족 중금속으로 독성이 강하며 적외선 검출기 결정과 심근 관류 핵의학 검사에 제한적으로 사용되는 원소", "원소 기호 Pb (원자번호 82번)\t납 (Pb, 원자번호 82번)\t\t원자번호 82번 납(Pb): 밀도가 높고 방사선(X선·감마선) 차폐 능력이 뛰어나 방호복과 자동차 납 축전지 및 우라늄 방사성 붕괴의 최종 안정 동위원소가 되는 금속", "원소 기호 Bi (원자번호 83번)\t비스무트 (Bi, 원자번호 83번)\t\t원자번호 83번 비스무트(Bi): 독성이 거의 없는 무거운 금속으로 위점막 보호 소화제와 강한 반자성 물질 및 친환경 무연 땜납에 쓰이는 원소", "원소 기호 Po (원자번호 84번)\t폴로늄 (Po, 원자번호 84번)\t\t원자번호 84번 폴로늄(Po): 마리 퀴리와 피에르 퀴리가 우라늄 광석에서 발견해 조국 폴란드의 이름을 붙인 강한 알파선 방출 방사성 원소", "원소 기호 At (원자번호 85번)\t아스타틴 (At, 원자번호 85번)\t\t원자번호 85번 아스타틴(At): 17족 할로젠에 속하는 자연계 최고 희귀 방사성 원소로 알파 입자 표적 방사선 암 치료 연구에 쓰이는 원소", "원소 기호 Rn (원자번호 86번)\t라돈 (Rn, 원자번호 86번)\t\t원자번호 86번 라돈(Rn): 18족 비활성 기체이자 무색·무취의 자연 방사성 기체로 화강암 지대 토양이나 지하 공간에서 방출되어 환기가 필요한 원소", "원소 기호 Fr (원자번호 87번)\t프랑슘 (Fr, 원자번호 87번)\t\t원자번호 87번 프랑슘(Fr): 1족 알칼리 금속의 마지막 원소로 반감기가 22분에 불과해 자연계에서 극미량만 존재하는 방사성 원소", "원소 기호 Ra (원자번호 88번)\t라듐 (Ra, 원자번호 88번)\t\t원자번호 88번 라듐(Ra): 퀴리 부부가 발견한 2족 알칼리 토금속 방사성 원소로 강한 방사선을 방출해 초기 방사선 치료의 역사를 연 원소", "원소 기호 Ac (원자번호 89번)\t악티늄 (Ac, 원자번호 89번)\t\t원자번호 89번 악티늄(Ac): 악티늄족(89~103번)의 시작이 되는 방사성 금속 원소로 어두운 곳에서 푸른빛을 내는 알파선 방출 원소", "원소 기호 Th (원자번호 90번)\t토륨 (Th, 원자번호 90번)\t\t원자번호 90번 토륨(Th): 자연계에 비교적 풍부한 악티늄족 원소로 차세대 안전 원자로인 토륨 용융염 원자로의 핵연료 후보가 되는 원소", "원소 기호 Pa (원자번호 91번)\t프로트악티늄 (Pa, 원자번호 91번)\t\t원자번호 91번 프로트악티늄(Pa): 우라늄과 토륨 사이에 위치한 악티늄족 방사성 원소로 해양 퇴적물의 연대 측정에 활용되는 원소", "원소 기호 U (원자번호 92번)\t우라늄 (U, 원자번호 92번)\t\t원자번호 92번 우라늄(U): 자연계에 존재하는 가장 무거운 주요 원소로 ²³⁵U가 열중성자를 흡수해 핵분열 연쇄반응을 일으켜 원자력 발전의 연료가 되는 원소", "원소 기호 Np (원자번호 93번)\t넵투늄 (Np, 원자번호 93번)\t\t원자번호 93번 넵투늄(Np): 우라늄 너머 최초로 발견된 초우라늄 원소(해왕성에서 명명)로 플루토늄-238 생산의 전구체로 쓰이는 원소", "원소 기호 Pu (원자번호 94번)\t플루토늄 (Pu, 원자번호 94번)\t\t원자번호 94번 플루토늄(Pu): 초우라늄 원소로 ²³⁹Pu는 핵분열 연료에, ²³⁸Pu는 보이저호·화성 탐사 로버의 원자력 전지(RTG) 열원에 쓰이는 원소", "원소 기호 Am (원자번호 95번)\t아메리슘 (Am, 원자번호 95번)\t\t원자번호 95번 아메리슘(Am): 인공 합성 초우라늄 원소로 ²⁴¹Am이 방출하는 알파 입자의 공기 이온화 작용을 이용해 가정용 이온화식 화재 연기 감지기에 쓰이는 원소", "원소 기호 Cm (원자번호 96번)\t퀴륨 (Cm, 원자번호 96번)\t\t원자번호 96번 퀴륨(Cm): 마리 퀴리와 피에르 퀴리의 업적을 기려 명명된 초우라늄 원소로 화성 탐사선의 알파 입자 X선 분광기(APXS) 방사선원으로 쓰인 원소", "원소 기호 Bk (원자번호 97번)\t버클륨 (Bk, 원자번호 97번)\t\t원자번호 97번 버클륨(Bk): 미국 UC 버클리 연구소에서 합성되어 명명된 97번 초우라늄 악티늄족 원소", "원소 기호 Cf (원자번호 98번)\t캘리포늄 (Cf, 원자번호 98번)\t\t원자번호 98번 캘리포늄(Cf): 강력한 중성자 방출원(²⁵²Cf)으로 원자로 시동용 중성자원과 비파괴 중성자 투과 검사에 사용되는 초우라늄 원소", "원소 기호 Es (원자번호 99번)\t아인슈타이늄 (Es, 원자번호 99번)\t\t원자번호 99번 아인슈타이늄(Es): 수소폭탄 실험 잔해에서 발견되어 알베르트 아인슈타인의 이름을 따 명명된 99번 악티늄족 원소", "원소 기호 Fm (원자번호 100번)\t페르뮴 (Fm, 원자번호 100번)\t\t원자번호 100번 페르뮴(Fm): 원자로를 최초로 설계한 물리학자 엔리코 페르미의 업적을 기려 명명된 100번 악티늄족 원소", "원소 기호 Md (원자번호 101번)\t멘델레예븀 (Md, 원자번호 101번)\t\t원자번호 101번 멘델레예븀(Md): 주기율표의 창시자 드미트리 멘델레예프의 이름을 기려 명명된 101번 악티늄족 원소", "원소 기호 No (원자번호 102번)\t노벨륨 (No, 원자번호 102번)\t\t원자번호 102번 노벨륨(No): 다이너마이트 발명가이자 노벨상 제정자인 알프레드 노벨의 이름을 기려 명명된 102번 악티늄족 원소", "원소 기호 Lr (원자번호 103번)\t로렌슘 (Lr, 원자번호 103번)\t\t원자번호 103번 로렌슘(Lr): 입자가속기 사이클로트론을 발명한 어니스트 로렌스의 이름을 따 명명된 악티늄족 마지막(103번) 원소", "원소 기호 Rf (원자번호 104번)\t러더퍼듐 (Rf, 원자번호 104번)\t\t원자번호 104번 러더퍼듐(Rf): 알파 입자 산란 실험으로 원자핵을 발견한 어니스트 러더퍼드의 이름을 기린 104번 초중원소", "원소 기호 Db (원자번호 105번)\t더브늄 (Db, 원자번호 105번)\t\t원자번호 105번 더브늄(Db): 러시아 합동핵연구소(JINR)가 위치한 과학 도시 두브나(Dubna)에서 이름을 딴 105번 초중원소", "원소 기호 Sg (원자번호 106번)\t시보귬 (Sg, 원자번호 106번)\t\t원자번호 106번 시보귬(Sg): 초우라늄 원소들을 다수 발견하고 악티늄족 개념을 제안한 글렌 시보그의 이름을 딴 106번 초중원소", "원소 기호 Bh (원자번호 107번)\t보륨 (Bh, 원자번호 107번)\t\t원자번호 107번 보륨(Bh): 원자 구조의 양자역학적 모형을 제시한 닐스 보어의 업적을 기려 명명된 107번 초중원소", "원소 기호 Hs (원자번호 108번)\t하슘 (Hs, 원자번호 108번)\t\t원자번호 108번 하슘(Hs): 독일 중이온연구소(GSI)가 위치한 헤센(Hesse)주의 라틴어 이름에서 유래한 108번 초중원소", "원소 기호 Mt (원자번호 109번)\t마이트너륨 (Mt, 원자번호 109번)\t\t원자번호 109번 마이트너륨(Mt): 핵분열 현상을 이론적으로 규명한 오스트리아 출신 물리학자 리제 마이트너를 기린 109번 초중원소", "원소 기호 Ds (원자번호 110번)\t다름슈타튬 (Ds, 원자번호 110번)\t\t원자번호 110번 다름슈타튬(Ds): 독일 다름슈타트 중이온연구소에서 중이온 충돌 실험으로 합성해 명명된 110번 초중원소", "원소 기호 Rg (원자번호 111번)\t뢴트게늄 (Rg, 원자번호 111번)\t\t원자번호 111번 뢴트게늄(Rg): X선을 최초로 발견해 초대 노벨 물리학상을 수상한 빌헬름 뢴트겐을 기려 명명된 111번 초중원소", "원소 기호 Cn (원자번호 112번)\t코페르니슘 (Cn, 원자번호 112번)\t\t원자번호 112번 코페르니슘(Cn): 지동설(태양중심설)을 제창한 천문학자 니콜라우스 코페르니쿠스를 기려 명명된 112번 초중원소", "원소 기호 Nh (원자번호 113번)\t니호늄 (Nh, 원자번호 113번)\t\t원자번호 113번 니호늄(Nh): 일본 이화학연구소(RIKEN)가 아시아 최초로 합성·발견하여 등재된 113번 13족 초중원소", "원소 기호 Fl (원자번호 114번)\t플레로븀 (Fl, 원자번호 114번)\t\t원자번호 114번 플레로븀(Fl): 러시아의 중이온 핵물리학자 게오르기 플료로프를 기려 명명된 114번 14족 초중원소", "원소 기호 Mc (원자번호 115번)\t모스코븀 (Mc, 원자번호 115번)\t\t원자번호 115번 모스코븀(Mc): 합동핵연구소가 위치한 러시아 모스크바주를 기념하여 명명된 115번 15족 초중원소", "원소 기호 Lv (원자번호 116번)\t리버모륨 (Lv, 원자번호 116번)\t\t원자번호 116번 리버모륨(Lv): 미국 로렌스 리버모어 국립연구소의 초중원소 공동 연구 업적을 기려 명명된 116번 초중원소", "원소 기호 Ts (원자번호 117번)\t테네신 (Ts, 원자번호 117번)\t\t원자번호 117번 테네신(Ts): 미국 오크리지 국립연구소와 밴더빌트 대학교가 위치한 테네시주에서 이름을 딴 117번 할로젠족 초중원소", "원소 기호 Og (원자번호 118번)\t오가네손 (Og, 원자번호 118번)\t\t원자번호 118번 오가네손(Og): 7주기 18족을 완성한 118번 원소로 초중원소 합성의 권위자 유리 오가네시안 교수의 이름을 딴 원소", "등속 직선 운동\t등속 직선 운동 (s = vt (가속도 a = 0, 알짜힘 F = 0))\t\t[물리학 역학·열역학·파동] 등속 직선 운동 | 핵심 공식·원리: s = vt (가속도 a = 0, 알짜힘 F = 0) | 해설: 물체에 작용하는 알짜힘이 0일 때 속력과 운동 방향이 일정", "등가속도 직선 운동 속도 공식\t등가속도 직선 운동 속도 공식 (v = v₀ + at)\t\t[물리학 역학·열역학·파동] 등가속도 직선 운동 속도 공식 | 핵심 공식·원리: v = v₀ + at | 해설: 가속도가 a로 일정할 때 처음 속도 v₀와 시간 t로 나중 속도 v를 구하는", "등가속도 직선 운동 변위 공식\t등가속도 직선 운동 변위 공식 (s = v₀t + ½at²)\t\t[물리학 역학·열역학·파동] 등가속도 직선 운동 변위 공식 | 핵심 공식·원리: s = v₀t + ½at² | 해설: 초기 속도 v₀와 일정한 가속도 a로 시간 t 동안 이동한 변위 s를 ", "등가속도 직선 운동 속도-변위 공식\t등가속도 직선 운동 속도-변위 공식 (2as = v² - v₀²)\t\t[물리학 역학·열역학·파동] 등가속도 직선 운동 속도-변위 공식 | 핵심 공식·원리: 2as = v² - v₀² | 해설: 시간 t를 포함하지 않고 처음 속도, 나중 속도, 가속도, 변위의", "자유 낙하 운동\t자유 낙하 운동\t\t[물리학 역학·열역학·파동] 자유 낙하 운동 | 핵심 공식·원리: v = gt, h = ½gt² (초기 속도 v₀ = 0, 가속도 g ≈ 9.8 m/s²) | 해설: 공기 저항이 없을 때 ", "연직 상방 투사 운동\t연직 상방 투사 운동 (v = v₀ - gt, 최고점 도달 시간 t = v₀/g)\t\t[물리학 역학·열역학·파동] 연직 상방 투사 운동 | 핵심 공식·원리: v = v₀ - gt, 최고점 도달 시간 t = v₀/g | 해설: 물체를 위쪽 방향으로 초기 속력 v₀로 던져 올렸", "수평 투사 운동\t수평 투사 운동\t\t[물리학 역학·열역학·파동] 수평 투사 운동 | 핵심 공식·원리: 수평 방향 등속 운동(x = v₀t) + 연직 방향 자유 낙하(y = ½gt²) | 해설: 일정한 높이에서 수평 방향으로 ", "포물선 운동(비스듬히 던진 물체)\t포물선 운동(비스듬히 던진 물체) (수평 속도 v₀cosθ 일정, 연직 속도 v₀sinθ - gt)\t\t[물리학 역학·열역학·파동] 포물선 운동(비스듬히 던진 물체) | 핵심 공식·원리: 수평 속도 v₀cosθ 일정, 연직 속도 v₀sinθ - gt | 해설: 지면과 각도 θ로 던진 물체가 ", "뉴턴 운동 제1법칙(관성의 법칙)\t뉴턴 운동 제1법칙(관성의 법칙) (ΣF = 0 이면 Δv = 0 (운동 상태 유지))\t\t[물리학 역학·열역학·파동] 뉴턴 운동 제1법칙(관성의 법칙) | 핵심 공식·원리: ΣF = 0 이면 Δv = 0 (운동 상태 유지) | 해설: 외부에서 알짜힘이 작용하지 않으면 정지한 물", "뉴턴 운동 제2법칙(가속도의 법칙)\t뉴턴 운동 제2법칙(가속도의 법칙) (a = F / m (또는 F = ma))\t\t[물리학 역학·열역학·파동] 뉴턴 운동 제2법칙(가속도의 법칙) | 핵심 공식·원리: a = F / m (또는 F = ma) | 해설: 물체의 가속도는 작용한 알짜힘의 크기에 비례하고 물체", "뉴턴 운동 제3법칙(작용 반작용의 법칙)\t뉴턴 운동 제3법칙(작용 반작용의 법칙) (F_AB = -F_BA (크기 동일, 방향 반대, 동일 작용선))\t\t[물리학 역학·열역학·파동] 뉴턴 운동 제3법칙(작용 반작용의 법칙) | 핵심 공식·원리: F_AB = -F_BA (크기 동일, 방향 반대, 동일 작용선) | 해설: 물체 A가 물체 B에 ", "선운동량(Linear Momentum)\t선운동량(Linear Momentum) (p = mv (단위)\t\t[물리학 역학·열역학·파동] 선운동량(Linear Momentum) | 핵심 공식·원리: p = mv (단위 | 해설: kg·m/s):물체의 질량 m과 속도 v의 곱으로 정의되며 물체의 운", "충격량(Impulse)과 운동량 변화량\t충격량(Impulse)과 운동량 변화량 (I = FΔt = Δp = mv - mv₀ (단위)\t\t[물리학 역학·열역학·파동] 충격량(Impulse)과 운동량 변화량 | 핵심 공식·원리: I = FΔt = Δp = mv - mv₀ (단위 | 해설: N·s):물체에 작용한 힘과 시간의 곱", "선운동량 보존 법칙\t선운동량 보존 법칙 (m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂' (외력 합 = 0))\t\t[물리학 역학·열역학·파동] 선운동량 보존 법칙 | 핵심 공식·원리: m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂' (외력 합 = 0) | 해설: 외력이 작용하지 않는 고립계에서 두 물", "반발 계수(충돌 계수)\t반발 계수(충돌 계수)\t\t[물리학 역학·열역학·파동] 반발 계수(충돌 계수) | 핵심 공식·원리: e = -(v₁' - v₂') / (v₁ - v₂) (탄성 충돌 e=1, 완전 비탄성 충돌 e=0) | 해설: 충돌", "일(Work)의 물리적 정의\t일(Work)의 물리적 정의 (W = F·s·cosθ (단위)\t\t[물리학 역학·열역학·파동] 일(Work)의 물리적 정의 | 핵심 공식·원리: W = F·s·cosθ (단위 | 해설: J = N·m):물체에 힘 F를 작용하여 힘의 방향으로 거리 s만큼 ", "일률(Power, 동력)\t일률(Power, 동력) (P = W / t = F·v (단위)\t\t[물리학 역학·열역학·파동] 일률(Power, 동력) | 핵심 공식·원리: P = W / t = F·v (단위 | 해설: W = J/s):단위 시간(1초) 동안 한 일의 양으로 힘과 속력의", "운동 에너지(Kinetic Energy)\t운동 에너지(Kinetic Energy) (Ek = ½mv² (단위)\t\t[물리학 역학·열역학·파동] 운동 에너지(Kinetic Energy) | 핵심 공식·원리: Ek = ½mv² (단위 | 해설: J):질량 m인 물체가 속력 v로 운동할 때 가지는 에너지", "일-운동 에너지 정리\t일-운동 에너지 정리 (W_알짜 = ΔEk = ½mv² - ½mv₀²)\t\t[물리학 역학·열역학·파동] 일-운동 에너지 정리 | 핵심 공식·원리: W_알짜 = ΔEk = ½mv² - ½mv₀² | 해설: 물체에 작용한 알짜힘이 한 일은 그 물체의 운동 에너지 변화", "중력 퍼텐셜 에너지\t중력 퍼텐셜 에너지 (Ep = mgh (단위)\t\t[물리학 역학·열역학·파동] 중력 퍼텐셜 에너지 | 핵심 공식·원리: Ep = mgh (단위 | 해설: J):질량 m인 물체가 기준면으로부터 높이 h만큼 올라갔을 때 중력장 내에서 가지는 ", "탄성 퍼텐셜 에너지\t탄성 퍼텐셜 에너지 (Ep = ½kx² (단위)\t\t[물리학 역학·열역학·파동] 탄성 퍼텐셜 에너지 | 핵심 공식·원리: Ep = ½kx² (단위 | 해설: J, k는 용수철 상수):용수철 상수가 k인 탄성체가 평형 위치로부터 x만큼 변형되", "역학적 에너지 보존 법칙\t역학적 에너지 보존 법칙 (Ek + Ep = ½mv² + mgh + ½kx² = 일정)\t\t[물리학 역학·열역학·파동] 역학적 에너지 보존 법칙 | 핵심 공식·원리: Ek + Ep = ½mv² + mgh + ½kx² = 일정 | 해설: 마찰이나 공기 저항 등 비보존력이 일을 하지", "훅의 법칙(탄성력 공식)\t훅의 법칙(탄성력 공식) (F = -kx (단위)\t\t[물리학 역학·열역학·파동] 훅의 법칙(탄성력 공식) | 핵심 공식·원리: F = -kx (단위 | 해설: N, k 단위: N/m):용수철의 탄성력은 변형된 길이 x에 비례하고 변형 반대 ", "최대 정지 마찰력과 운동 마찰력\t최대 정지 마찰력과 운동 마찰력 (f_s(max) = μ_s·N, f_k = μ_k·N (N은 수직항력))\t\t[물리학 역학·열역학·파동] 최대 정지 마찰력과 운동 마찰력 | 핵심 공식·원리: f_s(max) = μ_s·N, f_k = μ_k·N (N은 수직항력) | 해설: 접촉면에서 물체의 미끄러", "등속 원운동의 각속도와 선속도\t등속 원운동의 각속도와 선속도 (ω = Δθ / Δt = 2π / T, v = rω)\t\t[물리학 역학·열역학·파동] 등속 원운동의 각속도와 선속도 | 핵심 공식·원리: ω = Δθ / Δt = 2π / T, v = rω | 해설: 반지름 r인 원궤도를 주기 T로 돌 때 단위 ", "구심 가속도와 구심력 공식\t구심 가속도와 구심력 공식 (a_c = v² / r = rω², F_c = mv² / r = mrω²)\t\t[물리학 역학·열역학·파동] 구심 가속도와 구심력 공식 | 핵심 공식·원리: a_c = v² / r = rω², F_c = mv² / r = mrω² | 해설: 등속 원운동 하는 물체가 원", "만유인력의 법칙(뉴턴 중력 법칙)\t만유인력의 법칙(뉴턴 중력 법칙)\t\t[물리학 역학·열역학·파동] 만유인력의 법칙(뉴턴 중력 법칙) | 핵심 공식·원리: F = G·(m₁m₂) / r² (G ≈ 6.67×10⁻¹¹ N·m²/kg²) | 해설: 질량을 가진 모", "중력 가속도와 지구 질량·반지름 관계\t중력 가속도와 지구 질량·반지름 관계 (g = G·M / R² (지표면 근처 약 9.8 m/s²))\t\t[물리학 역학·열역학·파동] 중력 가속도와 지구 질량·반지름 관계 | 핵심 공식·원리: g = G·M / R² (지표면 근처 약 9.8 m/s²) | 해설: 지구 반지름 R과 질량 M으로 ", "제1 우주 속도(원궤도 공전 속도)\t제1 우주 속도(원궤도 공전 속도) (v₁ = √(GM / R) = √(gR) ≈ 7.9 km/s)\t\t[물리학 역학·열역학·파동] 제1 우주 속도(원궤도 공전 속도) | 핵심 공식·원리: v₁ = √(GM / R) = √(gR) ≈ 7.9 km/s | 해설: 인공위성이 지구 표면 근처 원궤", "제2 우주 속도(지구 탈출 속도)\t제2 우주 속도(지구 탈출 속도) (v₂ = √(2GM / R) = √(2gR) ≈ 11.2 km/s)\t\t[물리학 역학·열역학·파동] 제2 우주 속도(지구 탈출 속도) | 핵심 공식·원리: v₂ = √(2GM / R) = √(2gR) ≈ 11.2 km/s | 해설: 물체가 지구 중력장의 속박을", "케플러 제1법칙(타원 궤도 법칙)\t케플러 제1법칙(타원 궤도 법칙) (행성의 공전 궤도는 태양을 한 초점으로 하는 타원)\t\t[물리학 역학·열역학·파동] 케플러 제1법칙(타원 궤도 법칙) | 핵심 공식·원리: 행성의 공전 궤도는 태양을 한 초점으로 하는 타원 | 해설: 모든 행성이 원이 아닌 타원 궤도를 따라 태", "케플러 제2법칙(면적 속도 일정 법칙)\t케플러 제2법칙(면적 속도 일정 법칙) (dA / dt = 일정 (근일점 속력 최대, 원일점 속력 최소))\t\t[물리학 역학·열역학·파동] 케플러 제2법칙(면적 속도 일정 법칙) | 핵심 공식·원리: dA / dt = 일정 (근일점 속력 최대, 원일점 속력 최소) | 해설: 태양과 행성을 잇는 선분", "케플러 제3법칙(조화의 법칙)\t케플러 제3법칙(조화의 법칙) (T² / a³ = k (공전 주기 제곱은 긴반지름 세제곱에 비례))\t\t[물리학 역학·열역학·파동] 케플러 제3법칙(조화의 법칙) | 핵심 공식·원리: T² / a³ = k (공전 주기 제곱은 긴반지름 세제곱에 비례) | 해설: 행성의 공전 주기 T의 제곱은 ", "돌림힘(토크, Torque)\t돌림힘(토크, Torque) (τ = r × F = rF·sinθ (단위)\t\t[물리학 역학·열역학·파동] 돌림힘(토크, Torque) | 핵심 공식·원리: τ = r × F = rF·sinθ (단위 | 해설: N·m):회전축에서 힘의 작용점까지의 거리 r과 수직으로", "강체의 역학적 평형 조건\t강체의 역학적 평형 조건 (ΣF = 0 (병진 평형) 및 Στ = 0 (회전 평형))\t\t[물리학 역학·열역학·파동] 강체의 역학적 평형 조건 | 핵심 공식·원리: ΣF = 0 (병진 평형) 및 Στ = 0 (회전 평형) | 해설: 크기가 있는 물체(강체)가 이동하지도 않고 회", "관성 모멘트(회전 관성)\t관성 모멘트(회전 관성) (I = Σ(m_i·r_i²) (단위)\t\t[물리학 역학·열역학·파동] 관성 모멘트(회전 관성) | 핵심 공식·원리: I = Σ(m_i·r_i²) (단위 | 해설: kg·m²):회전하는 물체가 회전 운동 상태를 유지하려는 관성의 크", "각운동량 보존 법칙\t각운동량 보존 법칙 (L = Iω = r·mv = 일정 (외부 돌림힘 τ_외부 = 0))\t\t[물리학 역학·열역학·파동] 각운동량 보존 법칙 | 핵심 공식·원리: L = Iω = r·mv = 일정 (외부 돌림힘 τ_외부 = 0) | 해설: 외부에서 돌림힘이 작용하지 않을 때 회전하", "단진자의 주기 공식\t단진자의 주기 공식 (T = 2π√(l / g) (질량과 진폭이 작을 때 무관))\t\t[물리학 역학·열역학·파동] 단진자의 주기 공식 | 핵심 공식·원리: T = 2π√(l / g) (질량과 진폭이 작을 때 무관) | 해설: 길이가 l인 실에 매달린 단진자의 왕복 주기는 실", "용수철 진자의 주기 공식\t용수철 진자의 주기 공식 (T = 2π√(m / k))\t\t[물리학 역학·열역학·파동] 용수철 진자의 주기 공식 | 핵심 공식·원리: T = 2π√(m / k) | 해설: 용수철 상수 k인 용수철에 질량 m인 추를 매달아 단진동시킬 때의 고유 주기", "압력(Pressure)의 정의\t압력(Pressure)의 정의 (P = F / A (단위)\t\t[물리학 역학·열역학·파동] 압력(Pressure)의 정의 | 핵심 공식·원리: P = F / A (단위 | 해설: Pa = N/m², 1기압 ≈ 1,013 hPa):단위 면적에 수직으로 ", "유체 정역학 수압 공식\t유체 정역학 수압 공식 (P = P₀ + ρgh (ρ는 유체 밀도, h는 수심))\t\t[물리학 역학·열역학·파동] 유체 정역학 수압 공식 | 핵심 공식·원리: P = P₀ + ρgh (ρ는 유체 밀도, h는 수심) | 해설: 대기압 P₀ 아래 밀도 ρ인 액체 속 깊이 h인 ", "토리첼리의 수은 기압계 원리\t토리첼리의 수은 기압계 원리 (1기압 = 수은 기둥 76 cm 압력 = 물 기둥 약 10.3 m 압력)\t\t[물리학 역학·열역학·파동] 토리첼리의 수은 기압계 원리 | 핵심 공식·원리: 1기압 = 수은 기둥 76 cm 압력 = 물 기둥 약 10.3 m 압력 | 해설: 진공 유리관 속 수은 기둥의", "파스칼의 원리(유압 장치)\t파스칼의 원리(유압 장치) (P₁ = P₂ ➔ F₁ / A₁ = F₂ / A₂)\t\t[물리학 역학·열역학·파동] 파스칼의 원리(유압 장치) | 핵심 공식·원리: P₁ = P₂ ➔ F₁ / A₁ = F₂ / A₂ | 해설: 밀폐된 비압축성 유체의 일부분에 가한 압력은 모든 ", "아르키메데스의 부력 원리\t아르키메데스의 부력 원리 (B = ρ_유체·V_잠긴부피·g (단위)\t\t[물리학 역학·열역학·파동] 아르키메데스의 부력 원리 | 핵심 공식·원리: B = ρ_유체·V_잠긴부피·g (단위 | 해설: N):유체 속에 잠긴 물체가 받는 위쪽 방향의 부력은 물체가 밀", "연속 방정식(유량 보존 법칙)\t연속 방정식(유량 보존 법칙) (A₁v₁ = A₂v₂ = 일정 (비압축성 유체의 질량 보존))\t\t[물리학 역학·열역학·파동] 연속 방정식(유량 보존 법칙) | 핵심 공식·원리: A₁v₁ = A₂v₂ = 일정 (비압축성 유체의 질량 보존) | 해설: 굵기가 변하는 관을 흐르는 비압축성 ", "베르누이 정리(유체 에너지 보존)\t베르누이 정리(유체 에너지 보존) (P + ½ρv² + ρgh = 일정)\t\t[물리학 역학·열역학·파동] 베르누이 정리(유체 에너지 보존) | 핵심 공식·원리: P + ½ρv² + ρgh = 일정 | 해설: 비점성·비압축성 유체의 정상 흐름에서 압력 에너지, 운동 ", "마그누스 효과와 비행기 양력\t마그누스 효과와 비행기 양력 (빠른 유속 쪽의 압력이 낮아져 압력 차에 의해 수직 방향 힘 발생)\t\t[물리학 역학·열역학·파동] 마그누스 효과와 비행기 양력 | 핵심 공식·원리: 빠른 유속 쪽의 압력이 낮아져 압력 차에 의해 수직 방향 힘 발생 | 해설: 베르누이 정리에 따라 회전하는 공", "온도와 열평형(열역학 제0법칙)\t온도와 열평형(열역학 제0법칙) (T_A = T_B 이고 T_B = T_C 이면 T_A = T_C)\t\t[물리학 역학·열역학·파동] 온도와 열평형(열역학 제0법칙) | 핵심 공식·원리: T_A = T_B 이고 T_B = T_C 이면 T_A = T_C | 해설: 접촉한 두 물체 사이에서 고온 ", "비열(Specific Heat)과 열량 공식\t비열(Specific Heat)과 열량 공식 (Q = c·m·ΔT (비열 단위)\t\t[물리학 역학·열역학·파동] 비열(Specific Heat)과 열량 공식 | 핵심 공식·원리: Q = c·m·ΔT (비열 단위 | 해설: kcal/(kg·°C) 또는 J/(kg·K)):어떤", "열용량(Heat Capacity)\t열용량(Heat Capacity) (C = c·m = Q / ΔT (단위)\t\t[물리학 역학·열역학·파동] 열용량(Heat Capacity) | 핵심 공식·원리: C = c·m = Q / ΔT (단위 | 해설: J/K):어떤 물체 전체의 온도를 1K 높이는 데 필요한", "상태 변화와 잠열(융해열·기화열)\t상태 변화와 잠열(융해열·기화열) (Q = m·L (상태 변화 중 온도 일정 유지))\t\t[물리학 역학·열역학·파동] 상태 변화와 잠열(융해열·기화열) | 핵심 공식·원리: Q = m·L (상태 변화 중 온도 일정 유지) | 해설: 물질이 고체·액체·기체로 상태가 변할 때 온도", "열팽창(선팽창과 부피팽창)\t열팽창(선팽창과 부피팽창) (L = L₀(1 + αΔT), V = V₀(1 + βΔT) (β ≈ 3α))\t\t[물리학 역학·열역학·파동] 열팽창(선팽창과 부피팽창) | 핵심 공식·원리: L = L₀(1 + αΔT), V = V₀(1 + βΔT) (β ≈ 3α) | 해설: 온도가 올라감에 따라 분자", "보일 법칙(등온 변화)\t보일 법칙(등온 변화) (P₁V₁ = P₂V₂ = 일정 (온도 T 일정))\t\t[물리학 역학·열역학·파동] 보일 법칙(등온 변화) | 핵심 공식·원리: P₁V₁ = P₂V₂ = 일정 (온도 T 일정) | 해설: 일정한 온도에서 일정량의 기체 부피 V는 압력 P에 반비", "샤를 법칙(등압 변화)\t샤를 법칙(등압 변화) (V₁ / T₁ = V₂ / T₂ = 일정 (압력 P 일정, T는 절대온도))\t\t[물리학 역학·열역학·파동] 샤를 법칙(등압 변화) | 핵심 공식·원리: V₁ / T₁ = V₂ / T₂ = 일정 (압력 P 일정, T는 절대온도) | 해설: 일정한 압력에서 기체 부피는 ", "보일-샤를 법칙\t보일-샤를 법칙 (P₁V₁ / T₁ = P₂V₂ / T₂ = 일정)\t\t[물리학 역학·열역학·파동] 보일-샤를 법칙 | 핵심 공식·원리: P₁V₁ / T₁ = P₂V₂ / T₂ = 일정 | 해설: 일정량의 이상 기체에서 압력과 부피의 곱을 절대온도로 나눈 값은", "이상 기체 상태 방정식\t이상 기체 상태 방정식 (PV = nRT = NkT (R = 8.31 J/(mol·K)))\t\t[물리학 역학·열역학·파동] 이상 기체 상태 방정식 | 핵심 공식·원리: PV = nRT = NkT (R = 8.31 J/(mol·K)) | 해설: 이상 기체의 압력 P, 부피 V, 몰수 ", "기체 분자 운동론과 평균 운동 에너지\t기체 분자 운동론과 평균 운동 에너지\t\t[물리학 역학·열역학·파동] 기체 분자 운동론과 평균 운동 에너지 | 핵심 공식·원리: Ek_평균 = ½mv_rms² = (3/2)kT (오직 절대온도 T에만 비례) | 해설: 이상 기체 ", "이상 기체의 제곱평균제곱근(rms) 속력\t이상 기체의 제곱평균제곱근(rms) 속력\t\t[물리학 역학·열역학·파동] 이상 기체의 제곱평균제곱근(rms) 속력 | 핵심 공식·원리: v_rms = √(3RT / M) (절대온도 제곱근에 비례, 분자량 제곱근에 반비례) | 해설: ", "단원자 분자 이상 기체의 내부 에너지\t단원자 분자 이상 기체의 내부 에너지 (U = N·(3/2)kT = (3/2)nRT)\t\t[물리학 역학·열역학·파동] 단원자 분자 이상 기체의 내부 에너지 | 핵심 공식·원리: U = N·(3/2)kT = (3/2)nRT | 해설: 분자 간 인력을 무시하는 이상 기체의 내부 에", "기체가 외부에 한 일(부피 변화와 일)\t기체가 외부에 한 일(부피 변화와 일) (W = P·ΔV (P-V 그래프 아래의 넓이))\t\t[물리학 역학·열역학·파동] 기체가 외부에 한 일(부피 변화와 일) | 핵심 공식·원리: W = P·ΔV (P-V 그래프 아래의 넓이) | 해설: 기체가 압력 P를 유지하며 부피가 ΔV만큼", "열역학 제1법칙(열과 에너지 보존)\t열역학 제1법칙(열과 에너지 보존) (Q = ΔU + W = ΔU + PΔV)\t\t[물리학 역학·열역학·파동] 열역학 제1법칙(열과 에너지 보존) | 핵심 공식·원리: Q = ΔU + W = ΔU + PΔV | 해설: 기체에 가해준 열량 Q는 기체의 내부 에너지 변화량 ", "등적 과정(정적 변화)\t등적 과정(정적 변화) (ΔV = 0 ➔ W = 0, Q = ΔU = n·Cv·ΔT)\t\t[물리학 역학·열역학·파동] 등적 과정(정적 변화) | 핵심 공식·원리: ΔV = 0 ➔ W = 0, Q = ΔU = n·Cv·ΔT | 해설: 부피가 일정한 밀폐 용기에서 기체를 가열할 때", "등압 과정(정압 변화)\t등압 과정(정압 변화)\t\t[물리학 역학·열역학·파동] 등압 과정(정압 변화) | 핵심 공식·원리: P = 일정 ➔ Q = ΔU + PΔV = n·Cp·ΔT (Cp = Cv + R) | 해설: 압력이 일정하게 유지되", "등온 과정(온도 일정 변화)\t등온 과정(온도 일정 변화) (ΔT = 0 ➔ ΔU = 0, Q = W)\t\t[물리학 역학·열역학·파동] 등온 과정(온도 일정 변화) | 핵심 공식·원리: ΔT = 0 ➔ ΔU = 0, Q = W | 해설: 이상 기체의 온도가 일정하게 유지되어 내부 에너지 변화가 ", "단열 과정(열 출입 차단 변화)\t단열 과정(열 출입 차단 변화)\t\t[물리학 역학·열역학·파동] 단열 과정(열 출입 차단 변화) | 핵심 공식·원리: Q = 0 ➔ W = -ΔU (단열 팽창 시 온도 하강, 단열 압축 시 온도 상승) | 해설: 외부와 열 ", "열기관의 열효율 정의\t열기관의 열효율 정의\t\t[물리학 역학·열역학·파동] 열기관의 열효율 정의 | 핵심 공식·원리: e = W / Q₁ = (Q₁ - Q₂) / Q₁ = 1 - (Q₂ / Q₁) (항상 e < 1) | 해설: 고온 열", "카르노 기관과 최대 열효율\t카르노 기관과 최대 열효율 (e_카르노 = 1 - (T₂ / T₁) (T₁, T₂는 절대온도))\t\t[물리학 역학·열역학·파동] 카르노 기관과 최대 열효율 | 핵심 공식·원리: e_카르노 = 1 - (T₂ / T₁) (T₁, T₂는 절대온도) | 해설: 두 등온 과정과 두 단열 과정으로 ", "열역학 제2법칙(엔트로피 증가와 비가역성)\t열역학 제2법칙(엔트로피 증가와 비가역성) (ΔS_우주 ≥ 0 (고립계의 무질서도 증가, 제2종 영구기관 불가능))\t\t[물리학 역학·열역학·파동] 열역학 제2법칙(엔트로피 증가와 비가역성) | 핵심 공식·원리: ΔS_우주 ≥ 0 (고립계의 무질서도 증가, 제2종 영구기관 불가능) | 해설: 열은 스스로 저", "파동의 주기와 진동수 관계\t파동의 주기와 진동수 관계 (f = 1 / T (진동수 단위)\t\t[물리학 역학·열역학·파동] 파동의 주기와 진동수 관계 | 핵심 공식·원리: f = 1 / T (진동수 단위 | 해설: Hz = s⁻¹, 주기 단위: s):매질의 한 점이 1회 진동하는 데", "파동의 전파 속력 공식\t파동의 전파 속력 공식 (v = f·λ = λ / T (진동수는 파원에서 결정되어 굴절 시 불변))\t\t[물리학 역학·열역학·파동] 파동의 전파 속력 공식 | 핵심 공식·원리: v = f·λ = λ / T (진동수는 파원에서 결정되어 굴절 시 불변) | 해설: 파동이 한 주기 동안 이동한 거", "횡파(Transverse Wave)와 종파(Longitudinal Wave)\t횡파(Transverse Wave)와 종파(Longitudinal Wave) (횡파(진행 방향 ⊥ 진동 방향)\t\t[물리학 역학·열역학·파동] 횡파(Transverse Wave)와 종파(Longitudinal Wave) | 핵심 공식·원리: 횡파(진행 방향 ⊥ 진동 방향 | 해설: 전자기파·지진파 S파", "줄을 따라 전파되는 파동의 속력\t줄을 따라 전파되는 파동의 속력 (v = √(T / μ) (T는 줄의 장력, μ는 단위 길이당 질량 선밀도))\t\t[물리학 역학·열역학·파동] 줄을 따라 전파되는 파동의 속력 | 핵심 공식·원리: v = √(T / μ) (T는 줄의 장력, μ는 단위 길이당 질량 선밀도) | 해설: 현악기 줄의 장력이 ", "소리의 3요소(크기·높이·맵시)\t소리의 3요소(크기·높이·맵시) (소리의 크기 ↔ 진폭, 소리의 높이 ↔ 진동수, 소리의 맵시(음색) ↔ 파형)\t\t[물리학 역학·열역학·파동] 소리의 3요소(크기·높이·맵시) | 핵심 공식·원리: 소리의 크기 ↔ 진폭, 소리의 높이 ↔ 진동수, 소리의 맵시(음색) ↔ 파형 | 해설: 음파의 물리적 성질", "기주 공명과 정상파(양끝 열린 관 vs 한쪽 막힌 관)\t기주 공명과 정상파(양끝 열린 관 vs 한쪽 막힌 관)\t\t[물리학 역학·열역학·파동] 기주 공명과 정상파(양끝 열린 관 vs 한쪽 막힌 관) | 핵심 공식·원리: 개관 λ_n = 2L/n (n=1,2,3...), 폐관 λ_n = 4L/(2n-1)", "맥놀이(Beat) 현상과 맥놀이 진동수\t맥놀이(Beat) 현상과 맥놀이 진동수\t\t[물리학 역학·열역학·파동] 맥놀이(Beat) 현상과 맥놀이 진동수 | 핵심 공식·원리: 맥놀이(Beat) 현상과 맥놀이 진동수 | 해설: f_맥놀이 =", "(단위 시간당 소리가 커졌다 작아지는 횟수)\t(단위 시간당 소리가 커졌다 작아지는 횟수)\t\t[물리학 역학·열역학·파동] (단위 시간당 소리가 커졌다 작아지는 횟수) | 핵심 공식·원리: (단위 시간당 소리가 커졌다 작아지는 횟수) | 해설: 진동수가 조금 다른 두 음파가 중첩될 ", "호이겐스 원리(파면의 전파)\t호이겐스 원리(파면의 전파)\t\t[물리학 역학·열역학·파동] 호이겐스 원리(파면의 전파) | 핵심 공식·원리: 파면 위의 모든 점은 새로운 구면 소파(작은 파동)를 만드는 파원이 되며 이에 접하는 면이 다음 파면이 된다는", "반사의 법칙\t반사의 법칙 (입사각 i = 반사각 r (입사 광선, 반사 광선, 법선은 동일 평면))\t\t[물리학 역학·열역학·파동] 반사의 법칙 | 핵심 공식·원리: 입사각 i = 반사각 r (입사 광선, 반사 광선, 법선은 동일 평면) | 해설: 파동이 경계면에서 반사될 때 입사각과 반사각", "스넬의 굴절 법칙\t스넬의 굴절 법칙\t\t[물리학 역학·열역학·파동] 스넬의 굴절 법칙 | 핵심 공식·원리: n₁·sinθ₁ = n₂·sinθ₂ ➔ sinθ₁ / sinθ₂ = v₁ / v₂ = λ₁ / λ₂ = n₂ / n₁ |", "임계각과 전반사 조건\t임계각과 전반사 조건\t\t[물리학 역학·열역학·파동] 임계각과 전반사 조건 | 핵심 공식·원리: 굴절률이 큰 매질(n₁)에서 작은 매질(n₂)로 진행 & 입사각 θ > θ_c (sinθ_c = n₂/n₁) | 해설", "회절(Diffraction) 현상\t회절(Diffraction) 현상 (슬릿의 폭 d가 좁을수록, 파장 λ가 길수록 회절이 잘 일어남)\t\t[물리학 역학·열역학·파동] 회절(Diffraction) 현상 | 핵심 공식·원리: 슬릿의 폭 d가 좁을수록, 파장 λ가 길수록 회절이 잘 일어남 | 해설: 파동이 장애물 뒤쪽이나 좁은 틈", "영(Young)의 이중 슬릿 간섭 실험\t영(Young)의 이중 슬릿 간섭 실험 (밝은 무늬 간격 Δx = L·λ / d (빛의 파동성 실증))\t\t[물리학 역학·열역학·파동] 영(Young)의 이중 슬릿 간섭 실험 | 핵심 공식·원리: 밝은 무늬 간격 Δx = L·λ / d (빛의 파동성 실증) | 해설: 두 슬릿(간격 d)을 통과한", "얇은 막에 의한 빛의 간섭\t얇은 막에 의한 빛의 간섭\t\t[물리학 역학·열역학·파동] 얇은 막에 의한 빛의 간섭 | 핵심 공식·원리: 비눗방울이나 물 위의 기름막 윗면 반사광과 아랫면 반사광의 경로차·위상 변화에 의한 색깔 무늬 | 해설: 무반사", "빛의 편광(Polarization)\t빛의 편광(Polarization) (횡파인 빛에서 전기장 진동 방향이 특정 평면으로 제한되는 현상)\t\t[물리학 역학·열역학·파동] 빛의 편광(Polarization) | 핵심 공식·원리: 횡파인 빛에서 전기장 진동 방향이 특정 평면으로 제한되는 현상 | 해설: 종파에서는 일어나지 않고 횡파", "도플러 효과 진동수 공식\t도플러 효과 진동수 공식\t\t[물리학 역학·열역학·파동] 도플러 효과 진동수 공식 | 핵심 공식·원리: f = f₀·(v ± v_관측자) / (v ∓ v_파원) (접근 시 진동수 증가·청색편이, 후퇴 시 감소·적색편이", "오목 거울과 볼록 거울 및 렌즈 공식\t오목 거울과 볼록 거울 및 렌즈 공식\t\t[물리학 역학·열역학·파동] 오목 거울과 볼록 거울 및 렌즈 공식 | 핵심 공식·원리: 오목 거울과 볼록 거울 및 렌즈 공식 | 해설: 1/a + 1/b = 1/f, 배율 m =", "(a\t(a (물체 거리, b)\t\t[물리학 역학·열역학·파동] (a | 핵심 공식·원리: 물체 거리, b | 해설: 상 거리, f: 초점 거리):구면 거울과 얇은 렌즈에서 물체의 위치에 따른 실상·허상의 위치와 배율을 구하", "전하량 보존 법칙과 기본 전하량\t전하량 보존 법칙과 기본 전하량 (e = 1.6×10⁻¹⁹ C (밀리컨 기름방울 실험으로 측정))\t\t[물리학 전자기학·양자·현대물리] 전하량 보존 법칙과 기본 전하량 | 핵심 공식·원리: e = 1.6×10⁻¹⁹ C (밀리컨 기름방울 실험으로 측정) | 해설: 모든 전하량은 기본 전하량 ", "정전기 유도와 유전 분극\t정전기 유도와 유전 분극\t\t[물리학 전자기학·양자·현대물리] 정전기 유도와 유전 분극 | 핵심 공식·원리: 도체에서는 자유 전자가 이동(정전기 유도)하고 절연체에서는 쌍극자가 정렬(유전 분극)되어 가까운 쪽에 반대 ", "쿨롱의 법칙(정전기력)\t쿨롱의 법칙(정전기력)\t\t[물리학 전자기학·양자·현대물리] 쿨롱의 법칙(정전기력) | 핵심 공식·원리: 쿨롱의 법칙(정전기력) | 해설: F = k·", "/ r² (k ≈ 8.99×10⁹ N·m²/C²)\t/ r² (k ≈ 8.99×10⁹ N·m²/C²)\t\t[물리학 전자기학·양자·현대물리] / r² (k ≈ 8.99×10⁹ N·m²/C²) | 핵심 공식·원리: / r² (k ≈ 8.99×10⁹ N·m²/C²) | 해설: 두 점전하 사이에 작용", "전기장(Electric Field)의 세기\t전기장(Electric Field)의 세기\t\t[물리학 전자기학·양자·현대물리] 전기장(Electric Field)의 세기 | 핵심 공식·원리: 전기장(Electric Field)의 세기 | 해설: E = F / q = k·", "/ r² (단위\t/ r² (단위 (N/C 또는 V/m))\t\t[물리학 전자기학·양자·현대물리] / r² (단위 | 핵심 공식·원리: N/C 또는 V/m) | 해설: 전기장 내 한 점에 놓인 단위 양전하(+1C)가 받는 전기력의 크기와 방향", "가우스 법칙(전기 선속)\t가우스 법칙(전기 선속) (Φ_E = ∮E·dA = Q_내부 / ε₀)\t\t[물리학 전자기학·양자·현대물리] 가우스 법칙(전기 선속) | 핵심 공식·원리: Φ_E = ∮E·dA = Q_내부 / ε₀ | 해설: 폐곡면을 통과하는 총 전기 선속은 그 폐곡면 내부에 포", "전위(Electric Potential)와 전위차(전압)\t전위(Electric Potential)와 전위차(전압) (V = W / q = k·Q / r (단위)\t\t[물리학 전자기학·양자·현대물리] 전위(Electric Potential)와 전위차(전압) | 핵심 공식·원리: V = W / q = k·Q / r (단위 | 해설: 볼트 V = J/C),", "평행판 축전기(커패시터)의 정전 용량\t평행판 축전기(커패시터)의 정전 용량 (C = Q / V = ε·(A / d) (단위)\t\t[물리학 전자기학·양자·현대물리] 평행판 축전기(커패시터)의 정전 용량 | 핵심 공식·원리: C = Q / V = ε·(A / d) (단위 | 해설: 패럿 F = C/V):두 금속판의 넓이", "축전기의 직렬연결과 병렬연결\t축전기의 직렬연결과 병렬연결\t\t[물리학 전자기학·양자·현대물리] 축전기의 직렬연결과 병렬연결 | 핵심 공식·원리: 병렬 합성 용량 C = C₁ + C₂, 직렬 합성 용량 1/C = 1/C₁ + 1/C₂ (저항과 반대) ", "축전기에 저장된 전기 에너지\t축전기에 저장된 전기 에너지 (U = ½QV = ½CV² = Q² / (2C) (단위)\t\t[물리학 전자기학·양자·현대물리] 축전기에 저장된 전기 에너지 | 핵심 공식·원리: U = ½QV = ½CV² = Q² / (2C) (단위 | 해설: J):축전기를 충전하는 동안 전원이 한", "전류(Electric Current)의 정의와 미시적 표현\t전류(Electric Current)의 정의와 미시적 표현 (I = Q / t = n·e·A·v_d (단위)\t\t[물리학 전자기학·양자·현대물리] 전류(Electric Current)의 정의와 미시적 표현 | 핵심 공식·원리: I = Q / t = n·e·A·v_d (단위 | 해설: 암페어 A = C", "옴의 법칙과 전기 저항\t옴의 법칙과 전기 저항 (I = V / R ➔ V = I·R (저항 단위)\t\t[물리학 전자기학·양자·현대물리] 옴의 법칙과 전기 저항 | 핵심 공식·원리: I = V / R ➔ V = I·R (저항 단위 | 해설: 옴 Ω = V/A):도체에 흐르는 전류는 걸어준 전", "물질의 비저항과 저항 공식\t물질의 비저항과 저항 공식 (R = ρ·(L / A) (비저항 ρ 단위)\t\t[물리학 전자기학·양자·현대물리] 물질의 비저항과 저항 공식 | 핵심 공식·원리: R = ρ·(L / A) (비저항 ρ 단위 | 해설: Ω·m):도선의 저항은 물질 고유 성질인 비저항 ρ와", "저항의 직렬연결 법칙\t저항의 직렬연결 법칙 (I = I₁ = I₂ 일정, V = V₁ + V₂ (전압 분배 V₁)\t\t[물리학 전자기학·양자·현대물리] 저항의 직렬연결 법칙 | 핵심 공식·원리: I = I₁ = I₂ 일정, V = V₁ + V₂ (전압 분배 V₁ | 해설: V₂ = R₁:R₂), 합성 저항", "저항의 병렬연결 법칙\t저항의 병렬연결 법칙 (V = V₁ = V₂ 일정, I = I₁ + I₂ (전류 분배 I₁)\t\t[물리학 전자기학·양자·현대물리] 저항의 병렬연결 법칙 | 핵심 공식·원리: V = V₁ = V₂ 일정, I = I₁ + I₂ (전류 분배 I₁ | 해설: I₂ = 1/R₁:1/R₂), 역", "키르히호프 제1법칙(전류 법칙, KCL)\t키르히호프 제1법칙(전류 법칙, KCL) (ΣI_유입 = ΣI_유출 (전하량 보존 법칙))\t\t[물리학 전자기학·양자·현대물리] 키르히호프 제1법칙(전류 법칙, KCL) | 핵심 공식·원리: ΣI_유입 = ΣI_유출 (전하량 보존 법칙) | 해설: 회로의 임의의 접합점(마디)으로 흘", "키르히호프 제2법칙(전압 법칙, KVL)\t키르히호프 제2법칙(전압 법칙, KVL)\t\t[물리학 전자기학·양자·현대물리] 키르히호프 제2법칙(전압 법칙, KVL) | 핵심 공식·원리: ΣV_기전력 = Σ(I·R) (폐회로 일주 시 전위 변화 총합 = 0, 에너지 보존 법칙) ", "전력(Electric Power)과 전력량·줄의 법칙\t전력(Electric Power)과 전력량·줄의 법칙 (전력 P = V·I = I²R = V²/R (단위)\t\t[물리학 전자기학·양자·현대물리] 전력(Electric Power)과 전력량·줄의 법칙 | 핵심 공식·원리: 전력 P = V·I = I²R = V²/R (단위 | 해설: W), 발열량 Q ", "전지의 기전력과 내부 저항·단자 전압\t전지의 기전력과 내부 저항·단자 전압 (단자 전압 V = E - I·r (E는 기전력, r은 전지 내부 저항))\t\t[물리학 전자기학·양자·현대물리] 전지의 기전력과 내부 저항·단자 전압 | 핵심 공식·원리: 단자 전압 V = E - I·r (E는 기전력, r은 전지 내부 저항) | 해설: 전지에 전류 ", "휘트스톤 브리지 평형 조건\t휘트스톤 브리지 평형 조건\t\t[물리학 전자기학·양자·현대물리] 휘트스톤 브리지 평형 조건 | 핵심 공식·원리: 검류계 전류 I_G = 0 일 때 R₁·R₄ = R₂·R₃ (마주 보는 저항의 곱이 같음) | 해설: 네 ", "직선 전류에 의한 자기장(앙페르 법칙)\t직선 전류에 의한 자기장(앙페르 법칙)\t\t[물리학 전자기학·양자·현대물리] 직선 전류에 의한 자기장(앙페르 법칙) | 핵심 공식·원리: B = k'·I / r (k' = μ₀/(2π) = 2×10⁻⁷ T·m/A, 방향은 오른나사 ", "원형 전류 중심에서의 자기장\t원형 전류 중심에서의 자기장 (B = k''·I / r (k'' = μ₀/2 = π×10⁻⁷ T·m/A))\t\t[물리학 전자기학·양자·현대물리] 원형 전류 중심에서의 자기장 | 핵심 공식·원리: B = k''·I / r (k'' = μ₀/2 = π×10⁻⁷ T·m/A) | 해설: 반지름 r인 원형 ", "솔레노이드(원통형 코일) 내부의 균일 자기장\t솔레노이드(원통형 코일) 내부의 균일 자기장 (B = μ₀·n·I (n = N / L 은 단위 길이당 감은 수))\t\t[물리학 전자기학·양자·현대물리] 솔레노이드(원통형 코일) 내부의 균일 자기장 | 핵심 공식·원리: B = μ₀·n·I (n = N / L 은 단위 길이당 감은 수) | 해설: 촘촘히 감은", "균일 자기장 속 전류 도선이 받는 자기력\t균일 자기장 속 전류 도선이 받는 자기력 (F = B·I·l·sinθ (방향)\t\t[물리학 전자기학·양자·현대물리] 균일 자기장 속 전류 도선이 받는 자기력 | 핵심 공식·원리: F = B·I·l·sinθ (방향 | 해설: 플레밍의 왼손 법칙 / 오른손 손바닥 법칙):자", "평행한 두 직선 전류 사이의 힘\t평행한 두 직선 전류 사이의 힘\t\t[물리학 전자기학·양자·현대물리] 평행한 두 직선 전류 사이의 힘 | 핵심 공식·원리: 같은 방향 전류는 인력, 반대 방향 전류는 척력 (F/l = μ₀I₁I₂ / (2πd)) | 해설: ", "로렌츠 힘(자기장 속 운동 전하가 받는 힘)\t로렌츠 힘(자기장 속 운동 전하가 받는 힘)\t\t[물리학 전자기학·양자·현대물리] 로렌츠 힘(자기장 속 운동 전하가 받는 힘) | 핵심 공식·원리: 로렌츠 힘(자기장 속 운동 전하가 받는 힘) | 해설: F =", "B))\tB))\t\t[물리학 전자기학·양자·현대물리] B)) | 핵심 공식·원리: B)) | 해설: 자기장 B에 수직으로 입사한 전하 q가 속력 변화 없이 구심력을 받아 원운동(사이클로트론·질량분석기)하는 원", "홀 효과(Hall Effect)\t홀 효과(Hall Effect)\t\t[물리학 전자기학·양자·현대물리] 홀 효과(Hall Effect) | 핵심 공식·원리: 전류가 흐르는 도체·반도체에 수직 자기장을 걸면 전하 운반자가 한쪽으로 쏠려 홀 전압 V_H 발생 |", "자기 선속(자속, Magnetic Flux)\t자기 선속(자속, Magnetic Flux) (Φ = B·A·cosθ (단위)\t\t[물리학 전자기학·양자·현대물리] 자기 선속(자속, Magnetic Flux) | 핵심 공식·원리: Φ = B·A·cosθ (단위 | 해설: 웨버 Wb = T·m²):단면적 A인 면을 수직", "패러데이 전자기 유도 법칙\t패러데이 전자기 유도 법칙\t\t[물리학 전자기학·양자·현대물리] 패러데이 전자기 유도 법칙 | 핵심 공식·원리: 유도 기전력 V = -N·(ΔΦ / Δt) (발전기·인덕션·무선충전·마이크의 원리) | 해설: 코일을 통과", "렌츠의 법칙(유도 전류의 방향)\t렌츠의 법칙(유도 전류의 방향)\t\t[물리학 전자기학·양자·현대물리] 렌츠의 법칙(유도 전류의 방향) | 핵심 공식·원리: 유도 전류는 코일을 통과하는 자기 선속의 변화를 방해하는 방향(에너지 보존 법칙)으로 흐름 | 해설:", "운동 기전력(자기장 속 움직이는 도체 막대)\t운동 기전력(자기장 속 움직이는 도체 막대)\t\t[물리학 전자기학·양자·현대물리] 운동 기전력(자기장 속 움직이는 도체 막대) | 핵심 공식·원리: V = B·l·v (유도 전류 I = Blv / R, 자기력 F = B²l²v / R) ", "자체 유도(인덕턴스 L)와 코일 역기전력\t자체 유도(인덕턴스 L)와 코일 역기전력 (V = -L·(ΔI / Δt) (L 단위)\t\t[물리학 전자기학·양자·현대물리] 자체 유도(인덕턴스 L)와 코일 역기전력 | 핵심 공식·원리: V = -L·(ΔI / Δt) (L 단위 | 해설: 헨리 H, 저장 자기 에너지 U = ½L", "교류(AC)의 실효값(유효 전압·전류)\t교류(AC)의 실효값(유효 전압·전류)\t\t[물리학 전자기학·양자·현대물리] 교류(AC)의 실효값(유효 전압·전류) | 핵심 공식·원리: V_실효 = V_최대 / √2, I_실효 = I_최대 / √2, 평균 소비 전력 P = V_실", "축전기 용량 리액턴스(Xc)와 코일 유도 리액턴스(XL)\t축전기 용량 리액턴스(Xc)와 코일 유도 리액턴스(XL)\t\t[물리학 전자기학·양자·현대물리] 축전기 용량 리액턴스(Xc)와 코일 유도 리액턴스(XL) | 핵심 공식·원리: X_C = 1 / (2πfC) (고주파 통과), X_L = 2πfL (저주파", "RLC 직렬 교류 회로의 임피던스(Z)와 공진 진동수(f₀)\tRLC 직렬 교류 회로의 임피던스(Z)와 공진 진동수(f₀)\t\t[물리학 전자기학·양자·현대물리] RLC 직렬 교류 회로의 임피던스(Z)와 공진 진동수(f₀) | 핵심 공식·원리: 임피던스 Z = √(R² + (X_L - X_C)²), 공진 조건 X_L", "변압기(Transformer) 전압·전류 변환 공식\t변압기(Transformer) 전압·전류 변환 공식\t\t[물리학 전자기학·양자·현대물리] 변압기(Transformer) 전압·전류 변환 공식 | 핵심 공식·원리: V₁ / V₂ = N₁ / N₂ = I₂ / I₁ (에너지 보존 P₁ = V₁I₁", "맥스웰 전자기 방정식과 전자기파 속력\t맥스웰 전자기 방정식과 전자기파 속력\t\t[물리학 전자기학·양자·현대물리] 맥스웰 전자기 방정식과 전자기파 속력 | 핵심 공식·원리: c = 1 / √(ε₀·μ₀) ≈ 3.0×10⁸ m/s (헤르츠의 불꽃 방전 실험으로 실증) |", "흑체 복사와 플랑크 양자 가설\t흑체 복사와 플랑크 양자 가설 (E = n·h·f (h ≈ 6.626×10⁻³⁴ J·s 는 플랑크 상수))\t\t[물리학 전자기학·양자·현대물리] 흑체 복사와 플랑크 양자 가설 | 핵심 공식·원리: E = n·h·f (h ≈ 6.626×10⁻³⁴ J·s 는 플랑크 상수) | 해설: 고전 물리학의 자외", "빈의 변위 법칙(흑체 복사 최대 파장)\t빈의 변위 법칙(흑체 복사 최대 파장) (λ_max · T = b (일정, b ≈ 2.898×10⁻³ m·K))\t\t[물리학 전자기학·양자·현대물리] 빈의 변위 법칙(흑체 복사 최대 파장) | 핵심 공식·원리: λ_max · T = b (일정, b ≈ 2.898×10⁻³ m·K) | 해설: 물체의 절대온", "광전 효과와 광전자의 최대 운동 에너지\t광전 효과와 광전자의 최대 운동 에너지\t\t[물리학 전자기학·양자·현대물리] 광전 효과와 광전자의 최대 운동 에너지 | 핵심 공식·원리: Ek_max = h·f - W = h·f - h·f₀ = e·V_정지 (W는 일함수, f₀는 ", "콤프턴 산란 효과(X선과 전자의 충돌)\t콤프턴 산란 효과(X선과 전자의 충돌)\t\t[물리학 전자기학·양자·현대물리] 콤프턴 산란 효과(X선과 전자의 충돌) | 핵심 공식·원리: 산란된 X선의 파장 증가 Δλ = (h / (m_e·c))·(1 - cosθ) | 해설: X선", "드브로이 물질파 파장 공식\t드브로이 물질파 파장 공식\t\t[물리학 전자기학·양자·현대물리] 드브로이 물질파 파장 공식 | 핵심 공식·원리: λ = h / p = h / (mv) = h / √(2m·Ek) = h / √(2meV) | 해설: 빛뿐만", "데이비슨-거머 전자선 회절 실험\t데이비슨-거머 전자선 회절 실험 (니켈 결정 표면에 전자를 쏘았을 때 X선과 동일한 회절·간섭 무늬가 관측됨)\t\t[물리학 전자기학·양자·현대물리] 데이비슨-거머 전자선 회절 실험 | 핵심 공식·원리: 니켈 결정 표면에 전자를 쏘았을 때 X선과 동일한 회절·간섭 무늬가 관측됨 | 해설: 드브로이가 예언", "하이젠베르크 불확정성 원리\t하이젠베르크 불확정성 원리\t\t[물리학 전자기학·양자·현대물리] 하이젠베르크 불확정성 원리 | 핵심 공식·원리: Δx · Δp ≥ ħ / 2 (또는 ΔE · Δt ≥ ħ / 2, ħ = h / 2π) | 해설: 미시 세", "수소 원자 선스펙트럼 계열(라이먼·발머·파셴 계열)\t수소 원자 선스펙트럼 계열(라이먼·발머·파셴 계열)\t\t[물리학 전자기학·양자·현대물리] 수소 원자 선스펙트럼 계열(라이먼·발머·파셴 계열) | 핵심 공식·원리: n ≥ 2 에서 n=1 전이 시 라이먼 계열(자외선), n=2 전이 시 발머 계열", "양자 터널링 효과(Tunneling Effect)\t양자 터널링 효과(Tunneling Effect)\t\t[물리학 전자기학·양자·현대물리] 양자 터널링 효과(Tunneling Effect) | 핵심 공식·원리: 입자의 에너지가 퍼텐셜 에너지 장벽보다 낮아도 물질파 확률 파동이 장벽을 투과하는 ", "초전도체와 임계 온도·마이스너 효과\t초전도체와 임계 온도·마이스너 효과\t\t[물리학 전자기학·양자·현대물리] 초전도체와 임계 온도·마이스너 효과 | 핵심 공식·원리: 임계 온도(Tc) 이하에서 전기 저항 R = 0 이 되고 내부 자기장을 완전히 밀어내는 완전 반자", "트랜지스터(BJT·MOSFET)의 증폭 및 스위칭 작용\t트랜지스터(BJT·MOSFET)의 증폭 및 스위칭 작용\t\t[물리학 전자기학·양자·현대물리] 트랜지스터(BJT·MOSFET)의 증폭 및 스위칭 작용 | 핵심 공식·원리: 베이스(또는 게이트)의 미세한 전류·전압 신호로 컬렉터-이미터(드레인-소스) ", "마이컬슨-몰리 실험\t마이컬슨-몰리 실험\t\t[물리학 전자기학·양자·현대물리] 마이컬슨-몰리 실험 | 핵심 공식·원리: 빛의 매질로 가정했던 에테르(Ether)의 존재를 부정하고 모든 방향에서 빛의 속력이 일정함을 증명 | 해설: 아", "로렌츠 인자(γ)와 시간 지연·길이 수축 공식\t로렌츠 인자(γ)와 시간 지연·길이 수축 공식\t\t[물리학 전자기학·양자·현대물리] 로렌츠 인자(γ)와 시간 지연·길이 수축 공식 | 핵심 공식·원리: γ = 1 / √(1 - v²/c²) ≥ 1 ➔ 시간 지연 Δt = γ·Δt₀, 길이 ", "뮤온(Muon)의 지표면 도달 현상\t뮤온(Muon)의 지표면 도달 현상\t\t[물리학 전자기학·양자·현대물리] 뮤온(Muon)의 지표면 도달 현상 | 핵심 공식·원리: 상층 대기에서 생성된 짧은 수명의 뮤온이 광속의 99%로 낙하하며 시간 지연(지구 관측자) 및 대", "핵력(강한 상호작용)과 원자핵의 안정성\t핵력(강한 상호작용)과 원자핵의 안정성\t\t[물리학 전자기학·양자·현대물리] 핵력(강한 상호작용)과 원자핵의 안정성 | 핵심 공식·원리: 양성자들 사이의 전기적 척력을 이기고 핵자(양성자·중성자)들을 약 10⁻¹⁵ m 거리 내에서 ", "핵분열(Nuclear Fission)과 감속재·제어봉\t핵분열(Nuclear Fission)과 감속재·제어봉\t\t[물리학 전자기학·양자·현대물리] 핵분열(Nuclear Fission)과 감속재·제어봉 | 핵심 공식·원리: 우라늄-235(²³⁵U)가 느린 중성자(열중성자)를 흡수해 쪼개지며 중성자 2~"], "math": ["소인수분해와 산술의 기본 정리\t소인수분해와 산술의 기본 정리\t\t[수와 연산·집합·명제·대수 항등식] 소인수분해와 산술의 기본 정리 | 공식: 모든 2 이상의 자연수는 유일하게 소수들의 곱(N = p₁^a₁ · p₂^a₂ ··· p_k^a_k)으로 분해", "최대공약수(GCD)와 최소공배수(LCM)의 관계\t최대공약수(GCD)와 최소공배수(LCM)의 관계\t\t[수와 연산·집합·명제·대수 항등식] 최대공약수(GCD)와 최소공배수(LCM)의 관계 | 공식: 두 자연수 A, B에 대하여 A = aG, B = bG (a, b는 서로소)일 때 L = a", "유클리드 호제법\t유클리드 호제법 (자연수 a를 b로 나눈 나머지가 r일 때 GCD(a, b) = GCD(b, r) 성립)\t\t[수와 연산·집합·명제·대수 항등식] 유클리드 호제법 | 공식: 자연수 a를 b로 나눈 나머지가 r일 때 GCD(a, b) = GCD(b, r) 성립 | 해설: 큰 두 정수의 최대공약수를 ", "순환소수의 분수 변환 공식\t순환소수의 분수 변환 공식\t\t[수와 연산·집합·명제·대수 항등식] 순환소수의 분수 변환 공식 | 공식: 소수점 아래 순환마디가 k개, 비순환마디가 m개일 때 분모에 9를 k개, 0을 m개 쓰고 분자에 (전체 수 - 비", "지수법칙(실수 지수로의 확장)\t지수법칙(실수 지수로의 확장)\t\t[수와 연산·집합·명제·대수 항등식] 지수법칙(실수 지수로의 확장) | 공식: a > 0, b > 0 이고 x, y가 실수일 때 a^x · a^y = a^(x+y), (a^x)^y = a^", "이중근호 변형 항등식\t이중근호 변형 항등식\t\t[수와 연산·집합·명제·대수 항등식] 이중근호 변형 항등식 | 공식: a > 0, b > 0 일 때 √((a+b) ± 2√(ab)) = √a ± √b (단, 뺄셈은 a ≥ b) | 해설: ", "집합의 포함-배제 원리(합집합의 원소 개수)\t집합의 포함-배제 원리(합집합의 원소 개수)\t\t[수와 연산·집합·명제·대수 항등식] 집합의 포함-배제 원리(합집합의 원소 개수) | 공식: n(A ∪ B) = n(A) + n(B) - n(A ∩ B), 3개 집합은 n(A)+n(B)+n", "드모르간의 법칙(집합과 논리)\t드모르간의 법칙(집합과 논리)\t\t[수와 연산·집합·명제·대수 항등식] 드모르간의 법칙(집합과 논리) | 공식: ~(A ∪ B) = A^c ∩ B^c 및 (A ∩ B)^c = A^c ∪ B^c (명제에서는 ~(p ∨ q) ", "멱집합(부분집합의 총개수) 공식\t멱집합(부분집합의 총개수) 공식\t\t[수와 연산·집합·명제·대수 항등식] 멱집합(부분집합의 총개수) 공식 | 공식: 원소가 n개인 유한집합 A의 부분집합 개수는 2^n개, 진부분집합 개수는 (2^n - 1)개, 특정 원소 k", "명제의 역·이·대우와 진리집합 포함 관계\t명제의 역·이·대우와 진리집합 포함 관계 (명제 p → q 가 참 ⇔ 대우 ~q → ~p 가 참 ⇔ 진리집합 P ⊂ Q)\t\t[수와 연산·집합·명제·대수 항등식] 명제의 역·이·대우와 진리집합 포함 관계 | 공식: 명제 p → q 가 참 ⇔ 대우 ~q → ~p 가 참 ⇔ 진리집합 P ⊂ Q | 해설: 원명제를 직", "필요조건·충분조건·필요충분조건 판정\t필요조건·충분조건·필요충분조건 판정\t\t[수와 연산·집합·명제·대수 항등식] 필요조건·충분조건·필요충분조건 판정 | 공식: p ⇒ q 이면 p는 q이기 위한 충분조건, q는 p이기 위한 필요조건 (P ⊂ Q) / p ⇔ q 이면", "귀류법(Reductio ad absurdum, 간접 증명법)\t귀류법(Reductio ad absurdum, 간접 증명법)\t\t[수와 연산·집합·명제·대수 항등식] 귀류법(Reductio ad absurdum, 간접 증명법) | 공식: 결론을 부정(~q)하여 가정이나 이미 알려진 공리·정리에 모순됨을 보임으로써 원", "완전제곱식과 곱셈 공식 변형(2변수)\t완전제곱식과 곱셈 공식 변형(2변수)\t\t[수와 연산·집합·명제·대수 항등식] 완전제곱식과 곱셈 공식 변형(2변수) | 공식: a² + b² = (a + b)² - 2ab = (a - b)² + 2ab 및 (a - b)² = (a", "세제곱 곱셈 공식과 변형식\t세제곱 곱셈 공식과 변형식\t\t[수와 연산·집합·명제·대수 항등식] 세제곱 곱셈 공식과 변형식 | 공식: a³ + b³ = (a + b)(a² - ab + b²) = (a + b)³ - 3ab(a + b), a³ - b", "3변수 합과 제곱의 합 항등식\t3변수 합과 제곱의 합 항등식 ((a + b + c)² = a² + b² + c² + 2(ab + bc + ca))\t\t[수와 연산·집합·명제·대수 항등식] 3변수 합과 제곱의 합 항등식 | 공식: (a + b + c)² = a² + b² + c² + 2(ab + bc + ca) | 해설: 세 수의 합과 제", "가우스(오일러) 3차 인수분해 항등식\t가우스(오일러) 3차 인수분해 항등식\t\t[수와 연산·집합·명제·대수 항등식] 가우스(오일러) 3차 인수분해 항등식 | 공식: a³ + b³ + c³ - 3abc = (a + b + c)(a² + b² + c² - ab - bc ", "복이차식 인수분해(보기차식 치환 및 합차 변형)\t복이차식 인수분해(보기차식 치환 및 합차 변형)\t\t[수와 연산·집합·명제·대수 항등식] 복이차식 인수분해(보기차식 치환 및 합차 변형) | 공식: x⁴ + ax² + b 형태에서 x² = t 치환이 안 될 때 (x² ± √b)² - (kx", "항등식의 성질과 미정계수법(계수비교법·수치대입법)\t항등식의 성질과 미정계수법(계수비교법·수치대입법)\t\t[수와 연산·집합·명제·대수 항등식] 항등식의 성질과 미정계수법(계수비교법·수치대입법) | 공식: 모든 x에 대하여 ax² + bx + c = 0 이 성립할 필요충분조건은 a = b = c", "나머지 정리(Remainder Theorem)\t나머지 정리(Remainder Theorem)\t\t[수와 연산·집합·명제·대수 항등식] 나머지 정리(Remainder Theorem) | 공식: 다항식 P(x)를 일차식 (x - α)로 나누었을 때의 나머지 R은 P(α)와 같음 (ax +", "인수정리(Factor Theorem)와 조립제법\t인수정리(Factor Theorem)와 조립제법\t\t[수와 연산·집합·명제·대수 항등식] 인수정리(Factor Theorem)와 조립제법 | 공식: 다항식 P(x)가 (x - α)로 나누어떨어진다 ⇔ P(α) = 0 ⇔ (x - α)는 P(", "비례식과 가비의 리(비율의 덧셈 성질)\t비례식과 가비의 리(비율의 덧셈 성질)\t\t[수와 연산·집합·명제·대수 항등식] 비례식과 가비의 리(비율의 덧셈 성질) | 공식: a/b = c/d = e/f = k (단, b+d+f ≠ 0) 이면 (a + c + e) / (b +", "부분분수 분해 항등식(망원급수 기초)\t부분분수 분해 항등식(망원급수 기초)\t\t[수와 연산·집합·명제·대수 항등식] 부분분수 분해 항등식(망원급수 기초) | 공식: 1 / (A · B) = (1 / (B - A)) · (1/A - 1/B) (단, A ≠ B) | 해설", "복소수의 정의와 켤레복소수 성질\t복소수의 정의와 켤레복소수 성질\t\t[수와 연산·집합·명제·대수 항등식] 복소수의 정의와 켤레복소수 성질 | 공식: 복소수의 정의와 켤레복소수 성질 | 해설: i = √(-1) (i² = -1, i³ = -i, i⁴ = 1 ", "²(실수)\t²(실수)\t\t[수와 연산·집합·명제·대수 항등식] ²(실수) | 공식: ²(실수) | 해설: 실수 계수 방정식에서 한 근이 a+bi 이면 켤레복소수 a-bi 도 반드시 근이 된다는 켤레근 정리의 기초", "음수의 제곱근 곱셈·나눗셈 부호 법칙\t음수의 제곱근 곱셈·나눗셈 부호 법칙\t\t[수와 연산·집합·명제·대수 항등식] 음수의 제곱근 곱셈·나눗셈 부호 법칙 | 공식: a < 0, b < 0 이면 √a · √b = -√(ab) 이고, a > 0, b < 0 이면 √a /", "단위복소수 오메가(ω, x³ = 1 의 한 허근) 항등식\t단위복소수 오메가(ω, x³ = 1 의 한 허근) 항등식\t\t[수와 연산·집합·명제·대수 항등식] 단위복소수 오메가(ω, x³ = 1 의 한 허근) 항등식 | 공식: ω³ = 1, ω² + ω + 1 = 0, ω + ω̄ = -1, ω · ω̄ = ", "이차방정식의 근의 공식과 짝수 근의 공식\t이차방정식의 근의 공식과 짝수 근의 공식\t\t[수와 연산·집합·명제·대수 항등식] 이차방정식의 근의 공식과 짝수 근의 공식 | 공식: ax² + bx + c = 0 (a≠0)의 해 x = (-b ± √(b² - 4ac)) / (2a)", "이차방정식의 판별식(Discriminant)과 실근·허근 판정\t이차방정식의 판별식(Discriminant)과 실근·허근 판정\t\t[수와 연산·집합·명제·대수 항등식] 이차방정식의 판별식(Discriminant)과 실근·허근 판정 | 공식: D = b² - 4ac (짝수 D/4 = b'² - ac) 에 대하여 D > ", "이차방정식의 근과 계수의 관계(비에트 정리 2차)\t이차방정식의 근과 계수의 관계(비에트 정리 2차)\t\t[수와 연산·집합·명제·대수 항등식] 이차방정식의 근과 계수의 관계(비에트 정리 2차) | 공식: 이차방정식의 근과 계수의 관계(비에트 정리 2차) | 해설: ax² + bx + c = 0", "삼차방정식의 근과 계수의 관계(비에트 정리 3차)\t삼차방정식의 근과 계수의 관계(비에트 정리 3차)\t\t[수와 연산·집합·명제·대수 항등식] 삼차방정식의 근과 계수의 관계(비에트 정리 3차) | 공식: ax³ + bx² + cx + d = 0 의 세 근 α, β, γ 에 대하여 α+β+γ =", "이차방정식의 실근의 부호와 근의 분리(근의 위치 판정)\t이차방정식의 실근의 부호와 근의 분리(근의 위치 판정)\t\t[수와 연산·집합·명제·대수 항등식] 이차방정식의 실근의 부호와 근의 분리(근의 위치 판정) | 공식: 두 실근이 모두 특정 값 k보다 크려면 ① 판별식 D ≥ 0, ② 대칭축 -b/(2a", "절댓값 삼각부등식\t절댓값 삼각부등식\t\t[부등식·함수·해석기하·지수로그·삼각함수] 절댓값 삼각부등식 | 공식: 절댓값 삼각부등식 | 해설: 임의의 실수(또는 복소수·벡터) a, b 에 대하여", "(등호는 ab ≥ 0 일 때 성립)\t(등호는 ab ≥ 0 일 때 성립)\t\t[부등식·함수·해석기하·지수로그·삼각함수] (등호는 ab ≥ 0 일 때 성립) | 공식: (등호는 ab ≥ 0 일 때 성립) | 해설: 두 벡터나 실수의 합의 크기는 각 크기의 합을 넘을 ", "산술평균·기하평균·조화평균 절대부등식(AM-GM-HM)\t산술평균·기하평균·조화평균 절대부등식(AM-GM-HM)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 산술평균·기하평균·조화평균 절대부등식(AM-GM-HM) | 공식: 양수 a > 0, b > 0 일 때 (a + b)/2 ≥ √(ab) ≥ 2ab/", "코시-슈바르츠 부등식(Cauchy-Schwarz Inequality)\t코시-슈바르츠 부등식(Cauchy-Schwarz Inequality)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 코시-슈바르츠 부등식(Cauchy-Schwarz Inequality) | 공식: 실수 a, b, x, y 에 대하여 (a² + b²)(x² + y", "이차부등식이 모든 실수 x에서 항상 성립할 조건(절대부등식)\t이차부등식이 모든 실수 x에서 항상 성립할 조건(절대부등식)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 이차부등식이 모든 실수 x에서 항상 성립할 조건(절대부등식) | 공식: 모든 실수 x에 대하여 ax² + bx + c > 0 ⇔ a > 0 (아래", "평면좌표 내분점과 외분점 및 삼각형 무게중심 공식\t평면좌표 내분점과 외분점 및 삼각형 무게중심 공식 (선분 AB를 m)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 평면좌표 내분점과 외분점 및 삼각형 무게중심 공식 | 공식: 선분 AB를 m | 해설: n 으로 내분하는 점 P = ((mx₂ + nx₁)/(m+", "점과 직선 사이의 수직 거리 공식\t점과 직선 사이의 수직 거리 공식\t\t[부등식·함수·해석기하·지수로그·삼각함수] 점과 직선 사이의 수직 거리 공식 | 공식: 점과 직선 사이의 수직 거리 공식 | 해설: 점 (x₁, y₁)과 직선 ax + by + c = 0 ", "/ √(a² + b²)\t/ √(a² + b²)\t\t[부등식·함수·해석기하·지수로그·삼각함수] / √(a² + b²) | 공식: / √(a² + b²) | 해설: 원의 중심에서 접선까지의 거리가 반지름 r과 같다는 접선 조건(d = r)과 ", "두 직선의 평행 조건과 수직 조건\t두 직선의 평행 조건과 수직 조건\t\t[부등식·함수·해석기하·지수로그·삼각함수] 두 직선의 평행 조건과 수직 조건 | 공식: 기울기가 m, m' 인 두 직선이 평행 ⇔ m = m' (절편 다름), 수직 ⇔ m · m' = -1", "아폴로니오스의 원(Apollonius Circle)\t아폴로니오스의 원(Apollonius Circle) (두 정점 A, B로부터의 거리의 비가 m)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 아폴로니오스의 원(Apollonius Circle) | 공식: 두 정점 A, B로부터의 거리의 비가 m | 해설: n (m ≠ n, m,n > 0", "원의 접선의 방정식(접점 공식과 기울기 공식)\t원의 접선의 방정식(접점 공식과 기울기 공식)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 원의 접선의 방정식(접점 공식과 기울기 공식) | 공식: 원 x² + y² = r² 위의 점 (x₁, y₁)에서의 접선은 x₁x + y₁y = r", "도형의 평행이동과 대칭이동 규칙\t도형의 평행이동과 대칭이동 규칙\t\t[부등식·함수·해석기하·지수로그·삼각함수] 도형의 평행이동과 대칭이동 규칙 | 공식: 점 (x, y)를 (x+a, y+b)로 이동하면 도형 방정식은 f(x - a, y - b) = 0 이 ", "일대일함수(단사함수)와 일대일대응(전단사함수)의 정의\t일대일함수(단사함수)와 일대일대응(전단사함수)의 정의\t\t[부등식·함수·해석기하·지수로그·삼각함수] 일대일함수(단사함수)와 일대일대응(전단사함수)의 정의 | 공식: 일대일함수(x₁ ≠ x₂ 이면 f(x₁) ≠ f(x₂), 수평선 테스트 통과) +", "합성함수와 역함수의 성질\t합성함수와 역함수의 성질\t\t[부등식·함수·해석기하·지수로그·삼각함수] 합성함수와 역함수의 성질 | 공식: (g ∘ f)(x) = g(f(x)) (교환법칙 불성립, 결합법칙 성립), 역함수 (g ∘ f)⁻¹ = f⁻¹", "유리함수의 점근선과 대칭성\t유리함수의 점근선과 대칭성\t\t[부등식·함수·해석기하·지수로그·삼각함수] 유리함수의 점근선과 대칭성 | 공식: y = k / (x - p) + q (k ≠ 0) 의 점근선은 직선 x = p, y = q 이며 점 (p, ", "무리함수의 정의역·치역과 이차함수 역함수 관계\t무리함수의 정의역·치역과 이차함수 역함수 관계\t\t[부등식·함수·해석기하·지수로그·삼각함수] 무리함수의 정의역·치역과 이차함수 역함수 관계 | 공식: y = √(a(x - p)) + q (a ≠ 0) 의 시작점(꼭짓점)은 (p, q)이며 ", "로그(Logarithm)의 정의와 밑·진수 조건\t로그(Logarithm)의 정의와 밑·진수 조건\t\t[부등식·함수·해석기하·지수로그·삼각함수] 로그(Logarithm)의 정의와 밑·진수 조건 | 공식: a^x = N ⇔ x = log_a(N) — 로그가 정의되기 위한 필수 조건은 밑 조건", "로그의 기본 성질과 밑의 변환 공식\t로그의 기본 성질과 밑의 변환 공식\t\t[부등식·함수·해석기하·지수로그·삼각함수] 로그의 기본 성질과 밑의 변환 공식 | 공식: log_a(XY) = log_a(X) + log_a(Y), log_a(X/Y) = log_a(X) ", "상용로그(밑이 10인 로그)의 정수 부분과 소수 부분\t상용로그(밑이 10인 로그)의 정수 부분과 소수 부분\t\t[부등식·함수·해석기하·지수로그·삼각함수] 상용로그(밑이 10인 로그)의 정수 부분과 소수 부분 | 공식: log₁₀(N) = n + α (n은 정수, 0 ≤ α < 1) 에서 정수 부분 ", "호도법(Radian, 라디안)과 부채꼴의 호의 길이·넓이 공식\t호도법(Radian, 라디안)과 부채꼴의 호의 길이·넓이 공식\t\t[부등식·함수·해석기하·지수로그·삼각함수] 호도법(Radian, 라디안)과 부채꼴의 호의 길이·넓이 공식 | 공식: 1 라디안은 반지름 r과 호의 길이 l이 같을 때의 중심각 (π rad ", "삼각함수의 기본 항등식(피타고라스·탄젠트 항등식)\t삼각함수의 기본 항등식(피타고라스·탄젠트 항등식)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 삼각함수의 기본 항등식(피타고라스·탄젠트 항등식) | 공식: sin²θ + cos²θ = 1, tanθ = sinθ / cosθ, 1 + tan²", "삼각함수의 각 변환 공식(보각·여각·음각 공식)\t삼각함수의 각 변환 공식(보각·여각·음각 공식)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 삼각함수의 각 변환 공식(보각·여각·음각 공식) | 공식: n·(π/2) ± θ 변환에서 n이 짝수이면 함수 그대로(sin→sin, cos→cos", "삼각함수 그래프의 주기와 최대·최소\t삼각함수 그래프의 주기와 최대·최소\t\t[부등식·함수·해석기하·지수로그·삼각함수] 삼각함수 그래프의 주기와 최대·최소 | 공식: 삼각함수 그래프의 주기와 최대·최소 | 해설: y = a·sin(bx + c) + d 및 y = a", "(최대·최소 없음, 점근선 bx+c = nπ + π/2)\t(최대·최소 없음, 점근선 bx+c = nπ + π/2)\t\t[부등식·함수·해석기하·지수로그·삼각함수] (최대·최소 없음, 점근선 bx+c = nπ + π/2) | 공식: (최대·최소 없음, 점근선 bx+c = nπ + π/2) | 해설: 파동과 주", "사인법칙(Law of Sines)\t사인법칙(Law of Sines)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 사인법칙(Law of Sines) | 공식: 삼각형 ABC와 외접원 반지름 R에 대하여 a / sinA = b / sinB = c / sinC =", "코사인법칙(Law of Cosines, 제2코사인법칙)\t코사인법칙(Law of Cosines, 제2코사인법칙)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 코사인법칙(Law of Cosines, 제2코사인법칙) | 공식: c² = a² + b² - 2ab·cosC ⇔ cosC = (a² + b² - ", "삼각형의 넓이 공식 5선(삼각비·외접원·내접원·헤론의 공식·신발끈 공식)\t삼각형의 넓이 공식 5선(삼각비·외접원·내접원·헤론의 공식·신발끈 공식)\t\t[부등식·함수·해석기하·지수로그·삼각함수] 삼각형의 넓이 공식 5선(삼각비·외접원·내접원·헤론의 공식·신발끈 공식) | 공식: S = ½ab·sinC = abc/(4R) = ½r(a + b", "등차수열의 일반항과 등차중항\t등차수열의 일반항과 등차중항\t\t[수열·극한·미분법·적분법] 등차수열의 일반항과 등차중항 | 공식: 일반항 a_n = a₁ + (n - 1)d = dn + (a₁ - d) (n에 대한 일차식, 기울기=공차 d), 세 수 ", "등차수열의 첫째항부터 제n항까지의 합 공식\t등차수열의 첫째항부터 제n항까지의 합 공식\t\t[수열·극한·미분법·적분법] 등차수열의 첫째항부터 제n항까지의 합 공식 | 공식: S_n = n(a₁ + a_n) / 2 = n(2a₁ + (n - 1)d) / 2 = (d/2)n² + (", "수열의 합 S_n 과 일반항 a_n 사이의 관계\t수열의 합 S_n 과 일반항 a_n 사이의 관계\t\t[수열·극한·미분법·적분법] 수열의 합 S_n 과 일반항 a_n 사이의 관계 | 공식: n ≥ 2 일 때 a_n = S_n - S_{n-1} 이고 첫째항은 반드시 a₁ = S₁ 로 확인 (", "등비수열의 일반항과 등비중항\t등비수열의 일반항과 등비중항\t\t[수열·극한·미분법·적분법] 등비수열의 일반항과 등비중항 | 공식: 일반항 a_n = a₁ · r^(n-1) (공비 r ≠ 0), 세 수 a, b, c가 등비수열 ⇔ b² = ac (b =", "등비수열의 합 공식과 원리합계(복리 적금)\t등비수열의 합 공식과 원리합계(복리 적금)\t\t[수열·극한·미분법·적분법] 등비수열의 합 공식과 원리합계(복리 적금) | 공식: r ≠ 1 일 때 S_n = a₁(r^n - 1) / (r - 1) = a₁(1 - r^n) / (1 - ", "거듭제곱의 합(시그마 자연수 거듭제곱 공식)\t거듭제곱의 합(시그마 자연수 거듭제곱 공식)\t\t[수열·극한·미분법·적분법] 거듭제곱의 합(시그마 자연수 거듭제곱 공식) | 공식: Σ(k=1..n) k = n(n+1)/2, Σ(k=1..n) k² = n(n+1)(2n+1)/6, Σ(k", "연속하는 자연수 곱의 시그마 공식\t연속하는 자연수 곱의 시그마 공식\t\t[수열·극한·미분법·적분법] 연속하는 자연수 곱의 시그마 공식 | 공식: Σ(k=1..n) k(k+1) = n(n+1)(n+2)/3, Σ(k=1..n) k(k+1)(k+2) = n(n+1)", "망원급수(Telescoping Series, 소거형 급수)\t망원급수(Telescoping Series, 소거형 급수)\t\t[수열·극한·미분법·적분법] 망원급수(Telescoping Series, 소거형 급수) | 공식: Σ(k=1..n) (f(k+1) - f(k)) = f(n+1) - f(1) (부분분수 1/", "수학적 귀납법(Mathematical Induction) 증명 2단계\t수학적 귀납법(Mathematical Induction) 증명 2단계\t\t[수열·극한·미분법·적분법] 수학적 귀납법(Mathematical Induction) 증명 2단계 | 공식: ① 초기 조건(n = 1 일 때 명제 P(1)이 참임을 보임) + ② 귀납 가설", "수열의 극한과 등비수열 r^n 의 수렴 조건\t수열의 극한과 등비수열 r^n 의 수렴 조건\t\t[수열·극한·미분법·적분법] 수열의 극한과 등비수열 r^n 의 수렴 조건 | 공식: 수열 {r^n} 이 수렴할 필요충분조건은 -1 < r ≤ 1 (단, -1 < r < 1 이면 극한값 0,", "무한급수의 수렴과 일반항의 극한 관계(발산 판정법)\t무한급수의 수렴과 일반항의 극한 관계(발산 판정법)\t\t[수열·극한·미분법·적분법] 무한급수의 수렴과 일반항의 극한 관계(발산 판정법) | 공식: 무한급수 Σ(n=1..∞) a_n 이 수렴하면 반드시 lim_{n→∞} a_n = 0 이 성립함 ", "무한등비급수의 합 공식과 수렴 조건\t무한등비급수의 합 공식과 수렴 조건\t\t[수열·극한·미분법·적분법] 무한등비급수의 합 공식과 수렴 조건 | 공식: 첫째항 a, 공비 r 인 무한등비급수 Σ(n=1..∞) a·r^(n-1) 이 수렴할 조건은 a = 0 또는 -1 ", "함수의 극한 존재 조건(좌극한과 우극한의 일치)\t함수의 극한 존재 조건(좌극한과 우극한의 일치)\t\t[수열·극한·미분법·적분법] 함수의 극한 존재 조건(좌극한과 우극한의 일치) | 공식: lim_{x→a} f(x) = L 이 존재할 필요충분조건은 좌극한 lim_{x→a⁻} f(x) 와 우", "함수의 극한의 대소 관계와 샌드위치 정리(조임 정리, Squeeze Theorem)\t함수의 극한의 대소 관계와 샌드위치 정리(조임 정리, Squeeze Theorem)\t\t[수열·극한·미분법·적분법] 함수의 극한의 대소 관계와 샌드위치 정리(조임 정리, Squeeze Theorem) | 공식: x가 a에 가까워질 때 모든 x에서 f(x) ≤ g(x) ≤ h(", "부정형 극한(0/0 꼴, ∞/∞ 꼴, ∞ - ∞ 꼴, 0 × ∞ 꼴) 해법\t부정형 극한(0/0 꼴, ∞/∞ 꼴, ∞ - ∞ 꼴, 0 × ∞ 꼴) 해법\t\t[수열·극한·미분법·적분법] 부정형 극한(0/0 꼴, ∞/∞ 꼴, ∞ - ∞ 꼴, 0 × ∞ 꼴) 해법 | 공식: 0/0 꼴(인수분해 또는 유리화 후 0 인자 약분), ∞/∞ 꼴(분모 최고", "자연상수 e 의 정의와 지수·로그함수의 극한 공식\t자연상수 e 의 정의와 지수·로그함수의 극한 공식\t\t[수열·극한·미분법·적분법] 자연상수 e 의 정의와 지수·로그함수의 극한 공식 | 공식: e = lim_{x→0} (1 + x)^(1/x) = lim_{n→∞} (1 + 1/n)^n ≈ 2", "삼각함수의 극한 기본 공식\t삼각함수의 극한 기본 공식\t\t[수열·극한·미분법·적분법] 삼각함수의 극한 기본 공식 | 공식: 각 x가 라디안(호도법)일 때 lim_{x→0} (sin x)/x = 1, lim_{x→0} (tan x)/x = 1, l", "함수의 연속성 정의(한 점에서의 연속 3요소)\t함수의 연속성 정의(한 점에서의 연속 3요소)\t\t[수열·극한·미분법·적분법] 함수의 연속성 정의(한 점에서의 연속 3요소) | 공식: 함수 f(x)가 x = a 에서 연속일 필요충분조건은 ① 함숫값 f(a)가 정의되고, ② 극한값 lim", "최대·최소 정리(Extreme Value Theorem)\t최대·최소 정리(Extreme Value Theorem)\t\t[수열·극한·미분법·적분법] 최대·최소 정리(Extreme Value Theorem) | 공식: 함수 f(x)가 닫힌구간 [a, b]에서 연속이면 f(x)는 그 닫힌구간에서 반드시 최댓값과", "사잇값 정리(중간값 정리, Intermediate Value Theorem)\t사잇값 정리(중간값 정리, Intermediate Value Theorem)\t\t[수열·극한·미분법·적분법] 사잇값 정리(중간값 정리, Intermediate Value Theorem) | 공식: 함수 f(x)가 닫힌구간 [a, b]에서 연속이고 f(a) ≠ f(b) ", "평균변화율과 미분계수(순간변화율·접선의 기울기)의 정의\t평균변화율과 미분계수(순간변화율·접선의 기울기)의 정의\t\t[수열·극한·미분법·적분법] 평균변화율과 미분계수(순간변화율·접선의 기울기)의 정의 | 공식: 구간 [a, a+Δx]의 평균변화율 Δy/Δx = (f(a+Δx) - f(a))/Δx 의 극한", "미분가능성과 연속성의 관계\t미분가능성과 연속성의 관계\t\t[수열·극한·미분법·적분법] 미분가능성과 연속성의 관계 | 공식: 함수 f(x)가 x = a 에서 미분가능(좌미분계수 = 우미분계수 유한 확정)하면 x = a 에서 반드시 연속임 — 단, ", ")\t)\t\t[수열·극한·미분법·적분법] ) | 공식: ) | 해설: 미분가능할 조건(함숫값 일치 연속 조건 + 도함수 좌우 극한 일치 매끄러움 조건)을 연립해 미정계수를 구하는 핵심 원리", "다항함수와 거듭제곱함수의 도함수 및 미분법 기본 공식\t다항함수와 거듭제곱함수의 도함수 및 미분법 기본 공식\t\t[수열·극한·미분법·적분법] 다항함수와 거듭제곱함수의 도함수 및 미분법 기본 공식 | 공식: (c)' = 0, (x^n)' = n·x^(n-1), 곱의 미분법 (f·g)' = f'g + f", "초월함수(지수·로그·삼각함수)의 도함수 공식\t초월함수(지수·로그·삼각함수)의 도함수 공식\t\t[수열·극한·미분법·적분법] 초월함수(지수·로그·삼각함수)의 도함수 공식 | 공식: 초월함수(지수·로그·삼각함수)의 도함수 공식 | 해설: (e^x)' = e^x, (a^x)' = a^x·", ")' = 1/(x·ln a) / (sin x)' = cos x, (cos x)' = -sin x, (tan x)' = sec²x, (sec x)' = sec x·tan x\t)' = 1/(x·ln a) / (sin x)' = cos x, (cos x)' = -sin x, (tan x)' = sec²x, (sec x)' = sec x·tan x\t\t[수열·극한·미분법·적분법] )' = 1/(x·ln a) / (sin x)' = cos x, (cos x)' = -sin x, (tan x)' = sec²x, (sec x)' = sec x", "음함수 미분법과 매개변수 미분법·역함수 미분법\t음함수 미분법과 매개변수 미분법·역함수 미분법\t\t[수열·극한·미분법·적분법] 음함수 미분법과 매개변수 미분법·역함수 미분법 | 공식: 매개변수 dy/dx = (dy/dt)/(dx/dt), 역함수 미분법 (f⁻¹)'(b) = 1 / f'(", "접선의 방정식과 법선의 방정식\t접선의 방정식과 법선의 방정식\t\t[수열·극한·미분법·적분법] 접선의 방정식과 법선의 방정식 | 공식: 곡선 y = f(x) 위의 점 (a, f(a))에서의 접선의 방정식은 y - f(a) = f'(a)(x - a) 이고,", "롤의 정리(Rolle's Theorem)\t롤의 정리(Rolle's Theorem)\t\t[수열·극한·미분법·적분법] 롤의 정리(Rolle's Theorem) | 공식: 함수 f(x)가 닫힌구간 [a, b]에서 연속이고 열린구간 (a, b)에서 미분가능하며 양 끝 함숫값이 f(", "평균값 정리(Mean Value Theorem, MVT)\t평균값 정리(Mean Value Theorem, MVT)\t\t[수열·극한·미분법·적분법] 평균값 정리(Mean Value Theorem, MVT) | 공식: 함수 f(x)가 닫힌구간 [a, b]에서 연속이고 열린구간 (a, b)에서 미분가능하면, 구", "함수의 증가·감소와 극대·극소 판정(1계 도함수와 2계 도함수 판정법)\t함수의 증가·감소와 극대·극소 판정(1계 도함수와 2계 도함수 판정법)\t\t[수열·극한·미분법·적분법] 함수의 증가·감소와 극대·극소 판정(1계 도함수와 2계 도함수 판정법) | 공식: f'(x) > 0 이면 증가, f'(x) < 0 이면 감소 / 미분가능한 함수", "삼차함수와 사차함수의 그래프 개형 및 비율 관계\t삼차함수와 사차함수의 그래프 개형 및 비율 관계\t\t[수열·극한·미분법·적분법] 삼차함수와 사차함수의 그래프 개형 및 비율 관계 | 공식: 삼차함수 f(x) = ax³+bx²+cx+d 가 극대·극소를 모두 가질 조건은 도함수 이차방정식 f'", "곡선의 오목·볼록과 변곡점(Inflection Point) 판정\t곡선의 오목·볼록과 변곡점(Inflection Point) 판정\t\t[수열·극한·미분법·적분법] 곡선의 오목·볼록과 변곡점(Inflection Point) 판정 | 공식: 이계도함수 f''(x) > 0 이면 아래로 볼록(접선의 기울기 증가), f''(x) ", "부정적분(원시함수)의 정의와 기본 공식\t부정적분(원시함수)의 정의와 기본 공식\t\t[수열·극한·미분법·적분법] 부정적분(원시함수)의 정의와 기본 공식 | 공식: 부정적분(원시함수)의 정의와 기본 공식 | 해설: F'(x) = f(x) 일 때 ∫f(x)dx = F(x) +", "+ C\t+ C\t\t[수열·극한·미분법·적분법] + C | 공식: + C | 해설: (∫f(x)dx)' = f(x) (적분 후 미분하면 그대로) 이지만 ∫f'(x)dx = f(x) + C (미분 후 적분하면 ", "치환적분법(u-Substitution)과 로그형 분수 적분\t치환적분법(u-Substitution)과 로그형 분수 적분\t\t[수열·극한·미분법·적분법] 치환적분법(u-Substitution)과 로그형 분수 적분 | 공식: 치환적분법(u-Substitution)과 로그형 분수 적분 | 해설: ∫f(g(x))·g'", "부분적분법(Integration by Parts, 로다삼지 공식)\t부분적분법(Integration by Parts, 로다삼지 공식)\t\t[수열·극한·미분법·적분법] 부분적분법(Integration by Parts, 로다삼지 공식) | 공식: ∫u(x)v'(x)dx = u(x)v(x) - ∫u'(x)v(x)dx — 미분하기 ", "정적분의 기본 정리(미적분학의 기본 정리 제1·제2정리)\t정적분의 기본 정리(미적분학의 기본 정리 제1·제2정리)\t\t[수열·극한·미분법·적분법] 정적분의 기본 정리(미적분학의 기본 정리 제1·제2정리) | 공식: ① 정적분으로 정의된 함수의 미분 d/dx [∫_a^x f(t)dt] = f(x), ② 정적", "우함수(짝함수)와 기함수(홀함수)의 대칭구간 정적분 성질\t우함수(짝함수)와 기함수(홀함수)의 대칭구간 정적분 성질\t\t[수열·극한·미분법·적분법] 우함수(짝함수)와 기함수(홀함수)의 대칭구간 정적분 성질 | 공식: y축 대칭 우함수 f(-x) = f(x) (짝수차 다항식, cos x) 는 ∫_{-a}^a ", "구분구적법과 정적분과 급수의 관계\t구분구적법과 정적분과 급수의 관계\t\t[수열·극한·미분법·적분법] 구분구적법과 정적분과 급수의 관계 | 공식: lim_{n→∞} (1/n) Σ(k=1..n) f(a + (b-a)k/n) = (1/(b-a)) ∫_a^b f(x)", "포물선과 직선(또는 두 곡선)으로 둘러싸인 도형의 넓이 6분의 1 공식\t포물선과 직선(또는 두 곡선)으로 둘러싸인 도형의 넓이 6분의 1 공식\t\t[수열·극한·미분법·적분법] 포물선과 직선(또는 두 곡선)으로 둘러싸인 도형의 넓이 6분의 1 공식 | 공식: 포물선과 직선(또는 두 곡선)으로 둘러싸인 도형의 넓이 6분의 1 공식 | 해", "/ 12)·(β - α)⁴\t/ 12)·(β - α)⁴\t\t[수열·극한·미분법·적분법] / 12)·(β - α)⁴ | 공식: / 12)·(β - α)⁴ | 해설: 정적분을 일일이 전개하지 않고 교점의 x좌표 차(β - α)와 최고차항 계수만으로 넓", "수직선 및 평면 위를 움직이는 점의 속도·가속도와 위치 변화량·실제 이동 거리\t수직선 및 평면 위를 움직이는 점의 속도·가속도와 위치 변화량·실제 이동 거리\t\t[수열·극한·미분법·적분법] 수직선 및 평면 위를 움직이는 점의 속도·가속도와 위치 변화량·실제 이동 거리 | 공식: 수직선 및 평면 위를 움직이는 점의 속도·가속도와 위치 변화량·실제 이", "dt (평면 운동 곡선의 길이는 L = ∫_a^b √((dx/dt)² + (dy/dt)²) dt)\tdt (평면 운동 곡선의 길이는 L = ∫_a^b √((dx/dt)² + (dy/dt)²) dt)\t\t[수열·극한·미분법·적분법] dt (평면 운동 곡선의 길이는 L = ∫_a^b √((dx/dt)² + (dy/dt)²) dt) | 공식: dt (평면 운동 곡선의 길이는 L = ∫_a^b ", "합의 법칙과 곱의 법칙(경우의 수 기본 원리)\t합의 법칙과 곱의 법칙(경우의 수 기본 원리)\t\t[확률과 통계·조합론·기하·벡터] 합의 법칙과 곱의 법칙(경우의 수 기본 원리) | 공식: 동시에 일어나지 않는 두 사건 A, B는 합의 법칙(m + n), 잇달아(동시에) 일어나는 두 사", "순열(Permutation)과 계승(Factorial) 공식\t순열(Permutation)과 계승(Factorial) 공식\t\t[확률과 통계·조합론·기하·벡터] 순열(Permutation)과 계승(Factorial) 공식 | 공식: 서로 다른 n개에서 r개를 택해 일렬로 나열하는 순열의 수 _nP_r = n! / ", "원순열과 염주순열·다각형 탁자 배열\t원순열과 염주순열·다각형 탁자 배열\t\t[확률과 통계·조합론·기하·벡터] 원순열과 염주순열·다각형 탁자 배열 | 공식: 서로 다른 n개를 원형으로 배열하는 원순열의 수는 회전하여 일치하는 n가지를 하나로 보므로 (n - 1)! ", "중복순열과 같은 것이 있는 순열(다중집합 순열)\t중복순열과 같은 것이 있는 순열(다중집합 순열)\t\t[확률과 통계·조합론·기하·벡터] 중복순열과 같은 것이 있는 순열(다중집합 순열) | 공식: 서로 다른 n개에서 중복을 허용하여 r개를 택해 나열하는 중복순열 _nΠ_r = n^r (함수 ", "조합(Combination)의 정의와 파스칼의 삼각형 항등식\t조합(Combination)의 정의와 파스칼의 삼각형 항등식\t\t[확률과 통계·조합론·기하·벡터] 조합(Combination)의 정의와 파스칼의 삼각형 항등식 | 공식: 서로 다른 n개에서 순서에 상관없이 r개를 택하는 조합의 수 _nC_r = _nP_", "중복조합(Stars and Bars, 칸막이 모델)\t중복조합(Stars and Bars, 칸막이 모델)\t\t[확률과 통계·조합론·기하·벡터] 중복조합(Stars and Bars, 칸막이 모델) | 공식: 서로 다른 n개에서 중복을 허용하여 순서 없이 r개를 택하는 중복조합의 수 _nH_r = _", "완전순열(교란순열, Derangement — 자기 모자 안 쓰기)\t완전순열(교란순열, Derangement — 자기 모자 안 쓰기)\t\t[확률과 통계·조합론·기하·벡터] 완전순열(교란순열, Derangement — 자기 모자 안 쓰기) | 공식: n명의 사람이 각자 자기 이름표가 붙은 모자(또는 시험지)를 모두 다른 사람의", "이항정리(Binomial Theorem)와 이항계수의 성질\t이항정리(Binomial Theorem)와 이항계수의 성질\t\t[확률과 통계·조합론·기하·벡터] 이항정리(Binomial Theorem)와 이항계수의 성질 | 공식: (a + b)^n = Σ(r=0..n) _nC_r · a^(n-r) · b^r (일반", "수학적 확률과 기하학적 확률 및 여사건의 확률\t수학적 확률과 기하학적 확률 및 여사건의 확률\t\t[확률과 통계·조합론·기하·벡터] 수학적 확률과 기하학적 확률 및 여사건의 확률 | 공식: 표본공간 S에서 사건 A가 일어날 확률 P(A) = n(A)/n(S) (0 ≤ P(A) ≤ 1),", "조건부확률(Conditional Probability)과 확률의 곱셈정리\t조건부확률(Conditional Probability)과 확률의 곱셈정리\t\t[확률과 통계·조합론·기하·벡터] 조건부확률(Conditional Probability)과 확률의 곱셈정리 | 공식: 조건부확률(Conditional Probability)과 확률의 곱셈정", "A)\tA)\t\t[확률과 통계·조합론·기하·벡터] A) | 공식: A) | 해설: 비복원추출(꺼낸 제비를 다시 넣지 않음)에서 표본공간이 축소될 때의 확률과 전확률 공식 P(B) = P(A)·P(B", "베이즈 정리(Bayes' Theorem, 원인 확률 역추적)\t베이즈 정리(Bayes' Theorem, 원인 확률 역추적)\t\t[확률과 통계·조합론·기하·벡터] 베이즈 정리(Bayes' Theorem, 원인 확률 역추적) | 공식: 베이즈 정리(Bayes' Theorem, 원인 확률 역추적) | 해설: 사건 B가 ", "A^c)]\tA^c)]\t\t[확률과 통계·조합론·기하·벡터] A^c)] | 공식: A^c)] | 해설: 질병 진단 키트에서 양성 판정이 나왔을 때 실제로 질병에 걸렸을 확률(민감도·특이도·유병률 결합)과 인공지능 스", "사건의 독립과 종속 판정 조건\t사건의 독립과 종속 판정 조건\t\t[확률과 통계·조합론·기하·벡터] 사건의 독립과 종속 판정 조건 | 공식: 사건의 독립과 종속 판정 조건 | 해설: 두 사건 A, B가 서로 독립일 필요충분조건은 P(A ∩ B) = P(A", "A^c))\tA^c))\t\t[확률과 통계·조합론·기하·벡터] A^c)) | 공식: A^c)) | 해설: 주의! 배반사건(A ∩ B = ∅, P(A ∩ B) = 0)과 독립사건(P(A ∩ B) = P(A)P(B))은 ", "독립시행의 확률(베르누이 시행)\t독립시행의 확률(베르누이 시행)\t\t[확률과 통계·조합론·기하·벡터] 독립시행의 확률(베르누이 시행) | 공식: 매 시행에서 사건 A가 일어날 확률이 p (일어나지 않을 확률 q = 1 - p)로 일정할 때, n번의 독립시행", "이산확률변수의 기댓값(평균 E(X))과 분산(V(X))·표준편차(σ(X))\t이산확률변수의 기댓값(평균 E(X))과 분산(V(X))·표준편차(σ(X))\t\t[확률과 통계·조합론·기하·벡터] 이산확률변수의 기댓값(평균 E(X))과 분산(V(X))·표준편차(σ(X)) | 공식: 기댓값 E(X) = m = Σ(x_i · p_i), 분산 V(X) =", "이항분포 B(n, p)의 평균·분산·표준편차\t이항분포 B(n, p)의 평균·분산·표준편차\t\t[확률과 통계·조합론·기하·벡터] 이항분포 B(n, p)의 평균·분산·표준편차 | 공식: 확률변수 X가 독립시행 횟수 n, 성공 확률 p 인 이항분포 B(n, p)를 따를 때 평균 E(X)", "정규분포 N(m, σ²)와 표준정규분포 Z ~ N(0, 1) 표준화 변환\t정규분포 N(m, σ²)와 표준정규분포 Z ~ N(0, 1) 표준화 변환\t\t[확률과 통계·조합론·기하·벡터] 정규분포 N(m, σ²)와 표준정규분포 Z ~ N(0, 1) 표준화 변환 | 공식: 연속확률변수 X ~ N(m, σ²)의 확률밀도함수 그래프는 직선 x =", "표본평균 X̄ 의 분포와 모평균 m 의 신뢰구간 추정\t표본평균 X̄ 의 분포와 모평균 m 의 신뢰구간 추정\t\t[확률과 통계·조합론·기하·벡터] 표본평균 X̄ 의 분포와 모평균 m 의 신뢰구간 추정 | 공식: 모평균 m, 모표준편차 σ 인 모집단에서 크기 n인 표본을 임의추출할 때 표본평균 X̄ 의", "이차곡선 1 — 포물선(Parabola)의 정의와 방정식\t이차곡선 1 — 포물선(Parabola)의 정의와 방정식\t\t[확률과 통계·조합론·기하·벡터] 이차곡선 1 — 포물선(Parabola)의 정의와 방정식 | 공식: 초점 F(p, 0)과 준선 x = -p 로부터 같은 거리에 있는 점들의 자취 방정식은 ", "이차곡선 2 — 타원(Ellipse)의 정의와 방정식\t이차곡선 2 — 타원(Ellipse)의 정의와 방정식\t\t[확률과 통계·조합론·기하·벡터] 이차곡선 2 — 타원(Ellipse)의 정의와 방정식 | 공식: 두 초점 F(c, 0), F'(-c, 0)으로부터의 거리의 합이 2a (a > c > 0)", "이차곡선 3 — 쌍곡선(Hyperbola)의 정의와 점근선 방정식\t이차곡선 3 — 쌍곡선(Hyperbola)의 정의와 점근선 방정식\t\t[확률과 통계·조합론·기하·벡터] 이차곡선 3 — 쌍곡선(Hyperbola)의 정의와 점근선 방정식 | 공식: 두 초점 F(c, 0), F'(-c, 0)으로부터의 거리의 차가 2a (c >", "벡터의 내적(Dot Product, 스칼라곱)과 두 벡터가 이루는 각\t벡터의 내적(Dot Product, 스칼라곱)과 두 벡터가 이루는 각\t\t[확률과 통계·조합론·기하·벡터] 벡터의 내적(Dot Product, 스칼라곱)과 두 벡터가 이루는 각 | 공식: 벡터의 내적(Dot Product, 스칼라곱)과 두 벡터가 이루는 각 | ", "), 두 영 아닌 벡터의 수직 조건 a ⊥ b ⇔ a · b = 0, 평행 조건 a ∥ b ⇔ b = k·a\t), 두 영 아닌 벡터의 수직 조건 a ⊥ b ⇔ a · b = 0, 평행 조건 a ∥ b ⇔ b = k·a\t\t[확률과 통계·조합론·기하·벡터] ), 두 영 아닌 벡터의 수직 조건 a ⊥ b ⇔ a · b = 0, 평행 조건 a ∥ b ⇔ b = k·a | 공식: ), 두 영 아닌 벡터의 수직 조건", "삼수선의 정리(공간기하 수직 관계)와 정사영(Orthogonal Projection)의 길이·넓이\t삼수선의 정리(공간기하 수직 관계)와 정사영(Orthogonal Projection)의 길이·넓이\t\t[확률과 통계·조합론·기하·벡터] 삼수선의 정리(공간기하 수직 관계)와 정사영(Orthogonal Projection)의 길이·넓이 | 공식: 평면 α 밖의 점 P에서 평면 α와 평면 위 ", "행렬의 덧셈·스칼라배와 곱셈 정의\t행렬의 덧셈·스칼라배와 곱셈 정의\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 행렬의 덧셈·스칼라배와 곱셈 정의 | 공식: (AB)_{ij} = Σ_k A_{ik}·B_{kj} (앞 행렬의 열 개수 = 뒤 행렬", "2×2 이차 정사각행렬의 역행렬 공식과 행렬식(Determinant)\t2×2 이차 정사각행렬의 역행렬 공식과 행렬식(Determinant)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 2×2 이차 정사각행렬의 역행렬 공식과 행렬식(Determinant) | 공식: 행렬 A = [[a, b], [c, d]] 에서 행", "케일리-해밀턴 정리(Cayley-Hamilton Theorem)\t케일리-해밀턴 정리(Cayley-Hamilton Theorem)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 케일리-해밀턴 정리(Cayley-Hamilton Theorem) | 공식: 2×2 행렬 A = [[a, b], [c, d]] 는 자", "연립일차방정식의 해의 존재 조건(제차 연립방정식 AX = O)\t연립일차방정식의 해의 존재 조건(제차 연립방정식 AX = O)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 연립일차방정식의 해의 존재 조건(제차 연립방정식 AX = O) | 공식: ax + by = 0, cx + dy = 0 이 자명한 해", "일차변환(선형변환)과 회전변환·대칭변환 행렬\t일차변환(선형변환)과 회전변환·대칭변환 행렬\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 일차변환(선형변환)과 회전변환·대칭변환 행렬 | 공식: 원점 중심 각 θ 회전변환 행렬 R(θ) = [[cosθ, -sinθ], [", "선형변환에 의한 넓이 변화율(야코비안 행렬식)\t선형변환에 의한 넓이 변화율(야코비안 행렬식)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 선형변환에 의한 넓이 변화율(야코비안 행렬식) | 공식: 선형변환에 의한 넓이 변화율(야코비안 행렬식) | 해설: 행렬 A = [[", "·S\t·S\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] ·S | 공식: ·S | 해설: 2차원 행렬식의 절댓값이 단위 정사각형이 선형변환된 평행사변형의 넓이 배율과 정확히 일치한다는 기하", "공간좌표에서 두 점 사이의 거리와 구(Sphere)의 방정식\t공간좌표에서 두 점 사이의 거리와 구(Sphere)의 방정식\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 공간좌표에서 두 점 사이의 거리와 구(Sphere)의 방정식 | 공식: 두 점 A(x₁,y₁,z₁), B(x₂,y₂,z₂) 거리 A", "위치벡터와 세 점이 한 직선 위에 있을 조건(공선 조건)\t위치벡터와 세 점이 한 직선 위에 있을 조건(공선 조건)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 위치벡터와 세 점이 한 직선 위에 있을 조건(공선 조건) | 공식: 시점을 O로 통일할 때 AB = OB - OA / 서로 다른 세", "공간에서 직선의 방정식(방향벡터 u = (a, b, c))\t공간에서 직선의 방정식(방향벡터 u = (a, b, c))\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 공간에서 직선의 방정식(방향벡터 u = (a, b, c)) | 공식: 점 (x₁, y₁, z₁)을 지나고 방향벡터가 u = (a, ", "공간에서 평면의 방정식(법선벡터 n = (a, b, c))\t공간에서 평면의 방정식(법선벡터 n = (a, b, c))\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 공간에서 평면의 방정식(법선벡터 n = (a, b, c)) | 공식: 점 (x₁, y₁, z₁)을 지나고 평면에 수직인 법선벡터가 ", "두 평면이 이루는 각(이면각)과 직선과 평면이 이루는 각\t두 평면이 이루는 각(이면각)과 직선과 평면이 이루는 각\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 두 평면이 이루는 각(이면각)과 직선과 평면이 이루는 각 | 공식: 두 평면이 이루는 각(이면각)과 직선과 평면이 이루는 각 | 해", ") 성립\t) 성립\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] ) 성립 | 공식: ) 성립 | 해설: 평면끼리는 법선벡터의 코사인(cosθ)을 쓰고, 직선과 평면 사이는 여각 관계(90°-θ)이", "벡터의 외적(Cross Product, 벡터곱)과 평행사변형 넓이\t벡터의 외적(Cross Product, 벡터곱)과 평행사변형 넓이\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 벡터의 외적(Cross Product, 벡터곱)과 평행사변형 넓이 | 공식: 벡터의 외적(Cross Product, 벡터곱)과 평행", "원뿔곡선(이차곡선)의 통합 정의와 이심률(Eccentricity, e)\t원뿔곡선(이차곡선)의 통합 정의와 이심률(Eccentricity, e)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 원뿔곡선(이차곡선)의 통합 정의와 이심률(Eccentricity, e) | 공식: 초점 F로부터의 거리와 준선 l로부터의 거리의 비", "타원과 쌍곡선의 직교하는 두 접선의 교점의 자취(준원, Director Circle)\t타원과 쌍곡선의 직교하는 두 접선의 교점의 자취(준원, Director Circle)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 타원과 쌍곡선의 직교하는 두 접선의 교점의 자취(준원, Director Circle) | 공식: 타원 x²/a² + y²/b² = ", "사이클로이드(Cycloid, 최속강하선·등시곡선) 매개변수 방정식\t사이클로이드(Cycloid, 최속강하선·등시곡선) 매개변수 방정식\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 사이클로이드(Cycloid, 최속강하선·등시곡선) 매개변수 방정식 | 공식: 반지름 r인 원이 직선 위를 미끄러지지 않고 굴러갈 때", "쌍곡선함수(Hyperbolic Function) sinh x, cosh x, tanh x 의 정의와 항등식\t쌍곡선함수(Hyperbolic Function) sinh x, cosh x, tanh x 의 정의와 항등식\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 쌍곡선함수(Hyperbolic Function) sinh x, cosh x, tanh x 의 정의와 항등식 | 공식: cosh x ", "산술-기하 평균 부등식의 n변수 일반화와 등호 성립 조건\t산술-기하 평균 부등식의 n변수 일반화와 등호 성립 조건\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 산술-기하 평균 부등식의 n변수 일반화와 등호 성립 조건 | 공식: 양수 x₁, x₂, ···, x_n 에 대하여 (x₁ + x₂ ", "젠센 부등식(Jensen's Inequality, 볼록함수의 부등식)\t젠센 부등식(Jensen's Inequality, 볼록함수의 부등식)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 젠센 부등식(Jensen's Inequality, 볼록함수의 부등식) | 공식: 구간에서 아래로 볼록한 함수(f''(x) ≥ 0)에", "베르누이 부등식(Bernoulli's Inequality)\t베르누이 부등식(Bernoulli's Inequality)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 베르누이 부등식(Bernoulli's Inequality) | 공식: x > -1 이고 자연수 n ≥ 1 일 때 (1 + x)^n ", "삼각형의 결정 조건과 삼각부등식\t삼각형의 결정 조건과 삼각부등식\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 삼각형의 결정 조건과 삼각부등식 | 공식: 세 선분 a, b, c 가 삼각형의 세 변이 되기 위한 필요충분조건은 가장 긴 변의 길이", "< c < a + b\t< c < a + b\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] < c < a + b | 공식: < c < a + b | 해설: 삼각형의 두 변의 길이 합은 항상 나머지 한 변보다 크고, 두 변의", "스튜어트 정리(Stewart's Theorem, 일반 세비안 길이 공식)\t스튜어트 정리(Stewart's Theorem, 일반 세비안 길이 공식)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 스튜어트 정리(Stewart's Theorem, 일반 세비안 길이 공식) | 공식: 삼각형 ABC의 변 BC 위의 임의의 점 D에 ", "신발끈 공식(가우스 면적 공식, 좌표평면 다각형 넓이)\t신발끈 공식(가우스 면적 공식, 좌표평면 다각형 넓이)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 신발끈 공식(가우스 면적 공식, 좌표평면 다각형 넓이) | 공식: 신발끈 공식(가우스 면적 공식, 좌표평면 다각형 넓이) | 해설:", "(일반 세 점은 한 점을 원점으로 평행이동하여 적용)\t(일반 세 점은 한 점을 원점으로 평행이동하여 적용)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] (일반 세 점은 한 점을 원점으로 평행이동하여 적용) | 공식: (일반 세 점은 한 점을 원점으로 평행이동하여 적용) | 해설: 외", "픽의 정리(Pick's Theorem, 격자 다각형의 넓이)\t픽의 정리(Pick's Theorem, 격자 다각형의 넓이)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 픽의 정리(Pick's Theorem, 격자 다각형의 넓이) | 공식: 꼭짓점이 모두 정수 격자점 위에 있는 단순 다각형에서 내부 ", "비둘기집의 원리(Pigeonhole Principle, 디리클레 서랍 원리)\t비둘기집의 원리(Pigeonhole Principle, 디리클레 서랍 원리)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 비둘기집의 원리(Pigeonhole Principle, 디리클레 서랍 원리) | 공식: n개의 비둘기집에 (n + 1)마리 이상의 ", "카탈란 수(Catalan Numbers, 올바른 괄호쌍·대각선을 넘지 않는 최단 경로)\t카탈란 수(Catalan Numbers, 올바른 괄호쌍·대각선을 넘지 않는 최단 경로)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 카탈란 수(Catalan Numbers, 올바른 괄호쌍·대각선을 넘지 않는 최단 경로) | 공식: C_n = (1 / (n + 1)", "제2종 스털링 수 S(n, k) (집합의 분할, Set Partition)\t제2종 스털링 수 S(n, k) (집합의 분할, Set Partition)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 제2종 스털링 수 S(n, k) (집합의 분할, Set Partition) | 공식: 서로 다른 n개의 원소를 가진 집합을 공집합이", "자연수의 분할 P(n, k) (Integer Partition)\t자연수의 분할 P(n, k) (Integer Partition)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 자연수의 분할 P(n, k) (Integer Partition) | 공식: 같은 종류의 사탕 n개를 똑같은 종류의 접시 k개에 빈 ", "방데르몽드 항등식(Vandermonde's Identity, 이항계수 합성곱)\t방데르몽드 항등식(Vandermonde's Identity, 이항계수 합성곱)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 방데르몽드 항등식(Vandermonde's Identity, 이항계수 합성곱) | 공식: Σ(k=0..r) (_mC_k · _nC_", "하키스틱 정리(Hockey-Stick Identity, 파스칼 삼각형 대각선 합)\t하키스틱 정리(Hockey-Stick Identity, 파스칼 삼각형 대각선 합)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 하키스틱 정리(Hockey-Stick Identity, 파스칼 삼각형 대각선 합) | 공식: _rC_r + _{r+1}C_r + _", "피보나치 수열(Fibonacci Sequence)과 황금비(Golden Ratio φ)\t피보나치 수열(Fibonacci Sequence)과 황금비(Golden Ratio φ)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 피보나치 수열(Fibonacci Sequence)과 황금비(Golden Ratio φ) | 공식: F₁ = 1, F₂ = 1, 점화", "하노이의 탑(Tower of Hanoi) 최소 이동 횟수 점화식\t하노이의 탑(Tower of Hanoi) 최소 이동 횟수 점화식\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 하노이의 탑(Tower of Hanoi) 최소 이동 횟수 점화식 | 공식: n개의 원판을 다른 기둥으로 옮기는 최소 이동 횟수 a_", "일차 선형 점화식 a_{n+1} = p·a_n + q (p ≠ 1, q ≠ 0) 의 일반항 해법\t일차 선형 점화식 a_{n+1} = p·a_n + q (p ≠ 1, q ≠ 0) 의 일반항 해법\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 일차 선형 점화식 a_{n+1} = p·a_n + q (p ≠ 1, q ≠ 0) 의 일반항 해법 | 공식: 특성방정식 α = pα ", "합동식(Modular Arithmetic)과 페르마의 소정리·오일러 정리\t합동식(Modular Arithmetic)과 페르마의 소정리·오일러 정리\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 합동식(Modular Arithmetic)과 페르마의 소정리·오일러 정리 | 공식: 소수 p와 p의 배수가 아닌 정수 a에 대하여 ", "포아송 분포(Poisson Distribution)와 지수분포·기하분포\t포아송 분포(Poisson Distribution)와 지수분포·기하분포\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 포아송 분포(Poisson Distribution)와 지수분포·기하분포 | 공식: 단위 시간·공간 내 희귀 사건 발생 횟수 포아송 ", "큰 수의 법칙(대수의 법칙, Law of Large Numbers)과 중심극한정리(Central Limit Theorem)\t큰 수의 법칙(대수의 법칙, Law of Large Numbers)과 중심극한정리(Central Limit Theorem)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 큰 수의 법칙(대수의 법칙, Law of Large Numbers)과 중심극한정리(Central Limit Theorem) | 공식", "상관계수(피어슨 상관계수 r)와 최소제곱법 회귀직선\t상관계수(피어슨 상관계수 r)와 최소제곱법 회귀직선\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 상관계수(피어슨 상관계수 r)와 최소제곱법 회귀직선 | 공식: 두 변량 X, Y의 공분산 Cov(X,Y)를 각 표준편차의 곱으로 나", "이 1에 가까울수록 강한 직선 관계, r=0 이면 무상관)\t이 1에 가까울수록 강한 직선 관계, r=0 이면 무상관)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 이 1에 가까울수록 강한 직선 관계, r=0 이면 무상관) | 공식: 이 1에 가까울수록 강한 직선 관계, r=0 이면 무상관) |", "로랑 급수와 복소평면 오일러 공식(e^(iθ) = cosθ + i·sinθ) 및 드무아브르 정리\t로랑 급수와 복소평면 오일러 공식(e^(iθ) = cosθ + i·sinθ) 및 드무아브르 정리\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 로랑 급수와 복소평면 오일러 공식(e^(iθ) = cosθ + i·sinθ) 및 드무아브르 정리 | 공식: 극형식 복소수 z = r", "정적분 월리스 공식(Wallis Formula)과 가우스 오차적분\t정적분 월리스 공식(Wallis Formula)과 가우스 오차적분\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 정적분 월리스 공식(Wallis Formula)과 가우스 오차적분 | 공식: ∫_0^(π/2) sin^n(x) dx = ∫_0^(π", "바젤 문제(오일러 제타 함수 ζ(2))와 교대조화급수\t바젤 문제(오일러 제타 함수 ζ(2))와 교대조화급수\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 바젤 문제(오일러 제타 함수 ζ(2))와 교대조화급수 | 공식: 자연수 제곱의 역수의 무한합 Σ(n=1..∞) (1/n²) = 1 ", "미분방정식의 변수분리법과 지수적 성장·감소 모델(dy/dt = k·y)\t미분방정식의 변수분리법과 지수적 성장·감소 모델(dy/dt = k·y)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 미분방정식의 변수분리법과 지수적 성장·감소 모델(dy/dt = k·y) | 공식: 변화율이 현재 양에 비례하는 미분방정식 dy/dt", "선형계획법(Linear Programming)과 볼록 다각형 영역에서의 최대·최소(코너점 정리)\t선형계획법(Linear Programming)과 볼록 다각형 영역에서의 최대·최소(코너점 정리)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 선형계획법(Linear Programming)과 볼록 다각형 영역에서의 최대·최소(코너점 정리) | 공식: 일차 연립부등식이 나타내", "그래프 이론 — 오일러 한붓그리기 정리(한붓그리기 가능 조건)와 악수 보조정리\t그래프 이론 — 오일러 한붓그리기 정리(한붓그리기 가능 조건)와 악수 보조정리\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 그래프 이론 — 오일러 한붓그리기 정리(한붓그리기 가능 조건)와 악수 보조정리 | 공식: 모든 꼭짓점의 차수(연결된 변의 개수)의 ", "평면 그래프의 오일러 공식(V - E + F = 2)과 4색 정리(Four Color Theorem)\t평면 그래프의 오일러 공식(V - E + F = 2)과 4색 정리(Four Color Theorem)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 평면 그래프의 오일러 공식(V - E + F = 2)과 4색 정리(Four Color Theorem) | 공식: 변이 교차하지 않게", "게임 이론 — 내시 균형(Nash Equilibrium)과 죄수의 딜레마·기댓값 의사결정\t게임 이론 — 내시 균형(Nash Equilibrium)과 죄수의 딜레마·기댓값 의사결정\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 게임 이론 — 내시 균형(Nash Equilibrium)과 죄수의 딜레마·기댓값 의사결정 | 공식: 상대방의 전략이 주어졌을 때 나", "파스칼의 점수 분배 문제와 페르마의 확률론 탄생·도박사의 오류(Gambler's Fallacy)\t파스칼의 점수 분배 문제와 페르마의 확률론 탄생·도박사의 오류(Gambler's Fallacy)\t\t[행렬·선형변환·공간기하·정수론·고급해석·확률분포 심화] 파스칼의 점수 분배 문제와 페르마의 확률론 탄생·도박사의 오류(Gambler's Fallacy) | 공식: 독립시행에서는 이전까지 ", "평행사변형이 되는 5가지 필요충분조건\t평행사변형이 되는 5가지 필요충분조건\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 평행사변형이 되는 5가지 필요충분조건 | 공식: ① 두 쌍의 대변이 각각 평행, ② 두 쌍의 대변의 길이가 각각 같음, ③ 두 ", "직사각형·마름모·정사각형·등변사다리꼴의 대각선 성질\t직사각형·마름모·정사각형·등변사다리꼴의 대각선 성질\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 직사각형·마름모·정사각형·등변사다리꼴의 대각선 성질 | 공식: 직사각형(두 대각선 길이가 같고 서로 이등분), 마름모(두 대각선", "삼각형의 합동 조건 3가지(SSS, SAS, ASA)와 직각삼각형의 합동 조건 2가지(RHA, RHS)\t삼각형의 합동 조건 3가지(SSS, SAS, ASA)와 직각삼각형의 합동 조건 2가지(RHA, RHS)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 삼각형의 합동 조건 3가지(SSS, SAS, ASA)와 직각삼각형의 합동 조건 2가지(RHA, RHS) | 공식: 일반 삼각형 ", "삼각형의 닮음 조건 3가지(SSS 닮음, SAS 닮음, AA 닮음)\t삼각형의 닮음 조건 3가지(SSS 닮음, SAS 닮음, AA 닮음)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 삼각형의 닮음 조건 3가지(SSS 닮음, SAS 닮음, AA 닮음) | 공식: 세 쌍의 대응변의 길이의 비가 같음(SSS), 두", "원기둥·원뿔·원뿔대의 겉넓이와 부피 및 부채꼴 옆면 전개도\t원기둥·원뿔·원뿔대의 겉넓이와 부피 및 부채꼴 옆면 전개도\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 원기둥·원뿔·원뿔대의 겉넓이와 부피 및 부채꼴 옆면 전개도 | 공식: 밑면 반지름 r, 높이 h, 모선 길이 l 인 원뿔의 부피", "대푯값(평균·중앙값·최빈값)과 산포도(편차·분산·표준편차·사분위수 범위)\t대푯값(평균·중앙값·최빈값)과 산포도(편차·분산·표준편차·사분위수 범위)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 대푯값(평균·중앙값·최빈값)과 산포도(편차·분산·표준편차·사분위수 범위) | 공식: 편차(변량 - 평균)의 총합은 항상 0이며,", "유리수와 무리수의 조밀성 및 실수의 완비성(연속성)\t유리수와 무리수의 조밀성 및 실수의 완비성(연속성)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 유리수와 무리수의 조밀성 및 실수의 완비성(연속성) | 공식: 서로 다른 두 유리수(또는 무리수) 사이에는 무수히 많은 유리수와", "다항식의 최대공약수(G)와 최소공배수(L) 및 차수 관계\t다항식의 최대공약수(G)와 최소공배수(L) 및 차수 관계\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 다항식의 최대공약수(G)와 최소공배수(L) 및 차수 관계 | 공식: 두 다항식 A, B 에 대하여 A = aG, B = bG (", "대칭식(Symmetric Polynomial)과 교대식(Alternating Polynomial)의 인수분해\t대칭식(Symmetric Polynomial)과 교대식(Alternating Polynomial)의 인수분해\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 대칭식(Symmetric Polynomial)과 교대식(Alternating Polynomial)의 인수분해 | 공식: 두 문자", "절댓값 기호를 포함한 함수의 그래프 대칭 작도법 4유형\t절댓값 기호를 포함한 함수의 그래프 대칭 작도법 4유형\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 절댓값 기호를 포함한 함수의 그래프 대칭 작도법 4유형 | 공식: 절댓값 기호를 포함한 함수의 그래프 대칭 작도법 4유형 | 해", ") (제1사분면만 남기고 x축·y축·원점 모두 대칭 복사)\t) (제1사분면만 남기고 x축·y축·원점 모두 대칭 복사)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] ) (제1사분면만 남기고 x축·y축·원점 모두 대칭 복사) | 공식: ) (제1사분면만 남기고 x축·y축·원점 모두 대칭 복사)", "가우스 기호 [x] (최대정수함수, Floor Function)의 성질\t가우스 기호 [x] (최대정수함수, Floor Function)의 성질\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 가우스 기호 [x] (최대정수함수, Floor Function)의 성질 | 공식: 실수 x를 넘지 않는 최대 정수를 [x] 라 ", "역함수의 존재 조건과 단조성(항상 증가 또는 항상 감소)\t역함수의 존재 조건과 단조성(항상 증가 또는 항상 감소)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 역함수의 존재 조건과 단조성(항상 증가 또는 항상 감소) | 공식: 실수 전체에서 미분가능한 함수 f(x)의 역함수가 존재한다 ", "방정식 f(x) = g(x) 의 실근의 개수와 두 그래프 교점의 개수\t방정식 f(x) = g(x) 의 실근의 개수와 두 그래프 교점의 개수\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 방정식 f(x) = g(x) 의 실근의 개수와 두 그래프 교점의 개수 | 공식: 방정식 f(x) = k 의 서로 다른 실근의 개", "부등식 f(x) ≥ 0 의 증명(구간에서의 최솟값 ≥ 0)\t부등식 f(x) ≥ 0 의 증명(구간에서의 최솟값 ≥ 0)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 부등식 f(x) ≥ 0 의 증명(구간에서의 최솟값 ≥ 0) | 공식: 주어진 구간에서 부등식 f(x) ≥ g(x) 가 항상 성립", "속도와 가속도의 물리적·기하적 해석(운동 방향의 전환)\t속도와 가속도의 물리적·기하적 해석(운동 방향의 전환)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 속도와 가속도의 물리적·기하적 해석(운동 방향의 전환) | 공식: 위치 x(t)의 1계 도함수 v(t) = dx/dt 가 속도,", "시각에 대한 길이·넓이·부피의 순간변화율\t시각에 대한 길이·넓이·부피의 순간변화율\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 시각에 대한 길이·넓이·부피의 순간변화율 | 공식: 시각 t에서의 길이를 l(t), 넓이를 S(t), 부피를 V(t)라 할 때 ", "삼각함수의 주기와 대칭성을 나타내는 함수방정식 비교\t삼각함수의 주기와 대칭성을 나타내는 함수방정식 비교\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 삼각함수의 주기와 대칭성을 나타내는 함수방정식 비교 | 공식: 주기성 f(x + p) = f(x) (안쪽 x의 부호가 같으면 주", "수열의 귀납적 정의 — 계차수열(Difference Sequence)을 이용한 일반항\t수열의 귀납적 정의 — 계차수열(Difference Sequence)을 이용한 일반항\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 수열의 귀납적 정의 — 계차수열(Difference Sequence)을 이용한 일반항 | 공식: 이웃한 두 항의 차 b_n = ", "수열의 귀납적 정의 — 인접 두 항의 비 a_{n+1} = f(n)·a_n 의 일반항\t수열의 귀납적 정의 — 인접 두 항의 비 a_{n+1} = f(n)·a_n 의 일반항\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 수열의 귀납적 정의 — 인접 두 항의 비 a_{n+1} = f(n)·a_n 의 일반항 | 공식: 이웃한 두 항의 비 a_{n+1", "조화수열(Harmonic Progression)과 조화중항\t조화수열(Harmonic Progression)과 조화중항\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 조화수열(Harmonic Progression)과 조화중항 | 공식: 각 항의 역수 1/a₁, 1/a₂, 1/a₃, ··· 가 ", "군수열(묶음 수열)의 제n항 찾기 3단계 알고리즘\t군수열(묶음 수열)의 제n항 찾기 3단계 알고리즘\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 군수열(묶음 수열)의 제n항 찾기 3단계 알고리즘 | 공식: ① 규칙에 따라 제1군, 제2군, ···, 제k군으로 묶고 각 군의", "무한급수와 정적분의 변환 시 적분구간과 비례상수 설정 3법칙\t무한급수와 정적분의 변환 시 적분구간과 비례상수 설정 3법칙\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 무한급수와 정적분의 변환 시 적분구간과 비례상수 설정 3법칙 | 공식: lim_{n→∞} Σ(k=1..n) f(a + (p/n)", "치환적분에서 대칭 함수를 이용한 킹 성질(King's Property)\t치환적분에서 대칭 함수를 이용한 킹 성질(King's Property)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 치환적분에서 대칭 함수를 이용한 킹 성질(King's Property) | 공식: 정적분 성질 ∫_a^b f(x)dx = ∫_a", "역함수의 미분법에서 이계도함수 (f⁻¹)''(y) 주의점\t역함수의 미분법에서 이계도함수 (f⁻¹)''(y) 주의점\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 역함수의 미분법에서 이계도함수 (f⁻¹)''(y) 주의점 | 공식: y = f(x), x = g(y) 가 서로 역함수일 때 1계", "곡선의 매개변수 표현에서 속력(이동 거리 미분)과 가속도 벡터의 크기\t곡선의 매개변수 표현에서 속력(이동 거리 미분)과 가속도 벡터의 크기\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 곡선의 매개변수 표현에서 속력(이동 거리 미분)과 가속도 벡터의 크기 | 공식: 곡선의 매개변수 표현에서 속력(이동 거리 미분)", "= √((dx/dt)² + (dy/dt)²), 시각 t=a 에서 t=b 까지 곡선의 길이(이동 거리) L = ∫_a^b √((dx/dt)² + (dy/dt)²) dt\t= √((dx/dt)² + (dy/dt)²), 시각 t=a 에서 t=b 까지 곡선의 길이(이동 거리) L = ∫_a^b √((dx/dt)² + (dy/dt)²) dt\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] = √((dx/dt)² + (dy/dt)²), 시각 t=a 에서 t=b 까지 곡선의 길이(이동 거리) L = ∫_a^b √((d", "조건부확률에서 몬티 홀 문제(Monty Hall Problem)와 베이즈 갱신\t조건부확률에서 몬티 홀 문제(Monty Hall Problem)와 베이즈 갱신\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 조건부확률에서 몬티 홀 문제(Monty Hall Problem)와 베이즈 갱신 | 공식: 세 개의 문 중 자동차가 있는 문 1개", "이산확률변수 기댓값의 선형성(Linearity of Expectation)\t이산확률변수 기댓값의 선형성(Linearity of Expectation)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 이산확률변수 기댓값의 선형성(Linearity of Expectation) | 공식: 두 확률변수 X, Y가 독립이든 종속이든 ", "모비율 p 의 추정과 표본비율 p̂ 의 분포\t모비율 p 의 추정과 표본비율 p̂ 의 분포\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 모비율 p 의 추정과 표본비율 p̂ 의 분포 | 공식: 모비율 p 인 모집단에서 크기 n인 표본의 표본비율 p̂ 의 평균은 E(", "오일러 직선과 구점원(Nine-Point Circle, 포이어바흐 원)\t오일러 직선과 구점원(Nine-Point Circle, 포이어바흐 원)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 오일러 직선과 구점원(Nine-Point Circle, 포이어바흐 원) | 공식: 임의의 삼각형에서 세 변의 중점(3개), 세 ", "톨레미(프톨레마이오스) 부등식과 등호 성립 조건\t톨레미(프톨레마이오스) 부등식과 등호 성립 조건\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 톨레미(프톨레마이오스) 부등식과 등호 성립 조건 | 공식: 평면 위의 임의의 네 점 A, B, C, D 에 대하여 AB·CD +", "극방정식과 원뿔곡선 초점 극좌표 공식\t극방정식과 원뿔곡선 초점 극좌표 공식\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 극방정식과 원뿔곡선 초점 극좌표 공식 | 공식: 초점을 극(원점)으로 할 때 이차곡선의 극방정식은 r = l / (1 - e·c", "공간벡터에서 구(Sphere)의 벡터방정식과 접평면\t공간벡터에서 구(Sphere)의 벡터방정식과 접평면\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 공간벡터에서 구(Sphere)의 벡터방정식과 접평면 | 공식: 지름의 양 끝점이 A(위치벡터 a), B(위치벡터 b) 인 구 위", "선형대수학 — 고윳값(Eigenvalue λ)과 고유벡터(Eigenvector v)의 정의\t선형대수학 — 고윳값(Eigenvalue λ)과 고유벡터(Eigenvector v)의 정의\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 선형대수학 — 고윳값(Eigenvalue λ)과 고유벡터(Eigenvector v)의 정의 | 공식: 정사각행렬 A에 대하여 영", "푸리에 급수(Fourier Series)와 직교 함수계\t푸리에 급수(Fourier Series)와 직교 함수계\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 푸리에 급수(Fourier Series)와 직교 함수계 | 공식: 주기가 2π인 임의의 주기함수 f(x)는 기본 진동수와 배음 ", "황금 분할(Golden Section)과 정오각형의 대각선 길이 비\t황금 분할(Golden Section)과 정오각형의 대각선 길이 비\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 황금 분할(Golden Section)과 정오각형의 대각선 길이 비 | 공식: 한 변의 길이가 1인 정오각형의 대각선 길이는 황", "테일러 다항식 근사와 오차항(나머지항 라그랑주 형태)\t테일러 다항식 근사와 오차항(나머지항 라그랑주 형태)\t\t[중·고교 교육과정 필수 기하·대수·미적분·확률 심화 완성] 테일러 다항식 근사와 오차항(나머지항 라그랑주 형태) | 공식: n번 미분가능한 함수 f(x)를 x = a 근방에서 다항식 P_", "순열 5! (5팩토리얼)과 6! (6팩토리얼)의 정확한 값\t순열 5! (5팩토리얼)과 6! (6팩토리얼)의 정확한 값 (5! = 120, 6! = 720 (4! = 24, 7! = 5,040))\t\t[조합론·확률 표준값] 순열 5! (5팩토리얼)과 6! (6팩토리얼)의 정확한 값 | 공식: 5! = 120, 6! = 720 (4! = 24, 7! = 5,040) | 해설: 경우의 수와", "조합 ₁₀C₃ 과 ₁₀C₂, ₁₀C₅ 의 값\t조합 ₁₀C₃ 과 ₁₀C₂, ₁₀C₅ 의 값 (₁₀C₂ = 45, ₁₀C₃ = 120, ₁₀C₅ = 252)\t\t[조합론·확률 표준값] 조합 ₁₀C₃ 과 ₁₀C₂, ₁₀C₅ 의 값 | 공식: ₁₀C₂ = 45, ₁₀C₃ = 120, ₁₀C₅ = 252 | 해설: 10개 중에서 2개·3개·5개를 뽑는 ", "교란순열(완전순열) D₃, D₄, D₅ 의 정확한 값\t교란순열(완전순열) D₃, D₄, D₅ 의 정확한 값\t\t[조합론·확률 표준값] 교란순열(완전순열) D₃, D₄, D₅ 의 정확한 값 | 공식: D₃ = 2, D₄ = 9, D₅ = 44 (점화식 D_n = (n-1)(D_{n-1} + D_{n-", "카탈란 수 C₃, C₄, C₅ 의 정확한 값\t카탈란 수 C₃, C₄, C₅ 의 정확한 값 (C₃ = 5, C₄ = 14, C₅ = 42 (C_n = ₂nC_n / (n + 1)))\t\t[조합론·확률 표준값] 카탈란 수 C₃, C₄, C₅ 의 정확한 값 | 공식: C₃ = 5, C₄ = 14, C₅ = 42 (C_n = ₂nC_n / (n + 1)) | 해설: 대각선을 넘", "집합의 분할 S(4, 2) 와 S(4, 3) 의 값\t집합의 분할 S(4, 2) 와 S(4, 3) 의 값 (S(4, 2) = 2³ - 1 = 7, S(4, 3) = ₄C₂ = 6)\t\t[조합론·확률 표준값] 집합의 분할 S(4, 2) 와 S(4, 3) 의 값 | 공식: S(4, 2) = 2³ - 1 = 7, S(4, 3) = ₄C₂ = 6 | 해설: 원소 4개인 집합을 ", "정규분포 표준화 구간 P(|Z| ≤ 1), P(|Z| ≤ 2), P(|Z| ≤ 3) 근삿값\t정규분포 표준화 구간 P(|Z| ≤ 1), P(|Z| ≤ 2), P(|Z| ≤ 3) 근삿값\t\t[조합론·확률 표준값] 정규분포 표준화 구간 P(|Z| ≤ 1), P(|Z| ≤ 2), P(|Z| ≤ 3) 근삿값 | 공식: P(|Z| ≤ 1) ≈ 0.6826 (68.3%), P(|Z| ", "주사위 두 개를 동시에 던질 때 눈의 합이 7이 될 확률\t주사위 두 개를 동시에 던질 때 눈의 합이 7이 될 확률\t\t[조합론·확률 표준값] 주사위 두 개를 동시에 던질 때 눈의 합이 7이 될 확률 | 공식: 6 / 36 = 1 / 6 (순서쌍 (1,6),(2,5),(3,4),(4,3),(5,2),(6,1", "1부터 10까지의 자연수의 합과 제곱의 합, 세제곱의 합\t1부터 10까지의 자연수의 합과 제곱의 합, 세제곱의 합\t\t[정수론·수열 표준값] 1부터 10까지의 자연수의 합과 제곱의 합, 세제곱의 합 | 공식: Σ(k=1..10) k = 55, Σ(k=1..10) k² = 385, Σ(k=1..10) k³ ", "2의 거듭제곱 2¹⁰ 과 2¹², 3⁵, 6³ 의 값\t2의 거듭제곱 2¹⁰ 과 2¹², 3⁵, 6³ 의 값 (2¹⁰ = 1,024, 2¹² = 4,096, 3⁵ = 243, 6³ = 216)\t\t[정수론·수열 표준값] 2의 거듭제곱 2¹⁰ 과 2¹², 3⁵, 6³ 의 값 | 공식: 2¹⁰ = 1,024, 2¹² = 4,096, 3⁵ = 243, 6³ = 216 | 해설: 부분집합 ", "상용로그 log₁₀(2) ≈ 0.3010, log₁₀(3) ≈ 0.4771 일 때 log₁₀(5)의 값\t상용로그 log₁₀(2) ≈ 0.3010, log₁₀(3) ≈ 0.4771 일 때 log₁₀(5)의 값 (log₁₀(5) = log₁₀(10 / 2) = 1 - log₁₀(2) ≈ 0.6990)\t\t[정수론·수열 표준값] 상용로그 log₁₀(2) ≈ 0.3010, log₁₀(3) ≈ 0.4771 일 때 log₁₀(5)의 값 | 공식: log₁₀(5) = log₁₀(10 / 2) = 1", "100 이하의 소수(Prime Number)의 총개수와 첫 10개의 소수\t100 이하의 소수(Prime Number)의 총개수와 첫 10개의 소수\t\t[정수론·수열 표준값] 100 이하의 소수(Prime Number)의 총개수와 첫 10개의 소수 | 공식: 총 25개 (첫 10개: 2, 3, 5, 7, 11, 13, 17, 19, 23,", "배수 판정법 총정리(3의 배수·4의 배수·9의 배수·11의 배수)\t배수 판정법 총정리(3의 배수·4의 배수·9의 배수·11의 배수)\t\t[정수론·수열 표준값] 배수 판정법 총정리(3의 배수·4의 배수·9의 배수·11의 배수) | 공식: 3의 배수(각 자리 숫자의 합이 3의 배수), 4의 배수(끝 두 자리가 00 또는 4의 ", "한 변의 길이가 a인 정삼각형의 높이와 넓이, 외접원·내접원 반지름\t한 변의 길이가 a인 정삼각형의 높이와 넓이, 외접원·내접원 반지름\t\t[기하·해석 표준 공식] 한 변의 길이가 a인 정삼각형의 높이와 넓이, 외접원·내접원 반지름 | 공식: 높이 h = (√3 / 2)a, 넓이 S = (√3 / 4)a², 내접원 반지름 r ", "한 모서리의 길이가 a인 정사면체의 높이와 부피, 이면각의 코사인값\t한 모서리의 길이가 a인 정사면체의 높이와 부피, 이면각의 코사인값\t\t[기하·해석 표준 공식] 한 모서리의 길이가 a인 정사면체의 높이와 부피, 이면각의 코사인값 | 공식: 높이 h = (√6 / 3)a, 부피 V = (√2 / 12)a³, 두 면이 이루는 ", "한 변의 길이가 a인 정육각형의 넓이와 대각선의 길이\t한 변의 길이가 a인 정육각형의 넓이와 대각선의 길이\t\t[기하·해석 표준 공식] 한 변의 길이가 a인 정육각형의 넓이와 대각선의 길이 | 공식: 넓이 S = 6 × (√3 / 4)a² = (3√3 / 2)a², 가장 긴 대각선 2a, 짧은 대각", "초점 거리가 p인 포물선 y² = 4px 의 초점 현(통경, Latus Rectum)의 길이\t초점 거리가 p인 포물선 y² = 4px 의 초점 현(통경, Latus Rectum)의 길이 (초점 F(p, 0)를 지나고 축에 수직인 현의 길이는 |4p|)\t\t[기하·해석 표준 공식] 초점 거리가 p인 포물선 y² = 4px 의 초점 현(통경, Latus Rectum)의 길이 | 공식: 초점 F(p, 0)를 지나고 축에 수직인 현의 길이는 |4p", "사인·코사인 반주기 넓이 ∫_0^π sin x dx 와 ∫_0^(π/2) sin x dx\t사인·코사인 반주기 넓이 ∫_0^π sin x dx 와 ∫_0^(π/2) sin x dx\t\t[미적분 핵심 정적분] 사인·코사인 반주기 넓이 ∫_0^π sin x dx 와 ∫_0^(π/2) sin x dx | 공식: ∫_0^(π/2) sin x dx = ∫_0^(π/2) cos x", "극값 차 공식(삼차함수 극댓값과 극솟값의 차)\t극값 차 공식(삼차함수 극댓값과 극솟값의 차)\t\t[미적분 핵심 정적분] 극값 차 공식(삼차함수 극댓값과 극솟값의 차) | 공식: 삼차함수 f(x) = ax³ + ··· 의 도함수 f'(x) = 3a(x - α)(x - β) (α < β)", "사차함수 대칭 극값 차 공식(접선과 둘러싸인 넓이)\t사차함수 대칭 극값 차 공식(접선과 둘러싸인 넓이)\t\t[미적분 핵심 정적분] 사차함수 대칭 극값 차 공식(접선과 둘러싸인 넓이) | 공식: 최고차항 계수가 a인 사차함수가 중근 α와 다른 근 β를 가질 때 둘러싸인 넓이 S = (|a| / 3", "x → ∞ 일 때 로그함수·다항함수·지수함수의 발산 속도 서열\tx → ∞ 일 때 로그함수·다항함수·지수함수의 발산 속도 서열\t\t[미적분 핵심 극한] x → ∞ 일 때 로그함수·다항함수·지수함수의 발산 속도 서열 | 공식: x → ∞ 일 때 ln x ≪ x^p (p > 0) ≪ a^x (a > 1) ≪ x! ≪ x^", "sin(π/6) = sin(30°)의 정확한 값\tsin(π/6) = sin(30°)의 정확한 값 (1/2)\t\t[삼각함수 특수각] sin(π/6) = sin(30°)의 정확한 값 | 공식: 1/2 | 해설: 단위원에서 중심각 π/6(30°)일 때 y좌표(높이/빗변)는 1/2", "cos(π/6) = cos(30°)의 정확한 값\tcos(π/6) = cos(30°)의 정확한 값 (√3 / 2)\t\t[삼각함수 특수각] cos(π/6) = cos(30°)의 정확한 값 | 공식: √3 / 2 | 해설: 정삼각형을 이등분한 직각삼각형(1:√3:2)에서 밑변/빗변은 √3/2", "tan(π/6) = tan(30°)의 정확한 값\ttan(π/6) = tan(30°)의 정확한 값 (√3 / 3 (= 1/√3))\t\t[삼각함수 특수각] tan(π/6) = tan(30°)의 정확한 값 | 공식: √3 / 3 (= 1/√3) | 해설: sin(30°)/cos(30°) = (1/2)/(√3/2) = √3/3", "sin(π/4) = sin(45°)와 cos(π/4) = cos(45°)의 값\tsin(π/4) = sin(45°)와 cos(π/4) = cos(45°)의 값 (√2 / 2 (= 1/√2))\t\t[삼각함수 특수각] sin(π/4) = sin(45°)와 cos(π/4) = cos(45°)의 값 | 공식: √2 / 2 (= 1/√2) | 해설: 직각이등변삼각형(1:1:√2)에서 사인과", "tan(π/4) = tan(45°)의 정확한 값\ttan(π/4) = tan(45°)의 정확한 값 (1)\t\t[삼각함수 특수각] tan(π/4) = tan(45°)의 정확한 값 | 공식: 1 | 해설: 기울기가 1인 직선 y = x 가 양의 x축과 이루는 각이 π/4(45°)", "sin(π/3) = sin(60°)의 정확한 값\tsin(π/3) = sin(60°)의 정확한 값 (√3 / 2)\t\t[삼각함수 특수각] sin(π/3) = sin(60°)의 정확한 값 | 공식: √3 / 2 | 해설: 여각 공식 sin(60°) = cos(30°) = √3/2", "cos(π/3) = cos(60°)의 정확한 값\tcos(π/3) = cos(60°)의 정확한 값 (1/2)\t\t[삼각함수 특수각] cos(π/3) = cos(60°)의 정확한 값 | 공식: 1/2 | 해설: 여각 공식 cos(60°) = sin(30°) = 1/2", "tan(π/3) = tan(60°)의 정확한 값\ttan(π/3) = tan(60°)의 정확한 값 (√3)\t\t[삼각함수 특수각] tan(π/3) = tan(60°)의 정확한 값 | 공식: √3 | 해설: 기울기가 √3인 직선이 양의 x축과 이루는 각은 π/3(60°)", "sin(0), cos(0), tan(0)의 값\tsin(0), cos(0), tan(0)의 값 (sin(0) = 0, cos(0) = 1, tan(0) = 0)\t\t[삼각함수 특수각] sin(0), cos(0), tan(0)의 값 | 공식: sin(0) = 0, cos(0) = 1, tan(0) = 0 | 해설: 단위원 위의 점 (1, 0)에서의 삼각", "sin(π/2)와 cos(π/2)의 값\tsin(π/2)와 cos(π/2)의 값 (sin(π/2) = 1, cos(π/2) = 0 (tan(π/2)는 정의되지 않음))\t\t[삼각함수 특수각] sin(π/2)와 cos(π/2)의 값 | 공식: sin(π/2) = 1, cos(π/2) = 0 (tan(π/2)는 정의되지 않음) | 해설: 단위원 위의 점 (0, ", "sin(π), cos(π), tan(π)의 값\tsin(π), cos(π), tan(π)의 값 (sin(π) = 0, cos(π) = -1, tan(π) = 0)\t\t[삼각함수 특수각] sin(π), cos(π), tan(π)의 값 | 공식: sin(π) = 0, cos(π) = -1, tan(π) = 0 | 해설: 단위원 위의 점 (-1, 0)에서의 ", "sin(3π/2)와 cos(3π/2)의 값\tsin(3π/2)와 cos(3π/2)의 값 (sin(3π/2) = -1, cos(3π/2) = 0)\t\t[삼각함수 특수각] sin(3π/2)와 cos(3π/2)의 값 | 공식: sin(3π/2) = -1, cos(3π/2) = 0 | 해설: 단위원 위의 점 (0, -1)에서의 삼각함수 값", "sin(2π/3) = sin(120°)와 cos(2π/3) = cos(120°)의 값\tsin(2π/3) = sin(120°)와 cos(2π/3) = cos(120°)의 값 (sin(2π/3) = √3/2, cos(2π/3) = -1/2)\t\t[삼각함수 특수각] sin(2π/3) = sin(120°)와 cos(2π/3) = cos(120°)의 값 | 공식: sin(2π/3) = √3/2, cos(2π/3) = -1/2 | 해설:", "sin(3π/4) = sin(135°)와 cos(3π/4) = cos(135°)의 값\tsin(3π/4) = sin(135°)와 cos(3π/4) = cos(135°)의 값\t\t[삼각함수 특수각] sin(3π/4) = sin(135°)와 cos(3π/4) = cos(135°)의 값 | 공식: sin(3π/4) = √2/2, cos(3π/4) = -√2/2, tan", "sin(5π/6) = sin(150°)와 cos(5π/6) = cos(150°)의 값\tsin(5π/6) = sin(150°)와 cos(5π/6) = cos(150°)의 값 (sin(5π/6) = 1/2, cos(5π/6) = -√3/2)\t\t[삼각함수 특수각] sin(5π/6) = sin(150°)와 cos(5π/6) = cos(150°)의 값 | 공식: sin(5π/6) = 1/2, cos(5π/6) = -√3/2 | 해설:", "사인 덧셈정리 sin(α ± β) 공식\t사인 덧셈정리 sin(α ± β) 공식 (sin(α ± β) = sinα·cosβ ± cosα·sinβ)\t\t[삼각함수 덧셈정리] 사인 덧셈정리 sin(α ± β) 공식 | 공식: sin(α ± β) = sinα·cosβ ± cosα·sinβ | 해설: 싸코코싸(부호 동일)로 암기하는 삼각함수 덧", "코사인 덧셈정리 cos(α ± β) 공식\t코사인 덧셈정리 cos(α ± β) 공식 (cos(α ± β) = cosα·cosβ ∓ sinα·sinβ)\t\t[삼각함수 덧셈정리] 코사인 덧셈정리 cos(α ± β) 공식 | 공식: cos(α ± β) = cosα·cosβ ∓ sinα·sinβ | 해설: 코코싸싸(부호 반대)로 암기하는 삼각함수 ", "탄젠트 덧셈정리 tan(α ± β) 공식과 두 직선이 이루는 예각\t탄젠트 덧셈정리 tan(α ± β) 공식과 두 직선이 이루는 예각 (tan(α ± β) = (tanα ± tanβ) / (1 ∓ tanα·tanβ))\t\t[삼각함수 덧셈정리] 탄젠트 덧셈정리 tan(α ± β) 공식과 두 직선이 이루는 예각 | 공식: tan(α ± β) = (tanα ± tanβ) / (1 ∓ tanα·tanβ) | 해설:", "사인 2배각 공식 sin(2α)\t사인 2배각 공식 sin(2α) (sin(2α) = 2·sinα·cosα)\t\t[삼각함수 배각·반각] 사인 2배각 공식 sin(2α) | 공식: sin(2α) = 2·sinα·cosα | 해설: 덧셈정리에서 β = α 를 대입하여 유도한 2배각 항등식", "코사인 2배각 공식 cos(2α)의 3가지 표현\t코사인 2배각 공식 cos(2α)의 3가지 표현\t\t[삼각함수 배각·반각] 코사인 2배각 공식 cos(2α)의 3가지 표현 | 공식: cos(2α) = cos²α - sin²α = 2cos²α - 1 = 1 - 2sin²α | 해설: 제곱 ", "탄젠트 2배각 공식 tan(2α)\t탄젠트 2배각 공식 tan(2α) (tan(2α) = 2tanα / (1 - tan²α))\t\t[삼각함수 배각·반각] 탄젠트 2배각 공식 tan(2α) | 공식: tan(2α) = 2tanα / (1 - tan²α) | 해설: 탄젠트 덧셈정리에서 두 각이 같을 때의 2배각 공식", "반각 공식 sin²(α/2)와 cos²(α/2)\t반각 공식 sin²(α/2)와 cos²(α/2)\t\t[삼각함수 배각·반각] 반각 공식 sin²(α/2)와 cos²(α/2) | 공식: sin²(α/2) = (1 - cosα)/2, cos²(α/2) = (1 + cosα)/2 | 해설: 코사", "삼각함수의 합성 a·sinθ + b·cosθ 공식\t삼각함수의 합성 a·sinθ + b·cosθ 공식\t\t[삼각함수 합성] 삼각함수의 합성 a·sinθ + b·cosθ 공식 | 공식: √(a² + b²) · sin(θ + α) (단, cosα = a/√(a²+b²), sinα = b/√(a²+", "sin(15°) = sin(π/12)와 cos(15°) = cos(π/12)의 정확한 값\tsin(15°) = sin(π/12)와 cos(15°) = cos(π/12)의 정확한 값\t\t[삼각함수 특수각] sin(15°) = sin(π/12)와 cos(15°) = cos(π/12)의 정확한 값 | 공식: sin(15°) = (√6 - √2)/4, cos(15°) = (√6"], "korean": ["되다 / 돼다 구분\t되다 / 돼다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 되다 / 돼다 구분: 어간 '되-' 뒤에 어미 '-어'가 결합해 줄어든 말은 '돼(되어)'이고, 어간 뒤 자음 어미(-고, -지, -니) 앞에는 '되-'로", "안 / 않 구분\t안 / 않 구분 (부정 부사 '안'은 '아니'의 준말(용언 앞 수식)\t\t[한글 맞춤법·표준어 혼동 어휘] 안 / 않 구분: 안 먹다, 안 가다)이고, '않-'은 보조용언 '아니하-'의 준말로 '-지 않다' 구성(먹지 않다, 가지 않다)에만 쓰임", "로써 / 로서 구분\t로써 / 로서 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 로써 / 로서 구분: '-(으)로써'는 수단·도구·방법·재료·시간 셈 기준(대화로써 풀다, 눈물로써 호소하다)에 쓰고, '-(으)로서'는 지위·신분·자격(", "던지 / 든지 구분\t던지 / 든지 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 던지 / 든지 구분: '-던지'는 과거의 일이나 회상·의문(얼마나 춥던지, 어찌나 많이 먹던지)에 쓰고, '-든지'는 나열된 사실 중 어느 것이든 선택됨(", "데 / 대 구분\t데 / 대 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 데 / 대 구분: 그 영화 재미있대) 씀", "율 / 률, 열 / 렬, 양 / 량 표기 규칙\t율 / 률, 열 / 렬, 양 / 량 표기 규칙\t\t[한글 맞춤법·표준어 혼동 어휘] 율 / 률, 열 / 렬, 양 / 량 표기 규칙: 모음이나 'ㄴ' 받침 뒤에서는 '율, 열, 양'(비율, 백분율, 진열, 선열, 분량, 개량)으로 적고, 그", "사이시옷 표기 6개 한자어 예외\t사이시옷 표기 6개 한자어 예외\t\t[한글 맞춤법·표준어 혼동 어휘] 사이시옷 표기 6개 한자어 예외: 두 글자 한자어 합성어에는 원칙적으로 사이시옷을 적지 않으나 '곳간(庫間), 셋방(貰房), 숫자(數字), 찻간(車間), ", "사이시옷 표기 고유어·혼종어 원칙\t사이시옷 표기 고유어·혼종어 원칙\t\t[한글 맞춤법·표준어 혼동 어휘] 사이시옷 표기 고유어·혼종어 원칙: 고유어 합성어나 고유어+한자어 합성어에서 앞말이 모음으로 끝나고 뒷말 첫소리가 된소리로 나거나 'ㄴ' 소리가 덧나면 사", "두음 법칙(頭音法則) 표기 원칙\t두음 법칙(頭音法則) 표기 원칙\t\t[한글 맞춤법·표준어 혼동 어휘] 두음 법칙(頭音法則) 표기 원칙: 한자음 '녀, 뇨, 뉴, 니'와 '랴, 려, 례, 료, 류, 리'가 단어 첫머리에 올 때 '여, 요, 유, 이'와 '야,", "맞히다 / 맞추다 구분\t맞히다 / 맞추다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 맞히다 / 맞추다 구분: '맞히다'는 문제의 정답을 골라내거나 화살·총알을 표적에 닿게 하다(정답을 맞히다, 과녁을 맞히다, 눈비를 맞히다)에 쓰고, '맞", "가르치다 / 가리키다 구분\t가르치다 / 가리키다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 가르치다 / 가리키다 구분: '가르치다'는 지식이나 기능을 알게 하거나 교육하다(수학을 가르치다)에 쓰고, '가리키다'는 손가락이나 방향 등으로 어떤 대상", "다르다 / 틀리다 구분\t다르다 / 틀리다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 다르다 / 틀리다 구분: 같다)에 쓰고, '틀리다'는 셈이나 사실이 그릇되거나 어긋나다(계산이 틀리다, 반대말: 맞다)에 씀", "낫다 / 낳다 / 낮다 구분\t낫다 / 낳다 / 낮다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 낫다 / 낳다 / 낮다 구분: '낫다'(ㅅ불규칙)는 병이 치유되거나(감기가 나았다) 보다 더 좋다(이게 더 낫다)에 쓰고, '낳다'는 아기를 출산하거나 결", "부치다 / 붙이다 구분\t부치다 / 붙이다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 부치다 / 붙이다 구분: '붙이다'는 떨어지지 않게 접착하거나 조건·이름·불을 옮기다(우표를 붙이다, 별명을 붙이다, 조건을 붙이다)에 쓰고, '부치다'는", "거치다 / 걷히다 구분\t거치다 / 걷히다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 거치다 / 걷히다 구분: '거치다'는 도중에 어디를 들르거나 통과하다(대전을 거쳐 가다, 심의를 거치다)에 쓰고, '걷히다'는 안개·구름·어둠이 사라지거나", "바치다 / 받치다 / 받히다 / 밭치다 구분\t바치다 / 받치다 / 받히다 / 밭치다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 바치다 / 받치다 / 받히다 / 밭치다 구분: '바치다'(신께 제물·세금·목숨을 드리다), '받치다'(우산을 받치다, 책받침을 밑에 대다, 옷을 받쳐 입다", "반드시 / 반듯이 구분\t반드시 / 반듯이 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 반드시 / 반듯이 구분: '반드시'는 틀림없이 꼭(약속을 반드시 지키다)의 뜻이고, '반듯이'는 모양이나 자세가 기울거나 굽지 않고 바르게(고개를 반듯이 ", "일절 / 일체 구분\t일절 / 일체 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 일절 / 일체 구분: '일절(一切)'은 사물을 부인하거나 금지할 때 '아주, 전혀, 절대로'(출입을 일절 금한다, 변명은 일절 하지 마라)의 부사로 쓰고,", "체 / 채 구분\t체 / 채 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 체 / 채 구분: 의존명사 '체'는 거짓으로 꾸미는 모양이나 태도(모르는 체하다, 잘난 체하다 = 척)에 쓰고, '채'는 이미 있는 상태 그대로 유지함(옷", "너머 / 넘어 구분\t너머 / 넘어 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 너머 / 넘어 구분: 명사 '너머'는 산·고개·담·창문 등 높은 경계의 저쪽 공간(산 너머 남촌, 창문 너머로 보이다)을 뜻하고, '넘어'는 동사 '넘다'", "조차 / 마저 / 까지 조사 구분\t조차 / 마저 / 까지 조사 구분 ('조차'(전혀 예상치 못한 극단적 상황까지 포함)\t\t[한글 맞춤법·표준어 혼동 어휘] 조차 / 마저 / 까지 조사 구분: 너조차 나를 못 믿니), '마저'(남아 있던 마지막 하나까지 모두: 마지막 희망마저 사라졌다), '까지'(어떤 범위의 ", "왠지 / 웬일 표기 구분\t왠지 / 웬일 표기 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 왠지 / 웬일 표기 구분: '왠지'는 '왜인지'가 줄어든 말로 이유를 모르게(오늘따라 왠지 기분이 좋다)에만 '왜(왠)'로 적고, 그 외의 관형사 '어찌 ", "금세 / 금시초문 구분\t금세 / 금시초문 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 금세 / 금시초문 구분: '금세'는 '금시(今時)에'가 줄어든 부사로 '지금 바로, 곧장'(금세 날이 어두워졌다 — '금새'는 비표준어)이고, '금시초문(", "며칠 / 몇 일 표기 규칙\t며칠 / 몇 일 표기 규칙\t\t[한글 맞춤법·표준어 혼동 어휘] 며칠 / 몇 일 표기 규칙: '몇 월 며칠'이든 '며칠 동안'이든 어원이 분명하지 아니하여 본모양에서 멀어졌으므로 언제나 소리 나는 대로 '며칠'로만 적음", "설거지 / 설겆이, 값어치 / 값어치 표기\t설거지 / 설겆이, 값어치 / 값어치 표기\t\t[한글 맞춤법·표준어 혼동 어휘] 설거지 / 설겆이, 값어치 / 값어치 표기: 소리 나는 대로 적는 표준어 규정에 따라 '설거지'(설겆이 X), '푸성귀', '개구쟁이'(멋쟁이, 욕심쟁이 ", "이따가 / 있다가 구분\t이따가 / 있다가 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 이따가 / 있다가 구분: 부사 '이따가'는 '조금 지난 뒤에'(이따가 저녁에 만나자)라는 시간의 뜻이고, '있다가'는 동사 '있다'의 활용형으로 어떤 장소", "껍질 / 껍데기, 살찌다 / 살피다 구분\t껍질 / 껍데기, 살찌다 / 살피다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 껍질 / 껍데기, 살찌다 / 살피다 구분: '껍질'은 사과·양파·나무·귤처럼 무른 물질의 겉을 싸고 있는 단단하지 않은 외피이고, '껍데기'는 달걀·조개·", "늘리다 / 늘이다 구분\t늘리다 / 늘이다 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 늘리다 / 늘이다 구분: '늘리다'는 수량·시간·실력·몸무게·세력 등이 원래보다 많아지거나 커지게 하다(학생 수를 늘리다, 공부 시간을 늘리다)이고, '늘", "دار다(달다) / 다르다 활용형(달라 / 틀려)\tدار다(달다) / 다르다 활용형(달라 / 틀려) (형용사 '다르다'( 같지 않다 )와 동사 '달다'(요구하다)\t\t[한글 맞춤법·표준어 혼동 어휘] دار다(달다) / 다르다 활용형(달라 / 틀려): 물을 달라)는 모두 '르 불규칙' 및 '달라'로 활용되어 \"남들과 생각이 달라(다르다)\"로 적으며, '", "결재(決裁) / 결제(決濟) 구분\t결재(決裁) / 결제(決濟) 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 결재(決裁) / 결제(決濟) 구분: '결재'는 결정할 권한이 있는 상관이 부하가 제출한 안건을 검토하여 허가·승인함(서류 결재를 올리다)이고, '결제'는 ", "개발(開發) / 계발(啓發) 구분\t개발(開發) / 계발(啓發) 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 개발(開發) / 계발(啓發) 구분: '개발'은 토지·천연자원·신제품·소프트웨어·경제 등을 개척하여 발전시킴(신약 개발, 경제 개발)이고, '계발'은 슬기나", "실제(實際) / 실재(實在) 구분\t실제(實際) / 실재(實在) 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 실제(實際) / 실재(實在) 구분: '실제'는 사실의 경우나 형편 또는 거짓이나 상상이 아닌 현실(이론과 실제, 실제로 있었던 일)이고, '실재'는 철학·", "지양(止揚) / 지향(指向) 구분\t지양(止揚) / 지향(指向) 구분\t\t[한글 맞춤법·표준어 혼동 어휘] 지양(止揚) / 지향(指向) 구분: '지양'은 더 높은 단계로 발전하기 위해 어떠한 것을 하지 아니함(소모적인 갈등을 지양하다)이고, '지향'은 어떤 목표", "고유어 단위 명사(손·쾌·접·축·죽·톳·두름·우리·쌈)\t고유어 단위 명사(손·쾌·접·축·죽·톳·두름·우리·쌈)\t\t[한글 맞춤법·표준어 혼동 어휘] 고유어 단위 명사(손·쾌·접·축·죽·톳·두름·우리·쌈): 고등어·조기 한 손(2마리), 북어 한 쾌(20마리), 마늘·배추 한 접(100개), 오징어 한 ", "나이를 나타내는 고유어·한자어(세시·연령 어휘)\t나이를 나타내는 고유어·한자어(세시·연령 어휘)\t\t[한글 맞춤법·표준어 혼동 어휘] 나이를 나타내는 고유어·한자어(세시·연령 어휘): 돌(만 1세), 미운 일곱 살, 지학(志學, 15세), 약관(弱冠, 20세) / 방년(芳年, 여성 20세", "음운(Phoneme)의 정의와 자음 19개·모음 21개 체계\t음운(Phoneme)의 정의와 자음 19개·모음 21개 체계\t\t[국어 음운론·형태론·통사론·중세국어] 음운(Phoneme)의 정의와 자음 19개·모음 21개 체계: 단모음 10개('ㅏ,ㅐ,ㅓ,ㅔ,ㅗ,ㅚ,ㅜ,ㅟ,ㅡ,ㅣ' — '키위를 주게 되었소 내가')", "자음 조음 위치(양순음·치조음·경구개음·연구개음·후음)와 조음 방법(파열음·파찰음·마찰음·비음·유음)\t자음 조음 위치(양순음·치조음·경구개음·연구개음·후음)와 조음 방법(파열음·파찰음·마찰음·비음·유음)\t\t[국어 음운론·형태론·통사론·중세국어] 자음 조음 위치(양순음·치조음·경구개음·연구개음·후음)와 조음 방법(파열음·파찰음·마찰음·비음·유음): 안울림소리는 예사소리(평음)-된소리(경음)-거", "음절의 끝소리 규칙(음운의 교체 1)\t음절의 끝소리 규칙(음운의 교체 1)\t\t[국어 음운론·형태론·통사론·중세국어] 음절의 끝소리 규칙(음운의 교체 1): 뒤에 모음으로 시작하는 형식 형태소(조사·어미·접미사)가 오면 대표음으로 바뀌지 않고 제 음가대로 연음되며(꽃", "비음화(Nasalization, 음운의 교체 2 — 자음 동화)\t비음화(Nasalization, 음운의 교체 2 — 자음 동화)\t\t[국어 음운론·형태론·통사론·중세국어] 비음화(Nasalization, 음운의 교체 2 — 자음 동화): 조음 위치는 그대로 두고 조음 방법만 뒤 음운을 닮아 비음으로 바뀌는 표준 발음 현", "유음화(Liquidization, 음운의 교체 3 — 자음 동화)\t유음화(Liquidization, 음운의 교체 3 — 자음 동화)\t\t[국어 음운론·형태론·통사론·중세국어] 유음화(Liquidization, 음운의 교체 3 — 자음 동화): 유음화의 예외가 되는 2음절+1음절 한자어 결합 단어들이 시험에 자주 출제됨", "구개음화(Palatalization, 음운의 교체 4)\t구개음화(Palatalization, 음운의 교체 4)\t\t[국어 음운론·형태론·통사론·중세국어] 구개음화(Palatalization, 음운의 교체 4): 주의! 한 형태소 내부(잔디, 느티나무)이거나 뒤에 실질 형태소가 올 때(밭이랑[반니랑], ", "된소리되기(경음화, 음운의 교체 5)\t된소리되기(경음화, 음운의 교체 5)\t\t[국어 음운론·형태론·통사론·중세국어] 된소리되기(경음화, 음운의 교체 5): 용언 어간 'ㄴ, ㅁ' 뒤에서 어미는 된소리가 되지만 명사 파생 접미사(신발, 논밭)나 피동·사동 접미사 '-", "자음군 단순화(겹받침 발음, 음운의 탈락 1)\t자음군 단순화(겹받침 발음, 음운의 탈락 1)\t\t[국어 음운론·형태론·통사론·중세국어] 자음군 단순화(겹받침 발음, 음운의 탈락 1): 단, '밟-'은 자음 앞에서 [밥-](밟다[밥따], 밟고[밥꼬])으로, '넓-'은 '넓죽하다[넙쭈카다", "음운의 축약(거센소리되기·유기음화)과 탈락(ㅎ탈락·ㅡ탈락·ㄹ탈락)\t음운의 축약(거센소리되기·유기음화)과 탈락(ㅎ탈락·ㅡ탈락·ㄹ탈락)\t\t[국어 음운론·형태론·통사론·중세국어] 음운의 축약(거센소리되기·유기음화)과 탈락(ㅎ탈락·ㅡ탈락·ㄹ탈락): 축하[추카], 좋고[조코], 놓다[노타])이고, 탈락은 모음 어미 앞에서 'ㅎ'이", "사잇소리 현상과 ㄴ첨가(음운의 첨가)\t사잇소리 현상과 ㄴ첨가(음운의 첨가)\t\t[국어 음운론·형태론·통사론·중세국어] 사잇소리 현상과 ㄴ첨가(음운의 첨가): '꽃잎'은 음절 끝소리 규칙(교체: ㅊ→ㄷ) + ㄴ첨가(첨가: 잎→닙) + 비음화(교체: ㄷ→ㄴ)가 차례로 일", "형태소(Morpheme)의 분류(자립성 유무\t형태소(Morpheme)의 분류(자립성 유무 (자립/의존, 실질적 의미 유무)\t\t[국어 음운론·형태론·통사론·중세국어] 형태소(Morpheme)의 분류(자립성 유무: 실질/형식):뜻을 가진 가장 작은 말의 단위로 자립+실질(명사·대명사·수사·관형사·부사·감탄사), 의존", "단어의 형성(단일어 vs 복합어\t단어의 형성(단일어 vs 복합어 (파생어와 합성어))\t\t[국어 음운론·형태론·통사론·중세국어] 단어의 형성(단일어 vs 복합어: 어근 하나로 된 단일어와 달리, 어근에 접사(접두사·접미사)가 붙은 말은 파생어(맨손, 풋사과, 지우개, 멋쟁이, ", "통사적 합성어와 비통사적 합성어의 구별\t통사적 합성어와 비통사적 합성어의 구별\t\t[국어 음운론·형태론·통사론·중세국어] 통사적 합성어와 비통사적 합성어의 구별: '작은형(작+은+형)'과 '건널목(건너+ㄹ+목)'은 관형사형 어미 '-은, -ㄹ'이 있으므로 통사적 합성어이", "국어 9품사 분류 체계(체언·용언·수식언·관계언·독립언)\t국어 9품사 분류 체계(체언·용언·수식언·관계언·독립언) (형태가 변하지 않는 불변어(체언)\t\t[국어 음운론·형태론·통사론·중세국어] 국어 9품사 분류 체계(체언·용언·수식언·관계언·독립언): 명사·대명사·수사 / 수식언: 관형사·부사 / 관계언: 조사 / 독립언: 감탄사)와 형태가", "문장 성분 7종(주성분\t문장 성분 7종(주성분 (주어·서술어·목적어·보어 / 부속성분)\t\t[국어 음운론·형태론·통사론·중세국어] 문장 성분 7종(주성분: 관형어·부사어 / 독립성분: 독립어):문장 골격을 이루는 주성분 중 '보어'는 오직 서술어 '되다, 아니다' 앞에서 조사 '", "서술어의 자릿수(한 자리·두 자리·세 자리 서술어)\t서술어의 자릿수(한 자리·두 자리·세 자리 서술어)\t\t[국어 음운론·형태론·통사론·중세국어] 서술어의 자릿수(한 자리·두 자리·세 자리 서술어): 원래 부사어는 수의적 부속성분이지만 '닮다, 같다, 다르다, 넣다, 삼다, 주다' 등이 요구하는", "안은문장(복문)과 안긴문장(절) 5유형(명사절·관형절·부사절·서술절·인용절)\t안은문장(복문)과 안긴문장(절) 5유형(명사절·관형절·부사절·서술절·인용절)\t\t[국어 음운론·형태론·통사론·중세국어] 안은문장(복문)과 안긴문장(절) 5유형(명사절·관형절·부사절·서술절·인용절): 관계관형절 vs 동격관형절), 부사절(-이, -게, -도록, -아서),", "피동 표현(파생적 피동 '-이/히/리/기-', '-되다' vs 통사적 피동 '-아/어지다', '-게 되다')과 사동 표현('-이/히/리/기/우/구/추-', '-시키다', '-게 하다')\t피동 표현(파생적 피동 '-이/히/리/기-', '-되다' vs 통사적 피동 '-아/어지다', '-게 되다')과 사동 표현('-이/히/리/기/우/구/추-', '-시키다', '-게 하다')\t\t[국어 음운론·형태론·통사론·중세국어] 피동 표현(파생적 피동 '-이/히/리/기-', '-되다' vs 통사적 피동 '-아/어지다', '-게 되다')과 사동 표현('-이/히/리/기/우/구/추", "훈민정음 창제 원리(상형의 원리와 가획·합용의 원리)\t훈민정음 창제 원리(상형의 원리와 가획·합용의 원리)\t\t[국어 음운론·형태론·통사론·중세국어] 훈민정음 창제 원리(상형의 원리와 가획·합용의 원리): 종성(받침)은 따로 글자를 만들지 않고 초성 글자를 다시 쓴다는 '종성부용초성(終聲復用初聲)'", "중세 국어(15세기 국어)의 주요 문법·표기 특징(이어적기·8종성가족용·모음조화·주체/객체/상대 높임·주격 조사 이/∅)\t중세 국어(15세기 국어)의 주요 문법·표기 특징(이어적기·8종성가족용·모음조화·주체/객체/상대 높임·주격 조사 이/∅) (연철(이어적기)\t\t[국어 음운론·형태론·통사론·중세국어] 중세 국어(15세기 국어)의 주요 문법·표기 특징(이어적기·8종성가족용·모음조화·주체/객체/상대 높임·주격 조사 이/∅): 깊은 → 기픈), 받침을 ", "객관적 상관물(Objective Correlative)\t객관적 상관물(Objective Correlative)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 객관적 상관물(Objective Correlative): 황조가의 '꾀꼬리' — 화자의 외로움 심화):감정이입된 대상은 반드시 객관적 ", "감정이입(Empathy)과 감정 투영\t감정이입(Empathy)과 감정 투영\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 감정이입(Empathy)과 감정 투영: '우는 접동새', '눈물 흘리는 꽃'):대상이 화자의 정서와 동일시되어 울거나 기뻐할 때 성립하", "공감각적 심상(감각의 전이)\t공감각적 심상(감각의 전이)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 공감각적 심상(감각의 전이): '분수처럼 흩어지는 푸른 종소리' — 청각의 시각화, '금빛 게으른 울음' — 청각의 시각화, '피부의 ", "역설법(Paradox)과 반어법(Irony)의 구별\t역설법(Paradox)과 반어법(Irony)의 구별\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 역설법(Paradox)과 반어법(Irony)의 구별: 문장 자체에 양립 불가능한 논리적 모순(소리 없다 + 아우성)이 있으면 역설법이고", "설의법(Rhetorical Question)과 영탄법·돈호법\t설의법(Rhetorical Question)과 영탄법·돈호법\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 설의법(Rhetorical Question)과 영탄법·돈호법: '가난하다고 해서 사랑을 모르겠는가'), 영탄법(감탄사나 감탄형 어미 '", "직유법·은유법·의인법·활유법(비유하기 4대 기법)\t직유법·은유법·의인법·활유법(비유하기 4대 기법)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 직유법·은유법·의인법·활유법(비유하기 4대 기법): '내 마음은 호수요'), 의인법(사람이 아닌 것에 인격을 부여해 사람처럼 표현), ", "대유법(제유법과 환유법)\t대유법(제유법과 환유법)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 대유법(제유법과 환유법): 사물의 일부분이나 한 종류로 전체를 나타내는 제유법('빵만으로는 살 수 없다'에서 빵=식량 전체, '백두에서", "대구법·점층법·점강법·열거법·연쇄법(강조와 변화 기법)\t대구법·점층법·점강법·열거법·연쇄법(강조와 변화 기법) (대구법(가락이 비슷한 문장 구조를 나란히 짝지어 리듬감 형성)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 대구법·점층법·점강법·열거법·연쇄법(강조와 변화 기법): '범은 죽어서 가죽을 남기고 사람은 죽어서 이름을 남긴다'), 점층법(작고 약", "시적 허용(시적 자유)과 도치법·생략법\t시적 허용(시적 자유)과 도치법·생략법\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 시적 허용(시적 자유)과 도치법·생략법: '모란이 피기까지는'의 '찬란한 슬픔의 봄을'에서 '봄을' 목적격 조사나 김소월 시의 '외로운", "성격 제시 방법(직접 제시 = 말하기 Telling vs 간접 제시 = 보여주기 Showing)\t성격 제시 방법(직접 제시 = 말하기 Telling vs 간접 제시 = 보여주기 Showing)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 성격 제시 방법(직접 제시 = 말하기 Telling vs 간접 제시 = 보여주기 Showing): 직접 제시는 서술자가 인물의 성격·심", "소설의 시점 4유형(1인칭 주인공·1인칭 관찰자·3인칭 관찰자·전지적 작가 시점)\t소설의 시점 4유형(1인칭 주인공·1인칭 관찰자·3인칭 관찰자·전지적 작가 시점)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 소설의 시점 4유형(1인칭 주인공·1인칭 관찰자·3인칭 관찰자·전지적 작가 시점): 주요섭 '사랑손님과 어머니'의 옥희, 현진건 '빈처", "초점화(Focalization)와 자유간접화법·의식의 흐름 기법\t초점화(Focalization)와 자유간접화법·의식의 흐름 기법\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 초점화(Focalization)와 자유간접화법·의식의 흐름 기법: 현진건 '운수 좋은 날'의 김 첨지) 및 인물의 내면 의식과 무의식적", "액자식 구성(Frame Story)과 병렬식(옴니버스·피카레스크)·역순행적 구성\t액자식 구성(Frame Story)과 병렬식(옴니버스·피카레스크)·역순행적 구성\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 액자식 구성(Frame Story)과 병렬식(옴니버스·피카레스크)·역순행적 구성: 바깥 이야기(외화) 속에 핵심이 되는 안 이야기(내화", "고대가요 3대 작품(공무도하가·황조가·구지가)과 해가\t고대가요 3대 작품(공무도하가·황조가·구지가)과 해가\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 고대가요 3대 작품(공무도하가·황조가·구지가)과 해가: 백수광부의 아내가 물에 빠져 죽는 남편을 보며 부른 집단 무가에서 개인 서정시로", "향가(4구체·8구체·10구체)와 10구체 향가의 낙구 감탄사\t향가(4구체·8구체·10구체)와 10구체 향가의 낙구 감탄사\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 향가(4구체·8구체·10구체)와 10구체 향가의 낙구 감탄사: 신라 시대 향찰(한자의 음과 뜻을 빌려 우리말 어순과 조사·어미까지 표기", "월명사의 '제망매가'(10구체 향가)와 죽음의 종교적 승화\t월명사의 '제망매가'(10구체 향가)와 죽음의 종교적 승화\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 월명사의 '제망매가'(10구체 향가)와 죽음의 종교적 승화: 일찍 죽은 누이의 명복을 빌며 지은 향가로 '한 가지에 나고 가는 곳 모르", "충담사의 '찬기파랑가'와 '안민가'(10구체 향가)\t충담사의 '찬기파랑가'와 '안민가'(10구체 향가)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 충담사의 '찬기파랑가'와 '안민가'(10구체 향가): 화랑 기파랑의 고결한 인품을 구름을 헤치고 나타난 달, 맑은 새파란 물가의 조약돌", "고려가요(속요)의 형식적 특징(3음보·분절체·후렴구)과 대표작(청산별곡·가시리·서경별곡·동동·정석가)\t고려가요(속요)의 형식적 특징(3음보·분절체·후렴구)과 대표작(청산별곡·가시리·서경별곡·동동·정석가)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 고려가요(속요)의 형식적 특징(3음보·분절체·후렴구)과 대표작(청산별곡·가시리·서경별곡·동동·정석가): 평민들이 구전으로 부르다 궁중 ", "가시리(고려가요)와 서경별곡(고려가요)의 여성 화자 태도 비교\t가시리(고려가요)와 서경별곡(고려가요)의 여성 화자 태도 비교\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 가시리(고려가요)와 서경별곡(고려가요)의 여성 화자 태도 비교: 두 작품 모두 이별의 상황에 놓인 여성 화자의 목소리이나, '가시리'는", "정석가(고려가요)와 불가능한 상황 설정을 통한 영원한 사랑 다짐\t정석가(고려가요)와 불가능한 상황 설정을 통한 영원한 사랑 다짐\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 정석가(고려가요)와 불가능한 상황 설정을 통한 영원한 사랑 다짐: 구운 밤 닷 되를 심어 싹이 나야, 옥으로 새긴 연꽃이 바위 위에 피", "시조(평시조·연시조·사설시조)의 형식적 불변 규칙\t시조(평시조·연시조·사설시조)의 형식적 불변 규칙\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 시조(평시조·연시조·사설시조)의 형식적 불변 규칙: 3장(초장·중장·종장) 6구 45자 내외, 4음보 율격의 정형시로, 중장이 길어지는", "고려 말·조선 전기 충절가(정몽주 단심가 vs 이방원 하여가, 성삼문·이개·원호의 단종 애사가)\t고려 말·조선 전기 충절가(정몽주 단심가 vs 이방원 하여가, 성삼문·이개·원호의 단종 애사가)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 고려 말·조선 전기 충절가(정몽주 단심가 vs 이방원 하여가, 성삼문·이개·원호의 단종 애사가): 이방원이 만수산 드렁칡처럼 얽혀 백 ", "황진이의 시조('동짓달 기나긴 밤을 한 허리를 버혀 내여')와 우리말의 조형미\t황진이의 시조('동짓달 기나긴 밤을 한 허리를 버혀 내여')와 우리말의 조형미\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 황진이의 시조('동짓달 기나긴 밤을 한 허리를 버혀 내여')와 우리말의 조형미: 추상적인 개념인 '시간(동짓달 기나긴 밤)'을 눈에 보", "윤선도의 '어부사시사'(연시조 40수)와 '오우가'(연시조 6수)\t윤선도의 '어부사시사'(연시조 40수)와 '오우가'(연시조 6수)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 윤선도의 '어부사시사'(연시조 40수)와 '오우가'(연시조 6수): 보길도 자연 속에서 봄·여름·가을·겨울 사계절 각 10수씩 어부의 ", "정철의 양대 가사 '관동별곡'(기행가사)과 '사미인곡·속미인곡'(유배 연군가사)\t정철의 양대 가사 '관동별곡'(기행가사)과 '사미인곡·속미인곡'(유배 연군가사)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 정철의 양대 가사 '관동별곡'(기행가사)과 '사미인곡·속미인곡'(유배 연군가사): 강원도 관찰사로 부임하며 금강산과 관동 팔경 유람 여", "허난설헌의 '규원가'(규방가사·내방가사)와 봉건 사회 여성의 한\t허난설헌의 '규원가'(규방가사·내방가사)와 봉건 사회 여성의 한\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 허난설헌의 '규원가'(규방가사·내방가사)와 봉건 사회 여성의 한: 조선 중기 재능 있는 여성 작가가 집에만 갇혀 지내며 돌아오지 않는 ", "김만중의 '구운몽'(환몽 구조 소설)과 '사씨남정기'(가정·쟁총 소설)\t김만중의 '구운몽'(환몽 구조 소설)과 '사씨남정기'(가정·쟁총 소설)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 김만중의 '구운몽'(환몽 구조 소설)과 '사씨남정기'(가정·쟁총 소설): 성진(불교 승려, 현실)이 육관대사의 꾸지람으로 인간 세상에 ", "박지원의 한문 단편소설 '허생전'과 '호질'·'양반전'의 실학적 풍자\t박지원의 한문 단편소설 '허생전'과 '호질'·'양반전'의 실학적 풍자\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 박지원의 한문 단편소설 '허생전'과 '호질'·'양반전'의 실학적 풍자: 인재 등용·청과의 통상 및 유학생 파견)을 꾸짖고 종적을 감추는", "한중록(혜경궁 홍씨)과 동명일기(의유당 남씨)·계축일기(고전 수필·궁중 문학)\t한중록(혜경궁 홍씨)과 동명일기(의유당 남씨)·계축일기(고전 수필·궁중 문학)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 한중록(혜경궁 홍씨)과 동명일기(의유당 남씨)·계축일기(고전 수필·궁중 문학): 사도세자의 부인인 혜경궁 홍씨가 남편의 비극적인 죽음(", "김소월의 '진달래꽃'과 '산유화'·'초혼'(1920년대 전통 민요조 서정시)\t김소월의 '진달래꽃'과 '산유화'·'초혼'(1920년대 전통 민요조 서정시)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 김소월의 '진달래꽃'과 '산유화'·'초혼'(1920년대 전통 민요조 서정시): 7·5조 3음보의 전통 민요 율격을 바탕으로 이별의 정한", "한용운의 '님의 침묵'과 '알 수 없어요'(불교적 역설과 광복 의지)\t한용운의 '님의 침묵'과 '알 수 없어요'(불교적 역설과 광복 의지)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 한용운의 '님의 침묵'과 '알 수 없어요'(불교적 역설과 광복 의지): '님은 갔습니다(이별의 상황 인식) → 그러나 나는 님을 보내지", "윤동주의 '서시', '자화상', '쉽게 씌어진 시', '참회록'(성찰과 부끄러움의 시학)\t윤동주의 '서시', '자화상', '쉽게 씌어진 시', '참회록'(성찰과 부끄러움의 시학)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 윤동주의 '서시', '자화상', '쉽게 씌어진 시', '참회록'(성찰과 부끄러움의 시학): 일제 말기 암흑의 시대 현실 속에서 안일하게", "이육사의 '광야'와 '절정'·'청포도'(강인한 남성적 어조와 순교자적 저항시)\t이육사의 '광야'와 '절정'·'청포도'(강인한 남성적 어조와 순교자적 저항시)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 이육사의 '광야'와 '절정'·'청포도'(강인한 남성적 어조와 순교자적 저항시): 일제의 극한적 탄압을 '매운 계절의 채찍'(시간적 극한", "정지용의 '향수'와 백석의 '여우난골족'·'남신의주 유동 박시봉방'\t정지용의 '향수'와 백석의 '여우난골족'·'남신의주 유동 박시봉방'\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 정지용의 '향수'와 백석의 '여우난골족'·'남신의주 유동 박시봉방': 고향의 정경을 '넓은 벌 동쪽 끝으로~ 그곳이 차마 꿈엔들 잊히리", "김춘수의 '꽃'(인식론적 존재 탐구 시)\t김춘수의 '꽃'(인식론적 존재 탐구 시)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 김춘수의 '꽃'(인식론적 존재 탐구 시): 내가 그의 이름을 불러 주기 전에는 그는 다만 하나의 몸짓(무의미한 존재)에 지나지 않았으나", "가는 말이 고와야 오는 말이 곱다\t가는 말이 고와야 오는 말이 곱다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 가는 말이 고와야 오는 말이 곱다: 자기가 남에게 말이나 행동을 좋게 해야 남도 자기에게 좋게 대한다는 뜻의 속담(상호 존중)", "가랑비에 옷 젖는 줄 모른다\t가랑비에 옷 젖는 줄 모른다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 가랑비에 옷 젖는 줄 모른다: 아무리 사소하고 적은 것이라도 거듭되면 무시하지 못할 만큼 크게 쌓인다는 뜻(티끌 모아 태산과 유사)", "가재는 게 편이라\t가재는 게 편이라\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 가재는 게 편이라: 모양이나 형편이 서로 비슷하고 인연이 있는 것끼리 서로 감싸고 편을 들어 준다는 속담(초록은 동색)", "갈수록 태산(泰山)\t갈수록 태산(泰山)\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 갈수록 태산(泰山): 일이 갈수록 점점 더 어렵고 힘든 상황을 만나게 됨을 비유하는 속담(설상가상, 산 넘어 산)", "같은 값이면 다홍치마\t같은 값이면 다홍치마\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 같은 값이면 다홍치마: 값이 같거나 같은 조건이라면 기왕이면 보기 좋고 품질이 나은 것을 고른다는 속담(동가홍상 同價紅裳)", "개구리 올챙이 적 생각 못 한다\t개구리 올챙이 적 생각 못 한다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 개구리 올챙이 적 생각 못 한다: 미천하거나 어렵게 지내던 사람이 형편이 좀 나아졌다고 해서 지난날의 힘들었던 처지를 잊고 잘난 체함을 꼬집", "개천에서 용 난다\t개천에서 용 난다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 개천에서 용 난다: 미천한 집안이나 어려운 환경에서 훌륭한 인물이 나왔음을 이르는 속담", "고래 싸움에 새우 등 터진다\t고래 싸움에 새우 등 터진다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 고래 싸움에 새우 등 터진다: 강한 세력들끼리 싸우는 통에 아무 상관없는 약한 자가 중간에 끼어 억울하게 피해를 입음을 비유하는 속담(경전하", "고생 끝에 낙이 온다\t고생 끝에 낙이 온다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 고생 끝에 낙이 온다: 어렵고 힘든 고생을 이겨 내면 반드시 즐겁고 좋은 날이 찾아온다는 속담(고진감래 苦盡甘來)", "고양이 목에 방울 달기\t고양이 목에 방울 달기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 고양이 목에 방울 달기: 실행하기만 하면 매우 좋은 방법이지만 막상 위험을 무릅쓰고 나서서 실행할 사람이 없는 공허한 논의를 비유하는 속담", "공든 탑이 무너지랴\t공든 탑이 무너지랴\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 공든 탑이 무너지랴: 정성과 힘을 다하여 한 일은 헛되지 아니하여 반드시 좋은 결과를 맺는다는 속담", "구슬이 서 말이라도 꿰어야 보배\t구슬이 서 말이라도 꿰어야 보배\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 구슬이 서 말이라도 꿰어야 보배: 아무리 훌륭하고 좋은 재료나 재능을 가지고 있어도 그것을 잘 다듬어 쓸모 있게 만들어야 가치가 있다는 속담", "구더기 무서워 장 못 담글까\t구더기 무서워 장 못 담글까\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 구더기 무서워 장 못 담글까: 어떤 일을 추진할 때 다소 방해되는 것이나 작은 부작용이 두렵다고 해서 마땅히 해야 할 큰일을 그만둘 수는 없", "궁하면 통한다\t궁하면 통한다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 궁하면 통한다: 매우 어렵고 막다른 지경에 이르면 오히려 살길이 트이고 해결책이 생긴다는 속담(궁즉통 窮則通)", "귀에 걸면 귀걸이 코에 걸면 코걸이\t귀에 걸면 귀걸이 코에 걸면 코걸이\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 귀에 걸면 귀걸이 코에 걸면 코걸이: 하나의 사실을 두고 이러저러하게 둘러대어 서로 다르게 해석할 수 있음을 이르는 속담(이현령비현령 耳懸鈴", "그림의 떡\t그림의 떡\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 그림의 떡: 보기는 좋으나 실제로 자기가 차지하거나 이용할 수 없는 대상을 비유하는 속담(화중지병 畵中之餠)", "금강산도 식후경\t금강산도 식후경\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 금강산도 식후경: 아무리 재미있고 좋은 구경이라도 일단 배가 불러야 흥이 난다는 뜻으로 의식주 해결이 우선임을 이르는 속담", "길고 짧은 것은 대어 보아야 안다\t길고 짧은 것은 대어 보아야 안다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 길고 짧은 것은 대어 보아야 안다: 무엇이든지 실제로 겨루어 보거나 끝까지 겪어 보아야 승패나 우열을 알 수 있다는 속담", "까마귀 날자 배 떨어진다\t까마귀 날자 배 떨어진다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 까마귀 날자 배 떨어진다: 아무런 관계없이 우연히 동시에 일어난 일 때문에 억울하게 의심을 받게 됨을 이르는 속담(오비이락 烏飛梨落)", "꿩 먹고 알 먹기\t꿩 먹고 알 먹기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 꿩 먹고 알 먹기: 한 가지 일을 하여 두 가지 이상의 이익을 동시에 얻음을 이르는 속담(일석이조 一石二鳥, 일거양득)", "낮말은 새가 듣고 밤말은 쥐가 듣는다\t낮말은 새가 듣고 밤말은 쥐가 듣는다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 낮말은 새가 듣고 밤말은 쥐가 듣는다: 아무리 아무도 없는 곳에서 한 말이라도 결국 세상에 새어 나가게 마련이므로 늘 말조심을 해야 한다는 ", "내 코가 석 자\t내 코가 석 자\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 내 코가 석 자: 자기 자신의 사정이 너무 급하고 어려워서 남을 돌보거나 도와줄 여유가 전혀 없음을 이르는 속담(오비삼척 吾鼻三尺)", "누워서 침 뱉기\t누워서 침 뱉기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 누워서 침 뱉기: 남을 해치려고 한 말이나 행동이 결국 자기 자신에게 해가 되어 돌아옴을 이르는 속담", "누이 좋고 매부 좋다\t누이 좋고 매부 좋다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 누이 좋고 매부 좋다: 어떤 일로 인해 관련된 양쪽 모두가 서로에게 이익이 되고 좋음을 이르는 속담", "눈 가리고 아웅\t눈 가리고 아웅\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 눈 가리고 아웅: 얕은수로 남을 속이려 하나 이미 다 드러나 보여서 속지 아니함을 이르는 속담", "다 된 밥에 재 뿌리기\t다 된 밥에 재 뿌리기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 다 된 밥에 재 뿌리기: 거의 다 성사되어 가는 일을 마지막 순간에 망쳐 놓음을 비유하는 속담", "달면 삼키고 쓰면 뱉는다\t달면 삼키고 쓰면 뱉는다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 달면 삼키고 쓰면 뱉는다: 신의나 의리는 돌보지 않고 오직 자기에게 유리하면 가까이하고 불리하면 배척하는 이기적인 태도를 비유하는 속담(감탄", "닭 쫓던 개 지붕 쳐다보듯\t닭 쫓던 개 지붕 쳐다보듯\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 닭 쫓던 개 지붕 쳐다보듯: 애써 하던 일이 실패로 돌아가거나 남에게 가로채여 어찌할 도리가 없이 막연해하는 모양을 비유하는 속담", "도둑이 제 발 저리다\t도둑이 제 발 저리다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 도둑이 제 발 저리다: 나쁜 일을 저지른 사람이 죄책감과 불안감 때문에 스스로 두려워하여 어쩔 줄 몰라 함을 이르는 속담", "돌다리도 두들겨 보고 건너라\t돌다리도 두들겨 보고 건너라\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 돌다리도 두들겨 보고 건너라: 잘 아는 일이나 안전해 보이는 일이라도 세심하게 주의를 기울여 확인한 뒤에 처리하라는 속담", "되로 주고 말로 받는다\t되로 주고 말로 받는다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 되로 주고 말로 받는다: 남에게 조금 해를 입히거나 베풀었다가 그보다 몇 갑절이나 더 큰 화나 보답을 받게 됨을 이르는 속담", "등잔 밑이 어둡다\t등잔 밑이 어둡다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 등잔 밑이 어둡다: 가까이에서 일어난 일을 오히려 먼 곳의 일보다 더 잘 모름을 비유하는 속담(등하불명 燈下不明)", "땅 짚고 헤엄치기\t땅 짚고 헤엄치기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 땅 짚고 헤엄치기: 물이 얕아 손으로 땅을 짚으며 헤엄친다는 뜻으로 매우 쉽고 실패할 염려가 전혀 없는 일을 비유하는 속담(식은 죽 먹기, ", "뛰는 놈 위에 나는 놈 있다\t뛰는 놈 위에 나는 놈 있다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 뛰는 놈 위에 나는 놈 있다: 아무리 재주가 뛰어난 사람이라도 그보다 더 뛰어난 사람이 있으니 자만하지 말라는 속담", "마른하늘에 날벼락\t마른하늘에 날벼락\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 마른하늘에 날벼락: 맑은 날 갑자기 벼락이 떨어진다는 뜻으로 전혀 예상하지 못한 뜻밖의 큰 재난이나 변고를 당함을 이르는 속담(청천벽력 青天", "말 한마디에 천 냥 빚도 갚는다\t말 한마디에 천 냥 빚도 갚는다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 말 한마디에 천 냥 빚도 갚는다: 말만 조리 있고 지혜롭게 잘하면 아무리 어렵고 큰 문제라도 해결할 수 있음을 이르는 속담", "모로 가도 서울만 가면 된다\t모로 가도 서울만 가면 된다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 모로 가도 서울만 가면 된다: 수단이나 과정이 어떻든 간에 목적한 결과만 이루면 된다는 뜻의 속담", "목마른 사람이 우물 판다\t목마른 사람이 우물 판다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 목마른 사람이 우물 판다: 가장 급하고 절실하게 필요한 사람이 스스로 나서서 그 일을 서둘러 도모하게 된다는 속담(갈이천정 渴而穿井)", "미운 아이 떡 하나 더 준다\t미운 아이 떡 하나 더 준다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 미운 아이 떡 하나 더 준다: 미운 감정이 있는 사람일수록 겉으로는 오히려 더 잘 대접하여 감정을 다스리고 원망을 사지 않는다는 속담", "밑 빠진 독에 물 붓기\t밑 빠진 독에 물 붓기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 밑 빠진 독에 물 붓기: 아무리 힘과 재물을 들여 애를 써도 보람도 없이 계속 헛되이 사라지기만 하는 일을 비유하는 속담", "바늘 도둑이 소도둑 된다\t바늘 도둑이 소도둑 된다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 바늘 도둑이 소도둑 된다: 작은 나쁜 버릇이나 잘못도 제때 고치지 않고 되풀이하면 나중에는 큰 죄를 저지르게 된다는 속담", "발 없는 말이 천 리 간다\t발 없는 말이 천 리 간다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 발 없는 말이 천 리 간다: 말이나 소문은 순식간에 먼 곳까지 널리 퍼지므로 말을 삼가야 한다는 속담", "배보다 배꼽이 더 크다\t배보다 배꼽이 더 크다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 배보다 배꼽이 더 크다: 주된 것보다 부수적인 것(덤이나 부대비용)이 오히려 더 많거나 큼을 이르는 속담(본말전도)", "백지장도 맞들면 낫다\t백지장도 맞들면 낫다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 백지장도 맞들면 낫다: 아무리 가볍고 쉬운 일이라도 혼자 하는 것보다 여럿이 힘을 합쳐 협력하면 훨씬 쉽게 해낼 수 있다는 속담", "번갯불에 콩 볶아 먹겠다\t번갯불에 콩 볶아 먹겠다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 번갯불에 콩 볶아 먹겠다: 행동이 매우 재빠르거나 성미가 몹시 급하여 일을 순식간에 해치우려 함을 비유하는 속담", "뱁새가 황새를 따라가면 다리가 찢어진다\t뱁새가 황새를 따라가면 다리가 찢어진다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 뱁새가 황새를 따라가면 다리가 찢어진다: 자기의 분수나 능력에 맞지 않는 일을 억지로 남을 따라 하려다가는 큰 해를 입게 된다는 속담", "벼는 익을수록 고개를 숙인다\t벼는 익을수록 고개를 숙인다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 벼는 익을수록 고개를 숙인다: 교양이 있고 수양을 쌓아 덕이 높은 사람일수록 교만하지 않고 겸손함을 비유하는 속담", "병 주고 약 준다\t병 주고 약 준다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 병 주고 약 준다: 남을 해치거나 곤란하게 만들어 놓고는 뒤돌아서서 도와주는 체하며 어루만진다는 속담", "보기 좋은 떡이 먹기도 좋다\t보기 좋은 떡이 먹기도 좋다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 보기 좋은 떡이 먹기도 좋다: 내용이 훌륭한 것이 겉모양도 아름답고 잘 꾸며져 있으면 더욱 가치가 있고 좋다는 속담", "빛 좋은 개살구\t빛 좋은 개살구\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 빛 좋은 개살구: 겉모양은 그럴듯하고 화려해 보이나 실속이 전혀 없음을 비유하는 속담(외화내빈 外華內貧)", "사공이 많으면 배가 산으로 간다\t사공이 많으면 배가 산으로 간다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 사공이 많으면 배가 산으로 간다: 주관하는 사람 없이 여러 사람이 자기 주장만 내세우면 일이 엉뚱한 방향으로 흘러 성사되기 어렵다는 속담", "사촌이 땅을 사면 배가 아프다\t사촌이 땅을 사면 배가 아프다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 사촌이 땅을 사면 배가 아프다: 가까운 사람이 잘되는 것을 기뻐해 주지 않고 오히려 시샘하고 질투함을 이르는 속담", "산 입에 거미줄 치랴\t산 입에 거미줄 치랴\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 산 입에 거미줄 치랴: 아무리 가난하고 어려워도 살아 있는 사람은 어떻게든 먹고살 길이 생긴다는 속담", "서당 개 삼 년이면 풍월을 읊는다\t서당 개 삼 년이면 풍월을 읊는다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 서당 개 삼 년이면 풍월을 읊는다: 아무리 무식한 사람이라도 유식한 사람들과 오래 함께 지내다 보면 자연히 견문이 넓어지고 지식을 얻게 된다", "세 살 적 버릇이 여든까지 간다\t세 살 적 버릇이 여든까지 간다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 세 살 적 버릇이 여든까지 간다: 어릴 때 몸에 밴 버릇은 나이가 들어 늙어서도 고치기 어렵다는 속담", "소 잃고 외양간 고친다\t소 잃고 외양간 고친다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 소 잃고 외양간 고친다: 이미 일을 그르치거나 실패한 뒤에야 뒤늦게 뉘우치고 대책을 세우려 하나 소용없음을 비유하는 속담(망양보뢰 亡羊補牢)", "쇠뿔도 단김에 빼라\t쇠뿔도 단김에 빼라\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 쇠뿔도 단김에 빼라: 어떤 일을 하기로 마음먹었으면 망설이지 말고 열의가 있을 때 곧바로 추진하여 끝내라는 속담", "수박 겉 핥기\t수박 겉 핥기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 수박 겉 핥기: 사물의 속내용이나 본질은 알지 못하고 겉만 건성으로 슬쩍 건드리고 지나감을 비유하는 속담(주마간산 走馬看山)", "시작이 반이다\t시작이 반이다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 시작이 반이다: 무슨 일이든지 처음에 시작하기가 어렵지 일단 시작하고 나면 끝마치기는 한결 수월하다는 속담", "십 년이면 강산도 변한다\t십 년이면 강산도 변한다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 십 년이면 강산도 변한다: 세월이 흐르면 세상의 모든 사물과 인심도 바뀌게 마련이라는 속담(상전벽해 桑田碧海)", "싼 것이 비지떡\t싼 것이 비지떡\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 싼 것이 비지떡: 값이 싼 물건은 품질도 그만큼 떨어지게 마련이라는 속담", "아니 땐 굴뚝에 연기 나랴\t아니 땐 굴뚝에 연기 나랴\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 아니 땐 굴뚝에 연기 나랴: 원인이 없이는 결과가 나타나지 않으며 소문이 날 때는 그만한 까닭이 있다는 속담", "아닌 밤중에 홍두깨\t아닌 밤중에 홍두깨\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 아닌 밤중에 홍두깨: 전혀 예상하지 못했던 일이나 말을 불쑥 꺼내어 당황스럽게 함을 비유하는 속담", "아랫돌 빼서 윗돌 괴기\t아랫돌 빼서 윗돌 괴기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 아랫돌 빼서 윗돌 괴기: 임시방편으로 이리저리 돌려막으며 당장의 급한 위기만 겨우 모면함을 이르는 속담(미봉책 彌縫策)", "약방에 감초\t약방에 감초\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 약방에 감초: 무슨 일에나 빠지지 않고 끼어드는 사람이나 반드시 있어야 하는 물건을 비유하는 속담", "어물전 망신은 꼴뚜기가 시킨다\t어물전 망신은 꼴뚜기가 시킨다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 어물전 망신은 꼴뚜기가 시킨다: 못난 사람이나 하찮은 존재가 동료나 집단 전체의 체면과 명예를 깎아내림을 이르는 속담", "언 발에 오줌 누기\t언 발에 오줌 누기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 언 발에 오줌 누기: 당장은 잠시 효과가 있는 듯하나 금방 효력이 사라지고 오히려 사태가 더 나빠지는 어리석은 임시방편을 이르는 속담", "열 길 물속은 알아도 한 길 사람 속은 모른다\t열 길 물속은 알아도 한 길 사람 속은 모른다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 열 길 물속은 알아도 한 길 사람 속은 모른다: 자연의 깊이는 헤아릴 수 있어도 사람의 마음속은 헤아리기가 매우 어렵다는 속담", "열 번 찍어 안 넘어가는 나무 없다\t열 번 찍어 안 넘어가는 나무 없다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 열 번 찍어 안 넘어가는 나무 없다: 아무리 뜻이 굳은 사람이나 어려운 일이라도 끊임없이 정성을 들여 노력하면 결국에는 이루게 된다는 속담", "오르지 못할 나무는 쳐다보지도 마라\t오르지 못할 나무는 쳐다보지도 마라\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 오르지 못할 나무는 쳐다보지도 마라: 자기의 능력 밖이거나 가망이 전혀 없는 일에는 애초에 욕심을 내지 말라는 속담", "옥에도 티가 있다\t옥에도 티가 있다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 옥에도 티가 있다: 아무리 훌륭하고 완벽해 보이는 사람이나 물건이라도 작은 흠이나 결점은 있을 수 있다는 속담", "우물 안 개구리\t우물 안 개구리\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 우물 안 개구리: 넓은 세상의 형편은 알지 못하고 자기 주변의 좁은 소견만 옳다고 여기는 사람을 비유하는 속담(정저지와 井底之蛙)", "우물을 파도 한 우물을 파라\t우물을 파도 한 우물을 파라\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 우물을 파도 한 우물을 파라: 이 일 저 일 벌이지 말고 한 가지 일에만 끝까지 전념해야 성공할 수 있다는 속담", "원숭이도 나무에서 떨어진다\t원숭이도 나무에서 떨어진다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 원숭이도 나무에서 떨어진다: 아무리 그 분야에 능숙하고 재주가 뛰어난 사람이라도 때로는 실수를 할 때가 있다는 속담(홍법도 붓을 가리지 않는", "윗물이 맑아야 아랫물이 맑다\t윗물이 맑아야 아랫물이 맑다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 윗물이 맑아야 아랫물이 맑다: 윗사람이나 지도층이 바르고 모범을 보여야 아랫사람도 자연히 바르게 행한다는 속담(상탁하부정 上濁下不淨)", "자라 보고 놀란 가슴 솥뚜껑 보고 놀란다\t자라 보고 놀란 가슴 솥뚜껑 보고 놀란다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 자라 보고 놀란 가슴 솥뚜껑 보고 놀란다: 한번 어떤 일에 크게 놀라거나 데인 사람이 그와 비슷한 것만 보아도 겁을 먹고 두려워함을 이르는 ", "작은 고추가 더 맵다\t작은 고추가 더 맵다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 작은 고추가 더 맵다: 몸집이 작고 보잘것없어 보이는 사람이 큰 사람보다 오히려 더 야무지고 재주가 뛰어남을 비유하는 속담", "종로에서 뺨 맞고 한강에서 눈 흘긴다\t종로에서 뺨 맞고 한강에서 눈 흘긴다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 종로에서 뺨 맞고 한강에서 눈 흘긴다: 욕을 당한 자리에서는 아무 말도 못 하다가 나중에 엉뚱한 곳에 가서 화풀이를 함을 이르는 속담", "쥐구멍에도 볕 들 날 있다\t쥐구멍에도 볕 들 날 있다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 쥐구멍에도 볕 들 날 있다: 아무리 어렵고 고생스러운 처지에 있는 사람이라도 언젠가는 좋은 운을 만나 살판날 때가 있다는 속담", "지렁이도 밟으면 꿈틀한다\t지렁이도 밟으면 꿈틀한다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 지렁이도 밟으면 꿈틀한다: 아무리 순하고 미약한 사람이라도 너무 업신여기고 괴롭히면 가만히 있지 않고 저항한다는 속담", "천 리 길도 한 걸음부터\t천 리 길도 한 걸음부터\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 천 리 길도 한 걸음부터: 아무리 크고 원대한 일이라도 가장 작은 첫걸음부터 차근차근 시작해야 이루어진다는 속담(등고자비 登高自卑)", "칼로 물 베기\t칼로 물 베기\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 칼로 물 베기: 부부나 가까운 사이의 다툼은 싸우고 나서도 금방 화해하여 흔적이 남지 않음을 비유하는 속담", "콩 심은 데 콩 나고 팥 심은 데 팥 난다\t콩 심은 데 콩 나고 팥 심은 데 팥 난다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 콩 심은 데 콩 나고 팥 심은 데 팥 난다: 모든 일은 그 근본과 원인에 따라 그에 합당한 결과가 나타난다는 속담(종두득두 種豆得豆)", "티끌 모아 태산\t티끌 모아 태산\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 티끌 모아 태산: 아무리 작은 것이라도 꾸준히 모으면 나중에는 매우 큰 덩어리가 된다는 속담(적토성산 積土成山)", "핑계 없는 무덤 없다\t핑계 없는 무덤 없다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 핑계 없는 무덤 없다: 무슨 잘못이나 실패를 저질렀을 때 나름대로 둘러댈 구실이나 변명거리는 다 있다는 속담", "하늘이 무너져도 솟아날 구멍이 있다\t하늘이 무너져도 솟아날 구멍이 있다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 하늘이 무너져도 솟아날 구멍이 있다: 아무리 절망적이고 큰 위기에 처하더라도 살아남을 길이나 해결책은 반드시 있다는 속담", "하룻강아지 범 무서운 줄 모른다\t하룻강아지 범 무서운 줄 모른다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 하룻강아지 범 무서운 줄 모른다: 철모르고 세상 물정을 모르는 약한 자가 무서운 상대를 모르고 함부로 덤빔을 이르는 속담", "호랑이도 제 말 하면 온다\t호랑이도 제 말 하면 온다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 호랑이도 제 말 하면 온다: 자리에 없는 사람에 대하여 이야기하고 있을 때 마침 그 사람이 나타났을 때 이르는 속담", "호미로 막을 것을 가래로 막는다\t호미로 막을 것을 가래로 막는다\t\t[한국어 필수 속담·관용구·순우리말 어휘 백과] 호미로 막을 것을 가래로 막는다: 초기에 작은 힘으로 쉽게 처리할 수 있었던 일을 방치했다가 나중에 큰 힘을 들이고서야 겨우 막게 됨을 이르", "시나브로\t시나브로\t\t[고유어 어휘·관용구·현대문학 작품 심화] 시나브로: 모르는 사이에 조금씩 조금씩이라는 뜻의 순우리말 부사(김소월·박목월 시 등에 애용)", "안다미로\t안다미로\t\t[고유어 어휘·관용구·현대문학 작품 심화] 안다미로: 담은 것이 그릇에 넘치도록 많이, 또는 남이 알아주지 않아도 마음을 쏟아 보살피는 모양을 뜻하는 순우리말", "아스라이\t아스라이\t\t[고유어 어휘·관용구·현대문학 작품 심화] 아스라이: 보기에 아득히 높거나 멀어서 아찔하게, 또는 기억이나 소리가 희미하고 아득하게라는 뜻의 순우리말", "미리내\t미리내\t\t[고유어 어휘·관용구·현대문학 작품 심화] 미리내: 은하수(銀河水)를 뜻하는 아름다운 순우리말 명사", "꽃샘추위와 가랑비·이슬비·여우비·소나기·장대비\t꽃샘추위와 가랑비·이슬비·여우비·소나기·장대비\t\t[고유어 어휘·관용구·현대문학 작품 심화] 꽃샘추위와 가랑비·이슬비·여우비·소나기·장대비: 봄철 꽃이 필 무렵의 추위(꽃샘추위), 조금씩 내리는 가랑비보다 더 가는 이슬비, 볕이 나 있는 ", "가람과 뫼·아라·하늬바람·높새바람·마파람·된바람\t가람과 뫼·아라·하늬바람·높새바람·마파람·된바람\t\t[고유어 어휘·관용구·현대문학 작품 심화] 가람과 뫼·아라·하늬바람·높새바람·마파람·된바람: 영서 지방 푄 현상 고온 건조풍), 남풍(마파람), 북풍(된바람)을 뜻하는 순우리말", "윤슬과 여울·기슭·고샅·모퉁이\t윤슬과 여울·기슭·고샅·모퉁이\t\t[고유어 어휘·관용구·현대문학 작품 심화] 윤슬과 여울·기슭·고샅·모퉁이: 햇빛이나 달빛에 비치어 반짝이는 잔물결(윤슬), 강이나 바다의 바닥이 얕거나 폭이 좁아 물살이 세차게 흐르는 곳(", "가멸다(가멸차다)와 옹골차다·야무지다·해사하다\t가멸다(가멸차다)와 옹골차다·야무지다·해사하다\t\t[고유어 어휘·관용구·현대문학 작품 심화] 가멸다(가멸차다)와 옹골차다·야무지다·해사하다: 재산이 많고 부유하다(가멸다), 속이 꽉 차서 실속이 있다(옹골차다), 얼굴이 백옥같이 희고 곱다", "갈무리와 마중·배웅·바래다주다\t갈무리와 마중·배웅·바래다주다\t\t[고유어 어휘·관용구·현대문학 작품 심화] 갈무리와 마중·배웅·바래다주다: 물건을 잘 정돈하여 간수하거나 일을 끝맺음(갈무리), 오는 사람을 나가 맞이함(마중) ↔ 가는 사람을 보냄(배웅)", "[한글 맞춤법·표준어 혼동 어휘 해설] 되다 / 돼다 구분\t어간 '되-' 뒤에 어미 '-어'가 결합해 줄어든 말은 '돼(되어)'이고, 어간 뒤 자음 어미(-고, -지, -니) 앞에는 '되-'로 표기 ('되어'로 바꾸어 말이 되면 '돼', 종결어미는 무조건 '돼요')\t\t[한글 맞춤법·표준어 혼동 어휘] 되다 / 돼다 구분: 어간 '되-' 뒤에 어미 '-어'가 결합해 줄어든 말은 '돼(되어)'이고, 어간 뒤 자음 어미(-고, -지, -니) 앞에는 '되-'로", "[한글 맞춤법·표준어 혼동 어휘 해설] 안 / 않 구분\t안 먹다, 안 가다)이고, '않-'은 보조용언 '아니하-'의 준말로 '-지 않다' 구성(먹지 않다, 가지 않다)에만 쓰임\t\t[한글 맞춤법·표준어 혼동 어휘] 안 / 않 구분: 안 먹다, 안 가다)이고, '않-'은 보조용언 '아니하-'의 준말로 '-지 않다' 구성(먹지 않다, 가지 않다)에만 쓰임", "[한글 맞춤법·표준어 혼동 어휘 해설] 로써 / 로서 구분\t'-(으)로써'는 수단·도구·방법·재료·시간 셈 기준(대화로써 풀다, 눈물로써 호소하다)에 쓰고, '-(으)로서'는 지위·신분·자격(교사로서, 대표로서)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 로써 / 로서 구분: '-(으)로써'는 수단·도구·방법·재료·시간 셈 기준(대화로써 풀다, 눈물로써 호소하다)에 쓰고, '-(으)로서'는 지위·신분·자격(", "[한글 맞춤법·표준어 혼동 어휘 해설] 던지 / 든지 구분\t'-던지'는 과거의 일이나 회상·의문(얼마나 춥던지, 어찌나 많이 먹던지)에 쓰고, '-든지'는 나열된 사실 중 어느 것이든 선택됨(사과든지 배든지, 가든지 말든지)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 던지 / 든지 구분: '-던지'는 과거의 일이나 회상·의문(얼마나 춥던지, 어찌나 많이 먹던지)에 쓰고, '-든지'는 나열된 사실 중 어느 것이든 선택됨(", "[한글 맞춤법·표준어 혼동 어휘 해설] 데 / 대 구분\t그 영화 재미있대) 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 데 / 대 구분: 그 영화 재미있대) 씀", "[한글 맞춤법·표준어 혼동 어휘 해설] 율 / 률, 열 / 렬, 양 / 량 표기 규칙\t모음이나 'ㄴ' 받침 뒤에서는 '율, 열, 양'(비율, 백분율, 진열, 선열, 분량, 개량)으로 적고, 그 외의 받침 뒤에서는 본음대로 '률, 렬, 량'(확률, 합격률, 행렬, 일련번호, 수량)으로 적음\t\t[한글 맞춤법·표준어 혼동 어휘] 율 / 률, 열 / 렬, 양 / 량 표기 규칙: 모음이나 'ㄴ' 받침 뒤에서는 '율, 열, 양'(비율, 백분율, 진열, 선열, 분량, 개량)으로 적고, 그", "[한글 맞춤법·표준어 혼동 어휘 해설] 사이시옷 표기 6개 한자어 예외\t두 글자 한자어 합성어에는 원칙적으로 사이시옷을 적지 않으나 '곳간(庫間), 셋방(貰房), 숫자(數字), 찻간(車間), 툇간(退間), 횟수(回數)' 6개만 예외로 사이시옷을 적음 (초점, 대가, 개수, 세금, 전세방은 사이시옷 안 적음)\t\t[한글 맞춤법·표준어 혼동 어휘] 사이시옷 표기 6개 한자어 예외: 두 글자 한자어 합성어에는 원칙적으로 사이시옷을 적지 않으나 '곳간(庫間), 셋방(貰房), 숫자(數字), 찻간(車間), ", "[한글 맞춤법·표준어 혼동 어휘 해설] 사이시옷 표기 고유어·혼종어 원칙\t고유어 합성어나 고유어+한자어 합성어에서 앞말이 모음으로 끝나고 뒷말 첫소리가 된소리로 나거나 'ㄴ' 소리가 덧나면 사이시옷을 적음 (나뭇잎, 바닷가, 햇빛, 콧날, 아랫니, 베갯잇, 제삿날, 훗날)\t\t[한글 맞춤법·표준어 혼동 어휘] 사이시옷 표기 고유어·혼종어 원칙: 고유어 합성어나 고유어+한자어 합성어에서 앞말이 모음으로 끝나고 뒷말 첫소리가 된소리로 나거나 'ㄴ' 소리가 덧나면 사", "[한글 맞춤법·표준어 혼동 어휘 해설] 두음 법칙(頭音法則) 표기 원칙\t한자음 '녀, 뇨, 뉴, 니'와 '랴, 려, 례, 료, 류, 리'가 단어 첫머리에 올 때 '여, 요, 유, 이'와 '야, 여, 예, 요, 유, 이'로 적고, '라, 래, 로, 뢰, 루, 르'는 '나, 내, 노, 뇌, 누, 느'로 적음 (여자↔남녀, 양심↔불량, 역사↔이력, 낙원↔쾌락)\t\t[한글 맞춤법·표준어 혼동 어휘] 두음 법칙(頭音法則) 표기 원칙: 한자음 '녀, 뇨, 뉴, 니'와 '랴, 려, 례, 료, 류, 리'가 단어 첫머리에 올 때 '여, 요, 유, 이'와 '야,", "[한글 맞춤법·표준어 혼동 어휘 해설] 맞히다 / 맞추다 구분\t'맞히다'는 문제의 정답을 골라내거나 화살·총알을 표적에 닿게 하다(정답을 맞히다, 과녁을 맞히다, 눈비를 맞히다)에 쓰고, '맞추다'는 둘 이상의 대상을 나란히 대어 비교하거나 기준에 어긋나지 않게 조절하다(답을 정답지와 맞춰 보다, 입을 맞추다, 부품을 맞추다)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 맞히다 / 맞추다 구분: '맞히다'는 문제의 정답을 골라내거나 화살·총알을 표적에 닿게 하다(정답을 맞히다, 과녁을 맞히다, 눈비를 맞히다)에 쓰고, '맞", "[한글 맞춤법·표준어 혼동 어휘 해설] 가르치다 / 가리키다 구분\t'가르치다'는 지식이나 기능을 알게 하거나 교육하다(수학을 가르치다)에 쓰고, '가리키다'는 손가락이나 방향 등으로 어떤 대상을 집어 보이거나 일컫다(북쪽을 가리키다)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 가르치다 / 가리키다 구분: '가르치다'는 지식이나 기능을 알게 하거나 교육하다(수학을 가르치다)에 쓰고, '가리키다'는 손가락이나 방향 등으로 어떤 대상", "[한글 맞춤법·표준어 혼동 어휘 해설] 다르다 / 틀리다 구분\t같다)에 쓰고, '틀리다'는 셈이나 사실이 그릇되거나 어긋나다(계산이 틀리다, 반대말: 맞다)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 다르다 / 틀리다 구분: 같다)에 쓰고, '틀리다'는 셈이나 사실이 그릇되거나 어긋나다(계산이 틀리다, 반대말: 맞다)에 씀", "[한글 맞춤법·표준어 혼동 어휘 해설] 낫다 / 낳다 / 낮다 구분\t'낫다'(ㅅ불규칙)는 병이 치유되거나(감기가 나았다) 보다 더 좋다(이게 더 낫다)에 쓰고, '낳다'는 아기를 출산하거나 결과를 가져오다(아이를 낳다, 결과를 낳다), '낮다'는 높이가 아래쪽이다(산이 낮다)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 낫다 / 낳다 / 낮다 구분: '낫다'(ㅅ불규칙)는 병이 치유되거나(감기가 나았다) 보다 더 좋다(이게 더 낫다)에 쓰고, '낳다'는 아기를 출산하거나 결", "[한글 맞춤법·표준어 혼동 어휘 해설] 부치다 / 붙이다 구분\t'붙이다'는 떨어지지 않게 접착하거나 조건·이름·불을 옮기다(우표를 붙이다, 별명을 붙이다, 조건을 붙이다)에 쓰고, '부치다'는 편지·소포를 보내거나 힘이 모자라거나 빈대떡을 굽거나 안건을 회의에 넘기다(편지를 부치다, 힘에 부치다, 전을 부치다, 표결에 부치다)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 부치다 / 붙이다 구분: '붙이다'는 떨어지지 않게 접착하거나 조건·이름·불을 옮기다(우표를 붙이다, 별명을 붙이다, 조건을 붙이다)에 쓰고, '부치다'는", "[한글 맞춤법·표준어 혼동 어휘 해설] 거치다 / 걷히다 구분\t'거치다'는 도중에 어디를 들르거나 통과하다(대전을 거쳐 가다, 심의를 거치다)에 쓰고, '걷히다'는 안개·구름·어둠이 사라지거나 세금·회비가 모이다(안개가 걷히다, 성금이 잘 걷히다)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 거치다 / 걷히다 구분: '거치다'는 도중에 어디를 들르거나 통과하다(대전을 거쳐 가다, 심의를 거치다)에 쓰고, '걷히다'는 안개·구름·어둠이 사라지거나", "[한글 맞춤법·표준어 혼동 어휘 해설] 바치다 / 받치다 / 받히다 / 밭치다 구분\t'바치다'(신께 제물·세금·목숨을 드리다), '받치다'(우산을 받치다, 책받침을 밑에 대다, 옷을 받쳐 입다), '받히다'(소뿔에 받히다 — 피동), '밭치다'(체로 국수를 밭치다 — 액체를 걸러 내다)\t\t[한글 맞춤법·표준어 혼동 어휘] 바치다 / 받치다 / 받히다 / 밭치다 구분: '바치다'(신께 제물·세금·목숨을 드리다), '받치다'(우산을 받치다, 책받침을 밑에 대다, 옷을 받쳐 입다", "[한글 맞춤법·표준어 혼동 어휘 해설] 반드시 / 반듯이 구분\t'반드시'는 틀림없이 꼭(약속을 반드시 지키다)의 뜻이고, '반듯이'는 모양이나 자세가 기울거나 굽지 않고 바르게(고개를 반듯이 들다, 기와를 반듯이 놓다)의 뜻임\t\t[한글 맞춤법·표준어 혼동 어휘] 반드시 / 반듯이 구분: '반드시'는 틀림없이 꼭(약속을 반드시 지키다)의 뜻이고, '반듯이'는 모양이나 자세가 기울거나 굽지 않고 바르게(고개를 반듯이 ", "[한글 맞춤법·표준어 혼동 어휘 해설] 일절 / 일체 구분\t'일절(一切)'은 사물을 부인하거나 금지할 때 '아주, 전혀, 절대로'(출입을 일절 금한다, 변명은 일절 하지 마라)의 부사로 쓰고, '일체'는 '모든 것, 전부'(안주 일체 무료, 비용 일체 부담)의 명사·부사로 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 일절 / 일체 구분: '일절(一切)'은 사물을 부인하거나 금지할 때 '아주, 전혀, 절대로'(출입을 일절 금한다, 변명은 일절 하지 마라)의 부사로 쓰고,", "[한글 맞춤법·표준어 혼동 어휘 해설] 체 / 채 구분\t의존명사 '체'는 거짓으로 꾸미는 모양이나 태도(모르는 체하다, 잘난 체하다 = 척)에 쓰고, '채'는 이미 있는 상태 그대로 유지함(옷을 입은 채로 잠들다, 껍질째 통째와 유사)에 씀\t\t[한글 맞춤법·표준어 혼동 어휘] 체 / 채 구분: 의존명사 '체'는 거짓으로 꾸미는 모양이나 태도(모르는 체하다, 잘난 체하다 = 척)에 쓰고, '채'는 이미 있는 상태 그대로 유지함(옷", "[한글 맞춤법·표준어 혼동 어휘 해설] 너머 / 넘어 구분\t명사 '너머'는 산·고개·담·창문 등 높은 경계의 저쪽 공간(산 너머 남촌, 창문 너머로 보이다)을 뜻하고, '넘어'는 동사 '넘다'의 활용형으로 동작(산을 넘어 가다, 고비를 넘어 서다)을 나타냄\t\t[한글 맞춤법·표준어 혼동 어휘] 너머 / 넘어 구분: 명사 '너머'는 산·고개·담·창문 등 높은 경계의 저쪽 공간(산 너머 남촌, 창문 너머로 보이다)을 뜻하고, '넘어'는 동사 '넘다'", "[한글 맞춤법·표준어 혼동 어휘 해설] 조차 / 마저 / 까지 조사 구분\t너조차 나를 못 믿니), '마저'(남아 있던 마지막 하나까지 모두: 마지막 희망마저 사라졌다), '까지'(어떤 범위의 끝이나 추가: 밤늦게까지 공부했다)\t\t[한글 맞춤법·표준어 혼동 어휘] 조차 / 마저 / 까지 조사 구분: 너조차 나를 못 믿니), '마저'(남아 있던 마지막 하나까지 모두: 마지막 희망마저 사라졌다), '까지'(어떤 범위의 ", "[한글 맞춤법·표준어 혼동 어휘 해설] 왠지 / 웬일 표기 구분\t'왠지'는 '왜인지'가 줄어든 말로 이유를 모르게(오늘따라 왠지 기분이 좋다)에만 '왜(왠)'로 적고, 그 외의 관형사 '어찌 된, 어떠한'의 뜻은 모두 '웬'(웬일, 웬만하면, 웬 떡이냐, 웬 사람)으로 적음\t\t[한글 맞춤법·표준어 혼동 어휘] 왠지 / 웬일 표기 구분: '왠지'는 '왜인지'가 줄어든 말로 이유를 모르게(오늘따라 왠지 기분이 좋다)에만 '왜(왠)'로 적고, 그 외의 관형사 '어찌 ", "[한글 맞춤법·표준어 혼동 어휘 해설] 금세 / 금시초문 구분\t'금세'는 '금시(今時)에'가 줄어든 부사로 '지금 바로, 곧장'(금세 날이 어두워졌다 — '금새'는 비표준어)이고, '금시초문(今時初聞)'은 이제야 비로소 처음 듣는다는 뜻임\t\t[한글 맞춤법·표준어 혼동 어휘] 금세 / 금시초문 구분: '금세'는 '금시(今時)에'가 줄어든 부사로 '지금 바로, 곧장'(금세 날이 어두워졌다 — '금새'는 비표준어)이고, '금시초문(", "[한글 맞춤법·표준어 혼동 어휘 해설] 며칠 / 몇 일 표기 규칙\t'몇 월 며칠'이든 '며칠 동안'이든 어원이 분명하지 아니하여 본모양에서 멀어졌으므로 언제나 소리 나는 대로 '며칠'로만 적음 ('몇 일'은 항상 틀린 표기)\t\t[한글 맞춤법·표준어 혼동 어휘] 며칠 / 몇 일 표기 규칙: '몇 월 며칠'이든 '며칠 동안'이든 어원이 분명하지 아니하여 본모양에서 멀어졌으므로 언제나 소리 나는 대로 '며칠'로만 적음", "[한글 맞춤법·표준어 혼동 어휘 해설] 설거지 / 설겆이, 값어치 / 값어치 표기\t소리 나는 대로 적는 표준어 규정에 따라 '설거지'(설겆이 X), '푸성귀', '개구쟁이'(멋쟁이, 욕심쟁이 — 단, 기술자는 미장이·대장장이), '오뚝이'(오뚜기 X), '일찍이'(일찌기 X), '더욱이'(더우기 X)가 올바른 표기\t\t[한글 맞춤법·표준어 혼동 어휘] 설거지 / 설겆이, 값어치 / 값어치 표기: 소리 나는 대로 적는 표준어 규정에 따라 '설거지'(설겆이 X), '푸성귀', '개구쟁이'(멋쟁이, 욕심쟁이 ", "[한글 맞춤법·표준어 혼동 어휘 해설] 이따가 / 있다가 구분\t부사 '이따가'는 '조금 지난 뒤에'(이따가 저녁에 만나자)라는 시간의 뜻이고, '있다가'는 동사 '있다'의 활용형으로 어떤 장소에 머무르다가(도서관에 좀 있다가 갈게)의 뜻임\t\t[한글 맞춤법·표준어 혼동 어휘] 이따가 / 있다가 구분: 부사 '이따가'는 '조금 지난 뒤에'(이따가 저녁에 만나자)라는 시간의 뜻이고, '있다가'는 동사 '있다'의 활용형으로 어떤 장소", "[한글 맞춤법·표준어 혼동 어휘 해설] 껍질 / 껍데기, 살찌다 / 살피다 구분\t'껍질'은 사과·양파·나무·귤처럼 무른 물질의 겉을 싸고 있는 단단하지 않은 외피이고, '껍데기'는 달걀·조개·호두·소라처럼 딱딱한 외피를 뜻함\t\t[한글 맞춤법·표준어 혼동 어휘] 껍질 / 껍데기, 살찌다 / 살피다 구분: '껍질'은 사과·양파·나무·귤처럼 무른 물질의 겉을 싸고 있는 단단하지 않은 외피이고, '껍데기'는 달걀·조개·", "[한글 맞춤법·표준어 혼동 어휘 해설] 늘리다 / 늘이다 구분\t'늘리다'는 수량·시간·실력·몸무게·세력 등이 원래보다 많아지거나 커지게 하다(학생 수를 늘리다, 공부 시간을 늘리다)이고, '늘이다'는 고무줄·엿가락·바지 기장 등 길이를 더 길게 당기거나 아래로 처지게 하다(고무줄을 늘이다)임\t\t[한글 맞춤법·표준어 혼동 어휘] 늘리다 / 늘이다 구분: '늘리다'는 수량·시간·실력·몸무게·세력 등이 원래보다 많아지거나 커지게 하다(학생 수를 늘리다, 공부 시간을 늘리다)이고, '늘", "[한글 맞춤법·표준어 혼동 어휘 해설] دار다(달다) / 다르다 활용형(달라 / 틀려)\t물을 달라)는 모두 '르 불규칙' 및 '달라'로 활용되어 \"남들과 생각이 달라(다르다)\"로 적으며, '틀려'로 쓰면 비문\t\t[한글 맞춤법·표준어 혼동 어휘] دار다(달다) / 다르다 활용형(달라 / 틀려): 물을 달라)는 모두 '르 불규칙' 및 '달라'로 활용되어 \"남들과 생각이 달라(다르다)\"로 적으며, '", "[한글 맞춤법·표준어 혼동 어휘 해설] 결재(決裁) / 결제(決濟) 구분\t'결재'는 결정할 권한이 있는 상관이 부하가 제출한 안건을 검토하여 허가·승인함(서류 결재를 올리다)이고, '결제'는 대금을 주고받아 거래 관계를 끝맺음(카드로 대금을 결제하다)임\t\t[한글 맞춤법·표준어 혼동 어휘] 결재(決裁) / 결제(決濟) 구분: '결재'는 결정할 권한이 있는 상관이 부하가 제출한 안건을 검토하여 허가·승인함(서류 결재를 올리다)이고, '결제'는 ", "[한글 맞춤법·표준어 혼동 어휘 해설] 개발(開發) / 계발(啓發) 구분\t'개발'은 토지·천연자원·신제품·소프트웨어·경제 등을 개척하여 발전시킴(신약 개발, 경제 개발)이고, '계발'은 슬기나 재능·잠재력·사상 등 정신적 능력을 일깨워 열어 줌(자기 계발, 소질 계발)임\t\t[한글 맞춤법·표준어 혼동 어휘] 개발(開發) / 계발(啓發) 구분: '개발'은 토지·천연자원·신제품·소프트웨어·경제 등을 개척하여 발전시킴(신약 개발, 경제 개발)이고, '계발'은 슬기나", "[한글 맞춤법·표준어 혼동 어휘 해설] 실제(實際) / 실재(實在) 구분\t'실제'는 사실의 경우나 형편 또는 거짓이나 상상이 아닌 현실(이론과 실제, 실제로 있었던 일)이고, '실재'는 철학·현실적으로 실제로 존재함(역사적 실재 인물, 실재론)임\t\t[한글 맞춤법·표준어 혼동 어휘] 실제(實際) / 실재(實在) 구분: '실제'는 사실의 경우나 형편 또는 거짓이나 상상이 아닌 현실(이론과 실제, 실제로 있었던 일)이고, '실재'는 철학·", "[한글 맞춤법·표준어 혼동 어휘 해설] 지양(止揚) / 지향(指向) 구분\t'지양'은 더 높은 단계로 발전하기 위해 어떠한 것을 하지 아니함(소모적인 갈등을 지양하다)이고, '지향'은 어떤 목표로 뜻이 쏠리어 향함(평화 통일을 지향하다)임\t\t[한글 맞춤법·표준어 혼동 어휘] 지양(止揚) / 지향(指向) 구분: '지양'은 더 높은 단계로 발전하기 위해 어떠한 것을 하지 아니함(소모적인 갈등을 지양하다)이고, '지향'은 어떤 목표", "[한글 맞춤법·표준어 혼동 어휘 해설] 고유어 단위 명사(손·쾌·접·축·죽·톳·두름·우리·쌈)\t고등어·조기 한 손(2마리), 북어 한 쾌(20마리), 마늘·배추 한 접(100개), 오징어 한 축(20마리), 옷·그릇 한 죽(10벌/10개), 김 한 톳(100장), 조기·산나물 한 두름(20마리/10모숨), 기와 한 우리(2,000장), 바늘 한 쌈(24개)\t\t[한글 맞춤법·표준어 혼동 어휘] 고유어 단위 명사(손·쾌·접·축·죽·톳·두름·우리·쌈): 고등어·조기 한 손(2마리), 북어 한 쾌(20마리), 마늘·배추 한 접(100개), 오징어 한 ", "[한글 맞춤법·표준어 혼동 어휘 해설] 나이를 나타내는 고유어·한자어(세시·연령 어휘)\t돌(만 1세), 미운 일곱 살, 지학(志學, 15세), 약관(弱冠, 20세) / 방년(芳年, 여성 20세), 이립(而立, 30세), 불혹(不惑, 40세), 지천명(知天命, 50세), 이순(耳順, 60세) / 환갑·회갑(61세), 고희(古稀)·종심(從心, 70세), 산수(傘壽, 80세), 미수(米壽, 88세), 백수(白壽, 99세)\t\t[한글 맞춤법·표준어 혼동 어휘] 나이를 나타내는 고유어·한자어(세시·연령 어휘): 돌(만 1세), 미운 일곱 살, 지학(志學, 15세), 약관(弱冠, 20세) / 방년(芳年, 여성 20세", "[국어 음운론·형태론·통사론·중세국어 해설] 음운(Phoneme)의 정의와 자음 19개·모음 21개 체계\t단모음 10개('ㅏ,ㅐ,ㅓ,ㅔ,ㅗ,ㅚ,ㅜ,ㅟ,ㅡ,ㅣ' — '키위를 주게 되었소 내가') 중 'ㅚ, ㅟ'는 원순 전설 단모음이라는 점이 핵심 출제 포인트\t\t[국어 음운론·형태론·통사론·중세국어] 음운(Phoneme)의 정의와 자음 19개·모음 21개 체계: 단모음 10개('ㅏ,ㅐ,ㅓ,ㅔ,ㅗ,ㅚ,ㅜ,ㅟ,ㅡ,ㅣ' — '키위를 주게 되었소 내가')", "[국어 음운론·형태론·통사론·중세국어 해설] 자음 조음 위치(양순음·치조음·경구개음·연구개음·후음)와 조음 방법(파열음·파찰음·마찰음·비음·유음)\t안울림소리는 예사소리(평음)-된소리(경음)-거센소리(격음)의 삼지적 상관속을 이룬다는 한국어 자음 체계의 독창적 특징\t\t[국어 음운론·형태론·통사론·중세국어] 자음 조음 위치(양순음·치조음·경구개음·연구개음·후음)와 조음 방법(파열음·파찰음·마찰음·비음·유음): 안울림소리는 예사소리(평음)-된소리(경음)-거", "[국어 음운론·형태론·통사론·중세국어 해설] 음절의 끝소리 규칙(음운의 교체 1)\t뒤에 모음으로 시작하는 형식 형태소(조사·어미·접미사)가 오면 대표음으로 바뀌지 않고 제 음가대로 연음되며(꽃이[꼬치]), 뜻이 있는 실질 형태소가 오면 대표음으로 바뀐 뒤 연음됨(꽃위→[꼳위]→[꼬뒤])\t\t[국어 음운론·형태론·통사론·중세국어] 음절의 끝소리 규칙(음운의 교체 1): 뒤에 모음으로 시작하는 형식 형태소(조사·어미·접미사)가 오면 대표음으로 바뀌지 않고 제 음가대로 연음되며(꽃", "[국어 음운론·형태론·통사론·중세국어 해설] 비음화(Nasalization, 음운의 교체 2 — 자음 동화)\t조음 위치는 그대로 두고 조음 방법만 뒤 음운을 닮아 비음으로 바뀌는 표준 발음 현상\t\t[국어 음운론·형태론·통사론·중세국어] 비음화(Nasalization, 음운의 교체 2 — 자음 동화): 조음 위치는 그대로 두고 조음 방법만 뒤 음운을 닮아 비음으로 바뀌는 표준 발음 현", "[국어 음운론·형태론·통사론·중세국어 해설] 유음화(Liquidization, 음운의 교체 3 — 자음 동화)\t유음화의 예외가 되는 2음절+1음절 한자어 결합 단어들이 시험에 자주 출제됨\t\t[국어 음운론·형태론·통사론·중세국어] 유음화(Liquidization, 음운의 교체 3 — 자음 동화): 유음화의 예외가 되는 2음절+1음절 한자어 결합 단어들이 시험에 자주 출제됨", "[국어 음운론·형태론·통사론·중세국어 해설] 구개음화(Palatalization, 음운의 교체 4)\t주의! 한 형태소 내부(잔디, 느티나무)이거나 뒤에 실질 형태소가 올 때(밭이랑[반니랑], 홑이불[혼니불])는 구개음화가 일어나지 않고 ㄴ첨가·비음화가 일어남\t\t[국어 음운론·형태론·통사론·중세국어] 구개음화(Palatalization, 음운의 교체 4): 주의! 한 형태소 내부(잔디, 느티나무)이거나 뒤에 실질 형태소가 올 때(밭이랑[반니랑], ", "[국어 음운론·형태론·통사론·중세국어 해설] 된소리되기(경음화, 음운의 교체 5)\t용언 어간 'ㄴ, ㅁ' 뒤에서 어미는 된소리가 되지만 명사 파생 접미사(신발, 논밭)나 피동·사동 접미사 '-기-'(안기다, 감기다, 굶기다)는 된소리가 되지 않는다는 핵심 구분\t\t[국어 음운론·형태론·통사론·중세국어] 된소리되기(경음화, 음운의 교체 5): 용언 어간 'ㄴ, ㅁ' 뒤에서 어미는 된소리가 되지만 명사 파생 접미사(신발, 논밭)나 피동·사동 접미사 '-", "[국어 음운론·형태론·통사론·중세국어 해설] 자음군 단순화(겹받침 발음, 음운의 탈락 1)\t단, '밟-'은 자음 앞에서 [밥-](밟다[밥따], 밟고[밥꼬])으로, '넓-'은 '넓죽하다[넙쭈카다], 넓둥글다[넙뚱글다]'에서만 [넙]으로 발음하고, 'ㄺ' 용언 어간은 'ㄱ'으로 시작하는 어미 앞에서 [ㄹ]로 발음함(맑게[말께], 읽고[일꼬] ↔ 읽기[일끼])\t\t[국어 음운론·형태론·통사론·중세국어] 자음군 단순화(겹받침 발음, 음운의 탈락 1): 단, '밟-'은 자음 앞에서 [밥-](밟다[밥따], 밟고[밥꼬])으로, '넓-'은 '넓죽하다[넙쭈카다", "[국어 음운론·형태론·통사론·중세국어 해설] 음운의 축약(거센소리되기·유기음화)과 탈락(ㅎ탈락·ㅡ탈락·ㄹ탈락)\t축하[추카], 좋고[조코], 놓다[노타])이고, 탈락은 모음 어미 앞에서 'ㅎ'이 아예 사라지는 현상(좋은[조은], 놓아[노아]) 및 'ㅡ' 탈락(쓰+어→써, 담그+아→담가), 'ㄹ' 탈락(울+는→우는, 솔+나무→소나무):자음군 단순화는 두 자음 중 하나가 없어지므로 교체가 아니라 '음운의 탈락'(음운 개수 1개 감소)에 해당한다는 점이 핵심\t\t[국어 음운론·형태론·통사론·중세국어] 음운의 축약(거센소리되기·유기음화)과 탈락(ㅎ탈락·ㅡ탈락·ㄹ탈락): 축하[추카], 좋고[조코], 놓다[노타])이고, 탈락은 모음 어미 앞에서 'ㅎ'이", "[국어 음운론·형태론·통사론·중세국어 해설] 사잇소리 현상과 ㄴ첨가(음운의 첨가)\t'꽃잎'은 음절 끝소리 규칙(교체: ㅊ→ㄷ) + ㄴ첨가(첨가: 잎→닙) + 비음화(교체: ㄷ→ㄴ)가 차례로 일어나 [꼰닙]으로 발음되는 복합 음운 변동 대표 사례\t\t[국어 음운론·형태론·통사론·중세국어] 사잇소리 현상과 ㄴ첨가(음운의 첨가): '꽃잎'은 음절 끝소리 규칙(교체: ㅊ→ㄷ) + ㄴ첨가(첨가: 잎→닙) + 비음화(교체: ㄷ→ㄴ)가 차례로 일", "[국어 음운론·형태론·통사론·중세국어 해설] 형태소(Morpheme)의 분류(자립성 유무\t실질/형식):뜻을 가진 가장 작은 말의 단위로 자립+실질(명사·대명사·수사·관형사·부사·감탄사), 의존+실질(용언의 어간 '먹-', '예쁘-'), 의존+형식(조사, 용언의 어미, 접사 '-들', '맨-'):예컨대 '하늘이 매우 푸르렀다'를 형태소로 분석하면 '하늘(자립·실질) + 이(의존·형식) + 매우(자립·실질) + 푸르-(의존·실질) + -었-(의존·형식) + -다(의존·형식)' 총 6개\t\t[국어 음운론·형태론·통사론·중세국어] 형태소(Morpheme)의 분류(자립성 유무: 실질/형식):뜻을 가진 가장 작은 말의 단위로 자립+실질(명사·대명사·수사·관형사·부사·감탄사), 의존", "[국어 음운론·형태론·통사론·중세국어 해설] 단어의 형성(단일어 vs 복합어\t어근 하나로 된 단일어와 달리, 어근에 접사(접두사·접미사)가 붙은 말은 파생어(맨손, 풋사과, 지우개, 멋쟁이, 높이다)이고, 실질적 뜻을 가진 어근과 어근이 결합한 말은 합성어(돌다리, 논밭, 밤낮, 뛰놀다, 돌아가다):접두사는 품사를 바꾸지 않는 한정적 접사이나, 일부 접미사(명사 파생 '-이/-기/-개', 부사 파생 '-이/-히', 피동·사동 접미사)는 어근의 품사나 문장 구조를 바꾸는 지배적 접사임\t\t[국어 음운론·형태론·통사론·중세국어] 단어의 형성(단일어 vs 복합어: 어근 하나로 된 단일어와 달리, 어근에 접사(접두사·접미사)가 붙은 말은 파생어(맨손, 풋사과, 지우개, 멋쟁이, ", "[국어 음운론·형태론·통사론·중세국어 해설] 통사적 합성어와 비통사적 합성어의 구별\t'작은형(작+은+형)'과 '건널목(건너+ㄹ+목)'은 관형사형 어미 '-은, -ㄹ'이 있으므로 통사적 합성어이고, '늦더위(늦+더위)'와 '덮밥(덮+밥)'은 어미가 생략되어 비통사적 합성어라는 구별법\t\t[국어 음운론·형태론·통사론·중세국어] 통사적 합성어와 비통사적 합성어의 구별: '작은형(작+은+형)'과 '건널목(건너+ㄹ+목)'은 관형사형 어미 '-은, -ㄹ'이 있으므로 통사적 합성어이", "[국어 음운론·형태론·통사론·중세국어 해설] 국어 9품사 분류 체계(체언·용언·수식언·관계언·독립언)\t명사·대명사·수사 / 수식언: 관형사·부사 / 관계언: 조사 / 독립언: 감탄사)와 형태가 활용하며 변하는 가변어(용언: 동사·형용사 — 단, 서술격 조사 '이다'는 조사 중 유일한 가변어):동사와 형용사를 구별하는 절대 기준은 현재시제 선어말어미 '-는-/-ㄴ-' 및 관형사형 '-는' 결합 가능 여부(먹는다/먹는 O = 동사 vs 예쁜다/예쁘는 X = 형용사)와 명령형·청유형 가능 여부\t\t[국어 음운론·형태론·통사론·중세국어] 국어 9품사 분류 체계(체언·용언·수식언·관계언·독립언): 명사·대명사·수사 / 수식언: 관형사·부사 / 관계언: 조사 / 독립언: 감탄사)와 형태가", "[국어 음운론·형태론·통사론·중세국어 해설] 문장 성분 7종(주성분\t관형어·부사어 / 독립성분: 독립어):문장 골격을 이루는 주성분 중 '보어'는 오직 서술어 '되다, 아니다' 앞에서 조사 '이/가'가 붙어 보충해 주는 성분(물이 얼음이 되다, 그는 학생이 아니다)만을 가리킴:조사 '이/가'가 붙더라도 '되다, 아니다' 바로 앞의 필수 성분은 주어가 아니라 '보어'라는 점이 문장 성분 분석의 핵심\t\t[국어 음운론·형태론·통사론·중세국어] 문장 성분 7종(주성분: 관형어·부사어 / 독립성분: 독립어):문장 골격을 이루는 주성분 중 '보어'는 오직 서술어 '되다, 아니다' 앞에서 조사 '", "[국어 음운론·형태론·통사론·중세국어 해설] 서술어의 자릿수(한 자리·두 자리·세 자리 서술어)\t원래 부사어는 수의적 부속성분이지만 '닮다, 같다, 다르다, 넣다, 삼다, 주다' 등이 요구하는 부사어는 생략하면 비문이 되는 '필수적 부사어'임\t\t[국어 음운론·형태론·통사론·중세국어] 서술어의 자릿수(한 자리·두 자리·세 자리 서술어): 원래 부사어는 수의적 부속성분이지만 '닮다, 같다, 다르다, 넣다, 삼다, 주다' 등이 요구하는", "[국어 음운론·형태론·통사론·중세국어 해설] 안은문장(복문)과 안긴문장(절) 5유형(명사절·관형절·부사절·서술절·인용절)\t관계관형절 vs 동격관형절), 부사절(-이, -게, -도록, -아서), 서술절(절 표지 없이 '코끼리는 코가 길다'처럼 주어+서술어 절 전체가 전체 문장의 서술어 역할), 인용절(직접 인용 '라고', 간접 인용 '고'):'코끼리는 코가 길다'는 주어가 두 개처럼 보이지만 '코가 길다' 전체가 서술절로 안긴문장이라는 점이 시험 최빈출\t\t[국어 음운론·형태론·통사론·중세국어] 안은문장(복문)과 안긴문장(절) 5유형(명사절·관형절·부사절·서술절·인용절): 관계관형절 vs 동격관형절), 부사절(-이, -게, -도록, -아서),", "[국어 음운론·형태론·통사론·중세국어 해설] 피동 표현(파생적 피동 '-이/히/리/기-', '-되다' vs 통사적 피동 '-아/어지다', '-게 되다')과 사동 표현('-이/히/리/기/우/구/추-', '-시키다', '-게 하다')\t'보여지다, 불려지다, 믿겨지다, 쓰여지다'는 피동 접미사와 '-어지다'가 중복된 잘못된 이중 피동이므로 '보이다, 불리다, 믿기다, 쓰이다'로 고쳐야 함\t\t[국어 음운론·형태론·통사론·중세국어] 피동 표현(파생적 피동 '-이/히/리/기-', '-되다' vs 통사적 피동 '-아/어지다', '-게 되다')과 사동 표현('-이/히/리/기/우/구/추", "[국어 음운론·형태론·통사론·중세국어 해설] 훈민정음 창제 원리(상형의 원리와 가획·합용의 원리)\t종성(받침)은 따로 글자를 만들지 않고 초성 글자를 다시 쓴다는 '종성부용초성(終聲復用初聲)' 원칙을 천명함\t\t[국어 음운론·형태론·통사론·중세국어] 훈민정음 창제 원리(상형의 원리와 가획·합용의 원리): 종성(받침)은 따로 글자를 만들지 않고 초성 글자를 다시 쓴다는 '종성부용초성(終聲復用初聲)'", "[국어 음운론·형태론·통사론·중세국어 해설] 중세 국어(15세기 국어)의 주요 문법·표기 특징(이어적기·8종성가족용·모음조화·주체/객체/상대 높임·주격 조사 이/∅)\t깊은 → 기픈), 받침을 'ㄱ,ㆁ,ㄷ,ㄴ,ㅂ,ㅁ,ㅅ,ㄹ' 8글자로 적은 8종성가족용, 철저한 모음조화, 주격 조사 '이'(자음 뒤 '이', 모음 뒤 'ㅣ', 'ㅣ' 모음 뒤 생략 ∅ — '가'는 16세기 이후 등장), 객체 높임 선어말어미 '-삽/잡/앖-', 어두자음군(ㅳ, ㅼ 등 된소리 기원)과 방점(성조 표시) 및 한자음 동국정운식 표기:현대 국어의 주격 조사 '가'와 달리 15세기 중세 국어에서는 주격 조사 '이'만 쓰였다는 점과 명사형 어미 '-옴/-움'이 쓰였다는 점이 핵심\t\t[국어 음운론·형태론·통사론·중세국어] 중세 국어(15세기 국어)의 주요 문법·표기 특징(이어적기·8종성가족용·모음조화·주체/객체/상대 높임·주격 조사 이/∅): 깊은 → 기픈), 받침을 ", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 객관적 상관물(Objective Correlative)\t황조가의 '꾀꼬리' — 화자의 외로움 심화):감정이입된 대상은 반드시 객관적 상관물이지만, 화자와 처지가 대조되어 외로움을 부각하는 대상(꾀꼬리 등)은 감정이입이 아닌 객관적 상관물이라는 구별법\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 객관적 상관물(Objective Correlative): 황조가의 '꾀꼬리' — 화자의 외로움 심화):감정이입된 대상은 반드시 객관적 ", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 감정이입(Empathy)과 감정 투영\t'우는 접동새', '눈물 흘리는 꽃'):대상이 화자의 정서와 동일시되어 울거나 기뻐할 때 성립하는 시적 기법\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 감정이입(Empathy)과 감정 투영: '우는 접동새', '눈물 흘리는 꽃'):대상이 화자의 정서와 동일시되어 울거나 기뻐할 때 성립하", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 공감각적 심상(감각의 전이)\t'분수처럼 흩어지는 푸른 종소리' — 청각의 시각화, '금빛 게으른 울음' — 청각의 시각화, '피부의 바깥에 스미는 어둠' — 시각의 촉각화):주의! '달콤한 향기(미각+후각)'나 '차갑고 흰 눈(촉각+시각)'처럼 두 감각이 단순히 나란히 결합된 것은 공감각적 심상이 아니라 '복합 감각적 심상'임\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 공감각적 심상(감각의 전이): '분수처럼 흩어지는 푸른 종소리' — 청각의 시각화, '금빛 게으른 울음' — 청각의 시각화, '피부의 ", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 역설법(Paradox)과 반어법(Irony)의 구별\t문장 자체에 양립 불가능한 논리적 모순(소리 없다 + 아우성)이 있으면 역설법이고, 문장 자체는 말이 되나 상황·속뜻과 반대이면 반어법임\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 역설법(Paradox)과 반어법(Irony)의 구별: 문장 자체에 양립 불가능한 논리적 모순(소리 없다 + 아우성)이 있으면 역설법이고", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 설의법(Rhetorical Question)과 영탄법·돈호법\t'가난하다고 해서 사랑을 모르겠는가'), 영탄법(감탄사나 감탄형 어미 '-도다, -구나, -어라'로 벅찬 감정을 표출), 돈호법(사람이나 사물의 이름을 불러 주의를 환기)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 설의법(Rhetorical Question)과 영탄법·돈호법: '가난하다고 해서 사랑을 모르겠는가'), 영탄법(감탄사나 감탄형 어미 '", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 직유법·은유법·의인법·활유법(비유하기 4대 기법)\t'내 마음은 호수요'), 의인법(사람이 아닌 것에 인격을 부여해 사람처럼 표현), 활유법(무생물을 살아 있는 생물처럼 동작·생명력 부여: '바다가 춤춘다, 어둠이 기어온다')\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 직유법·은유법·의인법·활유법(비유하기 4대 기법): '내 마음은 호수요'), 의인법(사람이 아닌 것에 인격을 부여해 사람처럼 표현), ", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 대유법(제유법과 환유법)\t사물의 일부분이나 한 종류로 전체를 나타내는 제유법('빵만으로는 살 수 없다'에서 빵=식량 전체, '백두에서 한라까지'=우리나라 전체)과 사물의 특징·속성으로 대상을 대신 나타내는 환유법('금배지'=국회의원, '백의의 천사'=간호사)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 대유법(제유법과 환유법): 사물의 일부분이나 한 종류로 전체를 나타내는 제유법('빵만으로는 살 수 없다'에서 빵=식량 전체, '백두에서", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 대구법·점층법·점강법·열거법·연쇄법(강조와 변화 기법)\t'범은 죽어서 가죽을 남기고 사람은 죽어서 이름을 남긴다'), 점층법(작고 약한 것에서 크고 강하고 넓은 것으로 뜻을 고조), 연쇄법(앞 구절 끝말을 뒷구절 첫머리에 이어받아 전개: '원숭이 엉덩이는 빨개, 빨가면 사과')\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 대구법·점층법·점강법·열거법·연쇄법(강조와 변화 기법): '범은 죽어서 가죽을 남기고 사람은 죽어서 이름을 남긴다'), 점층법(작고 약", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 시적 허용(시적 자유)과 도치법·생략법\t'모란이 피기까지는'의 '찬란한 슬픔의 봄을'에서 '봄을' 목적격 조사나 김소월 시의 '외로운 황홀한 심사여'), 도치법(정상적인 어순을 바꾸어 서술어를 앞으로 빼 강조)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 시적 허용(시적 자유)과 도치법·생략법: '모란이 피기까지는'의 '찬란한 슬픔의 봄을'에서 '봄을' 목적격 조사나 김소월 시의 '외로운", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 성격 제시 방법(직접 제시 = 말하기 Telling vs 간접 제시 = 보여주기 Showing)\t직접 제시는 서술자가 인물의 성격·심리를 요약하여 직접 설명해 주는 방식('그는 구두쇠이고 심술궂은 사람이었다' — 고전소설에 빈번)이고, 간접 제시는 인물의 구체적인 행동·대화·외양 묘사만을 보여주고 독자가 성격을 추론하게 하는 극적 제시 방식\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 성격 제시 방법(직접 제시 = 말하기 Telling vs 간접 제시 = 보여주기 Showing): 직접 제시는 서술자가 인물의 성격·심", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 소설의 시점 4유형(1인칭 주인공·1인칭 관찰자·3인칭 관찰자·전지적 작가 시점)\t주요섭 '사랑손님과 어머니'의 옥희, 현진건 '빈처'), 작품 밖 서술자가 객관적 사실만 묘사하는 3인칭 관찰자(예: 황순원 '소나기'), 작품 밖 서술자가 신처럼 모든 인물의 내면 심리와 과거·미래까지 다 아는 전지적 작가 시점\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 소설의 시점 4유형(1인칭 주인공·1인칭 관찰자·3인칭 관찰자·전지적 작가 시점): 주요섭 '사랑손님과 어머니'의 옥희, 현진건 '빈처", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 초점화(Focalization)와 자유간접화법·의식의 흐름 기법\t현진건 '운수 좋은 날'의 김 첨지) 및 인물의 내면 의식과 무의식적 연상을 인과관계 없이 떠오르는 대로 서술하는 의식의 흐름 기법(이상 '날개', 박태원 '소설가 구보 씨의 일일')\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 초점화(Focalization)와 자유간접화법·의식의 흐름 기법: 현진건 '운수 좋은 날'의 김 첨지) 및 인물의 내면 의식과 무의식적", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 액자식 구성(Frame Story)과 병렬식(옴니버스·피카레스크)·역순행적 구성\t바깥 이야기(외화) 속에 핵심이 되는 안 이야기(내화)가 들어 있는 액자식 구성(김동리 '무녀도', 남영로 '옥루몽'·김만중 '구운몽' 환몽 구조)과 현재에서 과거로 거슬러 올라가는 역순행적(입체적) 구성\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 액자식 구성(Frame Story)과 병렬식(옴니버스·피카레스크)·역순행적 구성: 바깥 이야기(외화) 속에 핵심이 되는 안 이야기(내화", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 고대가요 3대 작품(공무도하가·황조가·구지가)과 해가\t백수광부의 아내가 물에 빠져 죽는 남편을 보며 부른 집단 무가에서 개인 서정시로 넘어가는 '공무도하가'(물=사랑과 생명의 공간→이별과 죽음의 공간), 유리왕의 '황조가'(꾀꼬리=객관적 상관물), 가락국 수로왕 강림 신화 집단 노동요·주술요 '구지가'(거북=신성한 존재, 명령·위협 어조)\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 고대가요 3대 작품(공무도하가·황조가·구지가)과 해가: 백수광부의 아내가 물에 빠져 죽는 남편을 보며 부른 집단 무가에서 개인 서정시로", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 향가(4구체·8구체·10구체)와 10구체 향가의 낙구 감탄사\t신라 시대 향찰(한자의 음과 뜻을 빌려 우리말 어순과 조사·어미까지 표기)로 기록된 시가로, 가장 완성된 형태인 10구체 향가(제망매가, 찬기파랑가, 안민가, 보현십원가)는 '4구 + 4구 + 2구(낙구)'의 3단 구성을 취하며 낙구 첫머리에 '아으, 아야' 같은 감탄사가 놓여 후대 시조 종장 첫 음보(3음절 감탄)의 기원이 됨\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 향가(4구체·8구체·10구체)와 10구체 향가의 낙구 감탄사: 신라 시대 향찰(한자의 음과 뜻을 빌려 우리말 어순과 조사·어미까지 표기", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 월명사의 '제망매가'(10구체 향가)와 죽음의 종교적 승화\t일찍 죽은 누이의 명복을 빌며 지은 향가로 '한 가지에 나고 가는 곳 모르온저'(삶과 죽음의 무상함을 한 나뭇가지에 났다가 떨어지는 나뭇잎에 비유)에서 출발해 '아으 미타찰(극락세계)에서 만날 나 도 닦아 기다리겠노라'며 슬픔을 불교적 윤회·재회 신앙으로 극복(승화)한 명작\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 월명사의 '제망매가'(10구체 향가)와 죽음의 종교적 승화: 일찍 죽은 누이의 명복을 빌며 지은 향가로 '한 가지에 나고 가는 곳 모르", "[문학 개념어·수사법·시점·고전/현대문학 필수 작품 해설] 충담사의 '찬기파랑가'와 '안민가'(10구체 향가)\t화랑 기파랑의 고결한 인품을 구름을 헤치고 나타난 달, 맑은 새파란 물가의 조약돌, 눈서리를 이겨내는 높은 잣나무에 비유해 예찬한 '찬기파랑가'와 군(임금)은 아버지, 신(신하)은 사랑하시는 어머니, 민(백성)은 어린아이에 비유해 유교적 민본 정치를 노래한 '안민가'\t\t[문학 개념어·수사법·시점·고전/현대문학 필수 작품] 충담사의 '찬기파랑가'와 '안민가'(10구체 향가): 화랑 기파랑의 고결한 인품을 구름을 헤치고 나타난 달, 맑은 새파란 물가의 조약돌"], "law_it": ["국민주권주의와 민주공화국\t국민주권주의와 민주공화국 (헌법 제1조)\t\t[헌법] 국민주권주의와 민주공화국 (헌법 제1조): 대한민국은 민주공화국이며 주권은 국민에게 있고 모든 권력은 국민으로부터 나온다는 헌법의 최고 기본 원리", "인간의 존엄과 가치 및 행복추구권\t인간의 존엄과 가치 및 행복추구권 (헌법 제10조)\t\t[헌법] 인간의 존엄과 가치 및 행복추구권 (헌법 제10조): 모든 국민은 인간으로서의 존엄과 가치를 가지며 행복을 추구할 권리를 가지고 국가는 기본적 인권을 보장할 의무를 짐", "평등의 원칙과 차별 금지\t평등의 원칙과 차별 금지 (헌법 제11조)\t\t[헌법] 평등의 원칙과 차별 금지 (헌법 제11조): 모든 국민은 법 앞에 평등하며 성별·종교 또는 사회적 신분에 의하여 정치적·경제적·사회적·문화적 생활의 모든 영역에서 차별받지 아니함", "신체의 자유와 적법절차의 원칙\t신체의 자유와 적법절차의 원칙 (헌법 제12조 제1항)\t\t[헌법] 신체의 자유와 적법절차의 원칙 (헌법 제12조 제1항): 누구든지 법률과 적법한 절차에 의하지 아니하고는 체포·구속·압수·수색 또는 심문을 받지 아니하며 처벌·보안처분·강제노역을 ", "고문 금지와 진술거부권(묵비권)\t고문 금지와 진술거부권(묵비권) (헌법 제12조 제2항)\t\t[헌법] 고문 금지와 진술거부권(묵비권) (헌법 제12조 제2항): 모든 국민은 고문을 받지 아니하며 형사상 자기에게 불리한 진술을 강요당하지 아니하는 권리", "영장주의\t영장주의 (헌법 제12조 제3항)\t\t[헌법] 영장주의 (헌법 제12조 제3항): 체포·구속·압수 또는 수색을 할 때에는 적법한 절차에 따라 검사의 신청에 의하여 법관이 발부한 영장을 제시하여야 하는 원칙", "변호인의 조력을 받을 권리와 국선변호인\t변호인의 조력을 받을 권리와 국선변호인 (헌법 제12조 제4항)\t\t[헌법] 변호인의 조력을 받을 권리와 국선변호인 (헌법 제12조 제4항): 누구든지 체포 또는 구속을당한 때에는 즉시 변호인의 조력을 받을 권리를 가지며 형사피고인이 스스로 변호인을 구할 ", "미란다 원칙(체포·구속 이유 고지)\t미란다 원칙(체포·구속 이유 고지) (헌법 제12조 제5항)\t\t[헌법] 미란다 원칙(체포·구속 이유 고지) (헌법 제12조 제5항): 체포 또는 구속의 이유와 변호인의 조력을 받을 권리가 있음을 고지받지 아니하고는 체포 또는 구속을 당하지 아니함", "구속적부심사청구권\t구속적부심사청구권 (헌법 제12조 제6항)\t\t[헌법] 구속적부심사청구권 (헌법 제12조 제6항): 누구든지 체포 또는 구속을 당한 때에는 적부의 심사를 법원에 청구할 권리를 가짐", "자백의 증거능력 제한과 보강법칙\t자백의 증거능력 제한과 보강법칙 (헌법 제12조 제7항)\t\t[헌법] 자백의 증거능력 제한과 보강법칙 (헌법 제12조 제7항): 고문·폭행·협박·구속의 부당한 장기화 등으로 임의로 진술한 것이 아니라고 인정되는 자백이나 정식재판에서 피고인의 자백이 ", "죄형법정주의와 형벌불소급의 원칙\t죄형법정주의와 형벌불소급의 원칙 (헌법 제13조 제1항)\t\t[헌법] 죄형법정주의와 형벌불소급의 원칙 (헌법 제13조 제1항): 모든 국민은 행위시의 법률에 의하여 범죄를 구성하지 아니하는 행위로 소추되지 아니함", "일사부재리의 원칙(이중처벌 금지)\t일사부재리의 원칙(이중처벌 금지) (헌법 제13조 제1항 후단)\t\t[헌법] 일사부재리의 원칙(이중처벌 금지) (헌법 제13조 제1항 후단): 모든 국민은 동일한 범죄에 대하여 거듭 처벌받지 아니한다는 헌법상 원칙", "소급입법에 의한 참정권 제한 및 재산권 박탈 금지\t소급입법에 의한 참정권 제한 및 재산권 박탈 금지 (헌법 제13조 제2항)\t\t[헌법] 소급입법에 의한 참정권 제한 및 재산권 박탈 금지 (헌법 제13조 제2항): 모든 국민은 소급입법에 의하여 참정권의 제한을 받거나 재산권을 박탈당하지 아니함", "연좌제 금지의 원칙\t연좌제 금지의 원칙 (헌법 제13조 제3항)\t\t[헌법] 연좌제 금지의 원칙 (헌법 제13조 제3항): 모든 국민은 자기의 행위가 아닌 친족의 행위로 인하여 불이익한 처우를 받지 아니함", "거주·이전의 자유\t거주·이전의 자유 (헌법 제14조)\t\t[헌법] 거주·이전의 자유 (헌법 제14조): 모든 국민은 거주·이전의 자유를 가짐", "직업선택의 자유\t직업선택의 자유 (헌법 제15조)\t\t[헌법] 직업선택의 자유 (헌법 제15조): 모든 국민은 직업선택의 자유를 가지며 영업의 자유와 전직의 자유를 포함함", "주거의 자유\t주거의 자유 (헌법 제16조)\t\t[헌법] 주거의 자유 (헌법 제16조): 모든 국민은 주거의 자유를 침해받지 아니하며 주거에 대한 압수나 수색에는 법관이 발부한 영장을 제시하여야 함", "사생활의 비밀과 자유 및 개인정보자기결정권\t사생활의 비밀과 자유 및 개인정보자기결정권 (헌법 제17조)\t\t[헌법] 사생활의 비밀과 자유 및 개인정보자기결정권 (헌법 제17조): 모든 국민은 사생활의 비밀과 자유를 침해받지 아니하며 자신에 관한 정보가 언제 누구에게 어느 범위까지 알려지고 이용되", "통신의 비밀과 자유\t통신의 비밀과 자유 (헌법 제18조)\t\t[헌법] 통신의 비밀과 자유 (헌법 제18조): 모든 국민은 통신의 비밀을 침해받지 아니함", "양심의 자유\t양심의 자유 (헌법 제19조)\t\t[헌법] 양심의 자유 (헌법 제19조): 모든 국민은 양심의 자유를 가지며 내심의 윤리적 판단을 외부에 표명하도록 강제받지 않을 침묵의 자유를 포함함", "종교의 자유와 정교분리의 원칙\t종교의 자유와 정교분리의 원칙 (헌법 제20조)\t\t[헌법] 종교의 자유와 정교분리의 원칙 (헌법 제20조): 모든 국민은 종교의 자유를 가지며 국교는 인정되지 아니하고 종교와 정치는 분리됨", "언론·출판·집회·결사의 자유와 사전검열·허가 금지\t언론·출판·집회·결사의 자유와 사전검열·허가 금지 (헌법 제21조)\t\t[헌법] 언론·출판·집회·결사의 자유와 사전검열·허가 금지 (헌법 제21조): 언론·출판에 대한 허가나 검열과 집회·결사에 대한 허가는 인정되지 아니함", "학문과 예술의 자유\t학문과 예술의 자유 (헌법 제22조)\t\t[헌법] 학문과 예술의 자유 (헌법 제22조): 모든 국민은 학문과 예술의 자유를 가지며 저작자·발명가·과학기술자와 예술가의 권리는 법률로써 보호함", "재산권의 보장과 공공복리 적합의무 및 정당보상\t재산권의 보장과 공공복리 적합의무 및 정당보상 (헌법 제23조)\t\t[헌법] 재산권의 보장과 공공복리 적합의무 및 정당보상 (헌법 제23조): 모든 국민의 재산권은 보장되며 공공필요에 의한 재산권의 수용·사용 또는 제한 및 그에 대한 보상은 법률로써 하되 ", "선거권과 공무담임권\t선거권과 공무담임권 (헌법 제24조·제25조)\t\t[헌법] 선거권과 공무담임권 (헌법 제24조·제25조): 모든 국민은 법률이 정하는 바에 의하여 선거권과 공무담임권을 가짐", "청원권\t청원권 (헌법 제26조)\t\t[헌법] 청원권 (헌법 제26조): 모든 국민은 법률이 정하는 바에 의하여 국가기관에 문서로 청원할 권리를 가지며 국가는 청원에 대하여 심사할 의무를 짐", "재판청구권과 무죄추정의 원칙\t재판청구권과 무죄추정의 원칙 (헌법 제27조)\t\t[헌법] 재판청구권과 무죄추정의 원칙 (헌법 제27조): 헌법과 법률이 정한 법관에 의하여 신속한 재판을 받을 권리를 가지며 형사피고인은 유죄의 판결이 확정될 때까지는 무죄로 추정됨", "형사보상청구권\t형사보상청구권 (헌법 제28조)\t\t[헌법] 형사보상청구권 (헌법 제28조): 형사피의자 또는 형사피고인으로서 구금되었던 자가 법률이 정하는 불기소처분을 받거나 무죄판결을 받은 때에는 국가에 정당한 보상을 청구할 수 있음", "국가배상청구권\t국가배상청구권 (헌법 제29조)\t\t[헌법] 국가배상청구권 (헌법 제29조): 공무원의 직무상 불법행위로 손해를 받은 국민은 법률이 정하는 바에 의하여 국가 또는 공공단체에 정당한 배상을 청구할 수 있음", "범죄피해자구조청구권\t범죄피해자구조청구권 (헌법 제30조)\t\t[헌법] 범죄피해자구조청구권 (헌법 제30조): 타인의 범죄행위로 인하여 생명·신체에 대한 피해를 받은 국민은 법률이 정하는 바에 의하여 국가로부터 구조를 받을 수 있음", "교육을 받을 권리와 의무교육 무상 원칙\t교육을 받을 권리와 의무교육 무상 원칙 (헌법 제31조)\t\t[헌법] 교육을 받을 권리와 의무교육 무상 원칙 (헌법 제31조): 모든 국민은 능력에 따라 균등하게 교육을 받을 권리를 가지며 의무교육은 무상으로 하고 교육의 자주성·전문성·정치적 중립성", "근로의 권리와 근로3권(단결권·단체교섭권·단체행동권)\t근로의 권리와 근로3권(단결권·단체교섭권·단체행동권) (헌법 제32조·제33조)\t\t[헌법] 근로의 권리와 근로3권(단결권·단체교섭권·단체행동권) (헌법 제32조·제33조): 근로자는 근로조건의 향상을 위하여 자주적인 단결권·단체교섭권 및 단체행동권을 가짐", "인간다운 생활을 할 권리(사회보장수급권)\t인간다운 생활을 할 권리(사회보장수급권) (헌법 제34조)\t\t[헌법] 인간다운 생활을 할 권리(사회보장수급권) (헌법 제34조): 모든 국민은 인간다운 생활을 할 권리를 가지며 국가는 사회보장·사회복지의 증진에 노력할 의무를 짐", "환경권\t환경권 (헌법 제35조)\t\t[헌법] 환경권 (헌법 제35조): 모든 국민은 건강하고 쾌적한 환경에서 생활할 권리를 가지며 국가와 국민은 환경보전을 위하여 노력하여야 함", "혼인과 가족생활의 보장 및 보건권\t혼인과 가족생활의 보장 및 보건권 (헌법 제36조)\t\t[헌법] 혼인과 가족생활의 보장 및 보건권 (헌법 제36조): 혼인과 가족생활은 개인의 존엄과 양성의 평등을 기초로 성립되고 유지되어야 하며 모든 국민은 보건에 관하여 국가의 보호를 받음", "과잉금지의 원칙(비례의 원칙)\t과잉금지의 원칙(비례의 원칙) (헌법 제37조 제2항)\t\t[헌법] 과잉금지의 원칙(비례의 원칙) (헌법 제37조 제2항): 국민의 모든 자유와 권리는 국가안전보장·질서유지 또는 공공복리를 위하여 필요한 경우에 한하여 법률로써 제한할 수 있으며 제", "국회의 입법권과 재정권(조세법률주의·예산심의권)\t국회의 입법권과 재정권(조세법률주의·예산심의권) (헌법 제40조·제54조·제59조)\t\t[헌법] 국회의 입법권과 재정권(조세법률주의·예산심의권) (헌법 제40조·제54조·제59조): 입법권은 국회에 속하며 조세의 종목과 세율은 법률로 정하고 국회는 국가의 예산안을 심의·확정함", "대통령의 지위와 긴급명령·계엄선포권\t대통령의 지위와 긴급명령·계엄선포권 (헌법 제66조·제76조·제77조)\t\t[헌법] 대통령의 지위와 긴급명령·계엄선포권 (헌법 제66조·제76조·제77조): 대통령은 국가의 원수이며 행정권의 수반으로서 내우·외환 등 위기 시 긴급재정경제명령이나 계엄을 선포할 수 ", "사법권의 독립과 대법원의 위헌·위법 명령·규칙 심사권\t사법권의 독립과 대법원의 위헌·위법 명령·규칙 심사권 (헌법 제101조·제107조 제2항)\t\t[헌법] 사법권의 독립과 대법원의 위헌·위법 명령·규칙 심사권 (헌법 제101조·제107조 제2항): 사법권은 법관으로 구성된 법원에 속하며 명령·규칙 또는 처분이 헌법이나 법률에 위반되는", "헌법재판소의 권한 5가지\t헌법재판소의 권한 5가지 (헌법 제111조)\t\t[헌법] 헌법재판소의 권한 5가지 (헌법 제111조): 위헌법률심판, 탄핵심판, 정당해산심판, 국가기관 상호간·국가기관과 지자체 간 및 지자체 상호간의 권한쟁의심판, 헌법소원심판", "신의성실의 원칙과 권리남용 금지의 원칙\t신의성실의 원칙과 권리남용 금지의 원칙 (민법 제2조)\t\t[민법] 신의성실의 원칙과 권리남용 금지의 원칙 (민법 제2조): 권리의 행사와 의무의 이행은 신의에 좇아 성실히 하여야 하며 권리는 남용하지 못한다는 민법 대원칙", "권리능력·의사능력·행위능력과 제한능력자 제도\t권리능력·의사능력·행위능력과 제한능력자 제도 (민법 제3조~제17조)\t\t[민법] 권리능력·의사능력·행위능력과 제한능력자 제도 (민법 제3조~제17조): 미성년자·피성년후견인·피한정후견인의 법률행위는 법정대리인의 동의를 요하거나 취소할 수 있도록 하여 제한능력자", "소멸시효와 제척기간\t소멸시효와 제척기간 (민법 제162조)\t\t[민법] 소멸시효와 제척기간 (민법 제162조): 권리자가 권리를 행사할 수 있음에도 일정 기간 행사하지 않으면 권리가 소멸하는 제도(일반채권 10년, 상사채권 5년)와 법률관계의 조속한 ", "비진의표시·통정허위표시·착오·사기·강박에 의한 의사표시\t비진의표시·통정허위표시·착오·사기·강박에 의한 의사표시 (민법 제107조~제110조)\t\t[민법] 비진의표시·통정허위표시·착오·사기·강박에 의한 의사표시 (민법 제107조~제110조): 통정허위표시는 무효이나 선의의 제3자에게 대항하지 못하며, 중요부분의 착오나 사기·강박에 의", "무권대리와 표현대리\t무권대리와 표현대리 (민법 제125조~제135조)\t\t[민법] 무권대리와 표현대리 (민법 제125조~제135조): 대리권 없이 한 행위는 본인이 추인하지 않으면 본인에게 효력이 없으나(무권대리), 외관상 대리권이 있는 것처럼 믿게 한 본인의 ", "법률행위의 무효와 취소\t법률행위의 무효와 취소 (민법 제137조~제146조)\t\t[민법] 법률행위의 무효와 취소 (민법 제137조~제146조): 무효는 처음부터 당연히 효력이 없는 것이고 취소는 일단 유효하게 성립한 법률행위를 취소권자의 의사표시로 소급하여 무효로 만드", "물권법정주의와 공시의 원칙·공신의 원칙\t물권법정주의와 공시의 원칙·공신의 원칙 (민법 제185조~제188조)\t\t[민법] 물권법정주의와 공시의 원칙·공신의 원칙 (민법 제185조~제188조): 물권은 법률 또는 관습법에 의하는 외에는 임의로 창설하지 못하며 부동산 물권변동은 등기, 동산은 인도(점유이", "선의취득(즉시취득)\t선의취득(즉시취득) (민법 제249조)\t\t[민법] 선의취득(즉시취득) (민법 제249조): 평온·공연하게 동산을 양수한 자가 선의이며 과실 없이 그 동산을 점유한 경우에는 양도인이 정당한 소유자가 아닌 때에도 즉시 그 동산의 소유", "저당권과 전세권·유치권·질권\t저당권과 전세권·유치권·질권 (담보물권과 용익물권)\t\t[민법] 저당권과 전세권·유치권·질권 (담보물권과 용익물권): 채권 담보를 목적으로 목적물의 교환가치를 지배하는 담보물권(유치권·질권·저당권)과 사용·수익가치를 지배하는 용익물권(지상권·지", "채무불이행(이행지체·이행불능·불완전이행)과 손해배상\t채무불이행(이행지체·이행불능·불완전이행)과 손해배상 (민법 제390조)\t\t[민법] 채무불이행(이행지체·이행불능·불완전이행)과 손해배상 (민법 제390조): 채무자가 채무의 내용에 좇은 이행을 하지 아니한 때에는 채권자는 손해배상을 청구할 수 있으나 채무자의 고의", "채권자대위권과 채권자취소권(사해행위취소권)\t채권자대위권과 채권자취소권(사해행위취소권) (민법 제404조·제406조)\t\t[민법] 채권자대위권과 채권자취소권(사해행위취소권) (민법 제404조·제406조): 채권자가 자기의 채권을 보전하기 위하여 채무자의 권리를 대신 행사하거나(대위권), 채무자가 채권자를 해함", "동시이행의 항변권과 위험부담\t동시이행의 항변권과 위험부담 (민법 제536조·제537조)\t\t[민법] 동시이행의 항변권과 위험부담 (민법 제536조·제537조): 쌍무계약의 당사자 일방은 상대방이 그 채무이행을 제공할 때까지 자기의 채무이행을 거절할 수 있으며 당사자 쌍방의 책임 ", "불법행위의 성립요건과 사용자책임\t불법행위의 성립요건과 사용자책임 (민법 제750조·제756조)\t\t[민법] 불법행위의 성립요건과 사용자책임 (민법 제750조·제756조): 고의 또는 과실로 인한 위법행위로 타인에게 손해를 가한 자는 손해를 배상할 책임이 있으며 타인을 사용하여 어느 사무", "부당이득반환청구권과 사무관리\t부당이득반환청구권과 사무관리 (민법 제734조·제741조)\t\t[민법] 부당이득반환청구권과 사무관리 (민법 제734조·제741조): 법률상 원인 없이 타인의 재산 또는 노무로 인하여 이익을 얻고 이로 인하여 타인에게 손해를 가한 자는 그 이익을 반환하", "죄형법정주의의 파생 원칙 4가지\t죄형법정주의의 파생 원칙 4가지 (관습형법 금지·소급효 금지·유추해석 금지·명확성의 원칙)\t\t[형법] 죄형법정주의의 파생 원칙 4가지 (관습형법 금지·소급효 금지·유추해석 금지·명확성의 원칙): 범죄와 형벌은 반드시 성문의 법률로 명확하게 규정되어야 하며 피고인에게 불리한 소급적용", "범죄의 성립요건 3단계\t범죄의 성립요건 3단계 (구성요건 해당성·위법성·책임)\t\t[형법] 범죄의 성립요건 3단계 (구성요건 해당성·위법성·책임): 어떠한 행위가 범죄로 성립하기 위해서는 형법상 금지된 구성요건에 해당하고 위법성 조각사유가 없으며 행위자에게 비난가능성(책", "위법성 조각사유 5가지\t위법성 조각사유 5가지 (정당행위·정당방위·긴급피난·자구행위·피해자의 승낙)\t\t[형법] 위법성 조각사유 5가지 (정당행위·정당방위·긴급피난·자구행위·피해자의 승낙): 구성요건에 해당하는 행위라도 법질서 전체의 관점에서 정당화되어 위법성이 배제되는 사유(형법 제20조~", "책임조각사유(형사미성년자·심신상실자·강요된 행위)\t책임조각사유(형사미성년자·심신상실자·강요된 행위) (형법 제9조·제10조·제12조)\t\t[형법] 책임조각사유(형사미성년자·심신상실자·강요된 행위) (형법 제9조·제10조·제12조): 14세 되지 아니한 자의 행위, 심신장애로 사물을 변별하거나 의사를 결정할 능력이 없는 자의 ", "미수범(장애미수·중지미수·불능미수)과 예비·음모\t미수범(장애미수·중지미수·불능미수)과 예비·음모 (형법 제25조~제28조)\t\t[형법] 미수범(장애미수·중지미수·불능미수)과 예비·음모 (형법 제25조~제28조): 범죄의 실행에 착수하여 행위를 종료하지 못하였거나 결과가 발생하지 아니한 때 처벌하되 자의로 중지한 때", "공범(공동정범·교사범·종범·간접정범)\t공범(공동정범·교사범·종범·간접정범) (형법 제30조~제34조)\t\t[형법] 공범(공동정범·교사범·종범·간접정범) (형법 제30조~제34조): 2인 이상이 공동하여 죄를 범한 때(공동정범), 타인을 교사하여 죄를 범하게 한 때(교사범), 타인의 범죄를 방조", "위법수집증거배제법칙과 독수과실이론\t위법수집증거배제법칙과 독수과실이론 (형사소송법 제308조의2)\t\t[형사소송법] 위법수집증거배제법칙과 독수과실이론 (형사소송법 제308조의2): 적법한 절차에 따르지 아니하고 수집한 증거는 유죄의 증거로 할 수 없으며 그 위법한 증거에 기초하여 획득한 2", "전문법칙(전문증거의 증거능력 제한)\t전문법칙(전문증거의 증거능력 제한) (형사소송법 제310조의2)\t\t[형사소송법] 전문법칙(전문증거의 증거능력 제한) (형사소송법 제310조의2): 경험자의 진술을 전해 들은 전문진술이나 진술을 기재한 서류는 반대신문권이 보장되지 않으므로 원칙적으로 증거능", "자유심증주의와 합리적 의심 없는 증명의 원칙\t자유심증주의와 합리적 의심 없는 증명의 원칙 (형사소송법 제307조·제308조)\t\t[형사소송법] 자유심증주의와 합리적 의심 없는 증명의 원칙 (형사소송법 제307조·제308조): 증거의 증명력은 법관의 자유판단에 의하되 논리와 경험칙에 합치해야 하며 범죄사실의 인정은 합", "법률유보의 원칙과 법률우위의 원칙\t법률유보의 원칙과 법률우위의 원칙 (법치행정의 원리)\t\t[행정법] 법률유보의 원칙과 법률우위의 원칙 (법치행정의 원리): 행정작용은 법률에 위반되어서는 안 되며(법률우위) 국민의 권리를 제한하거나 의무를 부과하는 침익적 행정작용 및 본질적 사항", "신뢰보호의 원칙과 자기구속의 원칙·부당결부금지의 원칙\t신뢰보호의 원칙과 자기구속의 원칙·부당결부금지의 원칙 (행정법의 일반원칙)\t\t[행정법] 신뢰보호의 원칙과 자기구속의 원칙·부당결부금지의 원칙 (행정법의 일반원칙): 행정청의 공적 견해표명에 대한 국민의 정당한 신뢰를 보호하고, 동종 사안에 대해 관행과 달리 차별 처", "기속행위와 재량행위 및 재량권의 일탈·남용\t기속행위와 재량행위 및 재량권의 일탈·남용 (행정행위의 분류)\t\t[행정법] 기속행위와 재량행위 및 재량권의 일탈·남용 (행정행위의 분류): 법률이 요건 충족 시 일의적 효과를 규정한 기속행위와 행정청에 복수의 행위 선택권을 부여한 재량행위로 나뉘며 재량", "행정행위의 공정력·구성요건적 효력·불가쟁력·불가변력\t행정행위의 공정력·구성요건적 효력·불가쟁력·불가변력 (행정행위의 효력)\t\t[행정법] 행정행위의 공정력·구성요건적 효력·불가쟁력·불가변력 (행정행위의 효력): 행정행위에 하자가 있더라도 당연무효가 아닌 한 권한 있는 기관이 취소할 때까지 유효한 것으로 통용되는 힘", "하자의 치유와 전환 및 무효와 취소의 구별(중대명백설)\t하자의 치유와 전환 및 무효와 취소의 구별(중대명백설) (행정행위의 하자론)\t\t[행정법] 하자의 치유와 전환 및 무효와 취소의 구별(중대명백설) (행정행위의 하자론): 행정처분이 당연무효가 되기 위해서는 그 하자가 법규의 중요한 부분을 위반한 중대한 것이고 객관적으로", "항고소송의 종류 3가지\t항고소송의 종류 3가지 (취소소송·무효등확인소송·부작위위법확인소송)\t\t[행정소송법] 항고소송의 종류 3가지 (취소소송·무효등확인소송·부작위위법확인소송): 행정청의 위법한 처분 등을 취소 또는 변경하는 소송(취소소송), 처분 등의 효력 유무 또는 존재 여부를 ", "객체지향 설계 5대 원칙(SOLID)\t객체지향 설계 5대 원칙(SOLID) (SRP·OCP·LSP·ISP·DIP)\t\t[소프트웨어공학] 객체지향 설계 5대 원칙(SOLID) (SRP·OCP·LSP·ISP·DIP): 단일 책임 원칙(SRP), 개방-폐쇄 원칙(OCP), 리스코프 치환 원칙(LSP), 인터페이", "GoF 디자인 패턴 3분류\tGoF 디자인 패턴 3분류\t\t[소프트웨어공학] GoF 디자인 패턴 3분류 (생성(Creational)·구조(Structural)·행위(Behavioral) 패턴): Singleton·Factory Method·Buil", "응집도(Cohesion) 7단계 순서(강→약)\t응집도(Cohesion) 7단계 순서(강→약) (기능적→순차적→교환적→절차적→시간적→논리적→우연적 응집도)\t\t[소프트웨어공학] 응집도(Cohesion) 7단계 순서(강→약) (기능적→순차적→교환적→절차적→시간적→논리적→우연적 응집도): 모듈 내부 구성요소들이 단일한 목적을 위해 긴밀하게 결합된 정", "결합도(Coupling) 6단계 순서(약→강)\t결합도(Coupling) 6단계 순서(약→강) (자료→스탬프→제어→외부→공통→내용 결합도)\t\t[소프트웨어공학] 결합도(Coupling) 6단계 순서(약→강) (자료→스탬프→제어→외부→공통→내용 결합도): 모듈 간 상호 의존하는 정도로 자료(Data) 결합도가 가장 낮아 이상적이며 ", "화이트박스 테스트와 기초 경로 테스트(McCabe 순환복잡도)\t화이트박스 테스트와 기초 경로 테스트(McCabe 순환복잡도) (V(G) = E - N + 2 (또는 조건 분기 수 + 1))\t\t[소프트웨어공학] 화이트박스 테스트와 기초 경로 테스트(McCabe 순환복잡도) (V(G) = E - N + 2 (또는 조건 분기 수 + 1)): 모듈 내부 소스코드를 보며 문장·결정(분기", "블랙박스 테스트 기법 5가지\t블랙박스 테스트 기법 5가지 (동치 분할·경계값 분석·원인-효과 그래프·오류 예측·비교 테스트)\t\t[소프트웨어공학] 블랙박스 테스트 기법 5가지 (동치 분할·경계값 분석·원인-효과 그래프·오류 예측·비교 테스트): 내부 구조를 보지 않고 입력과 출력 명세만을 기반으로 기능을 검증하는 테", "소프트웨어 테스트 V-모델 단계\t소프트웨어 테스트 V-모델 단계\t\t[소프트웨어공학] 소프트웨어 테스트 V-모델 단계 (단위(Unit)→통합(Integration)→시스템(System)→인수(Acceptance) 테스트): 모듈(단위 설계), 아키텍처(통합", "애자일(Agile) 선언문과 스크럼(Scrum) 프레임워크\t애자일(Agile) 선언문과 스크럼(Scrum) 프레임워크\t\t[소프트웨어공학] 애자일(Agile) 선언문과 스크럼(Scrum) 프레임워크 (Product Backlog·Sprint·Daily Scrum·Sprint Review·Retrospectiv", "리팩토링(Refactoring)과 기술 부채(Technical Debt)\t리팩토링(Refactoring)과 기술 부채(Technical Debt) (외부 동작을 바꾸지 않으면서 내부 코드 구조를 개선하는 작업)\t\t[소프트웨어공학] 리팩토링(Refactoring)과 기술 부채(Technical Debt) (외부 동작을 바꾸지 않으면서 내부 코드 구조를 개선하는 작업): 소프트웨어의 기능(외부 동작)은", "CI/CD(지속적 통합·지속적 배포)와 무중단 배포 전략\tCI/CD(지속적 통합·지속적 배포)와 무중단 배포 전략 (Rolling·Blue-Green·Canary 배포)\t\t[소프트웨어공학] CI/CD(지속적 통합·지속적 배포)와 무중단 배포 전략 (Rolling·Blue-Green·Canary 배포): 코드 변경사항을 자동으로 빌드·테스트하여 통합(CI)하고", "프로세스(Process)와 스레드(Thread)의 메모리 구조 차이\t프로세스(Process)와 스레드(Thread)의 메모리 구조 차이\t\t[운영체제] 프로세스(Process)와 스레드(Thread)의 메모리 구조 차이 (프로세스는 독립된 Code/Data/Heap/Stack 보유, 스레드는 Stack만 독립이고 Code/Da", "CPU 스케줄링 알고리즘(비선점 vs 선점)\tCPU 스케줄링 알고리즘(비선점 vs 선점) (비선점(FCFS·SJF·HRN) vs 선점(RR·SRT·MLQ·MLFQ))\t\t[운영체제] CPU 스케줄링 알고리즘(비선점 vs 선점) (비선점(FCFS·SJF·HRN) vs 선점(RR·SRT·MLQ·MLFQ)): HRN은 SJF의 기아(Starvation) 현상을 ", "교착상태(Deadlock) 발생 필요충분조건 4가지\t교착상태(Deadlock) 발생 필요충분조건 4가지\t\t[운영체제] 교착상태(Deadlock) 발생 필요충분조건 4가지 (상호 배제(Mutual Exclusion)·점유와 대기(Hold and Wait)·비선점(No Preemption)·환형 ", "교착상태 처리 기법 4가지\t교착상태 처리 기법 4가지\t\t[운영체제] 교착상태 처리 기법 4가지 (예방(Prevention)·회피(Avoidance, 은행원 알고리즘)·탐지(Detection, 자원할당 그래프)·복구(Recovery)): 다익스트", "상호배제와 동기화 도구(뮤텍스·세마포어·모니터)\t상호배제와 동기화 도구(뮤텍스·세마포어·모니터)\t\t[운영체제] 상호배제와 동기화 도구(뮤텍스·세마포어·모니터) (Mutex(이진 락)·Semaphore(P/V 연산 공유자원 카운터)·Monitor): 임계 구역(Critical Sectio", "가상메모리 페이징(Paging)과 세그먼테이션(Segmentation)\t가상메모리 페이징(Paging)과 세그먼테이션(Segmentation)\t\t[운영체제] 가상메모리 페이징(Paging)과 세그먼테이션(Segmentation) (고정 크기 블록(Page/Frame, 내부 단편화) vs 가변 크기 논리 블록(Segment, 외부 단", "페이지 교체 알고리즘(FIFO·OPT·LRU·LFU·NUR·Clock)\t페이지 교체 알고리즘(FIFO·OPT·LRU·LFU·NUR·Clock) (LRU(가장 오랫동안 참조되지 않은 페이지 교체)와 Belady의 모순)\t\t[운영체제] 페이지 교체 알고리즘(FIFO·OPT·LRU·LFU·NUR·Clock) (LRU(가장 오랫동안 참조되지 않은 페이지 교체)와 Belady의 모순): FIFO는 프레임 수를 늘려", "스래싱(Thrashing)과 워킹셋(Working Set)·PFF 기법\t스래싱(Thrashing)과 워킹셋(Working Set)·PFF 기법\t\t[운영체제] 스래싱(Thrashing)과 워킹셋(Working Set)·PFF 기법 (프로세스 처리 시간보다 페이지 교체(Page Fault) 시간이 더 많아 CPU 이용률이 급격히 떨어지", "디스크 스케줄링 알고리즘\t디스크 스케줄링 알고리즘 (FCFS·SSTF·SCAN·C-SCAN·LOOK·C-LOOK)\t\t[운영체제] 디스크 스케줄링 알고리즘 (FCFS·SSTF·SCAN·C-SCAN·LOOK·C-LOOK): SSTF는 탐색 거리가 가장 짧은 트랙을 우선 처리하나 기아 현상이 발생할 수 있고,", "트랜잭션의 4대 특성(ACID)\t트랜잭션의 4대 특성(ACID)\t\t[데이터베이스] 트랜잭션의 4대 특성(ACID) (원자성(Atomicity)·일관성(Consistency)·고립성(Isolation)·지속성(Durability)): 트랜잭션의 연산은 모두", "관계형 데이터베이스 키(Key)의 종류와 무결성 제약조건\t관계형 데이터베이스 키(Key)의 종류와 무결성 제약조건 (슈퍼키(유일성)·후보키(유일성+최소성)·기본키(PK)·대체키·외래키(FK))\t\t[데이터베이스] 관계형 데이터베이스 키(Key)의 종류와 무결성 제약조건 (슈퍼키(유일성)·후보키(유일성+최소성)·기본키(PK)·대체키·외래키(FK)): 개체 무결성(기본키는 NULL이나 ", "함수적 종속성과 정규화(Normalization) 단계\t함수적 종속성과 정규화(Normalization) 단계 (도부이결다조(1NF→2NF→3NF→BCNF→4NF→5NF))\t\t[데이터베이스] 함수적 종속성과 정규화(Normalization) 단계 (도부이결다조(1NF→2NF→3NF→BCNF→4NF→5NF)): 1NF(도메인 원자값), 2NF(부분 함수 종속 제거", "SQL 분류(DDL·DML·DCL·TCL)\tSQL 분류(DDL·DML·DCL·TCL)\t\t[데이터베이스] SQL 분류(DDL·DML·DCL·TCL) (DDL(CREATE·ALTER·DROP·TRUNCATE), DML(SELECT·INSERT·UPDATE·DELETE), DCL(", "SQL 실행 순서와 GROUP BY · HAVING 절\tSQL 실행 순서와 GROUP BY · HAVING 절\t\t[데이터베이스] SQL 실행 순서와 GROUP BY · HAVING 절 (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY): WHERE 절은 ", "데이터베이스 인덱스(Index) 구조(B-Tree vs B+Tree vs Hash)\t데이터베이스 인덱스(Index) 구조(B-Tree vs B+Tree vs Hash)\t\t[데이터베이스] 데이터베이스 인덱스(Index) 구조(B-Tree vs B+Tree vs Hash) (B+Tree 인덱스는 리프 노드에만 데이터를 저장하고 리프 노드끼리 연결 리스트로 이어", "트랜잭션 격리 수준(Isolation Level) 4단계와 동시성 이상 현상\t트랜잭션 격리 수준(Isolation Level) 4단계와 동시성 이상 현상\t\t[데이터베이스] 트랜잭션 격리 수준(Isolation Level) 4단계와 동시성 이상 현상 (READ UNCOMMITTED → READ COMMITTED → REPEATABLE READ ", "회복(Recovery) 기법과 WAL(Write-Ahead Logging)·체크포인트\t회복(Recovery) 기법과 WAL(Write-Ahead Logging)·체크포인트 (로그 우선 기록(WAL) 원칙과 REDO(재실행)·UNDO(취소) 기법)\t\t[데이터베이스] 회복(Recovery) 기법과 WAL(Write-Ahead Logging)·체크포인트 (로그 우선 기록(WAL) 원칙과 REDO(재실행)·UNDO(취소) 기법): 데이터베이", "OSI 7계층 모델과 계층별 PDU·장비\tOSI 7계층 모델과 계층별 PDU·장비\t\t[네트워크] OSI 7계층 모델과 계층별 PDU·장비 (물리(Bit/허브)→데이터링크(Frame/스위치)→네트워크(Packet/라우터)→전송(Segment/L4스위치)→세션→표현→응용(Da", "TCP와 UDP의 차이 및 3-Way Handshake / 4-Way Handshake\tTCP와 UDP의 차이 및 3-Way Handshake / 4-Way Handshake\t\t[네트워크] TCP와 UDP의 차이 및 3-Way Handshake / 4-Way Handshake (TCP(연결지향·신뢰성·흐름/혼잡제어, SYN→SYN+ACK→ACK) vs UDP(비연", "TCP 혼잡 제어 알고리즘(Slow Start·AIMD·Fast Retransmit·Fast Recovery)\tTCP 혼잡 제어 알고리즘(Slow Start·AIMD·Fast Retransmit·Fast Recovery)\t\t[네트워크] TCP 혼잡 제어 알고리즘(Slow Start·AIMD·Fast Retransmit·Fast Recovery) (네트워크 혼잡 상황을 감지하여 송신 윈도우 크기(cwnd)를 지", "IPv4와 IPv6의 주소 체계 및 서브넷 마스크(CIDR)·NAT·ARP\tIPv4와 IPv6의 주소 체계 및 서브넷 마스크(CIDR)·NAT·ARP\t\t[네트워크] IPv4와 IPv6의 주소 체계 및 서브넷 마스크(CIDR)·NAT·ARP (IPv4(32비트, 4옥텟) vs IPv6(128비트, 16진수 8블록, 유니캐스트·멀티캐스트·애니", "라우팅 프로토콜(IGP: RIP·OSPF vs EGP: BGP)\t라우팅 프로토콜(IGP: RIP·OSPF vs EGP: BGP)\t\t[네트워크] 라우팅 프로토콜(IGP: RIP·OSPF vs EGP: BGP) (RIP(거리 벡터, 벨만-포드, 최대 15홉) vs OSPF(링크 상태, 다익스트라 최단경로) vs BGP(자", "HTTP 상태 코드 분류와 REST 아키텍처 제약조건\tHTTP 상태 코드 분류와 REST 아키텍처 제약조건\t\t[네트워크] HTTP 상태 코드 분류와 REST 아키텍처 제약조건 (1xx(정보)·2xx(성공: 200 OK, 201 Created)·3xx(리다이렉션: 301/302/304)·4xx(클라", "DNS 동작 원리와 HTTPS(TLS Handshake)\tDNS 동작 원리와 HTTPS(TLS Handshake)\t\t[네트워크] DNS 동작 원리와 HTTPS(TLS Handshake) (도메인 이름을 IP 주소로 변환하는 분산 계층형 시스템(DNS)과 대칭키+공개키 암호화를 결합해 전송 구간 기밀성·무", "정보보안의 3대 요소(CIA Triad)와 인증·부인방지\t정보보안의 3대 요소(CIA Triad)와 인증·부인방지\t\t[정보보안] 정보보안의 3대 요소(CIA Triad)와 인증·부인방지 (기밀성(Confidentiality)·무결성(Integrity)·가용성(Availability)): 인가된 사용자만 ", "대칭키 암호화(AES·DES·SEED·ARIA)와 공개키 암호화(RSA·ECC) 및 해시(SHA-256)\t대칭키 암호화(AES·DES·SEED·ARIA)와 공개키 암호화(RSA·ECC) 및 해시(SHA-256)\t\t[정보보안] 대칭키 암호화(AES·DES·SEED·ARIA)와 공개키 암호화(RSA·ECC) 및 해시(SHA-256) (대칭키(암·복호화 키 동일, 고속, 키 배송 문제) vs 공개키(암·", "웹 애플리케이션 주요 보안 취약점(SQL Injection·XSS·CSRF·SSRF)\t웹 애플리케이션 주요 보안 취약점(SQL Injection·XSS·CSRF·SSRF)\t\t[정보보안] 웹 애플리케이션 주요 보안 취약점(SQL Injection·XSS·CSRF·SSRF) (SQL Injection(Prepared Statement 바인딩으로 방어), XSS(악", "네트워크 공격 기법(DoS/DDoS·SYN Flooding·ARP Spoofing·Smurf·Land Attack)\t네트워크 공격 기법(DoS/DDoS·SYN Flooding·ARP Spoofing·Smurf·Land Attack)\t\t[정보보안] 네트워크 공격 기법(DoS/DDoS·SYN Flooding·ARP Spoofing·Smurf·Land Attack) (SYN Flooding(TCP 3-Way Handshake", "스택(Stack)·큐(Queue)·덱(Deque)·우선순위 큐(Heap)\t스택(Stack)·큐(Queue)·덱(Deque)·우선순위 큐(Heap)\t\t[자료구조·알고리즘] 스택(Stack)·큐(Queue)·덱(Deque)·우선순위 큐(Heap) (스택(LIFO: 후입선출, 재귀·DFS·괄호검사), 큐(FIFO: 선입선출, BFS·작업스케", "해시 테이블(Hash Table)과 해시 충돌(Collision) 해결 기법\t해시 테이블(Hash Table)과 해시 충돌(Collision) 해결 기법\t\t[자료구조·알고리즘] 해시 테이블(Hash Table)과 해시 충돌(Collision) 해결 기법 (개방 주소법(Open Addressing: 선형 탐사·이차 탐사·이중 해싱) vs 분리 ", "정렬 알고리즘의 시간 복잡도와 안정성(Stability)\t정렬 알고리즘의 시간 복잡도와 안정성(Stability) (O(N²): 버블·선택·삽입 정렬)\t\t[자료구조·알고리즘] 정렬 알고리즘의 시간 복잡도와 안정성(Stability) (O(N²): 버블·선택·삽입 정렬): O(N log N): 병합(Merge, 안정)·힙(Heap, 불안정)·", "이진 탐색(Binary Search)과 그래프 탐색(DFS vs BFS)\t이진 탐색(Binary Search)과 그래프 탐색(DFS vs BFS)\t\t[자료구조·알고리즘] 이진 탐색(Binary Search)과 그래프 탐색(DFS vs BFS) (이진 탐색(정렬된 배열에서 절반씩 범위를 좁혀 O(log N) 탐색), DFS(깊이 우선 탐", "최단 경로 알고리즘(다익스트라 vs 벨만-포드 vs 플로이드-워셜)\t최단 경로 알고리즘(다익스트라 vs 벨만-포드 vs 플로이드-워셜)\t\t[자료구조·알고리즘] 최단 경로 알고리즘(다익스트라 vs 벨만-포드 vs 플로이드-워셜) (다익스트라(음이 아닌 가중치, 우선순위 큐 O((V+E) log V)), 벨만-포드(음수 가중치 ", "최소 신장 트리(MST: Kruskal 알고리즘 vs Prim 알고리즘)\t최소 신장 트리(MST: Kruskal 알고리즘 vs Prim 알고리즘)\t\t[자료구조·알고리즘] 최소 신장 트리(MST: Kruskal 알고리즘 vs Prim 알고리즘) (N개의 정점을 사이클 없이 N-1개의 간선으로 최소 비용 연결하는 트리(Kruskal은 간선", "동적 계획법(DP)·분할 정복(Divide and Conquer)·그리디(Greedy)\t동적 계획법(DP)·분할 정복(Divide and Conquer)·그리디(Greedy)\t\t[자료구조·알고리즘] 동적 계획법(DP)·분할 정복(Divide and Conquer)·그리디(Greedy) (최적 부분 구조(Optimal Substructure)와 중복 부분 문제(Ov", "국제평화주의와 침략적 전쟁 부인\t국제평화주의와 침략적 전쟁 부인 (헌법 제5조 제1항)\t\t[헌법] 국제평화주의와 침략적 전쟁 부인 (헌법 제5조 제1항): 대한민국은 국제평화의 유지에 노력하고 침략적 전쟁을 부인하며 국군은 국가의 안전보장과 국토방위의 신성한 의무를 수행함", "조약의 국내법적 효력과 외국인 지위 보장\t조약의 국내법적 효력과 외국인 지위 보장 (헌법 제6조)\t\t[헌법] 조약의 국내법적 효력과 외국인 지위 보장 (헌법 제6조): 헌법에 의하여 체결·공포된 조약과 일반적으로 승인된 국제법규는 국내법과 같은 효력을 가지며 외국인은 국제법과 조약이 정하", "공무원 제도와 직업공무원제도·정치적 중립성\t공무원 제도와 직업공무원제도·정치적 중립성 (헌법 제7조)\t\t[헌법] 공무원 제도와 직업공무원제도·정치적 중립성 (헌법 제7조): 공무원은 국민 전체에 대한 봉사자이며 국민에 대하여 책임을 지고 신분과 정치적 중립성은 법률이 정하는 바에 의하여 보장", "정당 설립의 자유와 복수정당제·위헌정당해산제도\t정당 설립의 자유와 복수정당제·위헌정당해산제도 (헌법 제8조)\t\t[헌법] 정당 설립의 자유와 복수정당제·위헌정당해산제도 (헌법 제8조): 정당의 설립은 자유이며 복수정당제는 보장되고 정당의 목적이나 활동이 민주적 기본질서에 위배될 때에는 정부가 헌법재판", "전통문화의 계승·발전과 민족문화 창달 의무\t전통문화의 계승·발전과 민족문화 창달 의무 (헌법 제9조)\t\t[헌법] 전통문화의 계승·발전과 민족문화 창달 의무 (헌법 제9조): 국가는 전통문화의 계승·발전과 민족문화의 창달에 노력하여야 한다는 문화국가 원리의 헌법적 근거", "사법절차에서 진술할 권리와 신속한 재판을 받을 권리\t사법절차에서 진술할 권리와 신속한 재판을 받을 권리 (헌법 제27조 제3항·제5항)\t\t[헌법] 사법절차에서 진술할 권리와 신속한 재판을 받을 권리 (헌법 제27조 제3항·제5항): 모든 국민은 신속한 재판을 받을 권리를 가지며 형사피해자는 법률이 정하는 바에 의하여 당해 사", "납세의 의무와 국방의 의무\t납세의 의무와 국방의 의무 (헌법 제38조·제39조)\t\t[헌법] 납세의 의무와 국방의 의무 (헌법 제38조·제39조): 모든 국민은 법률이 정하는 바에 의하여 납세의 의무와 국방의 의무를 지며 누구든지 병역의무의 이행으로 인하여 불이익한 처우를", "국회의원 불체포특권과 면책특권\t국회의원 불체포특권과 면책특권 (헌법 제44조·제45조)\t\t[헌법] 국회의원 불체포특권과 면책특권 (헌법 제44조·제45조): 국회의원은 현행범인인 경우를 제외하고는 회기 중 국회의 동의 없이 체포·구금되지 아니하며 국회에서 직무상 행한 발언과 표", "법률안 거부권(대통령의 재의요구권)\t법률안 거부권(대통령의 재의요구권) (헌법 제53조)\t\t[헌법] 법률안 거부권(대통령의 재의요구권) (헌법 제53조): 대통령은 법률안에 이의가 있을 때에는 15일 이내에 이의서를 붙여 국회로 환부하고 재의를 요구할 수 있으며 재적의원 과반수 ", "국정감사권과 국정조사권\t국정감사권과 국정조사권 (헌법 제61조)\t\t[헌법] 국정감사권과 국정조사권 (헌법 제61조): 국회는 국정을 감사하거나 특정한 국정사안에 대하여 조사할 수 있으며 이에 필요한 서류의 제출 또는 증인의 출석과 증언이나 의견의 진술을 ", "탄핵소추권과 탄핵심판의 효과\t탄핵소추권과 탄핵심판의 효과 (헌법 제65조)\t\t[헌법] 탄핵소추권과 탄핵심판의 효과 (헌법 제65조): 대통령·국무총리·국무위원·법관 등이 직무집행에 있어서 헌법이나 법률을 위배한 때에는 국회가 탄핵소추를 의결할 수 있으며 탄핵소추 의", "국무회의의 헌법상 지위(심의기관)\t국무회의의 헌법상 지위(심의기관) (헌법 제88조·제89조)\t\t[헌법] 국무회의의 헌법상 지위(심의기관) (헌법 제88조·제89조): 국무회의는 정부의 권한에 속하는 중요한 정책을 심의하는 헌법상 필수 합의체 심의기관이며 대통령·국무총리와 15인 이상", "감사원의 헌법상 지위와 권한\t감사원의 헌법상 지위와 권한 (헌법 제97조~제100조)\t\t[헌법] 감사원의 헌법상 지위와 권한 (헌법 제97조~제100조): 대통령 소속하에 두되 직무에 관하여는 독립의 지위를 가지며 국가의 세입·세출의 결산 검사와 행정기관 및 공무원의 직무에 ", "법관의 임기와 신분보장\t법관의 임기와 신분보장 (헌법 제105조·제106조)\t\t[헌법] 법관의 임기와 신분보장 (헌법 제105조·제106조): 대법원장의 임기는 6년(중임 불가), 대법관 6년, 일반 법관 10년이며 법관은 탄핵 또는 금고 이상의 형의 선고에 의하지 ", "선거관리위원회의 독립성과 선거공영제\t선거관리위원회의 독립성과 선거공영제 (헌법 제114조·제116조)\t\t[헌법] 선거관리위원회의 독립성과 선거공영제 (헌법 제114조·제116조): 선거와 국민투표의 공정한 관리 및 정당에 관한 사무를 처리하기 위해 독립된 헌법기관으로 선거관리위원회를 두며 선", "지방자치제도와 조례제정권\t지방자치제도와 조례제정권 (헌법 제117조·제118조)\t\t[헌법] 지방자치제도와 조례제정권 (헌법 제117조·제118조): 지방자치단체는 주민의 복리에 관한 사무를 처리하고 재산을 관리하며 법령의 범위 안에서 자치에 관한 규정(조례·규칙)을 제정", "사회적 시장경제질서와 경제민주화\t사회적 시장경제질서와 경제민주화 (헌법 제119조 제1항·제2항)\t\t[헌법] 사회적 시장경제질서와 경제민주화 (헌법 제119조 제1항·제2항): 대한민국의 경제질서는 개인과 기업의 경제상의 자유와 창의를 존중함을 기본으로 하며(제1항), 국가는 균형 있는 ", "헌법개정 절차와 헌법 제128조 제2항(임기연장 개헌의 효력 제한)\t헌법개정 절차와 헌법 제128조 제2항(임기연장 개헌의 효력 제한)\t\t[헌법] 헌법개정 절차와 헌법 제128조 제2항(임기연장 개헌의 효력 제한) (국회 재적의원 과반수 또는 대통령의 발의 → 20일 이상 공고 → 국회 재적 3분의 2 이상 찬성 의결 → 3", "고의(미필적 고의)와 과실(인식 있는 과실)의 구별\t고의(미필적 고의)와 과실(인식 있는 과실)의 구별\t\t[형법] 고의(미필적 고의)와 과실(인식 있는 과실)의 구별 (결과의 발생 가능성을 인식하고도 이를 용인하는 내심의 의사(인용설)가 있으면 미필적 고의, 결과 발생 가능성을 인식하였으나 발", "원인에 있어서 자유로운 행위(Actio Libera in Causa)\t원인에 있어서 자유로운 행위(Actio Libera in Causa) (형법 제10조 제3항)\t\t[형법] 원인에 있어서 자유로운 행위(Actio Libera in Causa) (형법 제10조 제3항): 위험의 발생을 예견하고 자의로 심신장애(만취 등)를 야기한 자의 행위는 심신장애로 ", "사실의 착오(구성요건적 착오\t사실의 착오(구성요건적 착오 (구체적 부합설 vs 법정적 부합설))\t\t[형법] 사실의 착오(구성요건적 착오 (구체적 부합설 vs 법정적 부합설)): 인식한 범죄사실과 실제로 발생한 범죄사실이 일치하지 않는 경우(객체의 착오·방법의 착오):대법원 판례는 법정적", "법률의 착오(금지의 착오, 형법 제16조)\t법률의 착오(금지의 착오, 형법 제16조)\t\t[형법] 법률의 착오(금지의 착오, 형법 제16조) (자기의 행위가 법령에 의하여 죄가 되지 아니하는 것으로 오인한 행위는 그 오인에 정당한 이유가 있는 때에 한하여 벌하지 아니함): 단순", "기대가능성과 강요된 행위·초법규적 책임조각사유\t기대가능성과 강요된 행위·초법규적 책임조각사유\t\t[형법] 기대가능성과 강요된 행위·초법규적 책임조각사유 (행위 당시의 구체적 사정하에서 행위자에게 적법행위를 할 것을 기대할 수 없는 경우 책임이 조각된다는 이론): 저항할 수 없는 폭력이", "상상적 경합(형법 제40조)과 실체적 경합(경합범, 형법 제37조)\t상상적 경합(형법 제40조)과 실체적 경합(경합범, 형법 제37조)\t\t[형법] 상상적 경합(형법 제40조)과 실체적 경합(경합범, 형법 제37조) (한 개의 행위가 수 개의 죄에 해당하는 경우 가장 중한 죄에 정한 형으로 처벌(상상적 경합) vs 판결이 확정", "유스케이스 다이어그램(Use Case Diagram) 관계 3종\t유스케이스 다이어그램(Use Case Diagram) 관계 3종\t\t[정보처리기사·SW] 유스케이스 다이어그램(Use Case Diagram) 관계 3종 (포함(<<include>>, 필수 공통 실행) · 확장(<<extend>>, 특정 조건 충족 시 선택", "UML 클래스 다이어그램 관계(연관·집합·복합·의존·일반화·실체화)\tUML 클래스 다이어그램 관계(연관·집합·복합·의존·일반화·실체화) (집합(Aggregation, 빈 마름모)\t\t[정보처리기사·SW] UML 클래스 다이어그램 관계(연관·집합·복합·의존·일반화·실체화) (집합(Aggregation, 빈 마름모): 전체가 소멸해도 부분 독립 존재) vs 복합(Compo", "소프트웨어 아키텍처 패턴(계층화·클라이언트-서버·파이프-필터·MVC·브로커)\t소프트웨어 아키텍처 패턴(계층화·클라이언트-서버·파이프-필터·MVC·브로커)\t\t[정보처리기사·SW] 소프트웨어 아키텍처 패턴(계층화·클라이언트-서버·파이프-필터·MVC·브로커) (파이프-필터(데이터 스트림을 필터 컴포넌트들이 순차 변환, UNIX 쉘 파이프) · MV", "뷰(View)의 개념과 장단점\t뷰(View)의 개념과 장단점\t\t[정보처리기사·DB] 뷰(View)의 개념과 장단점 (하나 이상의 기본 테이블로부터 유도된 이름을 가진 가상 테이블(물리적 데이터 저장 없이 카탈로그에 SELECT 정의만 저장)): 논리적", "파티셔닝(Partitioning) 기법 4종\t파티셔닝(Partitioning) 기법 4종\t\t[정보처리기사·DB] 파티셔닝(Partitioning) 기법 4종 (범위 분할(Range)·해시 분할(Hash)·목록 분할(List)·조합 분할(Composite)): 대용량 테이블이나 인", "접근 통제 모델 3종(DAC · MAC · RBAC)\t접근 통제 모델 3종(DAC · MAC · RBAC) (임의적 접근통제(DAC)\t\t[정보처리기사·보안] 접근 통제 모델 3종(DAC · MAC · RBAC) (임의적 접근통제(DAC): 데이터 소유자가 권한 부여, GRANT/REVOKE) · 강제적 접근통제(MAC: 보", "[헌법 법원·명세] 헌법 제1조\t헌법 제1조\t\t[헌법] 국민주권주의와 민주공화국: 헌법 제1조 — 대한민국은 민주공화국이며 주권은 국민에게 있고 모든 권력은 국민으로부터 나온다는 헌법의 최고 기본 원리", "[헌법 법원·명세] 헌법 제10조\t헌법 제10조\t\t[헌법] 인간의 존엄과 가치 및 행복추구권: 헌법 제10조 — 모든 국민은 인간으로서의 존엄과 가치를 가지며 행복을 추구할 권리를 가지고 국가는 기본적 인권을 보장할 의무를 짐", "[헌법 법원·명세] 헌법 제11조\t헌법 제11조\t\t[헌법] 평등의 원칙과 차별 금지: 헌법 제11조 — 모든 국민은 법 앞에 평등하며 성별·종교 또는 사회적 신분에 의하여 정치적·경제적·사회적·문화적 생활의 모든 영역에서 차별받지 아니함", "[헌법 법원·명세] 헌법 제12조 제1항\t헌법 제12조 제1항\t\t[헌법] 신체의 자유와 적법절차의 원칙: 헌법 제12조 제1항 — 누구든지 법률과 적법한 절차에 의하지 아니하고는 체포·구속·압수·수색 또는 심문을 받지 아니하며 처벌·보안처분·강제노역을 ", "[헌법 법원·명세] 헌법 제12조 제2항\t헌법 제12조 제2항\t\t[헌법] 고문 금지와 진술거부권(묵비권): 헌법 제12조 제2항 — 모든 국민은 고문을 받지 아니하며 형사상 자기에게 불리한 진술을 강요당하지 아니하는 권리", "[헌법 법원·명세] 헌법 제12조 제3항\t헌법 제12조 제3항\t\t[헌법] 영장주의: 헌법 제12조 제3항 — 체포·구속·압수 또는 수색을 할 때에는 적법한 절차에 따라 검사의 신청에 의하여 법관이 발부한 영장을 제시하여야 하는 원칙", "[헌법 법원·명세] 헌법 제12조 제4항\t헌법 제12조 제4항\t\t[헌법] 변호인의 조력을 받을 권리와 국선변호인: 헌법 제12조 제4항 — 누구든지 체포 또는 구속을당한 때에는 즉시 변호인의 조력을 받을 권리를 가지며 형사피고인이 스스로 변호인을 구할 ", "[헌법 법원·명세] 헌법 제12조 제5항\t헌법 제12조 제5항\t\t[헌법] 미란다 원칙(체포·구속 이유 고지): 헌법 제12조 제5항 — 체포 또는 구속의 이유와 변호인의 조력을 받을 권리가 있음을 고지받지 아니하고는 체포 또는 구속을 당하지 아니함", "[헌법 법원·명세] 헌법 제12조 제6항\t헌법 제12조 제6항\t\t[헌법] 구속적부심사청구권: 헌법 제12조 제6항 — 누구든지 체포 또는 구속을 당한 때에는 적부의 심사를 법원에 청구할 권리를 가짐", "[헌법 법원·명세] 헌법 제12조 제7항\t헌법 제12조 제7항\t\t[헌법] 자백의 증거능력 제한과 보강법칙: 헌법 제12조 제7항 — 고문·폭행·협박·구속의 부당한 장기화 등으로 임의로 진술한 것이 아니라고 인정되는 자백이나 정식재판에서 피고인의 자백이 ", "[헌법 법원·명세] 헌법 제13조 제1항\t헌법 제13조 제1항\t\t[헌법] 죄형법정주의와 형벌불소급의 원칙: 헌법 제13조 제1항 — 모든 국민은 행위시의 법률에 의하여 범죄를 구성하지 아니하는 행위로 소추되지 아니함", "[헌법 법원·명세] 헌법 제13조 제1항 후단\t헌법 제13조 제1항 후단\t\t[헌법] 일사부재리의 원칙(이중처벌 금지): 헌법 제13조 제1항 후단 — 모든 국민은 동일한 범죄에 대하여 거듭 처벌받지 아니한다는 헌법상 원칙", "[헌법 법원·명세] 헌법 제13조 제2항\t헌법 제13조 제2항\t\t[헌법] 소급입법에 의한 참정권 제한 및 재산권 박탈 금지: 헌법 제13조 제2항 — 모든 국민은 소급입법에 의하여 참정권의 제한을 받거나 재산권을 박탈당하지 아니함", "[헌법 법원·명세] 헌법 제13조 제3항\t헌법 제13조 제3항\t\t[헌법] 연좌제 금지의 원칙: 헌법 제13조 제3항 — 모든 국민은 자기의 행위가 아닌 친족의 행위로 인하여 불이익한 처우를 받지 아니함", "[헌법 법원·명세] 헌법 제14조\t헌법 제14조\t\t[헌법] 거주·이전의 자유: 헌법 제14조 — 모든 국민은 거주·이전의 자유를 가짐", "[헌법 법원·명세] 헌법 제15조\t헌법 제15조\t\t[헌법] 직업선택의 자유: 헌법 제15조 — 모든 국민은 직업선택의 자유를 가지며 영업의 자유와 전직의 자유를 포함함", "[헌법 법원·명세] 헌법 제16조\t헌법 제16조\t\t[헌법] 주거의 자유: 헌법 제16조 — 모든 국민은 주거의 자유를 침해받지 아니하며 주거에 대한 압수나 수색에는 법관이 발부한 영장을 제시하여야 함", "[헌법 법원·명세] 헌법 제17조\t헌법 제17조\t\t[헌법] 사생활의 비밀과 자유 및 개인정보자기결정권: 헌법 제17조 — 모든 국민은 사생활의 비밀과 자유를 침해받지 아니하며 자신에 관한 정보가 언제 누구에게 어느 범위까지 알려지고 이용되", "[헌법 법원·명세] 헌법 제18조\t헌법 제18조\t\t[헌법] 통신의 비밀과 자유: 헌법 제18조 — 모든 국민은 통신의 비밀을 침해받지 아니함", "[헌법 법원·명세] 헌법 제19조\t헌법 제19조\t\t[헌법] 양심의 자유: 헌법 제19조 — 모든 국민은 양심의 자유를 가지며 내심의 윤리적 판단을 외부에 표명하도록 강제받지 않을 침묵의 자유를 포함함", "[헌법 법원·명세] 헌법 제20조\t헌법 제20조\t\t[헌법] 종교의 자유와 정교분리의 원칙: 헌법 제20조 — 모든 국민은 종교의 자유를 가지며 국교는 인정되지 아니하고 종교와 정치는 분리됨", "[헌법 법원·명세] 헌법 제21조\t헌법 제21조\t\t[헌법] 언론·출판·집회·결사의 자유와 사전검열·허가 금지: 헌법 제21조 — 언론·출판에 대한 허가나 검열과 집회·결사에 대한 허가는 인정되지 아니함", "[헌법 법원·명세] 헌법 제22조\t헌법 제22조\t\t[헌법] 학문과 예술의 자유: 헌법 제22조 — 모든 국민은 학문과 예술의 자유를 가지며 저작자·발명가·과학기술자와 예술가의 권리는 법률로써 보호함", "[헌법 법원·명세] 헌법 제23조\t헌법 제23조\t\t[헌법] 재산권의 보장과 공공복리 적합의무 및 정당보상: 헌법 제23조 — 모든 국민의 재산권은 보장되며 공공필요에 의한 재산권의 수용·사용 또는 제한 및 그에 대한 보상은 법률로써 하되 ", "[헌법 법원·명세] 헌법 제24조·제25조\t헌법 제24조·제25조\t\t[헌법] 선거권과 공무담임권: 헌법 제24조·제25조 — 모든 국민은 법률이 정하는 바에 의하여 선거권과 공무담임권을 가짐", "[헌법 법원·명세] 헌법 제26조\t헌법 제26조\t\t[헌법] 청원권: 헌법 제26조 — 모든 국민은 법률이 정하는 바에 의하여 국가기관에 문서로 청원할 권리를 가지며 국가는 청원에 대하여 심사할 의무를 짐", "[헌법 법원·명세] 헌법 제27조\t헌법 제27조\t\t[헌법] 재판청구권과 무죄추정의 원칙: 헌법 제27조 — 헌법과 법률이 정한 법관에 의하여 신속한 재판을 받을 권리를 가지며 형사피고인은 유죄의 판결이 확정될 때까지는 무죄로 추정됨", "[헌법 법원·명세] 헌법 제28조\t헌법 제28조\t\t[헌법] 형사보상청구권: 헌법 제28조 — 형사피의자 또는 형사피고인으로서 구금되었던 자가 법률이 정하는 불기소처분을 받거나 무죄판결을 받은 때에는 국가에 정당한 보상을 청구할 수 있음", "[헌법 법원·명세] 헌법 제29조\t헌법 제29조\t\t[헌법] 국가배상청구권: 헌법 제29조 — 공무원의 직무상 불법행위로 손해를 받은 국민은 법률이 정하는 바에 의하여 국가 또는 공공단체에 정당한 배상을 청구할 수 있음", "[헌법 법원·명세] 헌법 제30조\t헌법 제30조\t\t[헌법] 범죄피해자구조청구권: 헌법 제30조 — 타인의 범죄행위로 인하여 생명·신체에 대한 피해를 받은 국민은 법률이 정하는 바에 의하여 국가로부터 구조를 받을 수 있음", "[헌법 법원·명세] 헌법 제31조\t헌법 제31조\t\t[헌법] 교육을 받을 권리와 의무교육 무상 원칙: 헌법 제31조 — 모든 국민은 능력에 따라 균등하게 교육을 받을 권리를 가지며 의무교육은 무상으로 하고 교육의 자주성·전문성·정치적 중립성", "[헌법 법원·명세] 헌법 제32조·제33조\t헌법 제32조·제33조\t\t[헌법] 근로의 권리와 근로3권(단결권·단체교섭권·단체행동권): 헌법 제32조·제33조 — 근로자는 근로조건의 향상을 위하여 자주적인 단결권·단체교섭권 및 단체행동권을 가짐", "[헌법 법원·명세] 헌법 제34조\t헌법 제34조\t\t[헌법] 인간다운 생활을 할 권리(사회보장수급권): 헌법 제34조 — 모든 국민은 인간다운 생활을 할 권리를 가지며 국가는 사회보장·사회복지의 증진에 노력할 의무를 짐", "[헌법 법원·명세] 헌법 제35조\t헌법 제35조\t\t[헌법] 환경권: 헌법 제35조 — 모든 국민은 건강하고 쾌적한 환경에서 생활할 권리를 가지며 국가와 국민은 환경보전을 위하여 노력하여야 함", "[헌법 법원·명세] 헌법 제36조\t헌법 제36조\t\t[헌법] 혼인과 가족생활의 보장 및 보건권: 헌법 제36조 — 혼인과 가족생활은 개인의 존엄과 양성의 평등을 기초로 성립되고 유지되어야 하며 모든 국민은 보건에 관하여 국가의 보호를 받음", "[헌법 법원·명세] 헌법 제37조 제2항\t헌법 제37조 제2항\t\t[헌법] 과잉금지의 원칙(비례의 원칙): 헌법 제37조 제2항 — 국민의 모든 자유와 권리는 국가안전보장·질서유지 또는 공공복리를 위하여 필요한 경우에 한하여 법률로써 제한할 수 있으며 제", "[헌법 법원·명세] 헌법 제40조·제54조·제59조\t헌법 제40조·제54조·제59조\t\t[헌법] 국회의 입법권과 재정권(조세법률주의·예산심의권): 헌법 제40조·제54조·제59조 — 입법권은 국회에 속하며 조세의 종목과 세율은 법률로 정하고 국회는 국가의 예산안을 심의·확정함", "[헌법 법원·명세] 헌법 제66조·제76조·제77조\t헌법 제66조·제76조·제77조\t\t[헌법] 대통령의 지위와 긴급명령·계엄선포권: 헌법 제66조·제76조·제77조 — 대통령은 국가의 원수이며 행정권의 수반으로서 내우·외환 등 위기 시 긴급재정경제명령이나 계엄을 선포할 수 ", "[헌법 법원·명세] 헌법 제101조·제107조 제2항\t헌법 제101조·제107조 제2항\t\t[헌법] 사법권의 독립과 대법원의 위헌·위법 명령·규칙 심사권: 헌법 제101조·제107조 제2항 — 사법권은 법관으로 구성된 법원에 속하며 명령·규칙 또는 처분이 헌법이나 법률에 위반되는", "[헌법 법원·명세] 헌법 제111조\t헌법 제111조\t\t[헌법] 헌법재판소의 권한 5가지: 헌법 제111조 — 위헌법률심판, 탄핵심판, 정당해산심판, 국가기관 상호간·국가기관과 지자체 간 및 지자체 상호간의 권한쟁의심판, 헌법소원심판", "[민법 법원·명세] 민법 제2조\t민법 제2조\t\t[민법] 신의성실의 원칙과 권리남용 금지의 원칙: 민법 제2조 — 권리의 행사와 의무의 이행은 신의에 좇아 성실히 하여야 하며 권리는 남용하지 못한다는 민법 대원칙", "[민법 법원·명세] 민법 제3조~제17조\t민법 제3조~제17조\t\t[민법] 권리능력·의사능력·행위능력과 제한능력자 제도: 민법 제3조~제17조 — 미성년자·피성년후견인·피한정후견인의 법률행위는 법정대리인의 동의를 요하거나 취소할 수 있도록 하여 제한능력자", "[민법 법원·명세] 민법 제162조\t민법 제162조\t\t[민법] 소멸시효와 제척기간: 민법 제162조 — 권리자가 권리를 행사할 수 있음에도 일정 기간 행사하지 않으면 권리가 소멸하는 제도(일반채권 10년, 상사채권 5년)와 법률관계의 조속한 ", "[민법 법원·명세] 민법 제107조~제110조\t민법 제107조~제110조\t\t[민법] 비진의표시·통정허위표시·착오·사기·강박에 의한 의사표시: 민법 제107조~제110조 — 통정허위표시는 무효이나 선의의 제3자에게 대항하지 못하며, 중요부분의 착오나 사기·강박에 의", "[민법 법원·명세] 민법 제125조~제135조\t민법 제125조~제135조\t\t[민법] 무권대리와 표현대리: 민법 제125조~제135조 — 대리권 없이 한 행위는 본인이 추인하지 않으면 본인에게 효력이 없으나(무권대리), 외관상 대리권이 있는 것처럼 믿게 한 본인의 ", "[민법 법원·명세] 민법 제137조~제146조\t민법 제137조~제146조\t\t[민법] 법률행위의 무효와 취소: 민법 제137조~제146조 — 무효는 처음부터 당연히 효력이 없는 것이고 취소는 일단 유효하게 성립한 법률행위를 취소권자의 의사표시로 소급하여 무효로 만드", "[민법 법원·명세] 민법 제185조~제188조\t민법 제185조~제188조\t\t[민법] 물권법정주의와 공시의 원칙·공신의 원칙: 민법 제185조~제188조 — 물권은 법률 또는 관습법에 의하는 외에는 임의로 창설하지 못하며 부동산 물권변동은 등기, 동산은 인도(점유이", "[민법 법원·명세] 민법 제249조\t민법 제249조\t\t[민법] 선의취득(즉시취득): 민법 제249조 — 평온·공연하게 동산을 양수한 자가 선의이며 과실 없이 그 동산을 점유한 경우에는 양도인이 정당한 소유자가 아닌 때에도 즉시 그 동산의 소유", "[민법 법원·명세] 담보물권과 용익물권\t담보물권과 용익물권\t\t[민법] 저당권과 전세권·유치권·질권: 담보물권과 용익물권 — 채권 담보를 목적으로 목적물의 교환가치를 지배하는 담보물권(유치권·질권·저당권)과 사용·수익가치를 지배하는 용익물권(지상권·지", "[민법 법원·명세] 민법 제390조\t민법 제390조\t\t[민법] 채무불이행(이행지체·이행불능·불완전이행)과 손해배상: 민법 제390조 — 채무자가 채무의 내용에 좇은 이행을 하지 아니한 때에는 채권자는 손해배상을 청구할 수 있으나 채무자의 고의", "[민법 법원·명세] 민법 제404조·제406조\t민법 제404조·제406조\t\t[민법] 채권자대위권과 채권자취소권(사해행위취소권): 민법 제404조·제406조 — 채권자가 자기의 채권을 보전하기 위하여 채무자의 권리를 대신 행사하거나(대위권), 채무자가 채권자를 해함", "[민법 법원·명세] 민법 제536조·제537조\t민법 제536조·제537조\t\t[민법] 동시이행의 항변권과 위험부담: 민법 제536조·제537조 — 쌍무계약의 당사자 일방은 상대방이 그 채무이행을 제공할 때까지 자기의 채무이행을 거절할 수 있으며 당사자 쌍방의 책임 ", "[민법 법원·명세] 민법 제750조·제756조\t민법 제750조·제756조\t\t[민법] 불법행위의 성립요건과 사용자책임: 민법 제750조·제756조 — 고의 또는 과실로 인한 위법행위로 타인에게 손해를 가한 자는 손해를 배상할 책임이 있으며 타인을 사용하여 어느 사무", "[민법 법원·명세] 민법 제734조·제741조\t민법 제734조·제741조\t\t[민법] 부당이득반환청구권과 사무관리: 민법 제734조·제741조 — 법률상 원인 없이 타인의 재산 또는 노무로 인하여 이익을 얻고 이로 인하여 타인에게 손해를 가한 자는 그 이익을 반환하", "[형법 법원·명세] 관습형법 금지·소급효 금지·유추해석 금지·명확성의 원칙\t관습형법 금지·소급효 금지·유추해석 금지·명확성의 원칙\t\t[형법] 죄형법정주의의 파생 원칙 4가지: 관습형법 금지·소급효 금지·유추해석 금지·명확성의 원칙 — 범죄와 형벌은 반드시 성문의 법률로 명확하게 규정되어야 하며 피고인에게 불리한 소급적용", "[형법 법원·명세] 구성요건 해당성·위법성·책임\t구성요건 해당성·위법성·책임\t\t[형법] 범죄의 성립요건 3단계: 구성요건 해당성·위법성·책임 — 어떠한 행위가 범죄로 성립하기 위해서는 형법상 금지된 구성요건에 해당하고 위법성 조각사유가 없으며 행위자에게 비난가능성(책", "[형법 법원·명세] 정당행위·정당방위·긴급피난·자구행위·피해자의 승낙\t정당행위·정당방위·긴급피난·자구행위·피해자의 승낙\t\t[형법] 위법성 조각사유 5가지: 정당행위·정당방위·긴급피난·자구행위·피해자의 승낙 — 구성요건에 해당하는 행위라도 법질서 전체의 관점에서 정당화되어 위법성이 배제되는 사유(형법 제20조~", "[형법 법원·명세] 형법 제9조·제10조·제12조\t형법 제9조·제10조·제12조\t\t[형법] 책임조각사유(형사미성년자·심신상실자·강요된 행위): 형법 제9조·제10조·제12조 — 14세 되지 아니한 자의 행위, 심신장애로 사물을 변별하거나 의사를 결정할 능력이 없는 자의 ", "[형법 법원·명세] 형법 제25조~제28조\t형법 제25조~제28조\t\t[형법] 미수범(장애미수·중지미수·불능미수)과 예비·음모: 형법 제25조~제28조 — 범죄의 실행에 착수하여 행위를 종료하지 못하였거나 결과가 발생하지 아니한 때 처벌하되 자의로 중지한 때", "[형법 법원·명세] 형법 제30조~제34조\t형법 제30조~제34조\t\t[형법] 공범(공동정범·교사범·종범·간접정범): 형법 제30조~제34조 — 2인 이상이 공동하여 죄를 범한 때(공동정범), 타인을 교사하여 죄를 범하게 한 때(교사범), 타인의 범죄를 방조", "[형사소송법 법원·명세] 형사소송법 제308조의2\t형사소송법 제308조의2\t\t[형사소송법] 위법수집증거배제법칙과 독수과실이론: 형사소송법 제308조의2 — 적법한 절차에 따르지 아니하고 수집한 증거는 유죄의 증거로 할 수 없으며 그 위법한 증거에 기초하여 획득한 2", "[형사소송법 법원·명세] 형사소송법 제310조의2\t형사소송법 제310조의2\t\t[형사소송법] 전문법칙(전문증거의 증거능력 제한): 형사소송법 제310조의2 — 경험자의 진술을 전해 들은 전문진술이나 진술을 기재한 서류는 반대신문권이 보장되지 않으므로 원칙적으로 증거능", "[형사소송법 법원·명세] 형사소송법 제307조·제308조\t형사소송법 제307조·제308조\t\t[형사소송법] 자유심증주의와 합리적 의심 없는 증명의 원칙: 형사소송법 제307조·제308조 — 증거의 증명력은 법관의 자유판단에 의하되 논리와 경험칙에 합치해야 하며 범죄사실의 인정은 합", "[행정법 법원·명세] 법치행정의 원리\t법치행정의 원리\t\t[행정법] 법률유보의 원칙과 법률우위의 원칙: 법치행정의 원리 — 행정작용은 법률에 위반되어서는 안 되며(법률우위) 국민의 권리를 제한하거나 의무를 부과하는 침익적 행정작용 및 본질적 사항", "[행정법 법원·명세] 행정법의 일반원칙\t행정법의 일반원칙\t\t[행정법] 신뢰보호의 원칙과 자기구속의 원칙·부당결부금지의 원칙: 행정법의 일반원칙 — 행정청의 공적 견해표명에 대한 국민의 정당한 신뢰를 보호하고, 동종 사안에 대해 관행과 달리 차별 처", "[행정법 법원·명세] 행정행위의 분류\t행정행위의 분류\t\t[행정법] 기속행위와 재량행위 및 재량권의 일탈·남용: 행정행위의 분류 — 법률이 요건 충족 시 일의적 효과를 규정한 기속행위와 행정청에 복수의 행위 선택권을 부여한 재량행위로 나뉘며 재량", "[행정법 법원·명세] 행정행위의 효력\t행정행위의 효력\t\t[행정법] 행정행위의 공정력·구성요건적 효력·불가쟁력·불가변력: 행정행위의 효력 — 행정행위에 하자가 있더라도 당연무효가 아닌 한 권한 있는 기관이 취소할 때까지 유효한 것으로 통용되는 힘", "[행정법 법원·명세] 행정행위의 하자론\t행정행위의 하자론\t\t[행정법] 하자의 치유와 전환 및 무효와 취소의 구별(중대명백설): 행정행위의 하자론 — 행정처분이 당연무효가 되기 위해서는 그 하자가 법규의 중요한 부분을 위반한 중대한 것이고 객관적으로", "[행정소송법 법원·명세] 취소소송·무효등확인소송·부작위위법확인소송\t취소소송·무효등확인소송·부작위위법확인소송\t\t[행정소송법] 항고소송의 종류 3가지: 취소소송·무효등확인소송·부작위위법확인소송 — 행정청의 위법한 처분 등을 취소 또는 변경하는 소송(취소소송), 처분 등의 효력 유무 또는 존재 여부를 ", "[소프트웨어공학 법원·명세] SRP·OCP·LSP·ISP·DIP\tSRP·OCP·LSP·ISP·DIP\t\t[소프트웨어공학] 객체지향 설계 5대 원칙(SOLID): SRP·OCP·LSP·ISP·DIP — 단일 책임 원칙(SRP), 개방-폐쇄 원칙(OCP), 리스코프 치환 원칙(LSP), 인터페이", "[소프트웨어공학 법원·명세] 생성(Creational)·구조(Structural)·행위(Behav\t생성(Creational)·구조(Structural)·행위(Behavioral) 패턴\t\t[소프트웨어공학] GoF 디자인 패턴 3분류: 생성(Creational)·구조(Structural)·행위(Behavioral) 패턴 — Singleton·Factory Method·Buil", "[소프트웨어공학 법원·명세] 기능적→순차적→교환적→절차적→시간적→논리적→우연적 응집도\t기능적→순차적→교환적→절차적→시간적→논리적→우연적 응집도\t\t[소프트웨어공학] 응집도(Cohesion) 7단계 순서(강→약): 기능적→순차적→교환적→절차적→시간적→논리적→우연적 응집도 — 모듈 내부 구성요소들이 단일한 목적을 위해 긴밀하게 결합된 정", "[소프트웨어공학 법원·명세] 자료→스탬프→제어→외부→공통→내용 결합도\t자료→스탬프→제어→외부→공통→내용 결합도\t\t[소프트웨어공학] 결합도(Coupling) 6단계 순서(약→강): 자료→스탬프→제어→외부→공통→내용 결합도 — 모듈 간 상호 의존하는 정도로 자료(Data) 결합도가 가장 낮아 이상적이며 ", "[소프트웨어공학 법원·명세] V(G) = E - N + 2 (또는 조건 분기 수 + 1)\tV(G) = E - N + 2 (또는 조건 분기 수 + 1)\t\t[소프트웨어공학] 화이트박스 테스트와 기초 경로 테스트(McCabe 순환복잡도): V(G) = E - N + 2 (또는 조건 분기 수 + 1) — 모듈 내부 소스코드를 보며 문장·결정(분기", "[소프트웨어공학 법원·명세] 동치 분할·경계값 분석·원인-효과 그래프·오류 예측·비교 테스트\t동치 분할·경계값 분석·원인-효과 그래프·오류 예측·비교 테스트\t\t[소프트웨어공학] 블랙박스 테스트 기법 5가지: 동치 분할·경계값 분석·원인-효과 그래프·오류 예측·비교 테스트 — 내부 구조를 보지 않고 입력과 출력 명세만을 기반으로 기능을 검증하는 테", "[소프트웨어공학 법원·명세] 단위(Unit)→통합(Integration)→시스템(System)→인\t단위(Unit)→통합(Integration)→시스템(System)→인수(Acceptance) 테스트\t\t[소프트웨어공학] 소프트웨어 테스트 V-모델 단계: 단위(Unit)→통합(Integration)→시스템(System)→인수(Acceptance) 테스트 — 모듈(단위 설계), 아키텍처(통합", "[소프트웨어공학 법원·명세] Product Backlog·Sprint·Daily Scrum·Spr\tProduct Backlog·Sprint·Daily Scrum·Sprint Review·Retrospective\t\t[소프트웨어공학] 애자일(Agile) 선언문과 스크럼(Scrum) 프레임워크: Product Backlog·Sprint·Daily Scrum·Sprint Review·Retrospectiv", "[소프트웨어공학 법원·명세] 외부 동작을 바꾸지 않으면서 내부 코드 구조를 개선하는 작업\t외부 동작을 바꾸지 않으면서 내부 코드 구조를 개선하는 작업\t\t[소프트웨어공학] 리팩토링(Refactoring)과 기술 부채(Technical Debt): 외부 동작을 바꾸지 않으면서 내부 코드 구조를 개선하는 작업 — 소프트웨어의 기능(외부 동작)은", "[소프트웨어공학 법원·명세] Rolling·Blue-Green·Canary 배포\tRolling·Blue-Green·Canary 배포\t\t[소프트웨어공학] CI/CD(지속적 통합·지속적 배포)와 무중단 배포 전략: Rolling·Blue-Green·Canary 배포 — 코드 변경사항을 자동으로 빌드·테스트하여 통합(CI)하고", "[운영체제 법원·명세] 프로세스는 독립된 Code/Data/Heap/Stack 보유, 스레드\t프로세스는 독립된 Code/Data/Heap/Stack 보유, 스레드는 Stack만 독립이고 Code/Data/Heap 공유\t\t[운영체제] 프로세스(Process)와 스레드(Thread)의 메모리 구조 차이: 프로세스는 독립된 Code/Data/Heap/Stack 보유, 스레드는 Stack만 독립이고 Code/Da", "[운영체제 법원·명세] 비선점(FCFS·SJF·HRN) vs 선점(RR·SRT·MLQ·MLF\t비선점(FCFS·SJF·HRN) vs 선점(RR·SRT·MLQ·MLFQ)\t\t[운영체제] CPU 스케줄링 알고리즘(비선점 vs 선점): 비선점(FCFS·SJF·HRN) vs 선점(RR·SRT·MLQ·MLFQ) — HRN은 SJF의 기아(Starvation) 현상을 ", "[운영체제 법원·명세] 상호 배제(Mutual Exclusion)·점유와 대기(Hold an\t상호 배제(Mutual Exclusion)·점유와 대기(Hold and Wait)·비선점(No Preemption)·환형 대기(Circular Wait)\t\t[운영체제] 교착상태(Deadlock) 발생 필요충분조건 4가지: 상호 배제(Mutual Exclusion)·점유와 대기(Hold and Wait)·비선점(No Preemption)·환형 ", "[운영체제 법원·명세] 예방(Prevention)·회피(Avoidance, 은행원 알고리즘)\t예방(Prevention)·회피(Avoidance, 은행원 알고리즘)·탐지(Detection, 자원할당 그래프)·복구(Recovery)\t\t[운영체제] 교착상태 처리 기법 4가지: 예방(Prevention)·회피(Avoidance, 은행원 알고리즘)·탐지(Detection, 자원할당 그래프)·복구(Recovery) — 다익스트", "[운영체제 법원·명세] Mutex(이진 락)·Semaphore(P/V 연산 공유자원 카운터)\tMutex(이진 락)·Semaphore(P/V 연산 공유자원 카운터)·Monitor\t\t[운영체제] 상호배제와 동기화 도구(뮤텍스·세마포어·모니터): Mutex(이진 락)·Semaphore(P/V 연산 공유자원 카운터)·Monitor — 임계 구역(Critical Sectio", "[운영체제 법원·명세] 고정 크기 블록(Page/Frame, 내부 단편화) vs 가변 크기\t고정 크기 블록(Page/Frame, 내부 단편화) vs 가변 크기 논리 블록(Segment, 외부 단편화)\t\t[운영체제] 가상메모리 페이징(Paging)과 세그먼테이션(Segmentation): 고정 크기 블록(Page/Frame, 내부 단편화) vs 가변 크기 논리 블록(Segment, 외부 단", "[운영체제 법원·명세] LRU(가장 오랫동안 참조되지 않은 페이지 교체)와 Belady의 모\tLRU(가장 오랫동안 참조되지 않은 페이지 교체)와 Belady의 모순\t\t[운영체제] 페이지 교체 알고리즘(FIFO·OPT·LRU·LFU·NUR·Clock): LRU(가장 오랫동안 참조되지 않은 페이지 교체)와 Belady의 모순 — FIFO는 프레임 수를 늘려", "[운영체제 법원·명세] 프로세스 처리 시간보다 페이지 교체(Page Fault) 시간이 더\t프로세스 처리 시간보다 페이지 교체(Page Fault) 시간이 더 많아 CPU 이용률이 급격히 떨어지는 현상\t\t[운영체제] 스래싱(Thrashing)과 워킹셋(Working Set)·PFF 기법: 프로세스 처리 시간보다 페이지 교체(Page Fault) 시간이 더 많아 CPU 이용률이 급격히 떨어지", "[운영체제 법원·명세] FCFS·SSTF·SCAN·C-SCAN·LOOK·C-LOOK\tFCFS·SSTF·SCAN·C-SCAN·LOOK·C-LOOK\t\t[운영체제] 디스크 스케줄링 알고리즘: FCFS·SSTF·SCAN·C-SCAN·LOOK·C-LOOK — SSTF는 탐색 거리가 가장 짧은 트랙을 우선 처리하나 기아 현상이 발생할 수 있고,", "[데이터베이스 법원·명세] 원자성(Atomicity)·일관성(Consistency)·고립성(Is\t원자성(Atomicity)·일관성(Consistency)·고립성(Isolation)·지속성(Durability)\t\t[데이터베이스] 트랜잭션의 4대 특성(ACID): 원자성(Atomicity)·일관성(Consistency)·고립성(Isolation)·지속성(Durability) — 트랜잭션의 연산은 모두", "[데이터베이스 법원·명세] 슈퍼키(유일성)·후보키(유일성+최소성)·기본키(PK)·대체키·외래키(\t슈퍼키(유일성)·후보키(유일성+최소성)·기본키(PK)·대체키·외래키(FK)\t\t[데이터베이스] 관계형 데이터베이스 키(Key)의 종류와 무결성 제약조건: 슈퍼키(유일성)·후보키(유일성+최소성)·기본키(PK)·대체키·외래키(FK) — 개체 무결성(기본키는 NULL이나 ", "[데이터베이스 법원·명세] 도부이결다조(1NF→2NF→3NF→BCNF→4NF→5NF)\t도부이결다조(1NF→2NF→3NF→BCNF→4NF→5NF)\t\t[데이터베이스] 함수적 종속성과 정규화(Normalization) 단계: 도부이결다조(1NF→2NF→3NF→BCNF→4NF→5NF) — 1NF(도메인 원자값), 2NF(부분 함수 종속 제거", "[데이터베이스 법원·명세] DDL(CREATE·ALTER·DROP·TRUNCATE), DML(S\tDDL(CREATE·ALTER·DROP·TRUNCATE), DML(SELECT·INSERT·UPDATE·DELETE), DCL(GRANT·REVOKE), TCL(COMMIT·ROLLBACK·SAVEPOINT)\t\t[데이터베이스] SQL 분류(DDL·DML·DCL·TCL): DDL(CREATE·ALTER·DROP·TRUNCATE), DML(SELECT·INSERT·UPDATE·DELETE), DCL(", "[데이터베이스 법원·명세] FROM → WHERE → GROUP BY → HAVING → SEL\tFROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY\t\t[데이터베이스] SQL 실행 순서와 GROUP BY · HAVING 절: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY — WHERE 절은 ", "[데이터베이스 법원·명세] B+Tree 인덱스는 리프 노드에만 데이터를 저장하고 리프 노드끼리\tB+Tree 인덱스는 리프 노드에만 데이터를 저장하고 리프 노드끼리 연결 리스트로 이어져 범위 탐색(Range Scan)에 최적화된 구조\t\t[데이터베이스] 데이터베이스 인덱스(Index) 구조(B-Tree vs B+Tree vs Hash): B+Tree 인덱스는 리프 노드에만 데이터를 저장하고 리프 노드끼리 연결 리스트로 이어", "[데이터베이스 법원·명세] READ UNCOMMITTED → READ COMMITTED → RE\tREAD UNCOMMITTED → READ COMMITTED → REPEATABLE READ → SERIALIZABLE\t\t[데이터베이스] 트랜잭션 격리 수준(Isolation Level) 4단계와 동시성 이상 현상: READ UNCOMMITTED → READ COMMITTED → REPEATABLE READ ", "[데이터베이스 법원·명세] 로그 우선 기록(WAL) 원칙과 REDO(재실행)·UNDO(취소) 기\t로그 우선 기록(WAL) 원칙과 REDO(재실행)·UNDO(취소) 기법\t\t[데이터베이스] 회복(Recovery) 기법과 WAL(Write-Ahead Logging)·체크포인트: 로그 우선 기록(WAL) 원칙과 REDO(재실행)·UNDO(취소) 기법 — 데이터베이", "[네트워크 법원·명세] 물리(Bit/허브)→데이터링크(Frame/스위치)→네트워크(Packe\t물리(Bit/허브)→데이터링크(Frame/스위치)→네트워크(Packet/라우터)→전송(Segment/L4스위치)→세션→표현→응용(Data/L7)\t\t[네트워크] OSI 7계층 모델과 계층별 PDU·장비: 물리(Bit/허브)→데이터링크(Frame/스위치)→네트워크(Packet/라우터)→전송(Segment/L4스위치)→세션→표현→응용(Da", "[네트워크 법원·명세] TCP(연결지향·신뢰성·흐름/혼잡제어, SYN→SYN+ACK→ACK)\tTCP(연결지향·신뢰성·흐름/혼잡제어, SYN→SYN+ACK→ACK) vs UDP(비연결형·고속·헤더 8바이트)\t\t[네트워크] TCP와 UDP의 차이 및 3-Way Handshake / 4-Way Handshake: TCP(연결지향·신뢰성·흐름/혼잡제어, SYN→SYN+ACK→ACK) vs UDP(비연", "[네트워크 법원·명세] 네트워크 혼잡 상황을 감지하여 송신 윈도우 크기(cwnd)를 지수적\t네트워크 혼잡 상황을 감지하여 송신 윈도우 크기(cwnd)를 지수적 증가(Slow Start) 후 임계치부터 선형 증가·반감(AIMD)시키는 기법\t\t[네트워크] TCP 혼잡 제어 알고리즘(Slow Start·AIMD·Fast Retransmit·Fast Recovery): 네트워크 혼잡 상황을 감지하여 송신 윈도우 크기(cwnd)를 지", "[네트워크 법원·명세] IPv4(32비트, 4옥텟) vs IPv6(128비트, 16진수 8블\tIPv4(32비트, 4옥텟) vs IPv6(128비트, 16진수 8블록, 유니캐스트·멀티캐스트·애니캐스트)\t\t[네트워크] IPv4와 IPv6의 주소 체계 및 서브넷 마스크(CIDR)·NAT·ARP: IPv4(32비트, 4옥텟) vs IPv6(128비트, 16진수 8블록, 유니캐스트·멀티캐스트·애니", "[네트워크 법원·명세] RIP(거리 벡터, 벨만-포드, 최대 15홉) vs OSPF(링크 상\tRIP(거리 벡터, 벨만-포드, 최대 15홉) vs OSPF(링크 상태, 다익스트라 최단경로) vs BGP(자율시스템 AS 간 경로 벡터 프로토콜)\t\t[네트워크] 라우팅 프로토콜(IGP: RIP·OSPF vs EGP: BGP): RIP(거리 벡터, 벨만-포드, 최대 15홉) vs OSPF(링크 상태, 다익스트라 최단경로) vs BGP(자", "[네트워크 법원·명세] 1xx(정보)·2xx(성공: 200 OK, 201 Created)·3\t1xx(정보)·2xx(성공: 200 OK, 201 Created)·3xx(리다이렉션: 301/302/304)·4xx(클라이언트 오류: 400/401/403/404)·5xx(서버 오류: 500/502/503)\t\t[네트워크] HTTP 상태 코드 분류와 REST 아키텍처 제약조건: 1xx(정보)·2xx(성공: 200 OK, 201 Created)·3xx(리다이렉션: 301/302/304)·4xx(클라", "[네트워크 법원·명세] 도메인 이름을 IP 주소로 변환하는 분산 계층형 시스템(DNS)과 대\t도메인 이름을 IP 주소로 변환하는 분산 계층형 시스템(DNS)과 대칭키+공개키 암호화를 결합해 전송 구간 기밀성·무결성·서버 인증을 제공하는 HTTPS\t\t[네트워크] DNS 동작 원리와 HTTPS(TLS Handshake): 도메인 이름을 IP 주소로 변환하는 분산 계층형 시스템(DNS)과 대칭키+공개키 암호화를 결합해 전송 구간 기밀성·무", "[정보보안 법원·명세] 기밀성(Confidentiality)·무결성(Integrity)·가용\t기밀성(Confidentiality)·무결성(Integrity)·가용성(Availability)\t\t[정보보안] 정보보안의 3대 요소(CIA Triad)와 인증·부인방지: 기밀성(Confidentiality)·무결성(Integrity)·가용성(Availability) — 인가된 사용자만 ", "[정보보안 법원·명세] 대칭키(암·복호화 키 동일, 고속, 키 배송 문제) vs 공개키(암·\t대칭키(암·복호화 키 동일, 고속, 키 배송 문제) vs 공개키(암·복호화 키 분리, 수학적 난제 기반, 전자서명 및 키 교환) vs 단방향 해시(무결성 검증, 복호화 불가)\t\t[정보보안] 대칭키 암호화(AES·DES·SEED·ARIA)와 공개키 암호화(RSA·ECC) 및 해시(SHA-256): 대칭키(암·복호화 키 동일, 고속, 키 배송 문제) vs 공개키(암·", "[정보보안 법원·명세] SQL Injection(Prepared Statement 바인딩으로\tSQL Injection(Prepared Statement 바인딩으로 방어), XSS(악성 스크립트 삽입, 출력 이스케이프·CSP로 방어), CSRF(위조 요청, CSRF 토큰·SameSite 쿠키로 방어), SSRF(서버측 요청 위조, 내부망 IP 차단으로 방어)\t\t[정보보안] 웹 애플리케이션 주요 보안 취약점(SQL Injection·XSS·CSRF·SSRF): SQL Injection(Prepared Statement 바인딩으로 방어), XSS(악", "[정보보안 법원·명세] SYN Flooding(TCP 3-Way Handshake 미완료로\tSYN Flooding(TCP 3-Way Handshake 미완료로 백로그 큐 고갈), ARP Spoofing(MAC 주소 위장으로 패킷 가로채기 스니핑), DDoS(분산 좀비 PC를 통한 대량 트래픽 공격)\t\t[정보보안] 네트워크 공격 기법(DoS/DDoS·SYN Flooding·ARP Spoofing·Smurf·Land Attack): SYN Flooding(TCP 3-Way Handshake", "[자료구조·알고리즘 법원·명세] 스택(LIFO: 후입선출, 재귀·DFS·괄호검사), 큐(FIFO: 선\t스택(LIFO: 후입선출, 재귀·DFS·괄호검사), 큐(FIFO: 선입선출, BFS·작업스케줄링), 힙(완전이진트리 기반 O(log N) 삽입·삭제 우선순위 큐)\t\t[자료구조·알고리즘] 스택(Stack)·큐(Queue)·덱(Deque)·우선순위 큐(Heap): 스택(LIFO: 후입선출, 재귀·DFS·괄호검사), 큐(FIFO: 선입선출, BFS·작업스케", "[자료구조·알고리즘 법원·명세] 개방 주소법(Open Addressing: 선형 탐사·이차 탐사·이중\t개방 주소법(Open Addressing: 선형 탐사·이차 탐사·이중 해싱) vs 분리 연결법(Separate Chaining: 연결 리스트/트리 체이닝)\t\t[자료구조·알고리즘] 해시 테이블(Hash Table)과 해시 충돌(Collision) 해결 기법: 개방 주소법(Open Addressing: 선형 탐사·이차 탐사·이중 해싱) vs 분리 ", "[자료구조·알고리즘 법원·명세] O(N²): 버블·선택·삽입 정렬\tO(N²): 버블·선택·삽입 정렬\t\t[자료구조·알고리즘] 정렬 알고리즘의 시간 복잡도와 안정성(Stability): O(N²): 버블·선택·삽입 정렬 — O(N log N): 병합(Merge, 안정)·힙(Heap, 불안정)·", "[자료구조·알고리즘 법원·명세] 이진 탐색(정렬된 배열에서 절반씩 범위를 좁혀 O(log N) 탐색)\t이진 탐색(정렬된 배열에서 절반씩 범위를 좁혀 O(log N) 탐색), DFS(깊이 우선 탐색, 스택/재귀), BFS(너비 우선 탐색, 큐, 비가중치 최단 경로 보장)\t\t[자료구조·알고리즘] 이진 탐색(Binary Search)과 그래프 탐색(DFS vs BFS): 이진 탐색(정렬된 배열에서 절반씩 범위를 좁혀 O(log N) 탐색), DFS(깊이 우선 탐", "[자료구조·알고리즘 법원·명세] 다익스트라(음이 아닌 가중치, 우선순위 큐 O((V+E) log V)\t다익스트라(음이 아닌 가중치, 우선순위 큐 O((V+E) log V)), 벨만-포드(음수 가중치 및 음수 사이클 판별 O(VE)), 플로이드-워셜(모든 정점 쌍 최단 경로 DP O(V³))\t\t[자료구조·알고리즘] 최단 경로 알고리즘(다익스트라 vs 벨만-포드 vs 플로이드-워셜): 다익스트라(음이 아닌 가중치, 우선순위 큐 O((V+E) log V)), 벨만-포드(음수 가중치 ", "[자료구조·알고리즘 법원·명세] N개의 정점을 사이클 없이 N-1개의 간선으로 최소 비용 연결하는 트\tN개의 정점을 사이클 없이 N-1개의 간선으로 최소 비용 연결하는 트리(Kruskal은 간선 정렬+Union-Find, Prim은 정점 확장+우선순위 큐)\t\t[자료구조·알고리즘] 최소 신장 트리(MST: Kruskal 알고리즘 vs Prim 알고리즘): N개의 정점을 사이클 없이 N-1개의 간선으로 최소 비용 연결하는 트리(Kruskal은 간선", "[자료구조·알고리즘 법원·명세] 최적 부분 구조(Optimal Substructure)와 중복 부분\t최적 부분 구조(Optimal Substructure)와 중복 부분 문제(Overlapping Subproblems)를 메모이제이션/타뷸레이션으로 해결하는 DP vs 지역적 최선의 선택이 전역 최적해를 보장할 때 쓰는 그리디\t\t[자료구조·알고리즘] 동적 계획법(DP)·분할 정복(Divide and Conquer)·그리디(Greedy): 최적 부분 구조(Optimal Substructure)와 중복 부분 문제(Ov", "[헌법 법원·명세] 헌법 제5조 제1항\t헌법 제5조 제1항\t\t[헌법] 국제평화주의와 침략적 전쟁 부인: 헌법 제5조 제1항 — 대한민국은 국제평화의 유지에 노력하고 침략적 전쟁을 부인하며 국군은 국가의 안전보장과 국토방위의 신성한 의무를 수행함", "[헌법 법원·명세] 헌법 제6조\t헌법 제6조\t\t[헌법] 조약의 국내법적 효력과 외국인 지위 보장: 헌법 제6조 — 헌법에 의하여 체결·공포된 조약과 일반적으로 승인된 국제법규는 국내법과 같은 효력을 가지며 외국인은 국제법과 조약이 정하"]};
  const _PARSED_SUBJECT_BANK_CACHE = {};

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
        sentence = ctx || `Practice using {{c1::${term}}} in context.`;
        prompt = `【 ${term} 】`;
      } else if (isHanja) {
        prompt = ctx || `【 ${term} 】`;
        sentence = `${prompt} ➔ {{c1::${answer}}}`;
      } else {
        const maskedTip = maskTermInDescJs(explain || ctx || term, term);
        prompt = maskedTip.endsWith("?") ? maskedTip : `${maskedTip} — 해당 개념은?`;
        sentence = `${maskedTip} ➔ {{c1::${answer}}}`;
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
    const cleanPrompt = String(item.prompt || "")
      .replace(/\s*—\s*다음\s*어휘·표현의\s*문맥\s*속\s*정확한\s*뜻은\??/g, "")
      .replace(/\s*—\s*위\s*설명에\s*해당하는\s*[^?]+\?/g, " — 해당 개념은?")
      .trim();

    const lv1Front = cleanPrompt
      ? `${isGrammar ? "[핵심 문법]" : "[Lv.1 개념]"} ${cleanPrompt}`
      : `[Lv.1 개념] ${item.term}`;
    const lv1Back = formatConciseBackJs(item.answer, item.explain, item.term);

    const rawSent = item.sentence ? String(item.sentence).trim() : "";
    const hasBlankMarker = /\{\{c\d+::|\[\s*_{2,}\s*\]|\[\s*\.{3}\s*\]/.test(rawSent);
    let lv2Clause = "";
    if (rawSent) {
      if (hasBlankMarker) {
        lv2Clause = rawSent;
      } else {
        const maskedSent = maskTermInDescJs(rawSent, item.term || item.answer);
        lv2Clause = maskedSent !== rawSent ? maskedSent : `${rawSent} ➔ {{c1::${item.answer}}}`;
      }
    } else {
      lv2Clause = `${cleanPrompt || item.term} ➔ {{c1::${item.answer}}}`;
    }
    const lv2Front = `${isGrammar ? "[문법 빈칸]" : "[Lv.2 빈칸]"} ${lv2Clause}`;
    const lv2Back = formatConciseBackJs(item.answer, item.explain, item.term);

    const isFactPrompt = Boolean(cleanPrompt && (item.term === item.answer || isGrammar));
    const lv3Front = isFactPrompt
      ? `${isGrammar ? "[심화 문법]" : "[Lv.3 심화]"} ${cleanPrompt}`
      : `[Lv.3 역방향] ${item.answer}`;
    const lv3Back = isFactPrompt
      ? formatConciseBackJs(item.answer, item.explain, item.term)
      : formatConciseBackJs(item.term, item.explain, item.term);

    const cLv1 = {
      front_text: lv1Front,
      back_text: lv1Back,
      note_type: "basic",
      tags: baseTags.concat(["diff_lv1"]),
    };
    const cLv2 = {
      front_text: lv2Front,
      back_text: lv2Back,
      note_type: "cloze",
      tags: baseTags.concat(["diff_lv2"]),
    };
    const cLv3 = {
      front_text: lv3Front,
      back_text: lv3Back,
      note_type: "basic",
      tags: baseTags.concat(["diff_lv3"]),
    };

    if (diff === "lv1" || diff === "standard") return [cLv1];
    if (diff === "lv2") return [cLv2];
    if (diff === "lv3") return [cLv3];
    if (diff === "mixed" || diff === "all") return [cLv1, cLv2, cLv3];
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

  function getSubjectPureSeedPool(subj, seedItems) {
    const cleanSeeds = Array.isArray(seedItems) ? seedItems.filter(Boolean) : [];
    const sameSubjectCollections = STANDALONE_COLLECTIONS.filter((c) => {
      const cid = String(c.collection_id || "").toLowerCase();
      if (subj === "hanja") return /hanja|idiom/.test(cid);
      if (subj === "history") return /khist|hist/.test(cid);
      if (subj === "math") return /math/.test(cid);
      if (subj === "science") return /sci/.test(cid);
      if (subj === "korean") return /kor|dictation/.test(cid);
      if (subj === "law_it") return /law|cert/.test(cid);
      return /eng|toeic|jlpt/.test(cid);
    }).reduce((acc, c) => acc.concat(c.items || []), []);

    const sameSubjectTextbooks = STANDALONE_TEXTBOOKS.filter((tb) => {
      const tid = String(tb.textbook_id || "").toLowerCase();
      if (subj === "history") return /hist/.test(tid);
      if (subj === "science") return /sci/.test(tid);
      if (subj === "english") return /eng/.test(tid);
      return false;
    }).reduce((acc, tb) => acc.concat(tb.entries || []), []);

    const authenticExtras = getAuthenticSubjectBankItems(subj);
    const merged = cleanSeeds.concat(sameSubjectCollections).concat(sameSubjectTextbooks).concat(authenticExtras);
    const seen = new Set();
    const deduped = [];
    merged.forEach((it) => {
      const k = String((it && (it.term || it.id)) || "").trim().toLowerCase();
      if (k && !seen.has(k)) {
        seen.add(k);
        deduped.push(it);
      }
    });
    return deduped.length > 0 ? deduped : cleanSeeds;
  }

  function padStandaloneSpecsToTarget(seedItems, sourceTag, difficultyLevel, targetCount) {
    const cap = Math.max(1, Number(targetCount || 1000));
    const subj = detectSubjectCategoryFromTag(sourceTag, seedItems);
    const pool = getSubjectPureSeedPool(subj, seedItems);
    const specs = [];
    const seenFronts = new Set();
    const n = Math.max(1, pool.length);

    const facetLabels = [
      { prefix: "[Lv.1 개념]", tag: "diff_lv1", mode: "prompt" },
      { prefix: "[Lv.2 빈칸]", tag: "diff_lv2", mode: "context" },
      { prefix: "[Lv.3 역방향]", tag: "diff_lv3", mode: "reverse" },
      { prefix: "[Lv.2 문맥적용]", tag: "diff_lv2", mode: "application" },
      { prefix: "[Lv.3 핵심변별]", tag: "diff_lv3", mode: "exam_focus" },
    ];

    let step = 0;
    const maxSteps = Math.max(cap * 3, n * facetLabels.length * 2);
    while (specs.length < cap && step < maxSteps) {
      const baseIdx = step % n;
      const base = pool[baseIdx] || { id: `item_${step + 1}`, term: `핵심 개념 ${step + 1}`, answer: "정답", explain: "필수 학습 개념" };
      const facetIdx = Math.floor(step / n) % facetLabels.length;
      const facet = facetLabels[facetIdx];
      const itemNo = specs.length + 1;
      const isNonVocab = subj !== "english";
      const roleTag = `role:${base.role || (isNonVocab ? "core_concept" : "core_vocab")}`;
      const conceptTag = `concept:${sourceTag || subj}_fact_${itemNo}`;
      const rootConceptTag = `root_concept:${sourceTag || subj}_root_${baseIdx + 1}`;
      const rawPrompt = String(base.prompt || base.term)
        .replace(/\s*—\s*다음\s*어휘·표현의\s*문맥\s*속\s*정확한\s*뜻은\??/g, "")
        .replace(/\s*—\s*위\s*설명에\s*해당하는\s*[^?]+\?/g, " — 해당 개념은?")
        .replace(String(base.answer || ""), "[ ___ ]")
        .trim();

      let frontText = "";
      let backText = formatConciseBackJs(base.answer, base.explain, base.term);
      if (facet.mode === "prompt") {
        frontText = `${facet.prefix} ${rawPrompt || base.term}`;
      } else if (facet.mode === "context") {
        let cleanSent = base.sentence
          ? String(base.sentence).replace(/\{\{c\d+::([^:}]+)(?:::[^}]+)?\}\} /g, "[ ___ ] ").replace(/\{\{c\d+::([^:}]+)(?:::[^}]+)?\}\}/g, "[ ___ ]")
          : "";
        if (!cleanSent || !cleanSent.includes("[ ___ ]")) {
          const masked = maskTermInDescJs(cleanSent || base.explain || rawPrompt, base.term || base.answer);
          cleanSent = masked.includes("[ ___ ]") ? masked : `${rawPrompt || base.term} ➔ [ ___ ]`;
        }
        frontText = `${facet.prefix} ${cleanSent}`;
      } else if (facet.mode === "reverse") {
        const cueRaw = base.explain && base.explain !== base.answer ? maskTermInDescJs(base.explain, base.term) : base.answer;
        frontText = `${facet.prefix} ${cueRaw} — 핵심 표제어·정답은?`;
        backText = formatConciseBackJs(base.term === base.answer ? base.answer : base.term, base.explain || base.answer, base.term);
      } else if (facet.mode === "application") {
        const appCue = base.explain ? maskTermInDescJs(base.explain, base.term) : rawPrompt;
        frontText = isNonVocab
          ? `${facet.prefix} ${appCue} (적용 원리: 【 ${base.term !== base.answer ? base.term : "핵심 개념"} 】)`
          : `${facet.prefix} 【 ${base.term} 】 — 문맥 속 의미와 쓰임은?`;
      } else {
        const focusCue = base.sentence
          ? String(base.sentence).replace(/\{\{c\d+::([^:}]+)(?:::[^}]+)?\}\}/g, "[ ___ ]")
          : rawPrompt;
        frontText = `${facet.prefix} ${focusCue} (핵심 개념 확인: ${base.term !== base.answer ? base.term : "#" + (baseIdx + 1)})`;
      }

      if (seenFronts.has(frontText)) {
        frontText = `${frontText} [문항 #${itemNo}]`;
      }
      seenFronts.add(frontText);

      specs.push({
        fact_key: `${sourceTag || subj}_${itemNo}`,
        front_text: frontText,
        back_text: backText,
        note_type: facet.mode === "context" ? "cloze" : "basic",
        tags: [sourceTag || "full_scale", conceptTag, rootConceptTag, roleTag, facet.tag],
      });
      step += 1;
    }
    return specs.slice(0, cap);
  }

  function createStandaloneEngine(customStorage) {
    const STORAGE_KEY = "braindeck_standalone_v56_db";
    const storageObj = customStorage || (typeof localStorage !== "undefined" ? localStorage : null);
    let memoryDbRaw = null;

    function loadDb() {
      if (memoryDbRaw) {
        try {
          const parsedMem = JSON.parse(memoryDbRaw);
          if (parsedMem && Array.isArray(parsedMem.decks) && Array.isArray(parsedMem.cards)) {
            return parsedMem;
          }
        } catch (_e) {
          // ignore
        }
      }
      if (storageObj) {
        try {
          const raw = storageObj.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.decks) && Array.isArray(parsed.cards)) {
              return parsed;
            }
          }
        } catch (_e) {
          // ignore
        }
      }
      // Seed initial starter deck so Apple/Web users can study immediately on first launch!
      const seedCards = [];
      let nextCardId = 1;
      const engStarterItems = STANDALONE_TEXTBOOKS[0].entries.slice(0, 4).map((it) => ({
        item: it,
        srcTag: "textbook:mid1-eng-neungyul-kim",
      }));
      const histStarterItems = STANDALONE_COLLECTIONS[3].items.slice(0, 3).map((it) => ({
        item: it,
        srcTag: "khist:essential",
      }));
      engStarterItems.concat(histStarterItems).forEach(({ item: it, srcTag }) => {
        const expanded = expandStandaloneItemByDifficulty(it, srcTag, "lv1");
        expanded.forEach((spec) => {
          seedCards.push({
            card_id: nextCardId++,
            deck_id: 1,
            deck_name: "🚀 브레인덱 스타터 덱 (영어·한국사 핵심)",
            front_text: spec.front_text,
            back_text: spec.back_text,
            note_type: spec.note_type,
            tags: spec.tags,
            state: "new",
            reps: 0,
            lapses: 0,
            stability: 1.2,
            difficulty: 5.0,
            due_at: new Date().toISOString(),
          });
        });
      });

      const initialDb = {
        nextDeckId: 2,
        nextCardId,
        decks: [
          {
            deck_id: 1,
            name: "🚀 브레인덱 스타터 덱 (영어·한국사 핵심)",
            description: "아이폰·아이패드·웹 즉시 학습용 기본 탑재 덱",
          },
        ],
        cards: seedCards,
        reviewHistory: [],
      };
      saveDb(initialDb);
      return initialDb;
    }

    let lastSaveStatus = { ok: true, compacted: false, error: null };

    function _mirrorToIndexedDbAsync(rawJson) {
      if (typeof indexedDB === "undefined" || !indexedDB || typeof indexedDB.open !== "function") return;
      try {
        const req = indexedDB.open("braindeck_idb_v70", 1);
        req.onupgradeneeded = function (ev) {
          const idb = ev.target.result;
          if (!idb.objectStoreNames.contains("snapshots")) {
            idb.createObjectStore("snapshots");
          }
        };
        req.onsuccess = function (ev) {
          try {
            const idb = ev.target.result;
            const tx = idb.transaction("snapshots", "readwrite");
            tx.objectStore("snapshots").put(rawJson, STORAGE_KEY);
          } catch (_txErr) {
            // ignore IDB write error
          }
        };
      } catch (_idbErr) {
        // ignore IDB open error
      }
    }

    function saveDb(db) {
      let serialized = JSON.stringify(db);
      memoryDbRaw = serialized;
      if (storageObj) {
        try {
          storageObj.setItem(STORAGE_KEY, serialized);
          lastSaveStatus = { ok: true, compacted: false, error: null };
        } catch (quotaErr) {
          try {
            if (Array.isArray(db.reviewHistory) && db.reviewHistory.length > 200) {
              db.reviewHistory = db.reviewHistory.slice(-200).map((h) => {
                const copy = Object.assign({}, h);
                delete copy.prev_review_events;
                return copy;
              });
            }
            if (Array.isArray(db.cards)) {
              db.cards.forEach((c) => {
                if (c && Array.isArray(c.review_events) && c.review_events.length > 30) {
                  c.review_events = c.review_events.slice(-30);
                }
              });
            }
            serialized = JSON.stringify(db);
            memoryDbRaw = serialized;
            storageObj.setItem(STORAGE_KEY, serialized);
            lastSaveStatus = { ok: true, compacted: true, error: null };
          } catch (finalErr) {
            lastSaveStatus = {
              ok: false,
              compacted: true,
              error: String((finalErr && finalErr.message) || quotaErr || "QUOTA_EXCEEDED"),
            };
          }
        }
      }
      _mirrorToIndexedDbAsync(serialized);
      return lastSaveStatus;
    }

    function getCatalog() {
      return {
        ok: true,
        standalone: true,
        textbooks: STANDALONE_TEXTBOOKS,
        collections: STANDALONE_COLLECTIONS,
      };
    }

    function enrichCardWithRenderedFields(card) {
      const c = Object.assign({}, card || {});
      const rawFront = String(c.front_text || c.rendered_question || "").trim();
      const rawBack = String(c.back_text || c.rendered_answer || "").trim();
      const ext = extractTargetAndExplanation(rawFront, rawBack, c.target_answer, c.extra_explanation);
      const renderedQ = rawFront.replace(/\{\{c\d+::([^:}]+)(?:::([^}]+))?\}\}/g, function (_, ans, hint) {
        return hint ? `[힌트: ${hint}]` : "[ ... ]";
      });
      c.rendered_question = renderedQ || rawFront;
      c.rendered_answer = ext.targetAnswer || rawBack;
      c.target_answer = ext.targetAnswer || rawBack;
      c.extra_explanation = ext.extraExplanation || "";
      return c;
    }

    const LEARN_AHEAD_WINDOW_MS = 20 * 60 * 1000;

    function isCardDueNow(card, nowMs) {
      if (!card) return false;
      const st = String(card.state || "new").toLowerCase();
      if (st === "suspended" || card.suspended || card.buried_today) return false;
      if (st === "new") return true;
      if (st === "learning" || st === "relearning") {
        if (!card.due_at) return true;
        const parsed = Date.parse(card.due_at);
        if (!Number.isFinite(parsed)) return true;
        return parsed <= nowMs + LEARN_AHEAD_WINDOW_MS;
      }
      if (!card.due_at) return true;
      const dueTime = Date.parse(card.due_at);
      if (!Number.isFinite(dueTime)) return true;
      return dueTime <= nowMs;
    }

    function getDeckDailyQuota(db, deckId, nowMsOverride) {
      const nowMs = Number.isFinite(Number(nowMsOverride)) ? Number(nowMsOverride) : Date.now();
      const todayKey = computeStudyDayKey(nowMs, 4, 9);
      const hasDeck = deckId !== undefined && deckId !== null && deckId !== "" && deckId !== "all";
      const targetDeck = hasDeck ? db.decks.find((d) => Number(d.deck_id) === Number(deckId)) : null;
      const deckCards = db.cards.filter((c) => !hasDeck || Number(c.deck_id) === Number(deckId));
      const deckCardIds = new Set(deckCards.map((c) => Number(c.card_id)));
      const defaultNewLimit = deckCardIds.size >= 50
        ? Math.max(10, Math.min(80, Math.ceil(deckCardIds.size / 26)))
        : 30;
      const targetDays = Math.max(1, Number((targetDeck && targetDeck.target_days) || 30));
      const dailyNewLimit = Math.max(1, Number((targetDeck && targetDeck.daily_new_limit) || defaultNewLimit));
      const dailyReviewLimit = Math.max(10, Number((targetDeck && targetDeck.daily_review_limit) || 200));
      const planApplied = Boolean(targetDeck && targetDeck.plan_applied);
      const history = Array.isArray(db.reviewHistory) ? db.reviewHistory : [];

      const seenNewCards = new Set();
      const seenReviewCards = new Set();
      const graduatedNewCards = new Set();
      const graduatedReviewCards = new Set();
      const graduatedTodayCards = new Set();

      history.forEach((h) => {
        if (!h || !deckCardIds.has(Number(h.card_id))) return;
        const cid = Number(h.card_id);
        const hKey = h.at ? computeStudyDayKey(h.at, 4, 9) : "";
        if (hKey && hKey !== todayKey) return;
        const rating = Number(h.rating || h.raw_rating || 3);
        const isFirstTouchToday = !seenNewCards.has(cid) && !seenReviewCards.has(cid);
        if (isFirstTouchToday) {
          if (h.prev_state === "new" || Number(h.prev_reps || 0) === 0) {
            seenNewCards.add(cid);
          } else {
            seenReviewCards.add(cid);
          }
        }
        if (rating >= 2) {
          graduatedTodayCards.add(cid);
          if (seenNewCards.has(cid)) {
            graduatedNewCards.add(cid);
          } else {
            graduatedReviewCards.add(cid);
          }
        } else {
          graduatedTodayCards.delete(cid);
          graduatedNewCards.delete(cid);
          graduatedReviewCards.delete(cid);
        }
      });

      const newStudiedToday = graduatedNewCards.size;
      const inProgressNewToday = Math.max(0, seenNewCards.size - graduatedNewCards.size);
      const reviewsStudiedToday = graduatedReviewCards.size;
      const inProgressRevToday = Math.max(0, seenReviewCards.size - graduatedReviewCards.size);
      const dueReviewCount = deckCards.filter(
        (c) => String(c.state || "").toLowerCase() === "review" && isCardDueNow(c, nowMs)
      ).length;

      return {
        deck_id: hasDeck ? Number(deckId) : null,
        study_day_key: todayKey,
        target_days: targetDays,
        daily_new_limit: dailyNewLimit,
        daily_review_limit: dailyReviewLimit,
        plan_applied: planApplied,
        new_studied_today: newStudiedToday,
        in_progress_today: inProgressNewToday,
        reviews_studied_today: reviewsStudiedToday,
        in_progress_review_today: inProgressRevToday,
        graduated_today: graduatedTodayCards.size,
        due_review_count: dueReviewCount,
        remaining_new_today: Math.max(0, dailyNewLimit - seenNewCards.size),
        remaining_review_today: Math.max(0, dailyReviewLimit - seenReviewCards.size),
      };
    }

    function computeDeckSummaries(db) {
      const nowMs = Date.now();
      return db.decks.map((d) => {
        const dCards = db.cards.filter((c) => Number(c.deck_id) === Number(d.deck_id));
        const dueCards = dCards.filter((c) => isCardDueNow(c, nowMs));
        const newCount = dueCards.filter((c) => c.state === "new").length;
        const learnCount = dueCards.filter((c) => c.state === "learning" || c.state === "relearning").length;
        const reviewCount = dueCards.filter((c) => c.state === "review").length;
        const q = getDeckDailyQuota(db, d.deck_id);
        const prog = computeDeckMasteryProgress(dCards, q);
        return {
          deck_id: d.deck_id,
          name: d.name,
          description: d.description || "",
          total_cards: dCards.length,
          due_cards: dueCards.length,
          new_count: newCount,
          learn_count: learnCount,
          review_count: reviewCount,
          unseen_cards: prog.unseen_cards,
          learning_cards: prog.learning_cards,
          young_cards: prog.young_cards,
          mature_cards: prog.mature_cards,
          touched_cards: prog.touched_cards,
          coverage_pct: prog.coverage_pct,
          mastery_pct: prog.mastery_pct,
          target_days: q.target_days,
          daily_new_limit: q.daily_new_limit,
          daily_review_limit: q.daily_review_limit,
          plan_applied: q.plan_applied,
          new_studied_today: q.new_studied_today,
          remaining_new_today: Math.min(newCount, q.remaining_new_today),
        };
      });
    }

    function getDashboard() {
      const db = loadDb();
      const nowMs = Date.now();
      const decks = computeDeckSummaries(db);
      const totalCards = db.cards.length;
      const dueNowCount = db.cards.filter((c) => isCardDueNow(c, nowMs)).length;
      const avgStability = totalCards > 0
        ? db.cards.reduce((acc, c) => acc + Number(c.stability || 1.2), 0) / totalCards
        : 0;
      return {
        ok: true,
        standalone: true,
        brand: "BrainDeck (브레인덱 Web/iOS)",
        decks,
        stats: {
          total_cards: totalCards,
          due_now: dueNowCount,
          reviews_today: (db.reviewHistory || []).length,
          retention_rate_30d: 92.5,
          avg_stability_days: Number(avgStability.toFixed(1)),
          leech_cards: db.cards.filter((c) => Number(c.lapses || 0) >= 3).length,
        },
      };
    }

    function getDueCards(opts) {
      const options = opts && typeof opts === "object" ? opts : {};
      const db = loadDb();
      const nowMs = Date.now();
      let pool = db.cards.slice();
      const hasDeck = options.deck_id !== undefined && options.deck_id !== null && options.deck_id !== "" && options.deck_id !== "all";
      if (hasDeck) {
        pool = pool.filter((c) => Number(c.deck_id) === Number(options.deck_id));
      }
      if (!options.include_all_cards) {
        pool = pool.filter((c) => isCardDueNow(c, nowMs));
      }
      const shuffleMode = String(options.shuffle_mode || "interleaved").toLowerCase();
      if (shuffleMode !== "sequential" && pool.length > 1) {
        pool = interleaveAndShuffleStudyQueue(pool, shuffleMode);
      }
      if (options.bury_siblings === true) {
        pool = deduplicateSessionSiblings(pool);
      }
      const quota = getDeckDailyQuota(db, hasDeck ? options.deck_id : null, nowMs);
      const explicitFullDump = Boolean(options.include_all_cards === true || options.respect_plan === false || Number(options.limit || 0) > 100);
      const shouldSliceByQuota =
        !explicitFullDump &&
        Boolean(options.respect_plan === true || options.respect_daily_quota === true || quota.plan_applied);
      if (shouldSliceByQuota) {
        const sliced = [];
        let newTaken = 0;
        let revTaken = 0;
        for (let i = 0; i < pool.length; i += 1) {
          const c = pool[i];
          const st = String(c.state || "new").toLowerCase();
          if (st === "learning" || st === "relearning") {
            sliced.push(c);
          } else if (st === "review") {
            if (revTaken < quota.remaining_review_today) {
              sliced.push(c);
              revTaken += 1;
            }
          } else {
            if (newTaken < quota.remaining_new_today) {
              sliced.push(c);
              newTaken += 1;
            }
          }
        }
        pool = sliced;
      }

      // 3-Tier Intraday Ordering: Due Intraday (due <= now) -> Review & New -> Learn-Ahead Intraday (now < due <= now + 20m)
      const dueIntraday = [];
      const coreQueue = [];
      const learnAheadIntraday = [];
      pool.forEach((c) => {
        const st = String((c && c.state) || "new").toLowerCase();
        if (st === "learning" || st === "relearning") {
          const parsedDue = c.due_at ? Date.parse(c.due_at) : 0;
          if (Number.isFinite(parsedDue) && parsedDue > nowMs) {
            learnAheadIntraday.push(c);
          } else {
            dueIntraday.push(c);
          }
        } else {
          coreQueue.push(c);
        }
      });
      learnAheadIntraday.sort((a, b) => (Date.parse(a.due_at || "") || 0) - (Date.parse(b.due_at || "") || 0));
      pool = dueIntraday.concat(coreQueue).concat(learnAheadIntraday);

      const allDeckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(options.deck_id))
        : db.cards;
      const deckProgress = computeDeckMasteryProgress(allDeckCards, quota);
      pool = pool.map(enrichCardWithRenderedFields);
      return {
        ok: true,
        standalone: true,
        count: pool.length,
        shuffle_mode: shuffleMode,
        daily_quota: quota,
        deck_progress: deckProgress,
        cards: pool,
      };
    }

    function exploreDeckCards(payload) {
      const p = payload || {};
      const db = loadDb();
      const hasDeck = p.deck_id !== undefined && p.deck_id !== null && p.deck_id !== "" && p.deck_id !== "all";
      const deckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(p.deck_id))
        : db.cards;
      const quota = getDeckDailyQuota(db, hasDeck ? p.deck_id : null);
      const deckProgress = computeDeckMasteryProgress(deckCards, quota);
      const res = filterCardsForExplorer(deckCards, {
        query: p.query || "",
        bucket_filter: p.bucket_filter || p.bucket || "all",
        stage_filter: p.stage_filter || p.stage || "all",
        limit: p.limit || 1500,
      });
      res.cards = res.cards.map(enrichCardWithRenderedFields);
      return Object.assign(
        {
          ok: true,
          standalone: true,
          deck_id: hasDeck ? Number(p.deck_id) : null,
          deck_progress: deckProgress,
        },
        res
      );
    }

    function getStudyPlan(payload) {
      const p = payload || {};
      const db = loadDb();
      const hasDeck = p.deck_id !== undefined && p.deck_id !== null && p.deck_id !== "" && p.deck_id !== "all";
      const deckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(p.deck_id))
        : db.cards;
      const totalCards = deckCards.length > 0 ? deckCards.length : 1020;
      const newCount = deckCards.length > 0 ? deckCards.filter((c) => c.state === "new").length : totalCards;
      const learnCount = deckCards.filter((c) => c.state === "learning" || c.state === "relearning").length;
      const revCount = deckCards.filter((c) => c.state === "review").length;
      const quota = getDeckDailyQuota(db, hasDeck ? p.deck_id : null);
      const targetDays = Math.max(1, Number(p.target_days || quota.target_days || 30));
      const dailyMinutes = Math.max(5, Number(p.daily_minutes_budget || 30));
      const plan = computeAnkiStudyPlan({
        total_cards: totalCards,
        new_count: newCount,
        learning_count: learnCount,
        review_due_count: revCount,
        target_days: targetDays,
        daily_minutes_budget: dailyMinutes,
      });
      const effDailyNew =
        p.new_per_day !== undefined && p.new_per_day !== null && p.new_per_day !== "" && Number(p.new_per_day) > 0
          ? Number(p.new_per_day)
          : quota.plan_applied
          ? quota.daily_new_limit
          : plan.recommended_daily_new;
      const budgetRevCap = Math.max(20, Math.floor((dailyMinutes * 60) / 8));
      const effDailyRev = Math.max(20, Math.min(quota.daily_review_limit || 200, budgetRevCap));
      if (hasDeck && !quota.plan_applied && deckCards.length >= 100) {
        db.decks.forEach((d) => {
          if (Number(d.deck_id) === Number(p.deck_id)) {
            d.target_days = targetDays;
            d.daily_new_limit = effDailyNew;
            d.daily_review_limit = effDailyRev;
            d.plan_applied = true;
          }
        });
        saveDb(db);
        quota.plan_applied = true;
        quota.daily_new_limit = effDailyNew;
        quota.daily_review_limit = effDailyRev;
        quota.remaining_new_today = Math.max(0, effDailyNew - quota.new_studied_today - (quota.in_progress_today || 0));
        quota.remaining_review_today = Math.max(0, effDailyRev - quota.reviews_studied_today - (quota.in_progress_review_today || 0));
      }
      const queueRes = buildAnkiV3DailyQueue(deckCards, {
        new_per_day: Math.max(0, effDailyNew - quota.new_studied_today - (quota.in_progress_today || 0)),
        max_reviews_per_day: quota.remaining_review_today,
      });
      const updatedQuota = Object.assign({}, quota, {
        target_days: targetDays,
        daily_new_limit: effDailyNew,
        remaining_new_today: Math.max(0, effDailyNew - quota.new_studied_today - (quota.in_progress_today || 0)),
      });
      const deckProgress = computeDeckMasteryProgress(deckCards, updatedQuota);
      return {
        ok: true,
        standalone: true,
        deck_id: hasDeck ? Number(p.deck_id) : null,
        plan,
        daily_quota: updatedQuota,
        deck_progress: deckProgress,
        daily_queue_counts: queueRes.counts,
      };
    }

    function applyStudyPlan(payload) {
      const p = payload || {};
      const db = loadDb();
      const hasDeck = p.deck_id !== undefined && p.deck_id !== null && p.deck_id !== "" && p.deck_id !== "all";
      const deckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(p.deck_id))
        : db.cards;
      const totalCards = deckCards.length > 0 ? deckCards.length : 1020;
      const newCount = deckCards.length > 0 ? deckCards.filter((c) => c.state === "new").length : totalCards;
      const targetDays = Math.max(1, Number(p.target_days || 30));
      const dailyMinutes = Math.max(5, Number(p.daily_minutes_budget || 30));
      const plan = computeAnkiStudyPlan({
        total_cards: totalCards,
        new_count: newCount,
        target_days: targetDays,
        daily_minutes_budget: dailyMinutes,
      });
      const rawNewLimit = p.new_per_day !== undefined && p.new_per_day !== null && p.new_per_day !== ""
        ? Number(p.new_per_day)
        : p.daily_new_limit !== undefined && p.daily_new_limit !== null && p.daily_new_limit !== ""
        ? Number(p.daily_new_limit)
        : 0;
      const effDailyNew = rawNewLimit > 0 ? rawNewLimit : Math.max(1, Number(plan.recommended_daily_new || 30));
      const budgetRevCap = Math.max(20, Math.floor((dailyMinutes * 60) / 8));
      const effDailyRev = Math.max(
        20,
        Math.min(Number(p.max_reviews_per_day || p.daily_review_limit || plan.recommended_max_reviews || 200), budgetRevCap)
      );

      db.decks.forEach((d) => {
        if (!hasDeck || Number(d.deck_id) === Number(p.deck_id)) {
          d.target_days = targetDays;
          d.daily_new_limit = effDailyNew;
          d.daily_review_limit = effDailyRev;
          d.plan_applied = true;
        }
      });
      saveDb(db);
      return getStudyPlan({
        deck_id: hasDeck ? p.deck_id : null,
        target_days: targetDays,
        daily_minutes_budget: dailyMinutes,
        new_per_day: effDailyNew,
      });
    }

    function insertDeckWithSpecs(deckName, description, specs, shuffleMode) {
      const db = loadDb();
      const cleanDeckName = String(deckName || "기본 덱").trim();
      let ordered = specs.slice();
      if (shuffleMode && shuffleMode !== "sequential" && ordered.length > 1) {
        ordered = interleaveAndShuffleStudyQueue(ordered, shuffleMode);
      }

      // BD-Q14: When auto-initializing the 1,000-card starter deck on first boot, upgrade the 7-card seed deck (deck_id=1) in-place
      const isStarterAutoUpgrade =
        cleanDeckName.includes("무료 기초 한자·어휘 스타터") &&
        db.decks.length === 1 &&
        Number(db.decks[0].deck_id) === 1 &&
        db.cards.length <= 25 &&
        (!Array.isArray(db.reviewHistory) || db.reviewHistory.length === 0);

      if (isStarterAutoUpgrade) {
        const deckId = 1;
        db.decks[0].name = cleanDeckName;
        db.decks[0].description = description || db.decks[0].description || "";
        db.nextCardId = 1;
        const createdCards = ordered.map((s) => ({
          card_id: db.nextCardId++,
          deck_id: deckId,
          deck_name: cleanDeckName,
          front_text: s.front_text,
          back_text: s.back_text,
          note_type: s.note_type || (String(s.front_text || "").includes("{{c") ? "cloze" : "basic"),
          tags: Array.isArray(s.tags) ? s.tags : [],
          state: "new",
          reps: 0,
          lapses: 0,
          stability: 1.2,
          difficulty: 5.0,
          due_at: new Date().toISOString(),
        }));
        db.cards = createdCards;
        saveDb(db);
        return {
          ok: true,
          standalone: true,
          deck_id: deckId,
          deck_name: cleanDeckName,
          saved_count: createdCards.length,
          newly_inserted_count: createdCards.length,
          cards: createdCards,
        };
      }

      // BD-P0-10 / BD-Q13: Idempotent deck creation by deckName and (front_text, back_text)
      const existingDeck = db.decks.find((d) => String(d.name || "").trim() === cleanDeckName);
      if (existingDeck) {
        const deckId = Number(existingDeck.deck_id);
        const existingDeckCards = db.cards.filter((c) => Number(c.deck_id) === deckId);
        const seenSignatures = new Set(
          existingDeckCards.map((c) => `${String(c.front_text || "").trim()}|||${String(c.back_text || "").trim()}`)
        );
        const newCards = [];
        ordered.forEach((s) => {
          const fText = String(s.front_text || "").trim();
          const bText = String(s.back_text || "").trim();
          const sig = `${fText}|||${bText}`;
          if (!fText || !bText || seenSignatures.has(sig)) return;
          seenSignatures.add(sig);
          newCards.push({
            card_id: db.nextCardId++,
            deck_id: deckId,
            deck_name: cleanDeckName,
            front_text: fText,
            back_text: bText,
            note_type: s.note_type || (fText.includes("{{c") ? "cloze" : "basic"),
            tags: Array.isArray(s.tags) ? s.tags : [],
            state: "new",
            reps: 0,
            lapses: 0,
            stability: 1.2,
            difficulty: 5.0,
            due_at: new Date().toISOString(),
          });
        });
        if (newCards.length > 0) {
          db.cards = db.cards.concat(newCards);
          saveDb(db);
        }
        const mergedDeckCards = existingDeckCards.concat(newCards);
        return {
          ok: true,
          standalone: true,
          deck_id: deckId,
          deck_name: cleanDeckName,
          saved_count: mergedDeckCards.length,
          newly_inserted_count: newCards.length,
          already_existed: newCards.length === 0,
          cards: mergedDeckCards,
        };
      }

      const deckId = db.nextDeckId++;
      const seenNewSigs = new Set();
      const createdCards = [];
      ordered.forEach((s) => {
        const fText = String(s.front_text || "").trim();
        const bText = String(s.back_text || "").trim();
        const sig = `${fText}|||${bText}`;
        if (!fText || !bText || seenNewSigs.has(sig)) return;
        seenNewSigs.add(sig);
        createdCards.push({
          card_id: db.nextCardId++,
          deck_id: deckId,
          deck_name: cleanDeckName,
          front_text: fText,
          back_text: bText,
          note_type: s.note_type || (fText.includes("{{c") ? "cloze" : "basic"),
          tags: Array.isArray(s.tags) ? s.tags : [],
          state: "new",
          reps: 0,
          lapses: 0,
          stability: 1.2,
          difficulty: 5.0,
          due_at: new Date().toISOString(),
        });
      });
      db.decks.unshift({
        deck_id: deckId,
        name: cleanDeckName,
        description: description || "",
      });
      db.cards = createdCards.concat(db.cards);
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        deck_id: deckId,
        deck_name: cleanDeckName,
        saved_count: createdCards.length,
        newly_inserted_count: createdCards.length,
        cards: createdCards,
      };
    }

    function buildExamScopeDeck(payload) {
      const p = payload || {};
      const tb = STANDALONE_TEXTBOOKS.find((t) => t.textbook_id === p.textbook_id) || STANDALONE_TEXTBOOKS[0];
      const unitSet = new Set(Array.isArray(p.unit_ids) && p.unit_ids.length > 0 ? p.unit_ids : tb.units.map((u) => u.unit_id));
      const matched = tb.entries.filter((e) => unitSet.has(e.unit_id));
      const diff = p.difficulty_level || "mixed";
      const targetCap = Math.max(1000, Number(p.limit || 1000));
      const specs = padStandaloneSpecsToTarget(matched.length > 0 ? matched : tb.entries, tb.textbook_id, diff, targetCap);
      const deckName = (p.deck_name || "").trim() || `${tb.title} (${unitSet.size}개 단원)`;
      return insertDeckWithSpecs(deckName, "시험범위 맞춤 덱 (1,000+ 문항)", specs, p.shuffle_mode || "interleaved");
    }

    function buildCollectionDeck(payload) {
      const p = payload || {};
      const col = STANDALONE_COLLECTIONS.find((c) => c.collection_id === p.collection_id) || STANDALONE_COLLECTIONS[0];
      const diff = p.difficulty_level || "mixed";
      const targetCap = Math.max(1000, Number(p.limit || 1000));
      const specs = padStandaloneSpecsToTarget(col.items, col.collection_id, diff, targetCap);
      const deckName = (p.deck_name || "").trim() || `${col.level_label}`;
      return insertDeckWithSpecs(deckName, "급수·자격증 맞춤 덱 (1,000+ 문항)", specs, p.shuffle_mode || "interleaved");
    }

    function buildCombinedExamDeck(payload) {
      const p = payload || {};
      const scopes = Array.isArray(p.scopes) ? p.scopes : [];
      const diff = p.difficulty_level || "mixed";
      const seedPool = [];
      const labels = [];

      scopes.forEach((sc) => {
        const stype = String(sc.source_type || "collection").toLowerCase();
        const refId = String(sc.ref_id || "");
        if (sc.label) labels.push(sc.label);
        if (stype === "textbook") {
          const tb = STANDALONE_TEXTBOOKS.find((t) => t.textbook_id === refId);
          if (tb) {
            const unitSet = new Set(Array.isArray(sc.unit_ids) && sc.unit_ids.length > 0 ? sc.unit_ids : tb.units.map((u) => u.unit_id));
            tb.entries.filter((e) => unitSet.has(e.unit_id)).forEach((e) => seedPool.push(e));
          }
        } else {
          const col = STANDALONE_COLLECTIONS.find((c) => c.collection_id === refId);
          if (col) {
            col.items.forEach((item) => seedPool.push(item));
          }
        }
      });

      const targetCap = Math.max(1000, Number(p.max_cards || 1000));
      const specs = padStandaloneSpecsToTarget(seedPool, "combined_exam_scope", diff, targetCap);
      const deckName = (p.deck_name || "").trim() || `통합 시험범위 (${labels.slice(0, 2).join(" + ") || `${scopes.length}개 범위`})`;
      const shuffleMode = p.interleave_shuffle === false ? "sequential" : "interleaved";
      return insertDeckWithSpecs(deckName, "다중 시험범위 교차 덱 (1,000+ 문항)", specs, shuffleMode);
    }

    function extractContentPivotJs(sentence) {
      const tokens = extractMeaningfulAnswerTokens(sentence).filter((tok) => {
        if (tok.length < 2) return false;
        if (isGenericSectionLabel(tok)) return false;
        if (/(?:이다|입니다|한다|된다|있다|없다|말한다|뜻한다|의미한다|가리킨다|정의된다|합성하는|과정|경우|통해|대한|위한)$/.test(tok)) {
          return false;
        }
        return true;
      });
      if (tokens.length === 0) return "";
      tokens.sort((a, b) => {
        const aNum = /\d/.test(a) ? 1 : 0;
        const bNum = /\d/.test(b) ? 1 : 0;
        if (aNum !== bNum) return bNum - aNum;
        return b.length - a.length;
      });
      return tokens[0];
    }

    function buildSmartTextDeck(payload) {
      const p = payload || {};
      const rawText = String(p.text || p.raw_text || "").trim();
      const diff = String(p.difficulty_level || "standard").toLowerCase();
      const rawLines = rawText
        .split(/\r?\n/)
        .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
        .filter((l) => l.length >= 2);
      const specs = [];
      let activeHeadingTopic = "";

      rawLines.forEach((rawLine, idx) => {
        if (isTocOrStructuralHeading(rawLine, "paragraph")) {
          const cleanH = rawLine.replace(/^[#*•\-\s[\]<>《》「」『』]+|[\]<>《》「」『』\s]+$/g, "").trim();
          if (
            cleanH.length >= 2 &&
            cleanH.length <= 40 &&
            !isGenericSectionLabel(cleanH) &&
            !/(?:목\s*차|차\s*례|table\s+of\s+contents|\.{2,}|…+)/i.test(cleanH)
          ) {
            activeHeadingTopic = cleanH;
          }
          return;
        }
        if (rawLine.length < 4) return;

        let line = rawLine;
        const conceptTag = `concept:doc_${idx + 1}`;
        const colonMatch = line.match(/^([^\n:：\-–—]{2,55}?)\s*(?::|：|\s—\s|\s-\s|->|→|\|)\s*(.{3,300})$/);
        let topicPrefix = "";

        if (colonMatch) {
          const term = colonMatch[1].trim();
          const defText = colonMatch[2].trim();
          if (isTocOrStructuralHeading(defText, "paragraph")) {
            return;
          }
          if (isGenericSectionLabel(term)) {
            line = defText;
            if (activeHeadingTopic && !line.includes(activeHeadingTopic)) {
              topicPrefix = `[${activeHeadingTopic}] `;
            }
          } else {
            const safeDef = maskTermInDescJs(defText, term);
            const conciseBack = `${term}\n\n💡 해설: ${defText}`;
            const cLv1 = {
              front_text: `[Lv.1 개념 확인] ${safeDef}`,
              back_text: conciseBack,
              note_type: "basic",
              tags: ["custom_doc", conceptTag, "role:core_concept", "diff_lv1"],
            };
            const cLv2 = {
              front_text: `{{c1::${term}::핵심 개념}}: ${safeDef}`,
              back_text: conciseBack,
              note_type: "cloze",
              tags: ["custom_doc", conceptTag, "role:core_concept", "diff_lv2"],
            };
            const cLv3 = {
              front_text: `[Lv.3 용어 인출] ${safeDef}`,
              back_text: conciseBack,
              note_type: "basic",
              tags: ["custom_doc", conceptTag, "role:core_concept", "diff_lv3"],
            };
            if (diff === "lv2") {
              specs.push(cLv2);
            } else if (diff === "lv3") {
              specs.push(cLv3);
            } else if (diff === "mixed" || diff === "all") {
              specs.push(cLv1, cLv2, cLv3);
            } else {
              specs.push(cLv1);
            }
            return;
          }
        }

        const pivot = extractContentPivotJs(line);
        if (!pivot) return;
        const escapedPivot = pivot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const clozeLine = `${topicPrefix}${line.replace(new RegExp(escapedPivot, "i"), `{{c1::${pivot}::핵심 키워드}}`)}`;
        const maskedLine = `${topicPrefix}${line.replace(new RegExp(escapedPivot, "i"), "[ ___ ]")}`;
        const backText = `${pivot}\n\n💡 해설: ${topicPrefix}${line}`;
        if (diff === "lv3") {
          specs.push({
            front_text: `[Lv.3 핵심 인출] ${maskedLine}`,
            back_text: backText,
            note_type: "basic",
            tags: ["custom_doc", conceptTag, "diff_lv3"],
          });
        } else {
          specs.push({
            front_text: clozeLine,
            back_text: backText,
            note_type: "cloze",
            tags: ["custom_doc", conceptTag, `diff_${diff}`],
          });
        }
      });

      const deckName = (p.deck_name || "").trim() || `스마트 노트 덱 (${specs.length}장)`;
      if (p.auto_save === false) {
        return { ok: true, standalone: true, deck_name: deckName, generated_count: specs.length, cards: specs };
      }
      return insertDeckWithSpecs(deckName, "노트·문서 기반 자동 생성 덱", specs, "interleaved");
    }

    function submitReview(payload) {
      const p = payload || {};
      const db = loadDb();
      const card = db.cards.find((c) => Number(c.card_id) === Number(p.card_id));
      const rawRating = Math.max(1, Math.min(4, Number(p.rating || 3)));
      if (!card) {
        return { ok: false, error: "Card not found" };
      }
      const nowMs = Date.now();
      const prevEvents = Array.isArray(card.review_events) ? card.review_events.slice() : [];
      const prevRtSamples = Array.isArray(card.rt_samples) ? card.rt_samples.slice() : [];
      const prevGoodStreak = Number(card.consecutive_good_streak || 0);

      if (!db.confusionMatrix || typeof db.confusionMatrix !== "object") {
        db.confusionMatrix = {};
      }
      let activeConfusionWeight = Number(p.confusion_weight || 0.0);
      const confusedPeerId = p.confused_with_card_id !== undefined && p.confused_with_card_id !== null ? String(p.confused_with_card_id).trim() : "";
      if (confusedPeerId && confusedPeerId !== String(card.card_id)) {
        const edgeKey = `${card.card_id}->${confusedPeerId}`;
        const prevEdge = db.confusionMatrix[edgeKey] || { weight: 0.0, ts_ms: nowMs, seen_ids: [] };
        const elapsedDays = Math.max(0.0, (nowMs - Number(prevEdge.ts_ms || nowMs)) / DAY_MS_V56);
        const revKey = String(p.review_id || `rev_${card.card_id}_${nowMs}`);
        const cmRes = updateConfusionMatrixWeight(
          prevEdge.weight,
          elapsedDays,
          String(card.card_id),
          confusedPeerId,
          revKey,
          prevEdge.seen_ids || [],
          30.0
        );
        db.confusionMatrix[edgeKey] = {
          weight: cmRes.weight,
          ts_ms: nowMs,
          seen_ids: (prevEdge.seen_ids || []).concat([revKey]).slice(-50),
        };
        activeConfusionWeight = Math.max(activeConfusionWeight, cmRes.weight);
      } else {
        Object.keys(db.confusionMatrix).forEach((k) => {
          if (k.startsWith(`${card.card_id}->`)) {
            activeConfusionWeight = Math.max(activeConfusionWeight, Number(db.confusionMatrix[k].weight || 0.0));
          }
        });
      }

      const c4 = applyC4ReviewCalibration(
        rawRating,
        p.response_time_ms !== undefined ? p.response_time_ms : null,
        Array.isArray(p.baseline_rt_ms_samples) ? p.baseline_rt_ms_samples : prevRtSamples,
        p.consecutive_good_streak !== undefined ? p.consecutive_good_streak : prevGoodStreak,
        activeConfusionWeight
      );
      const rating = c4.effective_rating;

      db.reviewHistory.push({
        card_id: card.card_id,
        prev_state: card.state,
        prev_reps: card.reps,
        prev_lapses: card.lapses,
        prev_stability: card.stability,
        prev_difficulty: card.difficulty,
        prev_due_at: card.due_at,
        prev_events_count: prevEvents.length,
        prev_review_events: prevEvents.slice(-10),
        prev_rt_samples: prevRtSamples,
        prev_good_streak: prevGoodStreak,
        raw_rating: rawRating,
        rating,
        at: new Date(nowMs).toISOString(),
      });

      if (
        typeof p.response_time_ms === "number" &&
        Number.isFinite(p.response_time_ms) &&
        p.response_time_ms >= 300 &&
        p.response_time_ms <= 60000
      ) {
        card.rt_samples = prevRtSamples.concat([Math.round(p.response_time_ms)]).slice(-20);
      }
      card.consecutive_good_streak = rating >= 3 ? prevGoodStreak + 1 : 0;

      const nextEvents = prevEvents.concat([
        {
          event_id: `ev_${card.card_id}_${nowMs}_${prevEvents.length + 1}`,
          card_id: card.card_id,
          rating,
          ts_ms: nowMs,
          kind: String(p.kind || "REVIEW"),
          idem_key: `idem_${card.card_id}_${nowMs}_${prevEvents.length + 1}`,
        },
      ]);
      const folded = foldReviewEvents(nextEvents);
      card.review_events = nextEvents;
      card.reps = folded.reps;
      card.lapses = folded.lapses;
      card.stability = quantize1e6(folded.s * c4.effective_interval_factor);
      card.difficulty = folded.d;

      const prevStateNorm = String(card.state || "new").toLowerCase();
      if (rating === 1) {
        card.state = (prevStateNorm === "new" || prevStateNorm === "learning") ? "learning" : "relearning";
        const intradayMs = card.state === "learning" ? 60 * 1000 : 10 * 60 * 1000;
        card.due_at = new Date(nowMs + intradayMs).toISOString();
      } else if (rating === 2) {
        card.state = "review";
        card.stability = Math.max(1.0, card.stability);
        const ivlDays = Math.max(1, Math.round(card.stability));
        card.due_at = new Date(nowMs + ivlDays * DAY_MS_V56).toISOString();
      } else {
        card.state = "review";
        card.stability = Math.max(1.0, card.stability);
        const ivlDays = Math.max(1, Math.round(card.stability));
        card.due_at = new Date(nowMs + ivlDays * DAY_MS_V56).toISOString();
      }
      saveDb(db);
      const schedDays = rating === 1 ? 0 : Math.max(1, Math.round(card.stability));
      const labelMap = {
        1: "10분 후 재학습",
        2: `${schedDays}일 후 복습`,
        3: `${schedDays}일 후 복습`,
        4: `${schedDays}일 후 복습`,
      };
      return {
        ok: true,
        standalone: true,
        card_id: card.card_id,
        raw_rating: rawRating,
        rating,
        effective_rating: rating,
        fluency_status: c4.status,
        fluency_z_score: c4.z_score,
        effective_interval_factor: c4.effective_interval_factor,
        scheduled_days: schedDays,
        scheduled_label: labelMap[rating],
        due_at: card.due_at,
        memory: {
          state: card.state,
          reps: card.reps,
          lapses: card.lapses,
          stability: Number(card.stability.toFixed(2)),
          difficulty: Number(card.difficulty.toFixed(2)),
        },
      };
    }

    function undoLastReview() {
      const db = loadDb();
      if (!Array.isArray(db.reviewHistory) || db.reviewHistory.length === 0) {
        return { ok: false, standalone: true, error: "되돌릴 최근 복습 기록이 없습니다." };
      }
      const last = db.reviewHistory.pop();
      const card = db.cards.find((c) => Number(c.card_id) === Number(last.card_id));
      if (!card) {
        saveDb(db);
        return { ok: false, standalone: true, error: "카드를 찾을 수 없습니다." };
      }
      card.state = last.prev_state || "new";
      card.reps = Number(last.prev_reps || 0);
      card.lapses = Number(last.prev_lapses || 0);
      card.stability = Number(last.prev_stability || 1.2);
      card.difficulty = Number(last.prev_difficulty || 5.0);
      card.due_at = last.prev_due_at || new Date().toISOString();
      if (typeof last.prev_events_count === "number" && Array.isArray(card.review_events)) {
        card.review_events = card.review_events.slice(0, last.prev_events_count);
      } else {
        card.review_events = Array.isArray(last.prev_review_events) ? last.prev_review_events.slice() : [];
      }
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        card_id: card.card_id,
        restored_state: card.state,
        restored_stability: Number(card.stability.toFixed(2)),
      };
    }

    function resetStudyProgress(payload) {
      const p = payload || {};
      const db = loadDb();
      const rawDeckId = p.deck_id;
      const hasDeckFilter =
        rawDeckId !== undefined &&
        rawDeckId !== null &&
        rawDeckId !== "" &&
        rawDeckId !== "all" &&
        Number.isFinite(Number(rawDeckId));
      const targetDeckId = hasDeckFilter ? Number(rawDeckId) : null;
      const nowIso = new Date().toISOString();
      const resetCardIds = new Set();
      let resetCount = 0;

      db.cards.forEach((c) => {
        if (!c) return;
        if (targetDeckId !== null && Number(c.deck_id) !== targetDeckId) return;
        c.state = "new";
        c.reps = 0;
        c.lapses = 0;
        c.stability = 1.2;
        c.difficulty = 5.0;
        c.due_at = nowIso;
        c.review_events = [];
        resetCardIds.add(Number(c.card_id));
        resetCount += 1;
      });

      const prevHistLen = Array.isArray(db.reviewHistory) ? db.reviewHistory.length : 0;
      if (targetDeckId === null) {
        db.reviewHistory = [];
      } else if (Array.isArray(db.reviewHistory)) {
        db.reviewHistory = db.reviewHistory.filter((h) => !resetCardIds.has(Number(h && h.card_id)));
      }
      const clearedReviews = prevHistLen - (db.reviewHistory ? db.reviewHistory.length : 0);
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        deck_id: targetDeckId,
        reset_cards: resetCount,
        reset_count: resetCount,
        cleared_reviews: clearedReviews,
        due_at: nowIso,
      };
    }

    function batchSaveDeck(payload) {
      const p = payload || {};
      const cards = Array.isArray(p.cards) ? p.cards : [];
      const deckName = String(p.deck_name || "사진·PDF 추출 단어장").trim();
      const specs = cards
        .map((c) => ({
          front_text: String(c.front_text || c.front || "").trim(),
          back_text: String(c.back_text || c.back || "").trim(),
          note_type: c.note_type || (String(c.front_text || "").includes("{{c") ? "cloze" : "basic"),
          tags: Array.isArray(c.tags) ? c.tags : [String(p.category || "custom_doc")],
        }))
        .filter((s) => s.front_text && s.back_text);
      return insertDeckWithSpecs(deckName, "사진·PDF 문서 추출 단어장", specs, "interleaved");
    }

    function getStorePacks(categoryFilter) {
      const db = loadDb();
      const unlockedSet = new Set(["pack.free.starter_k12"].concat(Array.isArray(db.unlockedPackIds) ? db.unlockedPackIds : []));
      const refundedSet = new Set(Array.isArray(db.refundedPackIds) ? db.refundedPackIds : []);
      const serialized = STANDALONE_STORE_PACKS.map((p) => {
        const isRefunded = refundedSet.has(p.pack_id) && !p.is_free_starter;
        const isUnlocked = Boolean(p.is_free_starter || (unlockedSet.has(p.pack_id) && !isRefunded));
        const priceLabel = p.price_krw === 0 ? "무료 기본 탑재" : `₩${Number(p.price_krw).toLocaleString("ko-KR")}`;
        return Object.assign({}, p, {
          price_label: priceLabel,
          unlocked: isUnlocked,
          status: isRefunded ? "refunded_frozen" : isUnlocked ? "unlocked" : "locked",
          status_code: isRefunded ? "REFUNDED_FROZEN" : isUnlocked ? "UNLOCKED" : "LOCKED",
          status_badge: isUnlocked ? "장착 완료" : `스토어 구매 (${priceLabel})`,
        });
      });
      const filtered = filterStorePacks(serialized, categoryFilter);
      const unlockedCount = serialized.filter((p) => p.unlocked).length;
      return {
        ok: true,
        standalone: true,
        brand: "BrainDeck (브레인덱)",
        store_name: "BrainPack Store (브레인팩 스토어)",
        total_packs: serialized.length,
        unlocked_packs: unlockedCount,
        self_upload_free: true,
        packs: filtered,
      };
    }

    function purchaseStorePack(payload) {
      const p = payload || {};
      const packId = String(p.pack_id || "").trim();
      const pack = STANDALONE_STORE_PACKS.find((item) => item.pack_id === packId);
      if (!pack) {
        return { ok: false, standalone: true, error: `Unknown BrainPack ID: ${packId}` };
      }
      const db = loadDb();
      if (!Array.isArray(db.unlockedPackIds)) db.unlockedPackIds = ["pack.free.starter_k12"];
      if (!Array.isArray(db.refundedPackIds)) db.refundedPackIds = [];
      const wasUnlocked = Boolean(pack.is_free_starter || (db.unlockedPackIds.includes(packId) && !db.refundedPackIds.includes(packId)));
      if (!db.unlockedPackIds.includes(packId)) {
        db.unlockedPackIds.push(packId);
      }
      db.refundedPackIds = db.refundedPackIds.filter((id) => id !== packId);
      saveDb(db);

      let mountedDeck = null;
      const targetDeckTitle = `${pack.title}`;
      if (p.auto_create_deck !== false) {
        const freshDb = loadDb();
        const existing = freshDb.decks.find((d) => d.name === targetDeckTitle);
        if (wasUnlocked && existing) {
          const cardCount = freshDb.cards.filter((c) => Number(c.deck_id) === Number(existing.deck_id)).length;
          mountedDeck = {
            ok: true,
            deck_id: existing.deck_id,
            deck_name: existing.name,
            saved_count: cardCount,
            already_mounted: true,
          };
        } else if (pack.link_kind === "textbook") {
          mountedDeck = buildExamScopeDeck({
            textbook_id: pack.primary_ref_id,
            deck_name: targetDeckTitle,
            difficulty_level: "mixed",
            limit: Math.max(1000, Number(pack.estimated_card_count || 1000)),
          });
        } else {
          mountedDeck = buildCollectionDeck({
            collection_id: pack.primary_ref_id,
            deck_name: targetDeckTitle,
            difficulty_level: "mixed",
            limit: Math.max(1000, Number(pack.estimated_card_count || 1000)),
          });
        }
      }
      const finalDb = loadDb();
      return {
        ok: true,
        standalone: true,
        pack_id: pack.pack_id,
        title: pack.title,
        price_krw: pack.price_krw,
        price_paid_krw: pack.price_krw,
        already_unlocked: wasUnlocked,
        unlocked_pack_ids: finalDb.unlockedPackIds || ["pack.free.starter_k12"],
        mounted_deck: mountedDeck,
      };
    }

    function purchaseStoreBundle(payload) {
      const p = payload || {};
      const packIds = Array.isArray(p.pack_ids) ? p.pack_ids : [];
      const storeSnap = getStorePacks("all");
      const quote = calculateStoreBundleQuote(storeSnap.packs, packIds);
      const purchasedItems = [];
      packIds.forEach((pid) => {
        const res = purchaseStorePack({
          pack_id: pid,
          auto_create_deck: p.auto_create_decks !== false,
          payment_token: p.payment_token || `BDPAY-BUNDLE-${pid}`,
        });
        if (res && res.ok) purchasedItems.push(res);
      });
      const finalDb = loadDb();
      return {
        ok: true,
        standalone: true,
        quote: {
          subtotal_krw: quote.subtotalKrw,
          discount_krw: quote.discountKrw,
          final_price_krw: quote.finalPriceKrw,
          discount_applied: quote.discountApplied,
        },
        purchased_count: purchasedItems.length,
        purchased_items: purchasedItems,
        unlocked_pack_ids: finalDb.unlockedPackIds || ["pack.free.starter_k12"],
      };
    }

    function refundStorePack(payload) {
      const p = payload || {};
      const packId = String(p.pack_id || "").trim();
      const db = loadDb();
      if (!Array.isArray(db.refundedPackIds)) db.refundedPackIds = [];
      if (!db.refundedPackIds.includes(packId)) {
        db.refundedPackIds.push(packId);
      }
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        pack_id: packId,
        status: "refunded_frozen",
        fsrs_history_preserved: true,
        unlocked_pack_ids: (db.unlockedPackIds || []).filter((id) => !db.refundedPackIds.includes(id)),
        refunded_pack_ids: db.refundedPackIds,
      };
    }

    return {
      getCatalog,
      getStorePacks,
      purchaseStorePack,
      purchaseStoreBundle,
      refundStorePack,
      getDashboard,
      getDueCards,
      exploreDeckCards,
      getStudyPlan,
      applyStudyPlan,
      buildExamScopeDeck,
      buildCollectionDeck,
      buildCombinedExamDeck,
      buildSmartTextDeck,
      batchSaveDeck,
      submitReview,
      undoLastReview,
      resetStudyProgress,
    };
  }

  // =========================================================================
  // BrainDeck v5.6 Master Upgrade — Event Fold, Summary Sheet, Exam Print, Audio Loop
  // =========================================================================
  const DEFAULT_FSRS5_PARAMS = [
    0.40255, 1.18385, 3.17300, 15.69105, 7.19490,
    0.53450, 1.46040, 0.00460, 1.54575, 0.11920,
    1.01925, 1.93950, 0.11000, 0.29605, 2.26980,
    0.23150, 2.98980, 0.51655, 0.66210,
  ];
  const DAY_MS_V56 = 86400000;

  function quantize1e6(x) {
    return Math.round(Number(x) * 1000000) / 1000000;
  }

  function clampV56(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  function foldReviewEvents(events, params) {
    const w = Array.isArray(params) && params.length >= 19 ? params.map(Number) : DEFAULT_FSRS5_PARAMS;
    const rawList = Array.isArray(events) ? events.slice() : [];
    const ordered = rawList.sort((a, b) => {
      const dt = Number(a.ts_ms) - Number(b.ts_ms);
      if (dt !== 0) return dt;
      return String(a.event_id).localeCompare(String(b.event_id));
    });

    const seenIdem = new Set();
    const voidedIds = new Set();
    const deduped = [];

    for (let i = 0; i < ordered.length; i += 1) {
      const ev = ordered[i] || {};
      const eid = String(ev.event_id || "").trim();
      const ikey = String(ev.idem_key || "").trim();
      if (!eid || !ikey) throw new Error("event_id and idem_key must be non-empty");
      if (seenIdem.has(ikey)) continue;
      seenIdem.add(ikey);
      if (ev.kind === "VOID") {
        if (ev.voids) voidedIds.add(String(ev.voids));
        continue;
      }
      deduped.push(ev);
    }

    let s = 0.0;
    let d = 0.0;
    let due_ms = 0;
    let last_ts_ms = null;
    let reps = 0;
    let lapses = 0;

    for (let i = 0; i < deduped.length; i += 1) {
      const ev = deduped[i];
      if (voidedIds.has(String(ev.event_id))) continue;
      if (ev.kind === "CRAM") continue;

      const g = Number(ev.rating || 3);
      const now_ms = Number(ev.ts_ms);

      if (reps === 0 || last_ts_ms === null || s <= 0.0) {
        s = quantize1e6(Math.max(0.1, w[g - 1]));
        const d0 = w[4] - Math.exp(w[5] * (g - 1)) + 1.0;
        d = quantize1e6(clampV56(d0, 1.0, 10.0));
        reps = 1;
        last_ts_ms = now_ms;
        const ivlDays = Math.max(1, Math.round(s));
        due_ms = now_ms + ivlDays * DAY_MS_V56;
        continue;
      }

      const elapsedDays = Math.max(0.0, (now_ms - last_ts_ms) / DAY_MS_V56);
      const rNow = quantize1e6(Math.pow(1.0 + (19.0 / 81.0) * (elapsedDays / Math.max(0.1, s)), -0.5));

      const d0Good = w[4] - Math.exp(w[5] * 2.0) + 1.0;
      const deltaD = -w[6] * (g - 3.0);
      const dPrime = d + deltaD * ((10.0 - d) / 9.0);
      const dNext = quantize1e6(clampV56(w[7] * d0Good + (1.0 - w[7]) * dPrime, 1.0, 10.0));

      let sNext = s;
      if (elapsedDays < 1.0 && ev.kind === "REVIEW_AHEAD") {
        sNext = quantize1e6(clampV56(s * Math.exp(w[17] * (g - 3.0 + w[18])), 0.1, 36500.0));
        if (g === 1) lapses += 1;
      } else if (g === 1) {
        lapses += 1;
        const sFail =
          w[11] *
          Math.pow(dNext, -w[12]) *
          (Math.pow(s + 1.0, w[13]) - 1.0) *
          Math.exp(w[14] * (1.0 - rNow));
        sNext = quantize1e6(clampV56(Math.min(s, sFail), 0.1, 36500.0));
      } else {
        const hardPenalty = g === 2 ? w[15] : 1.0;
        const easyBonus = g === 4 ? w[16] : 1.0;
        const inc =
          Math.exp(w[8]) *
          (11.0 - dNext) *
          Math.pow(s, -w[9]) *
          (Math.exp(w[10] * (1.0 - rNow)) - 1.0) *
          hardPenalty *
          easyBonus;
        sNext = quantize1e6(clampV56(s * (1.0 + inc), 0.1, 36500.0));
      }

      s = sNext;
      d = dNext;
      reps += 1;
      last_ts_ms = now_ms;
      const ivlDays = g === 1 ? 1 : Math.max(1, Math.round(s));
      due_ms = now_ms + ivlDays * DAY_MS_V56;
    }

    return { s, d, due_ms, last_ts_ms, reps, lapses };
  }

  function buildSummarySheetView(cards, maskMode = "red_filter") {
    const list = Array.isArray(cards) ? cards : [];
    const rows = list.map((c, idx) => {
      const ext = extractTargetAndExplanation(c.front_text || c.rendered_question, c.back_text || c.rendered_answer, c.target_answer, c.extra_explanation);
      return {
        index: idx + 1,
        card_id: c.card_id,
        question: String(c.rendered_question || c.front_text || "").replace(/\{\{c\d+::([^:}]+)(?:::[^}]+)?\}\}/g, "[ $1 ]"),
        clean_answer: ext.targetAnswer || String(c.rendered_answer || c.back_text || ""),
        extra: ext.extraExplanation || "",
        lapses: Number(c.lapses || 0),
      };
    });
    return {
      mask_mode: maskMode || "red_filter",
      total_rows: rows.length,
      rows,
    };
  }

  function buildPrintableExamSheet(cards, title = "BrainDeck 2단 실전 쪽지시험지", seed = 20261022) {
    const list = Array.isArray(cards) ? cards.slice() : [];
    let s = Number(seed) || 20261022;
    function nextRand() {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    }
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRand() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    const items = list.map((c, idx) => {
      const ext = extractTargetAndExplanation(c.front_text || c.rendered_question, c.back_text || c.rendered_answer, c.target_answer, c.extra_explanation);
      const qText = String(c.rendered_question || c.front_text || "").replace(/\{\{c\d+::[^:}]+(?:::([^}]+))?\}\}/g, " [ ______ ] ");
      return {
        number: idx + 1,
        card_id: c.card_id,
        question: qText,
        answer: ext.targetAnswer || String(c.rendered_answer || c.back_text || ""),
        explanation: ext.extraExplanation || "",
      };
    });

    const qRowsHtml = items
      .map(
        (it) =>
          `<div style="break-inside:avoid;margin-bottom:12px;padding-bottom:8px;border-bottom:1px dashed #cbd5e1;">
            <div style="font-weight:700;font-size:13px;color:#0f172a;">${it.number}. ${it.question}</div>
            <div style="margin-top:6px;font-size:12px;color:#64748b;">정답: ________________________</div>
          </div>`
      )
      .join("");

    const ansRowsHtml = items
      .map(
        (it) =>
          `<div style="font-size:12px;margin-bottom:4px;"><strong>${it.number}번:</strong> <span style="color:#be123c;font-weight:700;">${it.answer}</span> ${
            it.explanation ? `<span style="color:#64748b;">(${it.explanation})</span>` : ""
          }</div>`
      )
      .join("");

    const printable_html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif; padding: 24px; color: #0f172a; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 18px; }
        .two-col { column-count: 2; column-gap: 28px; }
        .ans-page { page-break-before: always; margin-top: 32px; padding-top: 16px; border-top: 2px solid #0f172a; }
        @media print { .no-print { display: none; } }
      </style></head><body>
      <div class="no-print" style="margin-bottom:16px;display:flex;gap:10px;">
        <button onclick="window.print()" style="padding:10px 18px;background:#1b64da;color:#fff;border:none;border-radius:10px;font-weight:800;cursor:pointer;">🖨️ 인쇄 / PDF 저장</button>
      </div>
      <div class="header">
        <div><h1 style="margin:0;font-size:20px;">📝 ${title}</h1><div style="font-size:12px;color:#475569;margin-top:4px;">BrainDeck v5.6 2단 실전 쪽지시험지 (총 ${items.length}문항)</div></div>
        <div style="font-size:13px;">이름: ____________ &nbsp; 점수: _____ / ${items.length}</div>
      </div>
      <div class="two-col">${qRowsHtml}</div>
      <div class="ans-page">
        <h2 style="font-size:16px;margin:0 0 12px 0;">🔑 빠른 채점 정답 및 해설지</h2>
        <div class="two-col">${ansRowsHtml}</div>
      </div>
      </body></html>`;

    return {
      title,
      column_count: 2,
      items,
      question_sheet: items,
      answer_key: items,
      printable_html,
    };
  }

  function buildCommuteAudioScript(cards, thinkSeconds = 3) {
    const list = Array.isArray(cards) ? cards : [];
    const waitSec = Math.max(1, Math.min(10, Number(thinkSeconds) || 3));
    const tracks = list.map((c, idx) => {
      const ext = extractTargetAndExplanation(c.front_text || c.rendered_question, c.back_text || c.rendered_answer, c.target_answer, c.extra_explanation);
      return {
        index: idx + 1,
        card_id: c.card_id,
        prompt_tts: String(c.rendered_question || c.front_text || "").replace(/\[[^\]]+\]/g, "빈칸"),
        pause_seconds: waitSec,
        answer_tts: ext.targetAnswer || String(c.rendered_answer || c.back_text || ""),
      };
    });
    return {
      think_seconds: waitSec,
      total_tracks: tracks.length,
      tracks,
    };
  }

  function chunkMicroSprints(cards, sprintSize = 7) {
    const list = Array.isArray(cards) ? cards : [];
    const sz = Math.max(3, Math.min(15, Number(sprintSize) || 7));
    const totalSprints = Math.max(1, Math.ceil(list.length / sz));
    const sprints = [];
    for (let i = 0; i < list.length; i += sz) {
      const idx = Math.floor(i / sz) + 1;
      const chunk = list.slice(i, i + sz);
      sprints.push({
        sprint_index: idx,
        total_sprints: totalSprints,
        cards: chunk,
        checkpoint_label: `🏁 스프린트 ${idx} / ${totalSprints} (${chunk.length}장)`,
      });
    }
    return sprints;
  }

  // =========================================================================
  // Gate T43: Type-Homogeneous 4-Choice Distractor Isolation & Question-Type Filter
  // =========================================================================
  const TYPE_FALLBACK_DISTRACTOR_BANK = {
    eng_vocab_meaning: [
      "소개하다",
      "가장 좋아하는",
      "악기",
      "함께",
      "맛있는",
      "전통적인",
      "자원봉사하다",
      "의무적인",
      "준수하다",
      "경험하다",
    ],
    eng_vocab_word: [
      "introduce",
      "favorite",
      "instrument",
      "together",
      "delicious",
      "traditional",
      "volunteer",
      "mandatory",
      "comply",
      "communicate",
    ],
    eng_grammar: [
      "doesn't (does not) + 동사원형",
      "am / are / is + 동사원형-ing (현재진행형)",
      "감각동사(look/sound/smell/taste/feel) + 형용사 보어",
      "have / has + 과거분사(p.p.) (현재완료)",
      "조동사(will/can/must) + 동사원형",
      "전치사(at/in/of) + 동명사(-ing)",
      "주격 관계대명사 who / which / that + 불완전 절",
    ],
    hanja_hun_eum: [
      "배울 학",
      "학교 교",
      "날 생",
      "나라 국",
      "백성 민",
      "가르칠 교",
      "집 가",
      "마음 심",
      "이룰 성",
      "믿을 신",
    ],
    hanja_char: ["學", "校", "生", "國", "民", "敎", "家", "心", "成", "信"],
    idiom: ["대기만성 (大器晩成)", "역지사지 (易地思之)", "유비무환 (有備無患)", "일석이조 (一石二鳥)", "우공이산 (愚公移山)"],
    history: ["강화도 조약", "함무라비 법전", "훈민정음", "경국대전", "갑신정변", "동학 농민 운동", "독립협회", "3·1 운동"],
    science: ["공유 결합", "이온 결합", "활성화 에너지", "미토콘드리아", "옴의 법칙 (V = IR)", "원자성·일관성·격리성·지속성"],
    ko_dictation: ["맑고 따뜻합니다", "할머니께 썼습니다", "조용히 읽어요", "깨끗이 씻어요", "같이 걸어요"],
    general_concept: [
      "핵심 원리 및 개념 정의",
      "상호 배제와 동기화 조건",
      "원인과 결과의 상관관계",
      "필수 성립 요건 및 예외 조항",
      "구조적 특징과 작동 원리",
    ],
  };

  function classifyCardQuestionType(card) {
    const c = card || {};
    const front = String(c.front_text || c.rendered_question || "").trim();
    const back = String(c.back_text || c.rendered_answer || "").trim();
    const ext = extractTargetAndExplanation(front, back, c.target_answer, c.extra_explanation);
    const target = String(ext.targetAnswer || back).trim();
    const rawTags = c.tags || [];
    const tagStr = (Array.isArray(rawTags) ? rawTags.join(" ") : String(rawTags)).toLowerCase();

    const hasCjk = /[\u4e00-\u9fff]/.test(front + " " + target);
    const isAsciiAlpha = Boolean(target) && /^[A-Za-z\s~'.,?!-]+$/.test(target) && /[A-Za-z]/.test(target);
    const isAsciiTarget =
      isAsciiAlpha &&
      target.split(/\s+/).filter(Boolean).length <= 3 &&
      !target.endsWith(".");

    if (
      tagStr.includes("role:key_grammar") ||
      tagStr.includes("grammar") ||
      front.includes("핵심문법") ||
      front.includes("[문법") ||
      front.includes("핵심 문법") ||
      front.includes("문법 빈칸") ||
      front.includes("어법") ||
      target.includes("동사원형") ||
      target.includes("과거분사") ||
      target.includes("현재분사") ||
      target.includes("형용사 보어") ||
      target.includes("관계대명사") ||
      target.includes("현재진행형")
    ) {
      return {
        category_key: "grammar",
        facet_key: "eng_grammar",
        badge_label: "📐 영문법·어법",
        short_label: "문법",
      };
    }

    if (tagStr.includes("idiom") || front.includes("사자성어") || front.includes("고사성어")) {
      return {
        category_key: "hanja",
        facet_key: "idiom",
        badge_label: "📜 사자성어",
        short_label: "한자·성어",
      };
    }

    if (tagStr.includes("hanja") || front.includes("[한자") || hasCjk) {
      if (target.length <= 2 && /[\u4e00-\u9fff]/.test(target)) {
        return {
          category_key: "hanja",
          facet_key: "hanja_char",
          badge_label: "漢字 한자 자형",
          short_label: "한자·성어",
        };
      }
      return {
        category_key: "hanja",
        facet_key: "hanja_hun_eum",
        badge_label: "漢字 한자 훈음",
        short_label: "한자·성어",
      };
    }

    if (tagStr.includes("dictation") || front.includes("받아쓰기") || front.includes("맞춤법")) {
      return {
        category_key: "vocab",
        facet_key: "ko_dictation",
        badge_label: "✏️ 맞춤법·받아쓰기",
        short_label: "단어·어휘",
      };
    }

    const combinedLower = `${front} ${back} ${tagStr}`.toLowerCase();
    const historyKeywords = [
      "한국사",
      "세계사",
      "역사",
      "조약",
      "정변",
      "운동",
      "봉기",
      "독립협회",
      "법전",
      "훈민정음",
      "경국대전",
      "카스트제",
      "왕조",
      "세조",
      "세종",
      "성종",
      "전봉준",
      "김옥균",
      "서재필",
      "개화파",
      "조선",
      "일제",
      "바빌로니아",
    ];
    if (
      tagStr.includes("hist") ||
      tagStr.includes("khist") ||
      tagStr.includes("kh_") ||
      historyKeywords.some((kw) => combinedLower.includes(kw))
    ) {
      return {
        category_key: "history_sci",
        facet_key: "history",
        badge_label: "🏛️ 역사 개념",
        short_label: "역사·과학·전공",
      };
    }

    const scienceKeywords = [
      "결합",
      "에너지",
      "트랜잭션",
      "헌법",
      "법칙",
      "미토콘드리아",
      "교착상태",
      "계층",
      "정규화",
      "세포",
      "염색체",
      "전자쌍",
      "피타고라스",
      "방정식",
      "삼각함수",
      "판별식",
      "수학 공식",
      "해령",
      "열곡대",
    ];
    if (
      tagStr.includes("sci") ||
      tagStr.includes("math") ||
      tagStr.includes("law") ||
      tagStr.includes("cert") ||
      scienceKeywords.some((kw) => combinedLower.includes(kw))
    ) {
      return {
        category_key: "history_sci",
        facet_key: "science",
        badge_label: "🔬 과학·전공 개념",
        short_label: "역사·과학·전공",
      };
    }

    if (isAsciiTarget) {
      return {
        category_key: "vocab",
        facet_key: "eng_vocab_word",
        badge_label: "🔤 영단어 스펠링·빈칸",
        short_label: "단어·어휘",
      };
    }

    if (isAsciiAlpha) {
      return {
        category_key: "history_sci",
        facet_key: "general_concept",
        badge_label: "💡 핵심 개념·정의",
        short_label: "역사·과학·전공",
      };
    }

    const frontWithoutCloze = front.replace(/\{\{c\d+::|::[^}]*\}\}|\}\}|\[Lv\.\d+[^\]]*\]|\bLv\.\d+\b/gi, " ");
    const tagStrWithoutDefaultRole = tagStr.replace(/role:core_vocab/g, " ");
    const hasEnglishInFront = /[A-Za-z]/.test(frontWithoutCloze);
    const hasVocabSignal =
      hasEnglishInFront ||
      /eng|vocab|word|toeic|teps|toefl|opic|lang|mid1|elem/.test(tagStrWithoutDefaultRole) ||
      front.includes("영단어") ||
      front.includes("어휘") ||
      front.includes("단어") ||
      front.includes("숙어");
    if (!hasVocabSignal) {
      return {
        category_key: "history_sci",
        facet_key: "general_concept",
        badge_label: "💡 핵심 개념·정의",
        short_label: "역사·과학·전공",
      };
    }

    return {
      category_key: "vocab",
      facet_key: "eng_vocab_meaning",
      badge_label: "📘 단어 뜻·어휘",
      short_label: "단어·어휘",
    };
  }

  function filterStudyQueueByQuestionType(cards, categoryKey = "all") {
    const list = Array.isArray(cards) ? cards : [];
    const key = String(categoryKey || "all").trim().toLowerCase();
    if (!key || key === "all") return list.slice();
    return list.filter((c) => {
      const qtype = classifyCardQuestionType(c);
      return qtype.category_key === key || qtype.facet_key === key;
    });
  }

  function computeQuestionTypeCounts(cards) {
    const list = Array.isArray(cards) ? cards : [];
    const counts = {
      all: list.length,
      vocab: 0,
      grammar: 0,
      hanja: 0,
      history_sci: 0,
    };
    list.forEach((c) => {
      const cat = classifyCardQuestionType(c).category_key;
      if (Object.prototype.hasOwnProperty.call(counts, cat)) {
        counts[cat] += 1;
      }
    });
    return counts;
  }

  function _seededFisherYatesJs(items, seedVal) {
    const arr = Array.isArray(items) ? items.slice() : [];
    let state = (Math.abs(Number(seedVal) || 1) * 1664525 + 1013904223) % 4294967296;
    for (let i = arr.length - 1; i > 0; i -= 1) {
      state = (state * 1664525 + 1013904223) % 4294967296;
      const j = state % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function buildTypeMatchedQuizOptions(card, deckCards, requiredOptions = 4) {
    const c = card || {};
    const qtype = classifyCardQuestionType(c);
    const facetKey = qtype.facet_key;
    const front = String(c.front_text || c.rendered_question || "").trim();
    const back = String(c.back_text || c.rendered_answer || "").trim();
    const ext = extractTargetAndExplanation(front, back, c.target_answer, c.extra_explanation);
    const targetAnswer = String(ext.targetAnswer || back || "정답").trim();

    const cid = Number(c.card_id || 1);
    const reps = Math.max(0, Number(c.reps || 0));
    const distractors = [];
    const seenNorm = new Set([targetAnswer.toLowerCase()]);

    const pool = Array.isArray(deckCards) ? deckCards : [];
    const poolCandidates = [];
    for (let i = 0; i < pool.length; i += 1) {
      const other = pool[i] || {};
      if (Number(other.card_id || -1) === cid && cid !== 0) continue;
      const otherQtype = classifyCardQuestionType(other);
      if (otherQtype.facet_key !== facetKey) continue;
      const oFront = String(other.front_text || other.rendered_question || "").trim();
      const oBack = String(other.back_text || other.rendered_answer || "").trim();
      const oExt = extractTargetAndExplanation(oFront, oBack, other.target_answer, other.extra_explanation);
      const cand = String(oExt.targetAnswer || oBack).trim();
      if (!cand) continue;
      const norm = cand.toLowerCase();
      if (seenNorm.has(norm)) continue;
      seenNorm.add(norm);
      poolCandidates.push(cand);
    }

    const shuffledPool = _seededFisherYatesJs(poolCandidates, cid * 31 + reps * 997 + 17);
    for (let i = 0; i < shuffledPool.length; i += 1) {
      if (distractors.length >= requiredOptions - 1) break;
      distractors.push(shuffledPool[i]);
    }

    const fallbackPool = _seededFisherYatesJs(
      TYPE_FALLBACK_DISTRACTOR_BANK[facetKey] || TYPE_FALLBACK_DISTRACTOR_BANK.eng_vocab_meaning,
      cid * 73 + reps * 389 + 53
    );
    for (let i = 0; i < fallbackPool.length; i += 1) {
      if (distractors.length >= requiredOptions - 1) break;
      const cand = fallbackPool[i];
      const norm = cand.toLowerCase();
      if (seenNorm.has(norm)) continue;
      seenNorm.add(norm);
      distractors.push(cand);
    }

    const rawOptions = [targetAnswer].concat(distractors.slice(0, Math.max(0, requiredOptions - 1)));
    const shuffledOptions = _seededFisherYatesJs(rawOptions, cid * 131 + reps * 521 + 2026);

    return {
      ok: true,
      question_type: qtype,
      question_facet: qtype.badge_label,
      target_answer: targetAnswer,
      options: shuffledOptions,
      tap_blocks: targetAnswer.split(/\s+/).filter(Boolean),
    };
  }

  // =========================================================================
  // PHASE 5 (v5.8): SIMPLE IS BEST — ANKI REA PROGRESSIVE DISCLOSURE & FLUENCY
  // =========================================================================

  const SMART_AI_FALLBACK_CHAIN = [
    "glm-5.3-flash",
    "deepseek-v4.1-flash",
    "gemma4:31b",
    "glm-5.3",
    "local_rule",
  ];

  const ALLOWED_SMART_AI_MODELS = new Set([
    "glm-5.3-flash",
    "deepseek-v4.1-flash",
    "gemma4:31b",
    "glm-5.3",
    "local_rule",
  ]);

  function computeStudyToolsSummary(opts) {
    const o = opts || {};
    const sf = String(o.studyFilter || o.study_filter || "all").trim().toLowerCase();
    const qf = String(o.qtypeFilter || o.qtype_filter || "all").trim().toLowerCase();
    const cram = Boolean(o.cramMode || o.cram_mode);
    const sh = String(o.shuffleMode || o.shuffle_mode || "sequential").trim().toLowerCase();
    let activeCount = 0;
    if (sf !== "all") activeCount += 1;
    if (qf !== "all") activeCount += 1;
    if (cram) activeCount += 1;
    if (sh && sh !== "sequential" && sh !== "default") activeCount += 1;
    const isDefault = activeCount === 0;
    return {
      active_count: activeCount,
      is_default: isDefault,
      summary_badge_text: isDefault ? "" : `필터 ${activeCount}개 적용 중`,
    };
  }

  function resolveSmartAiEngine(opts) {
    const o = opts || {};
    const taskNorm = String(o.taskType || o.task_type || "card_generate").trim().toLowerCase();
    const chain =
      taskNorm === "vision_doc"
        ? ["glm-5.3-flash", "gemma4:31b", "deepseek-v4.1-flash", "glm-5.3", "local_rule"]
        : SMART_AI_FALLBACK_CHAIN.slice();

    const manualRaw = String(o.manualOverride || o.manual_override || "").trim();
    if (manualRaw) {
      const manual = manualRaw.toLowerCase();
      if (manual !== "auto" && manual !== "smart") {
        if (manual === "offline") {
          return {
            ok: true,
            status: "OFFLINE_LOCAL",
            selected_model: "local_rule",
            fallback_chain: ["local_rule"],
            ui_label: "⚡ 오프라인 빠른 생성",
            exposes_raw_model_name: false,
          };
        }
        if (isOllamaCloudModelBlocked(manual) || !ALLOWED_SMART_AI_MODELS.has(manual)) {
          return {
            ok: false,
            status: "BLOCKED_MODEL",
            selected_model: "",
            fallback_chain: chain,
            ui_label: "✨ 스마트 자동 생성",
            exposes_raw_model_name: false,
          };
        }
        return {
          ok: true,
          status: "MANUAL_OVERRIDE",
          selected_model: manual,
          fallback_chain: chain,
          ui_label: manual === "local_rule" ? "⚡ 오프라인 빠른 생성" : "✨ 스마트 자동 생성",
          exposes_raw_model_name: false,
        };
      }
    }

    if (Boolean(o.offlineOnly || o.offline_only)) {
      return {
        ok: true,
        status: "OFFLINE_LOCAL",
        selected_model: "local_rule",
        fallback_chain: ["local_rule"],
        ui_label: "⚡ 오프라인 빠른 생성",
        exposes_raw_model_name: false,
      };
    }

    const failedArr = Array.isArray(o.failedModels || o.failed_models)
      ? o.failedModels || o.failed_models
      : [];
    const failedSet = new Set(failedArr.map((m) => String(m || "").trim().toLowerCase()).filter(Boolean));
    for (let i = 0; i < chain.length; i += 1) {
      const cand = chain[i];
      if (!failedSet.has(cand.toLowerCase())) {
        return {
          ok: true,
          status: cand === "local_rule" ? "FALLBACK_LOCAL" : "OK",
          selected_model: cand,
          fallback_chain: chain,
          ui_label: cand === "local_rule" ? "⚡ 오프라인 빠른 생성" : "✨ 스마트 자동 생성",
          exposes_raw_model_name: false,
        };
      }
    }
    return {
      ok: true,
      status: "FALLBACK_LOCAL",
      selected_model: "local_rule",
      fallback_chain: chain,
      ui_label: "⚡ 오프라인 빠른 생성",
      exposes_raw_model_name: false,
    };
  }

  function resolveCurriculumSegmentState(activeSegment, combinedScopeCount) {
    const valid = ["textbook", "collection", "combined"];
    const raw = String(activeSegment || "textbook").trim().toLowerCase();
    const seg = valid.includes(raw) ? raw : "textbook";
    const cnt = Math.max(0, Number(combinedScopeCount) || 0);
    return {
      active_segment: seg,
      combined_scope_count: cnt,
      combined_tab_label: cnt > 0 ? `🎯 시험범위 조합 (${cnt})` : "🎯 시험범위 조합",
      visible_panels: {
        textbook: seg === "textbook",
        collection: seg === "collection",
        combined: seg === "combined",
      },
    };
  }

  function calibrateFluencyGrade(rawRating, responseTimeMs, baselineRtMsSamples, consecutiveGoodStreak) {
    const rRaw = Number(rawRating);
    if (![1, 2, 3, 4].includes(rRaw)) {
      throw new Error("raw_rating must be 1..4");
    }
    if (rRaw !== 3) {
      return {
        raw_rating: rRaw,
        effective_rating: rRaw,
        z_score: 0.0,
        status: "PRESERVED_EXPLICIT_RATING",
      };
    }
    if (
      responseTimeMs === null ||
      responseTimeMs === undefined ||
      typeof responseTimeMs !== "number" ||
      !Number.isFinite(responseTimeMs) ||
      responseTimeMs < 300 ||
      responseTimeMs > 60000
    ) {
      return {
        raw_rating: rRaw,
        effective_rating: rRaw,
        z_score: 0.0,
        status: "BYPASSED_INVALID_RT",
      };
    }
    const samples = Array.isArray(baselineRtMsSamples)
      ? baselineRtMsSamples.filter((x) => typeof x === "number" && Number.isFinite(x) && x >= 300 && x <= 60000)
      : [];
    if (samples.length < 5) {
      return {
        raw_rating: rRaw,
        effective_rating: rRaw,
        z_score: 0.0,
        status: "BYPASSED_COLD_START",
      };
    }
    const lnSamples = samples.map((x) => Math.log(x)).sort((a, b) => a - b);
    const n = lnSamples.length;
    const mid = Math.floor(n / 2);
    const medianLn = n % 2 === 1 ? lnSamples[mid] : 0.5 * (lnSamples[mid - 1] + lnSamples[mid]);
    const absDevs = lnSamples.map((v) => Math.abs(v - medianLn)).sort((a, b) => a - b);
    const madLn = n % 2 === 1 ? absDevs[mid] : 0.5 * (absDevs[mid - 1] + absDevs[mid]);
    if (madLn < 1e-9) {
      return {
        raw_rating: rRaw,
        effective_rating: rRaw,
        z_score: 0.0,
        status: "BYPASSED_ZERO_MAD",
      };
    }
    const denom = Math.max(0.15, 1.4826 * madLn);
    const z = quantize1e6((Math.log(responseTimeMs) - medianLn) / denom);

    if (z >= 1.5) {
      return {
        raw_rating: rRaw,
        effective_rating: 2,
        z_score: z,
        status: "DOWNGRADED_HESITANT_GOOD",
      };
    }
    if (z <= -1.0 && (Number(consecutiveGoodStreak) || 0) >= 2) {
      return {
        raw_rating: rRaw,
        effective_rating: 4,
        z_score: z,
        status: "UPGRADED_FLUENT_GOOD",
      };
    }
    return {
      raw_rating: rRaw,
      effective_rating: 3,
      z_score: z,
      status: "UNCHANGED_NORMAL_GOOD",
    };
  }

  function updateConfusionMatrixWeight(currentWeight, elapsedDays, cardA, cardB, reviewId, seenReviewIds, tauDays) {
    const aId = String(cardA || "").trim();
    const bId = String(cardB || "").trim();
    const rawW = typeof currentWeight === "number" ? currentWeight : Number(currentWeight || 0.0);
    const curW = !Number.isFinite(rawW) || rawW < 0.0 ? 0.0 : Math.min(100.0, rawW);
    if (!aId || !bId || aId === bId) {
      return {
        weight: quantize1e6(curW),
        updated: false,
        should_interleave_peer: curW >= 2.0,
        should_suggest_contrast_note: curW >= 4.0,
      };
    }
    const revKey = String(reviewId || "").trim();
    const seenSet = new Set((Array.isArray(seenReviewIds) ? seenReviewIds : []).map((x) => String(x || "").trim()));
    if (revKey && seenSet.has(revKey)) {
      return {
        weight: quantize1e6(curW),
        updated: false,
        should_interleave_peer: curW >= 2.0,
        should_suggest_contrast_note: curW >= 4.0,
      };
    }
    const rawDt = typeof elapsedDays === "number" ? elapsedDays : Number(elapsedDays || 0.0);
    const dt = !Number.isFinite(rawDt) || rawDt < 0.0 ? 0.0 : rawDt;
    const rawTau = typeof tauDays === "number" ? tauDays : Number(tauDays || 30.0);
    const tau = !Number.isFinite(rawTau) || rawTau < 1.0 ? 30.0 : rawTau;
    const nextW = quantize1e6(Math.min(100.0, curW * Math.exp(-dt / tau) + 1.0));
    return {
      weight: nextW,
      updated: true,
      should_interleave_peer: nextW >= 2.0,
      should_suggest_contrast_note: nextW >= 4.0,
    };
  }

  function computeConfusionIntervalFactor(confusionWeight) {
    const rawW = typeof confusionWeight === "number" ? confusionWeight : Number(confusionWeight || 0.0);
    if (!Number.isFinite(rawW) || rawW <= 0.0) return 1.0;
    const w = Math.min(100.0, rawW);
    const penalty = Math.min(0.15, 0.05 * w);
    return quantize1e6(Math.max(0.85, 1.0 - penalty));
  }

  function applyC4ReviewCalibration(rawRating, responseTimeMs, baselineRtMsSamples, consecutiveGoodStreak, confusionWeight) {
    const fluency = calibrateFluencyGrade(rawRating, responseTimeMs, baselineRtMsSamples, consecutiveGoodStreak);
    const rawFactor = computeConfusionIntervalFactor(confusionWeight);
    const rewritten = Number(fluency.effective_rating) !== Number(fluency.raw_rating);
    const effectiveFactor = rewritten ? 1.0 : rawFactor;
    return {
      raw_rating: fluency.raw_rating,
      effective_rating: fluency.effective_rating,
      z_score: fluency.z_score,
      status: fluency.status,
      raw_confusion_factor: rawFactor,
      effective_interval_factor: effectiveFactor,
      interval_scaled_by_confusion: !rewritten && effectiveFactor < 1.0,
    };
  }

  function computeStudyDayWindowUtc(nowOrIso, rolloverHour = 4, tzOffsetHours = 9) {
    let dt;
    if (!nowOrIso) {
      dt = new Date();
    } else if (nowOrIso instanceof Date) {
      dt = new Date(nowOrIso.getTime());
    } else {
      const parsed = new Date(String(nowOrIso));
      dt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    const rHour = Math.max(0, Math.min(23, Math.trunc(Number(rolloverHour ?? 4))));
    const tzHours = Math.trunc(Number(tzOffsetHours ?? 9));
    const shiftedMs = dt.getTime() + tzHours * 3600000 - rHour * 3600000;
    const shifted = new Date(shiftedMs);
    const y = shifted.getUTCFullYear();
    const m = shifted.getUTCMonth();
    const d = shifted.getUTCDate();
    const dayKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - tzHours * 3600000 + rHour * 3600000;
    const endUtcMs = startUtcMs + 86400000;
    const startIso = new Date(startUtcMs).toISOString().replace(/\.\d{3}Z$/, "Z");
    const endIso = new Date(endUtcMs).toISOString().replace(/\.\d{3}Z$/, "Z");
    return {
      study_day_key: dayKey,
      start_utc_iso: startIso,
      end_utc_iso: endIso,
      rollover_hour: rHour,
      tz_offset_hours: tzHours,
    };
  }

  function computeStudyDayKey(nowOrIso, rolloverHour = 4, tzOffsetHours = 9) {
    return computeStudyDayWindowUtc(nowOrIso, rolloverHour, tzOffsetHours).study_day_key;
  }

  const ANKI_FLAG_LABELS = {
    0: "플래그 없음",
    1: "집중 요주의 (Red)",
    2: "시험 전 재확인 (Orange)",
    3: "암기 완료 후보 (Green)",
    4: "예문·문맥 보충 (Blue)",
    5: "오답 노트 (Pink)",
    6: "발음·듣기 체크 (Turquoise)",
    7: "심화·함정 변별 (Purple)",
  };

  function computeAnkiStudyPlan(params) {
    const p = params || {};
    const totalCards = Math.max(0, Math.trunc(Number(p.total_cards ?? p.totalCards ?? 1020)));
    const newCount = Math.max(0, Math.trunc(Number(p.new_count ?? p.newCount ?? totalCards)));
    const learningCount = Math.max(0, Math.trunc(Number(p.learning_count ?? p.learningCount ?? 0)));
    const reviewDueCount = Math.max(0, Math.trunc(Number(p.review_due_count ?? p.reviewDueCount ?? 0)));
    const targetDays = Math.max(1, Math.min(3650, Math.trunc(Number(p.target_days ?? p.targetDays ?? 30))));
    const dailyMinutesBudget = Math.max(1, Math.trunc(Number(p.daily_minutes_budget ?? p.dailyMinutesBudget ?? 30)));
    const desiredRetention = Math.max(0.7, Math.min(0.99, Number(p.desired_retention ?? p.desiredRetention ?? 0.9)));
    const avgSecPerNew = Math.max(5.0, Number(p.avg_sec_per_new ?? p.avgSecPerNew ?? 18.0));
    const avgSecPerReview = Math.max(3.0, Number(p.avg_sec_per_review ?? p.avgSecPerReview ?? 8.0));
    const avgSecPerLearning = Math.max(5.0, Number(p.avg_sec_per_learning ?? p.avgSecPerLearning ?? 12.0));

    let consolidationDays = 0;
    if (targetDays >= 7) {
      consolidationDays = Math.min(7, Math.max(2, Math.round(targetDays * 0.2)));
    } else if (targetDays >= 4) {
      consolidationDays = 1;
    }
    const newIntakeDays = Math.max(1, targetDays - consolidationDays);
    const recommendedDailyNew = newCount > 0 ? Math.max(1, Math.ceil(newCount / newIntakeDays)) : 0;

    const dailyNewSchedule = [];
    let remainingNew = newCount;
    for (let i = 0; i < targetDays; i++) {
      if (i < newIntakeDays && remainingNew > 0) {
        const take = Math.min(recommendedDailyNew, remainingNew);
        dailyNewSchedule.push(take);
        remainingNew -= take;
      } else {
        dailyNewSchedule.push(0);
      }
    }
    if (remainingNew > 0) {
      dailyNewSchedule[newIntakeDays - 1] += remainingNew;
    }

    const retentionLoadFactor = 1.0 + Math.max(0.0, (desiredRetention - 0.85) * 4.5);
    const cascadeOffsets = [
      [1, 1.0 * retentionLoadFactor],
      [3, 0.72 * retentionLoadFactor],
      [7, 0.55 * retentionLoadFactor],
      [14, 0.42 * retentionLoadFactor],
      [28, 0.32 * retentionLoadFactor],
    ];
    const backlogSpreadDays = reviewDueCount > 120 ? Math.min(5, targetDays) : 1;
    const baseMatureCards = Math.max(0, totalCards - newCount - learningCount);

    const dailyForecast = [];
    for (let dIdx = 0; dIdx < targetDays; dIdx++) {
      const dayNo = dIdx + 1;
      const nNew = dailyNewSchedule[dIdx];
      const nLearn = dIdx === 0 ? learningCount : Math.round(dailyNewSchedule[Math.max(0, dIdx - 1)] * 0.25);
      const backlogPart =
        dIdx < backlogSpreadDays
          ? Math.ceil(reviewDueCount / backlogSpreadDays)
          : Math.round(baseMatureCards * 0.06 * retentionLoadFactor);
      let cascadeReviews = 0.0;
      for (let k = 0; k < cascadeOffsets.length; k++) {
        const offset = cascadeOffsets[k][0];
        const weight = cascadeOffsets[k][1];
        const srcIdx = dIdx - offset;
        if (srcIdx >= 0 && srcIdx < dailyNewSchedule.length) {
          cascadeReviews += dailyNewSchedule[srcIdx] * weight;
        }
      }
      const nRev = Math.round(backlogPart + cascadeReviews);
      const estSeconds = nNew * avgSecPerNew + nLearn * avgSecPerLearning + nRev * avgSecPerReview;
      const estMinutes = Number((estSeconds / 60.0).toFixed(1));
      const phase =
        dIdx >= newIntakeDays
          ? "consolidation_review"
          : dIdx < Math.floor(newIntakeDays / 2)
          ? "initial_coverage"
          : "deep_coverage";
      dailyForecast.push({
        day: dayNo,
        phase,
        new_cards: nNew,
        learning_cards: nLearn,
        review_cards: nRev,
        total_workload: nNew + nLearn + nRev,
        estimated_minutes: estMinutes,
      });
    }

    const peakDailyMinutes = dailyForecast.reduce((m, d) => Math.max(m, d.estimated_minutes), 0.0);
    const avgDailyMinutes = Number(
      (dailyForecast.reduce((s, d) => s + d.estimated_minutes, 0.0) / Math.max(1, dailyForecast.length)).toFixed(1)
    );
    const peakDailyReviews = dailyForecast.reduce((m, d) => Math.max(m, d.review_cards), 0);

    let status = "OVERLOAD_WARNING";
    if (
      avgDailyMinutes <= dailyMinutesBudget * 1.05 &&
      peakDailyMinutes <= dailyMinutesBudget * 1.25 &&
      recommendedDailyNew <= 60
    ) {
      status = "FEASIBLE";
    } else if (
      avgDailyMinutes <= dailyMinutesBudget * 1.65 &&
      peakDailyMinutes <= dailyMinutesBudget * 2.0 &&
      recommendedDailyNew <= 100
    ) {
      status = "TIGHT_SCHEDULE";
    }

    const minComfortableDays = Math.max(
      targetDays,
      Math.ceil((newCount * avgSecPerNew * 2.4) / Math.max(60.0, dailyMinutesBudget * 60.0)) + consolidationDays
    );

    const recommendations = [];
    if (status === "FEASIBLE") {
      recommendations.push(
        `하루 새 카드 ${recommendedDailyNew}장 + 복습 중심(평균 ${avgDailyMinutes}분/일)으로 D-${targetDays} 내 안정적 완주가 가능합니다.`
      );
    } else if (status === "TIGHT_SCHEDULE") {
      recommendations.push(
        `피크 구간 일일 학습량이 약 ${peakDailyMinutes}분(목표 ${dailyMinutesBudget}분)에 달합니다. 주말 맞춤 보충 학습(Custom Study)을 병행하세요.`
      );
    } else {
      recommendations.push(
        `하루 새 카드 ${recommendedDailyNew}장(피크 ${peakDailyMinutes}분/일)은 번아웃 위험이 큽니다. 목표 기간을 최소 ${minComfortableDays}일로 늘리거나 핵심 단원부터 분할 학습하세요.`
      );
    }
    if (consolidationDays > 0) {
      recommendations.push(
        `시험 직전 마지막 ${consolidationDays}일은 새 카드 진도를 멈추고(0장/일) 취약·오답 카드만 집중 인출하는 '안키 총정리 구간(Consolidation)'으로 자동 배정되었습니다.`
      );
    }

    return {
      status,
      total_cards: totalCards,
      new_count: newCount,
      learning_count: learningCount,
      review_due_count: reviewDueCount,
      target_days: targetDays,
      new_intake_days: newIntakeDays,
      consolidation_days: consolidationDays,
      daily_minutes_budget: dailyMinutesBudget,
      desired_retention: desiredRetention,
      recommended_daily_new: recommendedDailyNew,
      recommended_max_reviews: Math.max(150, peakDailyReviews + 30),
      avg_daily_minutes: avgDailyMinutes,
      peak_daily_minutes: peakDailyMinutes,
      peak_daily_reviews: peakDailyReviews,
      min_comfortable_days: minComfortableDays,
      recommendations,
      daily_forecast: dailyForecast,
    };
  }

  function extractAnkiConceptGroup(card) {
    const c = card || {};
    const noteId = String(c.note_id || "").trim();
    if (noteId) return `note:${noteId}`;
    const rawTags = c.tags || [];
    const tags = Array.isArray(rawTags) ? rawTags : String(rawTags).split(",");
    for (let i = 0; i < tags.length; i++) {
      const t = String(tags[i] || "").trim();
      if (t.startsWith("concept:") || t.startsWith("note:") || t.startsWith("entry:")) {
        return t;
      }
    }
    return "";
  }

  function estimateCardRetrievabilityForAnki(card) {
    const c = card || {};
    const rVal = Number(c.retrievability);
    if (Number.isFinite(rVal) && rVal > 0 && rVal <= 1) return rVal;
    const s = Number(c.s ?? c.stability ?? 0);
    if (!Number.isFinite(s) || s <= 0) return 0.0;
    const dueDays = Number(c.due_days ?? 0);
    const elapsed = dueDays < 0 ? s + Math.abs(dueDays) : Math.max(0.0, s - dueDays);
    return Math.pow(1.0 + (19.0 / 81.0) * (elapsed / Math.max(0.1, s)), -0.5);
  }

  function buildAnkiV3DailyQueue(cards, options) {
    const opts = options || {};
    const newPerDay = Math.max(0, Math.trunc(Number(opts.new_per_day ?? opts.newPerDay ?? 30)));
    const maxReviewsPerDay = Math.max(0, Math.trunc(Number(opts.max_reviews_per_day ?? opts.maxReviewsPerDay ?? 200)));
    const buryNewSiblings = opts.bury_new_siblings !== false && opts.buryNewSiblings !== false;
    const buryReviewSiblings = opts.bury_review_siblings !== false && opts.buryReviewSiblings !== false;
    const reviewSortOrder = String(opts.review_sort_order || opts.reviewSortOrder || "retrievability_asc");
    const mixMode = String(opts.new_review_mix_mode || opts.newReviewMixMode || "mix");

    const learningRaw = [];
    const reviewRaw = [];
    const newRaw = [];
    const list = Array.isArray(cards) ? cards : [];

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c) continue;
      const tags = Array.isArray(c.tags) ? c.tags.map(String) : [];
      if (c.suspended || c.state === "suspended" || tags.includes("suspended")) continue;
      if (c.buried_today || c.buried || tags.includes("buried_today")) continue;
      const st = String(c.state || "new").toLowerCase();
      const dueDays = Number(c.due_days ?? 0);
      if (st === "learning" || st === "relearning") {
        learningRaw.push(Object.assign({}, c));
      } else if (st === "review") {
        if (dueDays <= 0) reviewRaw.push(Object.assign({}, c));
      } else if (st === "new") {
        newRaw.push(Object.assign({}, c));
      }
    }

    reviewRaw.forEach((rc) => {
      rc.retrievability = Number(estimateCardRetrievabilityForAnki(rc).toFixed(4));
    });

    if (reviewSortOrder === "retrievability_asc") {
      reviewRaw.sort((a, b) => a.retrievability - b.retrievability || Number(a.due_days || 0) - Number(b.due_days || 0));
    } else if (reviewSortOrder === "retrievability_desc") {
      reviewRaw.sort((a, b) => b.retrievability - a.retrievability || Number(a.due_days || 0) - Number(b.due_days || 0));
    } else if (reviewSortOrder === "due_date_asc") {
      reviewRaw.sort((a, b) => Number(a.due_days || 0) - Number(b.due_days || 0));
    } else if (reviewSortOrder === "difficulty_desc") {
      reviewRaw.sort((a, b) => Number(b.d ?? b.difficulty ?? 0) - Number(a.d ?? a.difficulty ?? 0));
    }

    const seenConcepts = new Set();
    const buriedSiblingIds = [];
    learningRaw.forEach((lc) => {
      const cg = extractAnkiConceptGroup(lc);
      if (cg) seenConcepts.add(cg);
    });

    const selectedReviews = [];
    for (let i = 0; i < reviewRaw.length; i++) {
      const rc = reviewRaw[i];
      const cid = String(rc.card_id ?? rc.id ?? "");
      const cg = extractAnkiConceptGroup(rc);
      if (buryReviewSiblings && cg && seenConcepts.has(cg)) {
        buriedSiblingIds.push(cid);
        continue;
      }
      if (selectedReviews.length >= maxReviewsPerDay) continue;
      selectedReviews.push(rc);
      if (cg) seenConcepts.add(cg);
    }

    const selectedNew = [];
    for (let i = 0; i < newRaw.length; i++) {
      const nc = newRaw[i];
      const cid = String(nc.card_id ?? nc.id ?? "");
      const cg = extractAnkiConceptGroup(nc);
      if (buryNewSiblings && cg && seenConcepts.has(cg)) {
        buriedSiblingIds.push(cid);
        continue;
      }
      if (selectedNew.length >= newPerDay) continue;
      selectedNew.push(nc);
      if (cg) seenConcepts.add(cg);
    }

    let combinedTail = [];
    if (mixMode === "reviews_first") {
      combinedTail = selectedReviews.concat(selectedNew);
    } else if (mixMode === "new_first") {
      combinedTail = selectedNew.concat(selectedReviews);
    } else {
      if (selectedNew.length === 0) {
        combinedTail = selectedReviews.slice();
      } else if (selectedReviews.length === 0) {
        combinedTail = selectedNew.slice();
      } else {
        const stride = Math.max(1, Math.floor(selectedReviews.length / selectedNew.length));
        let rIdx = 0;
        let nIdx = 0;
        while (rIdx < selectedReviews.length || nIdx < selectedNew.length) {
          for (let s = 0; s < stride && rIdx < selectedReviews.length; s++) {
            combinedTail.push(selectedReviews[rIdx++]);
          }
          if (nIdx < selectedNew.length) {
            combinedTail.push(selectedNew[nIdx++]);
          }
        }
      }
    }

    const queue = learningRaw.concat(combinedTail);
    return {
      queue,
      learning_queue: learningRaw,
      review_queue: selectedReviews,
      new_queue: selectedNew,
      buried_sibling_ids: buriedSiblingIds,
      counts: {
        learning: learningRaw.length,
        review: selectedReviews.length,
        new: selectedNew.length,
        total: queue.length,
        buried_siblings: buriedSiblingIds.length,
      },
    };
  }

  function evaluateLeechStatus(lapses, leechThreshold = 8, leechAction = "suspend", existingTags = []) {
    const threshold = Math.max(2, Math.trunc(Number(leechThreshold || 8)));
    const halfStep = Math.max(1, Math.floor(threshold / 2));
    const curLapses = Math.max(0, Math.trunc(Number(lapses || 0)));
    const tags = Array.isArray(existingTags) ? existingTags.map((t) => String(t).trim()).filter(Boolean) : [];
    const isLeech = curLapses >= threshold || tags.includes("leech");
    const justTriggered = curLapses >= threshold && (curLapses - threshold) % halfStep === 0;
    const shouldSuspend = Boolean(justTriggered && String(leechAction || "suspend").toLowerCase() === "suspend");
    if (isLeech && !tags.includes("leech")) tags.push("leech");
    if (shouldSuspend && !tags.includes("suspended")) tags.push("suspended");
    return {
      is_leech: isLeech,
      just_triggered: justTriggered,
      should_suspend: shouldSuspend,
      lapses: curLapses,
      leech_threshold: threshold,
      tags,
      coaching_message: isLeech
        ? `거머리 카드(Leech) 감지 (${curLapses}회 오답): 단서를 더 작게 쪼개거나 초성·어원 연상 힌트를 보강하세요.`
        : "",
    };
  }

  function applyAnkiCardAction(card, action, opts) {
    const updated = Object.assign({}, card || {});
    const o = opts || {};
    const act = String(action || "").trim().toLowerCase();
    let tags = Array.isArray(updated.tags) ? updated.tags.map((t) => String(t).trim()).filter(Boolean) : [];

    if (act === "set_flag") {
      const fVal = Math.trunc(Number(o.flag ?? 0));
      if (!(fVal in ANKI_FLAG_LABELS)) {
        throw new Error(`Invalid Anki flag: ${fVal}`);
      }
      tags = tags.filter((t) => !t.startsWith("flag:"));
      if (fVal > 0) tags.push(`flag:${fVal}`);
      updated.flag = fVal;
      updated.flag_label = ANKI_FLAG_LABELS[fVal];
    } else if (act === "suspend") {
      updated.suspended = true;
      if (!tags.includes("suspended")) tags.push("suspended");
    } else if (act === "unsuspend") {
      updated.suspended = false;
      tags = tags.filter((t) => t !== "suspended");
    } else if (act === "bury") {
      updated.buried_today = true;
      if (!tags.includes("buried_today")) tags.push("buried_today");
    } else if (act === "unbury") {
      updated.buried_today = false;
      tags = tags.filter((t) => t !== "buried_today");
    } else if (act === "set_due_days") {
      const dVal = Math.trunc(Number(o.due_days ?? o.dueDays ?? 0));
      updated.due_days = dVal;
      if (String(updated.state || "new") === "new") {
        updated.state = "review";
        updated.s = Math.max(1.0, Number(dVal));
      }
    } else if (act === "forget_reset") {
      updated.state = "new";
      updated.s = 0.0;
      updated.d = 0.0;
      updated.stability = 0.0;
      updated.difficulty = 0.0;
      updated.reps = 0;
      updated.lapses = 0;
      updated.due_days = 0;
      updated.buried_today = false;
      tags = tags.filter((t) => t !== "leech" && t !== "buried_today");
    } else {
      throw new Error(`Unsupported Anki card action: ${action}`);
    }
    updated.tags = tags;
    return updated;
  }

  function buildCustomStudySession(cards, opts) {
    const o = opts || {};
    const preset = String(o.preset || "forgotten_recent").trim().toLowerCase();
    const daysAhead = Math.max(0, Math.trunc(Number(o.days_ahead ?? o.daysAhead ?? 3)));
    const limit = Math.max(1, Math.trunc(Number(o.limit ?? 50)));
    const extraNew = Math.max(1, Math.trunc(Number(o.extra_new ?? o.extraNew ?? 10)));

    const active = (Array.isArray(cards) ? cards : []).filter(
      (c) => c && !c.suspended && c.state !== "suspended" && !c.buried_today
    );
    let selected = [];
    let eventKind = "REVIEW";
    let reschedule = true;
    let title = "";

    if (preset === "forgotten_recent") {
      selected = active
        .filter(
          (c) =>
            Number(c.last_rating || 0) === 1 ||
            String(c.state || "") === "relearning" ||
            Number(c.lapses || 0) >= 2
        )
        .sort((a, b) => Number(b.lapses || 0) - Number(a.lapses || 0))
        .slice(0, limit);
      title = "최근 오답·망각 카드 집중 복습 (Anki Forgotten Cards)";
    } else if (preset === "review_ahead") {
      selected = active
        .filter((c) => String(c.state || "") === "review" && Number(c.due_days ?? 0) <= daysAhead)
        .sort((a, b) => Number(a.due_days || 0) - Number(b.due_days || 0))
        .slice(0, limit);
      eventKind = "REVIEW_AHEAD";
      title = `시험 대비 ${daysAhead}일 선행 복습 (Anki Review Ahead)`;
    } else if (preset === "preview_new") {
      selected = active.filter((c) => String(c.state || "new") === "new").slice(0, limit);
      eventKind = "CRAM";
      reschedule = false;
      title = "새 카드 무오염 미리보기 (Anki Preview New Cards)";
    } else if (preset === "cram_flagged_or_leech") {
      selected = active
        .filter((c) => {
          const tags = Array.isArray(c.tags) ? c.tags.map(String) : [];
          return (
            Number(c.flag || 0) > 0 ||
            tags.includes("leech") ||
            tags.some((t) => t.startsWith("flag:")) ||
            Number(c.lapses || 0) >= 4
          );
        })
        .sort((a, b) => Number(b.flag || 0) - Number(a.flag || 0) || Number(b.lapses || 0) - Number(a.lapses || 0))
        .slice(0, limit);
      eventKind = "CRAM";
      reschedule = false;
      title = "플래그·거머리 취약 카드 특훈 (Anki Filtered Cram)";
    } else if (preset === "increase_new_quota") {
      selected = active.filter((c) => String(c.state || "new") === "new").slice(0, extraNew);
      title = `오늘의 새 카드 할당량 +${extraNew}장 추가 (Anki Increase New Limit)`;
    } else {
      throw new Error(`Unsupported custom study preset: ${preset}`);
    }

    return {
      preset,
      title,
      event_kind: eventKind,
      reschedule,
      count: selected.length,
      cards: selected.map((c) => Object.assign({}, c)),
    };
  }

  const STAGE_LABELS = {
    lv1: "Lv.1 기초",
    lv2: "Lv.2 핵심",
    lv3: "Lv.3 심화",
    lv4: "Lv.4 최고급",
  };

  const MILESTONE_STEPS = [
    [10, "첫 10% 돌파"],
    [25, "1/4(25%) 돌파"],
    [50, "반환점(50%) 돌파"],
    [75, "3/4(75%) 돌파"],
    [100, "100% 완주 달성"],
  ];

  function computePercentTenths(numerator, denominator) {
    const num = Math.trunc(Number(numerator || 0));
    const den = Math.trunc(Number(denominator || 0));
    if (den <= 0 || num <= 0) return 0;
    if (num >= den) return 1000;
    const tenths = Math.floor((num * 1000 + Math.floor(den / 2)) / den);
    return Math.max(1, Math.min(999, tenths));
  }

  function normalizeTagListJs(rawTags) {
    if (!rawTags) return [];
    if (typeof rawTags === "string") {
      return rawTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }
    if (Array.isArray(rawTags)) {
      return rawTags
        .map((t) => String(t || "").trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }

  function classifyCardMaturityBucket(card) {
    const c = card || {};
    const state = String(c.state || "new").trim().toLowerCase();
    const tags = normalizeTagListJs(c.tags);
    if (state === "suspended" || Boolean(c.suspended) || tags.includes("suspended")) {
      return "suspended";
    }
    const reps = Math.trunc(Number(c.reps || 0));
    const stability = Number(c.s ?? c.stability ?? 0);
    if (state === "new" || reps <= 0) {
      return "unseen";
    }
    if (state === "learning" || state === "relearning" || stability < 1.0) {
      return "learning";
    }
    if (stability >= 21.0) {
      return "mature";
    }
    return "young";
  }

  function classifyCardStage(card) {
    const c = card || {};
    const explicit = String(c.stage || "").trim().toLowerCase();
    if (explicit === "lv1" || explicit === "lv2" || explicit === "lv3" || explicit === "lv4") {
      return explicit;
    }
    if (explicit === "basic" || explicit === "beginner" || explicit === "elementary" || explicit === "1") return "lv1";
    if (explicit === "core" || explicit === "intermediate" || explicit === "standard" || explicit === "2") return "lv2";
    if (explicit === "advanced" || explicit === "high" || explicit === "hard" || explicit === "3") return "lv3";
    if (explicit === "master" || explicit === "expert" || explicit === "top" || explicit === "4") return "lv4";

    const tags = normalizeTagListJs(c.tags);
    for (let i = 0; i < tags.length; i += 1) {
      const t = tags[i];
      if (t === "lv1" || t === "diff_lv1" || t === "stage:lv1" || t === "level:1" || t.endsWith(":lv1") || t.includes("기초") || t.includes("초급")) return "lv1";
      if (t === "lv2" || t === "diff_lv2" || t === "stage:lv2" || t === "level:2" || t.endsWith(":lv2") || t.includes("핵심") || t.includes("중급")) return "lv2";
      if (t === "lv3" || t === "diff_lv3" || t === "stage:lv3" || t === "level:3" || t.endsWith(":lv3") || t.includes("심화") || t.includes("고급")) return "lv3";
      if (t === "lv4" || t === "diff_lv4" || t === "stage:lv4" || t === "level:4" || t.endsWith(":lv4") || t.includes("최고급") || t.includes("킬러")) return "lv4";
    }
    const lapses = Math.trunc(Number(c.lapses || 0));
    const rawD = c.d ?? c.difficulty;
    const diff = rawD !== undefined && rawD !== null && Number(rawD) > 0 ? Number(rawD) : 5.0;
    if (lapses >= 3 || diff >= 7.5) return "lv4";
    if (diff < 4.0) return "lv1";
    if (diff < 6.0) return "lv2";
    return "lv3";
  }

  function computeDeckMasteryProgress(cards, dailyQuota) {
    const list = Array.isArray(cards) ? cards : [];
    const dq = dailyQuota || {};
    const totalCards = list.length;
    let suspendedCards = 0;
    let unseenCount = 0;
    let learningCount = 0;
    let youngCount = 0;
    let matureCount = 0;

    const stageAccum = {
      lv1: { total: 0, unseen: 0, learning: 0, young: 0, mature: 0 },
      lv2: { total: 0, unseen: 0, learning: 0, young: 0, mature: 0 },
      lv3: { total: 0, unseen: 0, learning: 0, young: 0, mature: 0 },
      lv4: { total: 0, unseen: 0, learning: 0, young: 0, mature: 0 },
    };

    for (let i = 0; i < list.length; i += 1) {
      const raw = list[i] || {};
      const bucket = classifyCardMaturityBucket(raw);
      if (bucket === "suspended") {
        suspendedCards += 1;
        continue;
      }
      const stage = classifyCardStage(raw);
      const stRec = stageAccum[stage];
      stRec.total += 1;
      stRec[bucket] += 1;
      if (bucket === "unseen") unseenCount += 1;
      else if (bucket === "learning") learningCount += 1;
      else if (bucket === "young") youngCount += 1;
      else matureCount += 1;
    }

    const activeCards = totalCards - suspendedCards;
    const touchedCards = learningCount + youngCount + matureCount;

    const coverageTenths = computePercentTenths(touchedCards, activeCards);
    const coveragePct = Number((coverageTenths / 10.0).toFixed(1));
    const matureTenths = computePercentTenths(matureCount, activeCards);
    const maturePct = Number((matureTenths / 10.0).toFixed(1));

    const weightedPoints = learningCount * 250 + youngCount * 650 + matureCount * 1000;
    let masteryTenths = 0;
    if (activeCards <= 0 || weightedPoints <= 0) {
      masteryTenths = 0;
    } else if (matureCount === activeCards) {
      masteryTenths = 1000;
    } else {
      masteryTenths = Math.max(
        1,
        Math.min(999, Math.floor((weightedPoints + Math.floor(activeCards / 2)) / activeCards))
      );
    }
    const masteryPct = Number((masteryTenths / 10.0).toFixed(1));

    const newStudiedToday = Math.max(0, Math.trunc(Number(dq.new_studied_today || 0)));
    const reviewsStudiedToday = Math.max(0, Math.trunc(Number(dq.reviews_studied_today || 0)));
    const inProgressToday = Math.max(0, Math.trunc(Number(dq.in_progress_today || 0)));
    const inProgressReviewToday = Math.max(0, Math.trunc(Number(dq.in_progress_review_today || 0)));
    const dailyNewLimit = Math.max(
      0,
      Math.trunc(Number(dq.daily_new_limit !== undefined && dq.daily_new_limit !== null ? dq.daily_new_limit : 30))
    );

    const rawCompleted =
      dq.graduated_today !== undefined && dq.graduated_today !== null
        ? dq.graduated_today
        : dq.today_completed !== undefined && dq.today_completed !== null
        ? dq.today_completed
        : Math.max(0, newStudiedToday - inProgressToday) + Math.max(0, reviewsStudiedToday - inProgressReviewToday);
    const todayCompleted = Math.max(0, Math.trunc(Number(rawCompleted || 0)));

    let todayTarget = 0;
    if (dq.today_target !== undefined && dq.today_target !== null) {
      todayTarget = Math.max(0, Math.trunc(Number(dq.today_target || 0)));
    } else {
      const plannedNew = Math.min(unseenCount + newStudiedToday + inProgressToday, dailyNewLimit);
      const dueReviews = Math.max(0, Math.trunc(Number(dq.due_review_count || 0)));
      let baseTarget = plannedNew + reviewsStudiedToday + inProgressReviewToday + dueReviews;
      if (baseTarget <= 0 && activeCards > 0 && dailyNewLimit > 0) {
        baseTarget = Math.min(activeCards, dailyNewLimit);
      }
      todayTarget = Math.max(todayCompleted + inProgressToday + inProgressReviewToday, baseTarget);
    }

    let todayStatus = "ACTIVE";
    let todayTenths = 0;
    if (activeCards <= 0) {
      todayStatus = "EMPTY";
      todayTenths = 0;
    } else if (todayTarget <= 0) {
      todayStatus = "NO_PLAN";
      todayTenths = 0;
    } else {
      todayTenths = computePercentTenths(todayCompleted, todayTarget);
      if (
        todayCompleted >= todayTarget &&
        inProgressToday === 0 &&
        inProgressReviewToday === 0 &&
        learningCount === 0
      ) {
        todayStatus = "COMPLETE";
      } else {
        todayStatus = "ACTIVE";
      }
    }

    const todayPct = Number((todayTenths / 10.0).toFixed(1));
    const todayRemaining = Math.max(0, todayTarget - todayCompleted);
    const overTargetCount = Math.max(0, todayCompleted - todayTarget);
    const currentCardOrdinal = todayRemaining === 0 ? todayCompleted : todayCompleted + 1;
    const estimatedRemainingMinutes =
      todayRemaining === 0 ? 0.0 : Math.max(1.0, Number(((todayRemaining * 14.0) / 60.0).toFixed(1)));

    let achievedMilestonePct = 0;
    let achievedMilestoneLabel = "출발 전";
    let nextMilestonePct = 100;
    let nextMilestoneLabel = "100% 완주 달성";
    let cardsToNextMilestone = 0;

    if (activeCards > 0) {
      let foundNext = false;
      for (let i = 0; i < MILESTONE_STEPS.length; i += 1) {
        const mPct = MILESTONE_STEPS[i][0];
        const mLabel = MILESTONE_STEPS[i][1];
        const reqCards = Math.floor((activeCards * mPct + 99) / 100);
        if (touchedCards >= reqCards) {
          achievedMilestonePct = mPct;
          achievedMilestoneLabel = mLabel;
        } else if (!foundNext) {
          nextMilestonePct = mPct;
          nextMilestoneLabel = mLabel;
          cardsToNextMilestone = Math.max(0, reqCards - touchedCards);
          foundNext = true;
        }
      }
      if (!foundNext) {
        nextMilestonePct = 100;
        nextMilestoneLabel = "100% 완주 달성";
        cardsToNextMilestone = 0;
      }
    }

    const effectiveDailyPace = Math.max(1, dailyNewLimit > 0 ? dailyNewLimit : 30);
    const daysToNextMilestone =
      cardsToNextMilestone > 0
        ? Math.floor((cardsToNextMilestone + effectiveDailyPace - 1) / effectiveDailyPace)
        : 0;
    const etaFullCoverageDays =
      unseenCount > 0 ? Math.floor((unseenCount + effectiveDailyPace - 1) / effectiveDailyPace) : 0;

    const byStage = {};
    ["lv1", "lv2", "lv3", "lv4"].forEach((st) => {
      const rec = stageAccum[st];
      const stTotal = rec.total;
      const stTouched = rec.learning + rec.young + rec.mature;
      const stCovTenths = computePercentTenths(stTouched, stTotal);
      const stPts = rec.learning * 250 + rec.young * 650 + rec.mature * 1000;
      let stMastTenths = 0;
      if (stTotal <= 0 || stPts <= 0) {
        stMastTenths = 0;
      } else if (rec.mature === stTotal) {
        stMastTenths = 1000;
      } else {
        stMastTenths = Math.max(1, Math.min(999, Math.floor((stPts + Math.floor(stTotal / 2)) / stTotal)));
      }
      byStage[st] = {
        stage: st,
        label: STAGE_LABELS[st],
        total: stTotal,
        unseen: rec.unseen,
        learning: rec.learning,
        young: rec.young,
        mature: rec.mature,
        touched: stTouched,
        coverage_tenths: stCovTenths,
        coverage_pct: Number((stCovTenths / 10.0).toFixed(1)),
        mastery_tenths: stMastTenths,
        mastery_pct: Number((stMastTenths / 10.0).toFixed(1)),
      };
    });

    const status = activeCards <= 0 ? "EMPTY" : "OK";
    return {
      status,
      total_cards: totalCards,
      active_cards: activeCards,
      suspended_cards: suspendedCards,
      touched_cards: touchedCards,
      unseen_cards: unseenCount,
      learning_cards: learningCount,
      young_cards: youngCount,
      mature_cards: matureCount,
      coverage_tenths: coverageTenths,
      coverage_pct: coveragePct,
      mature_tenths: matureTenths,
      mature_pct: maturePct,
      mastery_tenths: masteryTenths,
      mastery_pct: masteryPct,
      buckets: {
        unseen: unseenCount,
        learning: learningCount,
        young: youngCount,
        mature: matureCount,
        suspended: suspendedCards,
      },
      today: {
        status: todayStatus,
        completed_count: todayCompleted,
        in_progress_count: inProgressToday + inProgressReviewToday,
        target_count: todayTarget,
        remaining_count: todayRemaining,
        over_target_count: overTargetCount,
        percent_tenths: todayTenths,
        percent: todayPct,
        current_card_ordinal: currentCardOrdinal,
        estimated_remaining_minutes: estimatedRemainingMinutes,
      },
      milestone: {
        current_pct: achievedMilestonePct,
        achieved_pct: achievedMilestonePct,
        achieved_label: achievedMilestoneLabel,
        next_pct: nextMilestonePct,
        next_label: nextMilestoneLabel,
        cards_to_next: cardsToNextMilestone,
        days_to_next: daysToNextMilestone,
        eta_full_coverage_days: etaFullCoverageDays,
      },
      eta_full_coverage_days: etaFullCoverageDays,
      by_stage: byStage,
    };
  }

  function filterCardsForExplorer(cards, opts) {
    const list = Array.isArray(cards) ? cards : [];
    const o = opts || {};
    const qRaw = String(o.query || "").trim();
    const qTokens = qRaw
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const bNorm = String(o.bucket || o.bucket_filter || "all").trim().toLowerCase();
    const sNorm = String(o.stage || o.stage_filter || "all").trim().toLowerCase();
    const cap = Math.max(1, Math.min(5000, Math.trunc(Number(o.limit || 1500))));

    const matched = [];
    for (let i = 0; i < list.length; i += 1) {
      const raw = list[i] || {};
      const bucket = classifyCardMaturityBucket(raw);
      const stage = classifyCardStage(raw);
      if (bNorm !== "all" && bucket !== bNorm) continue;
      if (sNorm !== "all" && stage !== sNorm) continue;
      const front = String(raw.front_text || raw.rendered_question || "").trim();
      const back = String(raw.back_text || raw.rendered_answer || "").trim();
      if (qTokens.length > 0) {
        const hay = `${front} ${back} ${normalizeTagListJs(raw.tags).join(" ")}`.toLowerCase();
        const allHit = qTokens.every((tok) => hay.includes(tok));
        if (!allHit) continue;
      }
      matched.push(
        Object.assign({}, raw, {
          ordinal: i + 1,
          maturity_bucket: bucket,
          stage,
          stage_label: STAGE_LABELS[stage] || "Lv.1 기초",
        })
      );
    }

    return {
      total_count: list.length,
      matched_count: matched.length,
      total_matched: matched.length,
      returned_count: Math.min(matched.length, cap),
      query: qRaw,
      bucket_filter: bNorm,
      stage_filter: sNorm,
      cards: matched.slice(0, cap),
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
  };
});


