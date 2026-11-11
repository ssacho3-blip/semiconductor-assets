/**
 * BrainDeck Pure Quick-Bar ViewModel & Interactive User Manual Module (`user_guide_and_quick_vm.js`).
 * Implements:
 * 1. Local Midnight Study Date Key (`getLocalDateKey`) & Streak Continuity
 * 2. Subject Level Registry (`ENGLISH_LEVEL_OPTIONS`, `HANJA_LEVEL_OPTIONS`) & Daily Goal Validator
 * 3. Pure English Headword Extractor (`extractEnglishHeadword`) & Persistent Daily Wrong-IDs Merger
 * 4. Canonical 3-Tab User Manual (`USER_MANUAL_SECTIONS`: 아이용 / 부모님용 / 단축키·FAQ) & Dialog Controller
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrainDeckUserGuideQuickVm = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VALID_DAILY_GOALS = [10, 15, 20, 30];

  const ENGLISH_LEVEL_OPTIONS = [
    { id: "moe-eng:elem-3-4", label: "초등 3·4학년 필수 (240단어)", limit: 240, available: true },
    { id: "moe-eng:elementary", label: "초등 5·6학년 완성 (400단어)", limit: 400, available: true },
    { id: "moe-eng:middle", label: "중등 필수 어휘 (500단어)", limit: 500, available: true },
    { id: "moe-eng:high", label: "고등 내신 핵심 (500단어)", limit: 500, available: true },
    { id: "exam-eng:csat-civil", label: "수능·공무원 핵심 (450단어)", limit: 450, available: true },
  ];

  const HANJA_LEVEL_OPTIONS = [
    { id: "hanja-grade:8geup", label: "8급 기초 한자 (100자)", limit: 100, available: true },
    { id: "hanja-grade:7geup", label: "7급 초등 한자 (150자)", limit: 150, available: true },
    { id: "hanja-grade:6to4geup", label: "6급~4급 중급 한자 (400자)", limit: 400, available: true },
    { id: "moe-hanja-1800:middle", label: "중등 기초한자 (450자)", limit: 450, available: true },
  ];

  const STOP_AND_POS_WORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "have", "has",
    "noun", "verb", "adj", "adv", "prep", "pron", "conj", "blank", "word", "answer",
  ]);

  function getLocalDateKey(dateObj) {
    const d = dateObj instanceof Date && !Number.isNaN(dateObj.getTime()) ? dateObj : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function normalizeDailyGoal(rawVal) {
    const n = Number(rawVal);
    return VALID_DAILY_GOALS.includes(n) ? n : 15;
  }

  function extractEnglishHeadword(frontText, backText) {
    const candidates = [String(frontText || ""), String(backText || "")];
    for (let i = 0; i < candidates.length; i += 1) {
      const cleaned = candidates[i].replace(/\[[^\]]*\]/g, " ");
      const tokens = cleaned.split(/[^A-Za-z]+/);
      for (let j = 0; j < tokens.length; j += 1) {
        const w = tokens[j].trim().toLowerCase();
        if (w.length >= 3 && w.length <= 20 && !STOP_AND_POS_WORDS.has(w)) {
          return w;
        }
      }
    }
    return null;
  }

  function mergeUniqueWrongIds(existingIds, cardId, isWrong) {
    const list = Array.isArray(existingIds)
      ? existingIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    const set = new Set(list);
    const cid = Number(cardId);
    if (!Number.isFinite(cid) || cid <= 0) return Array.from(set);
    if (isWrong) set.add(cid);
    else set.delete(cid);
    return Array.from(set);
  }

  function resolveSubjectLevelMeta(subject, collectionId) {
    const list = subject === "hanja" ? HANJA_LEVEL_OPTIONS : ENGLISH_LEVEL_OPTIONS;
    return list.find((item) => item.id === collectionId) || list[0];
  }

  function resolvePersonaPolicy(personaId, wasmApi) {
    if (wasmApi && typeof wasmApi.resolvePersonaPolicyWasm === "function") {
      return wasmApi.resolvePersonaPolicyWasm(personaId);
    }
    const p = String(personaId || "").trim().toLowerCase();
    if (p === "kid1" || p === "kid2" || p === "kids" || p === "junior") {
      return {
        persona_tier: "kids",
        age_tier: "junior",
        default_daily_goal: 10,
        desired_retention: 0.85,
        default_solve_mode: "choice",
        ui_density: "playful_clean",
        show_tabs: false,
        show_raw_fsrs: false,
        default_eng_level: "moe-eng:elem-3-4",
        default_hanja_level: "hanja-grade:8geup",
        rating_labels: ["😢 몰랐어요 (다시)", "🤔 헷갈려요 (복습)", "😊 알아요! (통과)"],
        theme_badge: "🎈 초등 키즈 놀이학습 (큰 글씨 · 3버튼 · 4지선다)",
      };
    }
    if (p === "teen" || p === "middle_high") {
      return {
        persona_tier: "teen",
        age_tier: "teen",
        default_daily_goal: 20,
        desired_retention: 0.90,
        default_solve_mode: "adaptive",
        ui_density: "exam_sprint",
        show_tabs: true,
        show_raw_fsrs: false,
        default_eng_level: "moe-eng:middle",
        default_hanja_level: "hanja-grade:6to4geup",
        rating_labels: ["1 · 다시 (오답노트)", "2 · 어려움 (집중)", "3 · 알맞음 (표준)", "4 · 쉬움 (완벽)"],
        theme_badge: "⚡ 중고등 내신·수능 스프린트 (오답노트 · 적응형 인출)",
      };
    }
    return {
      persona_tier: "adult",
      age_tier: "senior",
      default_daily_goal: 30,
      desired_retention: 0.92,
      default_solve_mode: "flip",
      ui_density: "classic_pro",
      show_tabs: true,
      show_raw_fsrs: true,
      default_eng_level: "exam-eng:csat-civil",
      default_hanja_level: "moe-hanja-1800:middle",
      rating_labels: ["1 · Again", "2 · Hard", "3 · Good", "4 · Easy"],
      theme_badge: "🧠 성인·프로 워크스페이스 (FSRS-5 정밀 지표 · 전체 도구)",
    };
  }

  const USER_MANUAL_SECTIONS = {
    kids: [
      {
        title: "1단계. 오늘 공부 3초 만에 시작하기 (아이용)",
        bullets: [
          "① 상단 왼쪽에서 내 프로필(👦 초등 키즈 · 첫째 / 👧 초등 키즈 · 둘째)을 골라요.",
          "② 오늘 풀 문제 수(🎯 하루 10문제 / 15문제 / 20문제 / 30문제)를 확인해요.",
          "③ [🇬🇧 영어 단계]를 고르고 [영어 시작], 또는 [🀄 한자 급수]를 고르고 [한자 시작]을 누르면 1번 문제부터 바로 시작돼요!",
        ],
      },
      {
        title: "2단계. 카드 풀기와 초록색 코칭 배너 활용법",
        bullets: [
          "🔤 영어 카드: 새 영어 카드가 나오면 원어민 발음이 자동 재생되고 초록색 코칭 배너에 파닉스 규칙이 표시돼요. 다시 듣고 싶으면 [🔊 발음 듣기]를 눌러보세요.",
          "漢字 한자 카드: 초록색 코칭 배너에서 1,728자 한자 조자 원리(부수 · Unihan 표준 총획 · 실생활 활용 단어)를 함께 확인해요.",
          "🎯 4지선다 & 키즈 3버튼 채점: 보기를 눌러 정답과 해설을 확인한 뒤, [😢 몰랐어요 (다시)] · [🤔 헷갈려요 (복습)] · [😊 알아요! (통과)] 중 하나를 눌러 다음 카드로 넘어가요.",
        ],
      },
      {
        title: "3단계. 별 도장 10칸 모으기와 오늘 오답 복습",
        bullets: [
          "⭐ 문제를 풀 때마다 상단 별 도장(⭐⭐⭐⭐⚪...)이 하나씩 채워져요.",
          "🎉 오늘 목표를 다 채우면 축하 창이 열려요! [🔥 오늘 틀린·모르는 문제만 다시 풀기] 또는 [➕ 오늘 목표 10문제 더 풀기]로 실력을 탄탄하게 다질 수 있어요.",
        ],
      },
    ],
    parents: [
      {
        title: "0단계. 학부모 초기 3분 설정 가이드",
        bullets: [
          "👨‍👩‍👧 4인 가족 프로필 독립 저장: 첫째·둘째(키즈 집중 화면)와 중고등·성인(전체 5대 탭 활성화) 프로필마다 오늘 푼 문제 수, 연속 학습일(Streak), 오늘 틀린 카드, 선호 레벨이 각각 분리 저장됩니다.",
          "📚 학년별 추천 단계: 초3~4는 [초등 3·4학년 필수 240단어 + 8급 한자 100자], 초5~6은 [초등 5·6학년 400단어 + 7급 한자 150자], 중학생은 [중등 필수 500단어 + 6~4급/중등 한자]를 권장합니다.",
          "🕛 하루 리셋 기준: 매일 밤 12시(로컬 자정 00:00)를 기준으로 오늘의 목표 카운터가 새로 시작되며, 어제 목표를 달성했다면 연속 학습일(🔥 N일째)이 자동으로 이어집니다.",
        ],
      },
      {
        title: "뇌과학 기억 엔진(Rust/WASM FSRS-5) & 학부모 점검 팁",
        bullets: [
          "🧠 왜 내일 나오는 카드가 달라지나요?: 아이가 [몰랐어요/다시]를 누른 카드는 당일·내일 바로 다시 나오고, [알아요/알맞음]을 누른 카드는 기억 반감기(3일→7일→21일)에 맞춰 자동 배치됩니다.",
          "🖨️ 시험 전 요약시트 & 쪽지시험 인쇄: [필터·도구] 버튼을 열면 전자 빨간 셀로판지 요약시트, 무오염 벼락치기(CRAM), 2단 PDF 쪽지시험지 인쇄를 식탁에서 바로 활용할 수 있습니다.",
        ],
      },
      {
        title: "자주 묻는 질문 (FAQ & 문제 해결)",
        bullets: [
          "❓ 상단 5개 탭(시험·급수, 만들기, 스토어, 내 정보)이 안 보여요: 초등 키즈 프로필에서는 집중을 위해 탭이 자동 숨김됩니다. 프로필을 [🧑‍🎓 중고등] 또는 [👨 성인·프로]로 바꾸면 즉시 나타납니다.",
          "❓ 영어 발음 소리 / 한자 카드 발음 버튼: 상단 [🔊 자동발음 ON]과 기기 무음 모드를 확인해 주세요. 순수 한자·국어 카드는 오작동 방지를 위해 영어 발음 버튼이 자동 비활성화됩니다.",
          "❓ 인터넷이 없는 곳에서도 되나요?: Rust WebAssembly(WASM) 엔진이 브라우저 내부에서 직접 작동하므로 오프라인에서도 문제 풀이와 채점이 즉시 실행됩니다.",
        ],
      },
    ],
    shortcuts: [
      { key: "Space / Enter", action: "정답 및 해설 뒤집기 (카드 앞면 상태)" },
      { key: "1 / 2 / 3 / 4", action: "난이도 평가 (1: 다시 · 2: 어려움 · 3: 알맞음 · 4: 쉬움)" },
      { key: "R", action: "현재 카드 음성 발음 듣기 (TTS)" },
      { key: "H", action: "단계별 초성·구조 힌트 열기" },
      { key: "Z", action: "방금 평가한 카드 되돌리기 (Undo)" },
      { key: "? (물음표)", action: "사용설명서 모달 열기" },
      { key: "Esc", action: "열려 있는 설명서·축하 모달 닫기" },
    ],
  };

  function renderUserManualTabHtml(tabKey) {
    if (tabKey === "shortcuts") {
      const rows = USER_MANUAL_SECTIONS.shortcuts
        .map(
          (r) =>
            `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 10px;font-weight:800;color:#1d4ed8;white-space:nowrap;"><code>${r.key}</code></td><td style="padding:8px 10px;color:#334155;">${r.action}</td></tr>`
        )
        .join("");
      return `<div style="font-size:0.84rem;"><p style="margin:0 0 10px 0;color:#475569;font-weight:700;">키보드 하나로 모든 학습과 복습을 빠르게 조작할 수 있습니다.</p><table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;"><thead><tr style="background:#e2e8f0;text-align:left;"><th style="padding:8px 10px;">단축키</th><th style="padding:8px 10px;">동작 설명</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    const sections = USER_MANUAL_SECTIONS[tabKey] || USER_MANUAL_SECTIONS.kids;
    return sections
      .map((sec) => {
        const items = sec.bullets.map((b) => `<li style="margin-bottom:6px;line-height:1.5;">${b}</li>`).join("");
        return `<div style="margin-bottom:14px;padding:12px 14px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;"><h4 style="margin:0 0 8px 0;font-size:0.92rem;color:#0f172a;">${sec.title}</h4><ul style="margin:0;padding-left:18px;font-size:0.83rem;color:#334155;">${items}</ul></div>`;
      })
      .join("");
  }

  function bindCommercialKidsFocusDom(ctx, wasmApi) {
    if (!ctx || typeof ctx.el !== "function") return null;
    const { el, state, currentCard, showUxToast, setStudyFilterMode, launchQuickFocusCollection, applyLearnerProfile, refreshDashboardAndQueue } = ctx;
    let activeProfile = "kid1";
    try {
      const savedId = typeof localStorage !== "undefined" ? localStorage.getItem("braindeck_active_family_profile_v1") : null;
      if (savedId && ["kid1", "kid2", "teen", "adult"].includes(savedId)) activeProfile = savedId;
    } catch (_e) {}
    let autoTtsEnabled = false;
    let lastSpokenCardId = null;

    function loadProfilePrefs(profileId) {
      const policy = resolvePersonaPolicy(profileId, wasmApi);
      try {
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem(`braindeck_profile_prefs_v1_${profileId}`) : null;
        if (raw) {
          const p = JSON.parse(raw);
          return {
            daily_goal: normalizeDailyGoal(p.daily_goal || policy.default_daily_goal),
            eng_level: p.eng_level || policy.default_eng_level || "moe-eng:elem-3-4",
            hanja_level: p.hanja_level || policy.default_hanja_level || "hanja-grade:8geup",
            selected_deck_id: p.selected_deck_id || "",
          };
        }
      } catch (_e) {}
      return {
        daily_goal: normalizeDailyGoal(policy.default_daily_goal),
        eng_level: policy.default_eng_level || "moe-eng:elem-3-4",
        hanja_level: policy.default_hanja_level || "hanja-grade:8geup",
        selected_deck_id: "",
      };
    }

    function saveProfilePrefs(profileId, prefs) {
      try { if (typeof localStorage !== "undefined") localStorage.setItem(`braindeck_profile_prefs_v1_${profileId}`, JSON.stringify(prefs)); } catch (_e) {}
    }

    function applyPersonaTierDomAndLogic(profileId, isSwitch) {
      const policy = resolvePersonaPolicy(profileId, wasmApi);
      const prefs = loadProfilePrefs(profileId);
      if (typeof document !== "undefined" && document.body) {
        document.body.setAttribute("data-persona-tier", policy.persona_tier);
        document.body.setAttribute("data-age-tier", policy.age_tier);
        document.body.setAttribute("data-kids-parent-menu", "closed");
      }
      const btnKidsUnlock = el("btn-kids-parent-unlock");
      if (btnKidsUnlock) {
        btnKidsUnlock.setAttribute("aria-expanded", "false");
        btnKidsUnlock.textContent = "👨‍👩‍👧 전체메뉴";
      }
      const modeSetupBtn = el("btn-open-mode-setup");
      if (modeSetupBtn) {
        const pLbl = profileId === "kid1" ? "👦 첫째(초등)" : profileId === "kid2" ? "👧 둘째(초등)" : profileId === "teen" ? "🧑‍🎓 중고등" : "👨 성인·프로";
        modeSetupBtn.textContent = `${pLbl} · 프로필 설정`;
      }
      const modeBadge = el("bd-persona-mode-badge");
      if (modeBadge) {
        modeBadge.textContent = policy.theme_badge;
        if (policy.persona_tier === "kids") { modeBadge.style.background = "#dbeafe"; modeBadge.style.color = "#1e40af"; }
        else if (policy.persona_tier === "teen") { modeBadge.style.background = "#d1fae5"; modeBadge.style.color = "#065f46"; }
        else { modeBadge.style.background = "#e2e8f0"; modeBadge.style.color = "#0f172a"; }
      }
      if (state) {
        state.ageTier = policy.age_tier;
        state.desiredRetention = policy.desired_retention;
        if (prefs.selected_deck_id !== undefined) state.selectedDeckId = prefs.selected_deck_id;
      }
      if (typeof applyLearnerProfile === "function") {
        applyLearnerProfile(
          {
            ageTier: policy.age_tier,
            solveMode: policy.default_solve_mode,
            difficulty: "mixed",
            order: policy.persona_tier === "kids" ? "sequential" : "interleaved",
          },
          false
        );
      }
      const labels = Array.isArray(policy.rating_labels) ? policy.rating_labels : [];
      [1, 2, 3, 4].forEach((r, idx) => {
        const btn = el(`rate-${r}`);
        if (!btn) return;
        const lblText = labels[idx];
        btn.style.display = lblText ? "flex" : "none";
        if (!lblText) return;
        const firstSpan = btn.querySelector("span:first-child");
        if (firstSpan) firstSpan.textContent = lblText;
        else btn.textContent = lblText;
      });
      if (isSwitch && typeof refreshDashboardAndQueue === "function") {
        refreshDashboardAndQueue();
      }
    }

    function loadProfileSession(profileId) {
      const todayKey = getLocalDateKey(new Date());
      const prefs = loadProfilePrefs(profileId);
      try {
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem(`braindeck_family_session_v1_${profileId}`) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayKey) {
            parsed.wrong_ids = Array.isArray(parsed.wrong_ids) ? parsed.wrong_ids : [];
            parsed.wrong_cards = parsed.wrong_cards && typeof parsed.wrong_cards === "object" ? parsed.wrong_cards : {};
            return parsed;
          }
          if (parsed && parsed.date) {
            const yest = new Date();
            yest.setDate(yest.getDate() - 1);
            const nextStreak = parsed.date === getLocalDateKey(yest) && parsed.solved >= (parsed.goal || 15) ? (Number(parsed.streak) || 1) + 1 : 1;
            return { date: todayKey, solved: 0, correct: 0, goal: prefs.daily_goal, streak: nextStreak, celebrated: false, wrong_ids: [], wrong_cards: {} };
          }
        }
      } catch (_e) {}
      return { date: todayKey, solved: 0, correct: 0, goal: prefs.daily_goal, streak: 1, celebrated: false, wrong_ids: [], wrong_cards: {} };
    }

    function saveProfileSession(profileId, sess) {
      try { if (typeof localStorage !== "undefined") localStorage.setItem(`braindeck_family_session_v1_${profileId}`, JSON.stringify(sess)); } catch (_e) {}
    }

    function speakEnglishWord(word) {
      if (!word || typeof window === "undefined" || !("speechSynthesis" in window)) return false;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(word);
        u.lang = "en-US";
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
        return true;
      } catch (_e) { return false; }
    }

    function refreshSessionAndCoachingUi() {
      const prefs = loadProfilePrefs(activeProfile), sess = loadProfileSession(activeProfile);
      const summary = wasmApi.evaluateDailySessionWasm(sess.solved, sess.correct, sess.goal, sess.streak);
      const lbl = el("bd-daily-session-counter"), stamps = el("bd-daily-stamp-strip");
      if (lbl) lbl.textContent = summary.badge_label;
      if (stamps) stamps.textContent = summary.stamp_bar;

      const profSel = el("bd-family-profile-select"), goalSel = el("bd-daily-goal-select");
      const engSel = el("bd-quick-eng-level"), hjSel = el("bd-quick-hanja-level");
      if (profSel && profSel.value !== activeProfile) profSel.value = activeProfile;
      if (goalSel) goalSel.value = String(prefs.daily_goal);
      if (engSel) engSel.value = prefs.eng_level;
      if (hjSel) hjSel.value = prefs.hanja_level;

      const btnWrong = el("btn-quick-today-wrong");
      const wrongCount = Array.isArray(sess.wrong_ids) ? sess.wrong_ids.length : 0;
      if (btnWrong) {
        btnWrong.textContent = `📝 오늘 오답 (${wrongCount})`;
        btnWrong.disabled = wrongCount === 0;
      }

      const card = typeof currentCard === "function" ? currentCard() : null;
      const isRevealed = Boolean(state && state.isRevealed);
      const safeFront = !card ? "" : isRevealed ? String(card.front_text || "") : String(card.front_text || "").replace(/\{\{c\d+::[^}]*\}\}/gi, "[...]");
      const safeBack = isRevealed && card ? card.back_text : "";
      const headword = card ? extractEnglishHeadword(safeFront, safeBack) : null;
      const btnSpeakNow = el("btn-quick-speak-now");
      if (btnSpeakNow) {
        btnSpeakNow.disabled = !headword;
        btnSpeakNow.title = headword ? `'${headword}' 영어 발음 듣기 (단축키 R)` : "영단어가 없는 카드입니다";
      }

      const coachingEl = el("bd-card-coaching-banner");
      if (coachingEl) {
        if (!card) coachingEl.style.display = "none";
        else {
          const hj = wasmApi.hanjaCoachingWasm(`${safeFront} ${safeBack || ""}`);
          const en = !hj && headword ? wasmApi.englishPhonicsWasm(headword) : "";
          const tip = hj || en;
          coachingEl.textContent = tip;
          coachingEl.style.display = tip ? "block" : "none";
        }
      }
      const unrevealedFront = card ? String(card.front_text || "").replace(/\{\{c\d+::[^}]*\}\}/gi, "[...]") : "";
      const frontHeadword = card ? extractEnglishHeadword(unrevealedFront, "") : null;
      if (autoTtsEnabled && card && frontHeadword && card.card_id !== lastSpokenCardId) {
        lastSpokenCardId = card.card_id;
        speakEnglishWord(frontHeadword);
      }
      if (summary.goal_reached && !sess.celebrated) {
        sess.celebrated = true;
        saveProfileSession(activeProfile, sess);
        const modal = el("bd-session-complete-modal"), modalSummary = el("bd-session-complete-summary");
        if (modalSummary) modalSummary.textContent = `${summary.badge_label} (${summary.stamp_bar})`;
        if (modal) modal.style.display = "flex";
      }
    }

    const profSelect = el("bd-family-profile-select");
    if (profSelect) profSelect.addEventListener("change", () => {
      activeProfile = profSelect.value || "kid1";
      try { if (typeof localStorage !== "undefined") localStorage.setItem("braindeck_active_family_profile_v1", activeProfile); } catch (_e) {}
      lastSpokenCardId = null;
      if (state) { state.studyFilterMode = "all"; state.dailyExactWrongSet = null; }
      applyPersonaTierDomAndLogic(activeProfile, true);
      refreshSessionAndCoachingUi();
      if (showUxToast) showUxToast(`👤 맞춤 모드·프로필 전환 완료 (${profSelect.options[profSelect.selectedIndex].text})`, "emerald");
    });

    if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
      document.querySelectorAll("[data-onboarding-tier], [data-age-tier]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const rawTier = btn.getAttribute("data-onboarding-tier") || btn.getAttribute("data-age-tier") || "teen";
          activeProfile = rawTier === "junior" ? "kid1" : rawTier === "teen" ? "teen" : "adult";
          try { if (typeof localStorage !== "undefined") localStorage.setItem("braindeck_active_family_profile_v1", activeProfile); } catch (_e) {}
          applyPersonaTierDomAndLogic(activeProfile, false);
          refreshSessionAndCoachingUi();
        });
      });
    }

    const btnKidsParentUnlock = el("btn-kids-parent-unlock");
    if (btnKidsParentUnlock) {
      btnKidsParentUnlock.addEventListener("click", () => {
        if (typeof document === "undefined" || !document.body) return;
        const isOpen = document.body.getAttribute("data-kids-parent-menu") === "open";
        const nextState = isOpen ? "closed" : "open";
        document.body.setAttribute("data-kids-parent-menu", nextState);
        btnKidsParentUnlock.setAttribute("aria-expanded", isOpen ? "false" : "true");
        btnKidsParentUnlock.textContent = isOpen ? "👨‍👩‍👧 전체메뉴" : "👨‍👩‍👧 전체메뉴 닫기";
      });
    }

    const goalSelect = el("bd-daily-goal-select");
    if (goalSelect) goalSelect.addEventListener("change", () => {
      const prefs = loadProfilePrefs(activeProfile);
      prefs.daily_goal = normalizeDailyGoal(goalSelect.value);
      saveProfilePrefs(activeProfile, prefs);
      const sess = loadProfileSession(activeProfile);
      sess.goal = prefs.daily_goal; sess.celebrated = sess.solved >= sess.goal;
      saveProfileSession(activeProfile, sess); refreshSessionAndCoachingUi();
      if (typeof document !== "undefined" && document.body && document.body.getAttribute("data-persona-tier") === "kids" && typeof refreshDashboardAndQueue === "function") {
        refreshDashboardAndQueue();
      }
    });

    const engLevelSel = el("bd-quick-eng-level"), hjLevelSel = el("bd-quick-hanja-level");
    if (engLevelSel) engLevelSel.addEventListener("change", () => { const p = loadProfilePrefs(activeProfile); p.eng_level = engLevelSel.value; saveProfilePrefs(activeProfile, p); });
    if (hjLevelSel) hjLevelSel.addEventListener("change", () => { const p = loadProfilePrefs(activeProfile); p.hanja_level = hjLevelSel.value; saveProfilePrefs(activeProfile, p); });

    const btnQuickEng = el("btn-quick-start-english"), btnQuickHanja = el("btn-quick-start-hanja");
    if (btnQuickEng && typeof launchQuickFocusCollection === "function") btnQuickEng.addEventListener("click", () => {
      const p = loadProfilePrefs(activeProfile);
      const meta = resolveSubjectLevelMeta("english", (engLevelSel && engLevelSel.value) || p.eng_level);
      launchQuickFocusCollection(meta.id, meta.limit, meta.label);
    });
    if (btnQuickHanja && typeof launchQuickFocusCollection === "function") btnQuickHanja.addEventListener("click", () => {
      const p = loadProfilePrefs(activeProfile);
      const meta = resolveSubjectLevelMeta("hanja", (hjLevelSel && hjLevelSel.value) || p.hanja_level);
      launchQuickFocusCollection(meta.id, meta.limit, meta.label);
    });

    const btnSpeakNow = el("btn-quick-speak-now");
    if (btnSpeakNow) btnSpeakNow.addEventListener("click", () => {
      const card = typeof currentCard === "function" ? currentCard() : null;
      const isRev = Boolean(state && state.isRevealed);
      const safeFront = !card ? "" : isRev ? String(card.front_text || "") : String(card.front_text || "").replace(/\{\{c\d+::[^}]*\}\}/gi, "[...]");
      const safeBack = isRev && card ? card.back_text : "";
      const hw = card ? extractEnglishHeadword(safeFront, safeBack) : null;
      if (hw) speakEnglishWord(hw);
    });

    function activateTodayWrongReview() {
      const sess = loadProfileSession(activeProfile);
      if (state && Array.isArray(sess.wrong_ids) && sess.wrong_ids.length > 0) {
        state.sessionWrongCardIds = sess.wrong_ids.slice();
        state.sessionWrongCardMap = state.sessionWrongCardMap || {};
        sess.wrong_ids.forEach((cid) => {
          if (sess.wrong_cards && sess.wrong_cards[cid]) state.sessionWrongCardMap[cid] = sess.wrong_cards[cid];
        });
        state.dailyExactWrongSet = new Set(sess.wrong_ids.map(Number));
        if (typeof setStudyFilterMode === "function") setStudyFilterMode("wrong_only");
        if (showUxToast) showUxToast(`📝 오늘 틀린·모르는 문제 (${sess.wrong_ids.length}장) 집중 복습을 시작합니다!`, "amber");
      }
    }

    const btnWrongToday = el("btn-quick-today-wrong");
    if (btnWrongToday) btnWrongToday.addEventListener("click", activateTodayWrongReview);

    const btnAutoTts = el("btn-toggle-auto-tts");
    if (btnAutoTts) btnAutoTts.addEventListener("click", () => {
      autoTtsEnabled = !autoTtsEnabled;
      btnAutoTts.setAttribute("aria-pressed", autoTtsEnabled ? "true" : "false");
      btnAutoTts.textContent = autoTtsEnabled ? "🔊 자동발음 ON" : "🔇 자동발음 OFF";
    });

    const btnMore10 = el("btn-session-more-10"), btnRetryWrongModal = el("btn-session-retry-wrong"), btnCloseModal = el("btn-session-finish-close");
    if (btnMore10) btnMore10.addEventListener("click", () => {
      const s = loadProfileSession(activeProfile);
      s.goal += 10;
      s.celebrated = false;
      saveProfileSession(activeProfile, s);
      const m = el("bd-session-complete-modal");
      if (m) m.style.display = "none";
      refreshSessionAndCoachingUi();
      if (typeof refreshDashboardAndQueue === "function") refreshDashboardAndQueue();
    });
    if (btnRetryWrongModal) btnRetryWrongModal.addEventListener("click", () => { const m = el("bd-session-complete-modal"); if (m) m.style.display = "none"; activateTodayWrongReview(); });
    if (btnCloseModal) btnCloseModal.addEventListener("click", () => { const m = el("bd-session-complete-modal"); if (m) m.style.display = "none"; });

    const manualModal = el("bd-user-manual-modal"), manualBody = el("bd-user-manual-body");
    const btnOpenManual = el("btn-open-user-manual"), btnCloseManual = el("btn-close-user-manual");
    function switchManualTab(tabKey) {
      if (!manualBody) return;
      manualBody.innerHTML = renderUserManualTabHtml(tabKey);
      ["kids", "parents", "shortcuts"].forEach((k) => { const b = el(`btn-manual-tab-${k}`); if (b) { if (k === tabKey) b.classList.add("btn-primary"); else b.classList.remove("btn-primary"); } });
    }
    function openManualModal() {
      if (!manualModal) return;
      switchManualTab("kids");
      manualModal.style.display = "flex";
      if (btnCloseManual && typeof btnCloseManual.focus === "function") btnCloseManual.focus();
    }
    function closeManualModal() {
      if (!manualModal) return;
      manualModal.style.display = "none";
      if (btnOpenManual && typeof btnOpenManual.focus === "function") btnOpenManual.focus();
    }
    if (btnOpenManual && manualModal) btnOpenManual.addEventListener("click", openManualModal);
    if (btnCloseManual && manualModal) btnCloseManual.addEventListener("click", closeManualModal);
    ["kids", "parents", "shortcuts"].forEach((k) => { const b = el(`btn-manual-tab-${k}`); if (b) b.addEventListener("click", () => switchManualTab(k)); });
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          if (manualModal && manualModal.style.display === "flex") closeManualModal();
          const cm = el("bd-session-complete-modal"); if (cm && cm.style.display === "flex") cm.style.display = "none";
        } else if (ev.key === "?" && manualModal && !["INPUT", "TEXTAREA", "SELECT"].includes((ev.target && ev.target.tagName) || "")) {
          openManualModal();
        }
      });
    }

    applyPersonaTierDomAndLogic(activeProfile, false);
    refreshSessionAndCoachingUi();
    return {
      recordAnswer(rating, cardId) {
        const sess = loadProfileSession(activeProfile);
        sess.solved += 1;
        if (Number(rating) >= 3) sess.correct += 1;
        if (cardId) {
          const isWrong = Number(rating) <= 2;
          sess.wrong_ids = mergeUniqueWrongIds(sess.wrong_ids, cardId, isWrong);
          sess.wrong_cards = sess.wrong_cards || {};
          const cur = typeof currentCard === "function" ? currentCard() : null;
          if (isWrong && cur && Number(cur.card_id) === Number(cardId)) sess.wrong_cards[cardId] = cur;
          else if (!isWrong) delete sess.wrong_cards[cardId];
        }
        saveProfileSession(activeProfile, sess);
        refreshSessionAndCoachingUi();
      },
      saveSelectedDeck(deckId) {
        const p = loadProfilePrefs(activeProfile);
        p.selected_deck_id = String(deckId || "");
        saveProfilePrefs(activeProfile, p);
      },
      getActiveDailyGoal() {
        const sess = loadProfileSession(activeProfile);
        const prefs = loadProfilePrefs(activeProfile);
        return Math.max(Number(sess.goal) || 0, Number(prefs.daily_goal) || 10);
      },
      resolveEffectiveDailyNew(newSel) {
        if (newSel && newSel.value && newSel.value !== "auto") return Number(newSel.value);
        const isKids = typeof document !== "undefined" && document.body && document.body.getAttribute("data-persona-tier") === "kids";
        if (!isKids) return null;
        const sess = loadProfileSession(activeProfile);
        const prefs = loadProfilePrefs(activeProfile);
        return Math.max(Number(sess.goal) || 0, Number(prefs.daily_goal) || 10);
      },
      refreshSessionAndCoachingUi,
    };
  }

  return {
    VALID_DAILY_GOALS,
    ENGLISH_LEVEL_OPTIONS,
    HANJA_LEVEL_OPTIONS,
    USER_MANUAL_SECTIONS,
    getLocalDateKey,
    normalizeDailyGoal,
    extractEnglishHeadword,
    mergeUniqueWrongIds,
    resolveSubjectLevelMeta,
    resolvePersonaPolicy,
    renderUserManualTabHtml,
    bindCommercialKidsFocusDom,
  };
});
