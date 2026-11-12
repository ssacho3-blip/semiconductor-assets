(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BrainDeckStandaloneEngineOps = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STANDALONE_STORE_PACKS = [
    {
      pack_id: "pack.free.starter_k12",
      title: "기초 한자 8급·초등 스타터",
      subtitle: "앱 설치 즉시 기본 탑재되는 무료 스타터 데이터팩 (본인 사진/PDF 업로드 무제한 무료 포함)",
      category: "starter_free",
      age_tier: "all",
      price_krw: 0,
      is_free_starter: true,
      link_kind: "collection",
      primary_ref_id: "hanja-grade:8geup",
      covered_ref_ids: ["hanja-grade:8geup", "ko-dictation:grade1-2", "moe-eng:elementary"],
      estimated_card_count: 100,
      badge_label: "무료 기본 탑재",
      features: ["어문회 8급 기초 한자 50자 양방향 인출 + 초등 받아쓰기 기본 내장", "사진·PDF 업로드 무제한 무료"],
      sample_cards: [{ front: "韓", back: "나라 한 (부수: 韋 · 17획)", tag: "hanja_8geup" }],
    },
    {
      pack_id: "pack.moe.eng.elem34",
      title: "초등 3~4학년 영단어",
      subtitle: "2022 개정 교육과정 초등 3~4학년군 기본 어휘표 · 생활·학교·자연·동작 영단어",
      category: "k12_textbook",
      age_tier: "junior",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:elem-3-4",
      covered_ref_ids: ["moe-eng:elem-3-4"],
      estimated_card_count: 240,
      badge_label: "초등 3~4",
      features: ["초등 3~4학년 기초 필수 영단어 240개(morning, weather, borrow 등)", "Lv.1~3 단계별 카드 & 예문 해설"],
      sample_cards: [{ front: "weather", back: "날씨 — How is the weather today?", tag: "초등 3~4" }],
    },
    {
      pack_id: "pack.moe.eng.elem56",
      title: "초등 5~6학년 영단어 800",
      subtitle: "2022 개정 교육과정 초등 5~6학년군 영단어 핵심 어휘 & 의사소통 표현",
      category: "k12_textbook",
      age_tier: "junior",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:elementary",
      covered_ref_ids: ["moe-eng:elementary"],
      estimated_card_count: 400,
      badge_label: "초등 5~6",
      features: ["초등 5~6학년 필수 영단어 400개 핵심(library, museum, vacation, between 등)", "중학 진학 전 필수 마스터"],
      sample_cards: [{ front: "museum", back: "박물관, 미술관 — We visited the science museum.", tag: "초등 5~6" }],
    },
    {
      pack_id: "pack.moe.eng.mid1200",
      title: "중학교 영단어 1,200·영문법",
      subtitle: "2022 개정 중학 필수 영단어 + 현재완료·관계대명사·감각동사 등 내신 핵심 영문법",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:middle-1200",
      covered_ref_ids: ["moe-eng:middle-1200"],
      estimated_card_count: 500,
      badge_label: "중학 영단어·문법",
      features: ["중학 필수 영단어 핵심 500개 + 내신 8대 핵심 영문법 동시 수록", "단어·문법 분리형 4지선다"],
      sample_cards: [{ front: "감각동사(look/smell/taste) 뒤 보어 품사는?", back: "형용사 (부사 -ly 불가)", tag: "중학 영문법" }],
    },
    {
      pack_id: "pack.moe.eng.high_csat",
      title: "고교·수능 학술 영단어",
      subtitle: "2022 개정 고등학교 공통영어 및 평가원 모의고사·수능 빈출 추상·학술 어휘",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:high-csat",
      covered_ref_ids: ["moe-eng:high-csat"],
      estimated_card_count: 500,
      badge_label: "고교·수능",
      features: ["평가원·수능 최빈출 학술 어휘 500개(hypothesis, empirical, correlation, cognitive 등)", "반의어·파생어 해설"],
      sample_cards: [{ front: "empirical", back: "경험적인, 실증적인 (↔ theoretical 이론적인)", tag: "수능 학술" }],
    },
    {
      pack_id: "pack.moe.kor.orthography_lit",
      title: "국어 맞춤법·문학 개념",
      subtitle: "자주 틀리는 한글 맞춤법(며칠/금세/되·돼/로서·로써) & 내신·수능 문학 개념어",
      category: "k12_textbook",
      age_tier: "all",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-kor:orthography-lit",
      covered_ref_ids: ["moe-kor:orthography-lit"],
      estimated_card_count: 300,
      badge_label: "국어·문학",
      features: ["한글 맞춤법·표준어 규정 혼동 어휘 & 필수 문학 개념어 300선(역설법, 객관적 상관물 등)"],
      sample_cards: [{ front: "'오늘이 몇 월 [ ___ ]이지?' 바른 맞춤법 표기는?", back: "며칠 ('몇일'은 틀린 표기)", tag: "한글 맞춤법" }],
    },
    {
      pack_id: "pack.moe.hanja.mid1800",
      title: "중·고교 한자 1,800",
      subtitle: "교육부 고시 한문 교육용 기초한자 핵심 대표자 양방향 인출",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-hanja-1800:middle",
      covered_ref_ids: ["moe-hanja-1800:middle"],
      estimated_card_count: 500,
      badge_label: "한자 1,800",
      features: ["교육부 고시 중·고교 기초한자 핵심 대표 250자 양방향 인출(500카드) 훈음·부수·획수"],
      sample_cards: [{ front: "溫故知新 (온고지신)", back: "옛것을 익히고 그것을 미루어 새것을 안다", tag: "기초한자 1800" }],
    },
    {
      pack_id: "pack.moe.hist.essential",
      title: "한국사 시대별 연표·사건",
      subtitle: "2022 개정 초·중·고 한국사 시대별 연표·조약·개혁·유네스코 세계유산 정리",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "khist:essential",
      covered_ref_ids: ["khist:essential"],
      estimated_card_count: 300,
      badge_label: "한국사 연표",
      features: ["시대별 핵심 사건·조약·개혁·문화재 연표 300선 총정리"],
      sample_cards: [{ front: "1876년 체결된 조선 최초의 근대적 조약이자 불평등 조약은?", back: "강화도 조약 (조일수호조규)", tag: "한국사 연표" }],
    },
    {
      pack_id: "pack.moe.sci.core_formula",
      title: "과학 법칙·공식",
      subtitle: "중·고등학교 과학 4대 영역(물리·화학·생명·지구과학) 법칙·화학결합·공식",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "sci-element-formula:core",
      covered_ref_ids: ["sci-element-formula:core"],
      estimated_card_count: 300,
      badge_label: "과학 법칙·공식",
      features: ["옴의 법칙(V=IR), 뉴턴 가속도 법칙(F=ma), 필수 원소(1~20번), 미토콘드리아 ATP, 판구조론 300선"],
      sample_cards: [{ front: "뉴턴 운동 제2법칙(가속도 법칙) 공식은?", back: "F = m × a (알짜힘 = 질량 × 가속도)", tag: "물리 법칙" }],
    },
    {
      pack_id: "pack.moe.math.core_formula",
      title: "중·고교 수학 공식",
      subtitle: "중·고등학교 수학과 대수·기하·삼각함수·수열·미적분 공식 정리",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-math:core-formulas",
      covered_ref_ids: ["moe-math:core-formulas"],
      estimated_card_count: 300,
      badge_label: "수학 공식",
      features: ["피타고라스 정리, 근의 공식·판별식, 삼각함수 제곱 관계, 등차수열 일반항, 미분계수 정의 300선"],
      sample_cards: [{ front: "첫째항 a, 공차 d인 등차수열의 일반항 aₙ과 미분계수 f'(a)는?", back: "aₙ = a + (n - 1)d · f'(a) = lim(h→0)[f(a+h)-f(a)]/h", tag: "수학 공식" }],
    },
    {
      pack_id: "pack.mid1.eng.donga_yoon.full",
      title: "중1 영어 단원 어휘 [동아(윤정미) 진도 호환·비공식]",
      subtitle: "2022 개정 교육과정 성취기준 기반 · 단원별·쪽수별 진도 호환 슬라이싱 + 영단어·문법 (비공식)",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid1.eng.donga_yoon.2022",
      covered_ref_ids: ["kr.mid1.eng.donga_yoon.2022"],
      estimated_card_count: 240,
      badge_label: "중1 내신",
      features: ["Lesson 1 ~ Lesson 8 전 단원 필수 어휘·숙어·핵심 문법 완벽 매핑 (240카드)"],
      sample_cards: [{ front: "introduce (p.12)", back: "소개하다 (동사)", tag: "Lesson 1" }],
    },
    {
      pack_id: "pack.mid2.eng.donga_yoon.full",
      title: "중2 영어 단원 어휘 [동아(윤정미) 진도 호환·비공식]",
      subtitle: "중학교 2학년 내신 대비 · 단원/쪽수 진도 호환 슬라이싱 & 4지선다 유의어 구성 (비공식)",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid2.eng.donga_yoon.2022",
      covered_ref_ids: ["kr.mid2.eng.donga_yoon.2022"],
      estimated_card_count: 240,
      badge_label: "중2 내신",
      features: ["중2 영어(동아 윤정미 진도 호환) 단원별 어휘·문법 핵심 수록 (240카드)"],
      sample_cards: [{ front: "confident (p.16)", back: "자신감 있는 (형용사)", tag: "Lesson 1" }],
    },
    {
      pack_id: "pack.mid2.hist.miraeen.full",
      title: "중2 역사① 핵심 개념 [미래엔 진도 호환·비공식]",
      subtitle: "중학교 역사 내신 단원 진도 호환 매핑 · 동시대 사건 보기 자동 구성 (비공식)",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid2.hist.miraeen.2022",
      covered_ref_ids: ["kr.mid2.hist.miraeen.2022"],
      estimated_card_count: 240,
      badge_label: "역사 내신",
      features: ["중학교 역사①(미래엔 진도 호환) 단원·쪽수별 사건·연표·조약·문화재 정리 (240카드)"],
      sample_cards: [{ front: "훈민정음 창제 (1443, 반포 1446)", back: "조선 세종 대 백성을 가르치는 바른 소리 28자 창제", tag: "Ⅰ단원" }],
    },
    {
      pack_id: "pack.high1.sci.visang.full",
      title: "고1 통합과학1 공식·원소 [비상 진도 호환·비공식]",
      subtitle: "고등학교 1학년 통합과학 물리·화학·생명·지구과학 공식 및 원소 진도 호환 (비공식)",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.high1.sci.visang.2022",
      covered_ref_ids: ["kr.high1.sci.visang.2022", "sci-element-formula:core"],
      estimated_card_count: 240,
      badge_label: "고1 내신",
      features: ["고1 통합과학1(비상 진도 호환) 단원별 핵심 공식 및 필수 원소 매핑 (240카드)"],
      sample_cards: [{ front: "옴의 법칙: V = I × R", back: "전압(V)은 전류(I)와 저항(R)의 곱에 비례한다", tag: "통합과학1" }],
    },
    {
      pack_id: "pack.exam.hanja_master",
      title: "급수 대비 한자 7급~3급·사자성어 [어문회 급수 대비·비공식]",
      subtitle: "동음이의어·유사한자 함정선지 방어 + 두음법칙/다음자(樂 락·악·요) 채점 (비공식 독립 콘텐츠)",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 1500,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "hanja-grade:7geup",
      covered_ref_ids: ["hanja-grade:7geup", "hanja-grade:6geup", "hanja-grade:5geup", "hanja-grade:4geup", "hanja-grade:3geup", "ko-idiom:essential"],
      estimated_card_count: 200,
      badge_label: "급수한자",
      features: ["한자 7급~3급 급수별 배정 한자(각 100자 양방향 200카드) 및 필수 사자성어 300선 잠금해제"],
      sample_cards: [{ front: "樂 (3급 대표 다음자)", back: "즐길 락(낙) / 노래 악 / 좋아할 요 (부수: 木 · 15획)", tag: "hanja_3geup" }],
    },
    {
      pack_id: "pack.exam.khist_master",
      title: "한국사능력검정 심화(1~3급)",
      subtitle: "고려·조선·근현대사 사건·조약·유네스코 문화재 정리",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 1500,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "khist:essential",
      covered_ref_ids: ["khist:essential"],
      estimated_card_count: 300,
      badge_label: "한능검",
      features: ["시대별·왕대별 핵심 사건·조약·문화재 연표 300선 Cloze"],
      sample_cards: [{ front: "갑신정변 (1884)", back: "김옥균·박영효 등 급진개화파가 일으킨 근대화 개혁 운동", tag: "khist" }],
    },
    {
      pack_id: "pack.exam.lang_toeic_jlpt",
      title: "비즈니스 영어(TOEIC® 대비)·일본어(JLPT N5~N3 대비) [비공식]",
      subtitle: "자체 클린룸 비즈니스 영어 어휘 + 일본어 한자·히라가나 발음/원어민 TTS 드릴 (비공식)",
      category: "language_exam",
      age_tier: "adult",
      price_krw: 1900,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "exam-eng:toeic-core",
      covered_ref_ids: ["exam-eng:toeic-core", "exam-ja:jlpt-n5-n3"],
      estimated_card_count: 500,
      badge_label: "어학",
      features: ["토익 빈출 어휘 500선 및 JLPT 핵심 어휘 500선 동시 수록"],
      sample_cards: [{ front: "reimburse", back: "(경비를) 변제하다, 환급하다 (동사 · C1)", tag: "TOEIC" }],
    },
    {
      pack_id: "pack.pro.law_it_cert",
      title: "헌법 조문·정보처리기사",
      subtitle: "공무원·법학 시험 헌법 조문 + IT 자격증(정처기·컴활) 개념 수록",
      category: "pro_cert",
      age_tier: "adult",
      price_krw: 1900,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "cert-it:core",
      covered_ref_ids: ["cert-it:core", "law-statute:constitution"],
      estimated_card_count: 300,
      badge_label: "수험·자격증",
      features: ["대한민국 헌법 핵심 조문 300선 & 정보처리기사·컴활 필수 개념 300선 완벽 정리"],
      sample_cards: [{ front: "데이터베이스 트랜잭션의 4대 특성 (ACID)", back: "원자성, 일관성, 격리성, 영속성", tag: "정처기" }],
    },
  ];


  function attachStandaloneEngineOps(core, deps) {
    const {
      loadDb,
      saveDb,
      getLastSaveStatus,
      hydrateFromIndexedDb,
      getCatalog,
      getDashboard,
      getDueCards,
      exploreDeckCards,
      getStudyPlan,
      applyStudyPlan,
      insertDeckWithSpecs,
      buildExamScopeDeck,
      buildCollectionDeck,
      buildCombinedExamDeck,
      buildSmartTextDeck,
      submitReview,
    } = core;
    const {
      STANDALONE_COLLECTIONS,
      STANDALONE_STORE_PACKS,
      _getModule,
      advanceOnboardingState,
      applyCardActionCore,
      buildTypeMatchedQuizOptions,
      calculateStoreBundleQuote,
      checkStatuteStaleness,
      classifyScriptProfileJs,
      cleanCardFrontForDisplayJs,
      computeRetrievability,
      computeRetentionAndForgettingCurveVm,
      enrichConceptCurriculumMetadata,
      evaluateTypedAnswerUnderstanding,
      extractTargetAndExplanation,
      filterStorePacks,
      generateProgressiveHint,
      mergeNoteLwwRegisters,
      mergeReviewLogGSet,
      padStandaloneSpecsToTarget,
      resolveWcagKeyboardShortcut,
      validateSyncDeltaEnvelope,
    } = deps;
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
            limit: Number(pack.estimated_card_count || 240),
          });
        } else {
          mountedDeck = buildCollectionDeck({
            collection_id: pack.primary_ref_id,
            deck_name: targetDeckTitle,
            difficulty_level: "mixed",
            limit: Number(pack.estimated_card_count || 240),
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

    function installStorePack(packOrSlug, difficultyLevel, targetLimit) {
      const slug = String((packOrSlug && packOrSlug.pack_id) || packOrSlug || "starter_k12").trim();
      const pack =
        STANDALONE_STORE_PACKS.find(
          (it) => it.pack_id === slug || it.pack_id.endsWith("." + slug) || it.primary_ref_id === slug
        ) || STANDALONE_STORE_PACKS[0];
      const db = loadDb();
      if (!Array.isArray(db.unlockedPackIds)) db.unlockedPackIds = ["pack.free.starter_k12"];
      if (!db.unlockedPackIds.includes(pack.pack_id)) db.unlockedPackIds.push(pack.pack_id);
      saveDb(db);
      const diff = String(difficultyLevel || (packOrSlug && packOrSlug.difficulty_level) || "mixed");
      const lim = Number(targetLimit || (packOrSlug && packOrSlug.limit) || pack.estimated_card_count || 240);
      const mounted =
        pack.link_kind === "textbook"
          ? buildExamScopeDeck({ textbook_id: pack.primary_ref_id, deck_name: pack.title, difficulty_level: diff, limit: lim })
          : buildCollectionDeck({ collection_id: pack.primary_ref_id, deck_name: pack.title, difficulty_level: diff, limit: lim });
      return {
        ok: true,
        standalone: true,
        pack_id: pack.pack_id,
        deck_id: mounted.deck_id,
        deck_name: mounted.deck_name,
        saved_count: mounted.saved_count,
        mounted_deck: mounted,
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

    function buildCollectionCards(collectionId, difficultyLevel, targetCount) {
      const cid = String(collectionId || "hanja-grade:8geup").trim();
      const col = STANDALONE_COLLECTIONS.find((c) => c.collection_id === cid);
      const diff = difficultyLevel || "mixed";
      return padStandaloneSpecsToTarget(col ? col.items : [], col ? col.collection_id : cid, diff, targetCount);
    }

    function extractCleanTargetAnswer(frontText, backText) {
      return extractTargetAndExplanation(frontText, backText);
    }

    const MAX_CARD_TEXT_LEN_JS = 4000;
    const MAX_IMPORT_DECKS_JS = 200;
    const MAX_IMPORT_CARDS_JS = 10000;

    function addDirectCard(payload) {
      const p = payload || {};
      const front = String(p.frontText !== undefined ? p.frontText : p.front_text !== undefined ? p.front_text : p.front || "")
        .replace(/\0/g, "")
        .trim();
      const back = String(p.backText !== undefined ? p.backText : p.back_text !== undefined ? p.back_text : p.back || "")
        .replace(/\0/g, "")
        .trim();
      if (!front || !back) {
        return { ok: false, standalone: true, error_code: "EMPTY_CARD_CONTENT", error: "앞면과 뒷면 내용을 모두 입력해 주세요." };
      }
      if (front.length > MAX_CARD_TEXT_LEN_JS || back.length > MAX_CARD_TEXT_LEN_JS) {
        return { ok: false, standalone: true, error_code: "CARD_CONTENT_TOO_LONG", error: "앞면과 뒷면은 각각 4,000자를 초과할 수 없습니다." };
      }
      const db = loadDb();
      const requestedDeckId = Number(p.deckId !== undefined ? p.deckId : p.deck_id);
      let targetDeck = db.decks.find((d) => Number(d.deck_id) === requestedDeckId);
      if (!targetDeck) {
        targetDeck = db.decks[0];
      }
      const rawTags = p.tags;
      const tags = (
        Array.isArray(rawTags)
          ? rawTags.map((t) => String(t || "").replace(/\0/g, "").trim().slice(0, 64)).filter(Boolean)
          : String(rawTags || "direct_input")
              .split(/[,\s]+/)
              .map((t) => t.replace(/\0/g, "").trim().slice(0, 64))
              .filter(Boolean)
      ).slice(0, 32);
      const noteType = String(p.noteType || p.note_type || (front.includes("{{c") ? "cloze" : "basic")) === "cloze" ? "cloze" : "basic";
      const nowIso = new Date().toISOString();
      const cid = Number(db.nextCardId) || db.cards.length + 1;
      db.nextCardId = cid + 1;
      const newCard = {
        card_id: cid,
        id: cid,
        deck_id: Number(targetDeck.deck_id),
        deck_name: String(targetDeck.name),
        front_text: front,
        front,
        back_text: back,
        back,
        note_type: noteType,
        tags: tags.length > 0 ? tags : ["direct_input"],
        state: "new",
        reps: 0,
        lapses: 0,
        stability: 1.2,
        difficulty: 5.0,
        due_at: nowIso,
        flag: 0,
        suspended: false,
      };
      db.cards.push(newCard);
      if (!saveDb(db)) {
        db.cards.pop();
        return {
          ok: false,
          standalone: true,
          error_code: "STORAGE_WRITE_FAILED",
          error: (lastSaveStatus && lastSaveStatus.error) || "QUOTA_EXCEEDED",
        };
      }
      return {
        ok: true,
        standalone: true,
        card_id: cid,
        deck_id: Number(targetDeck.deck_id),
        deck_name: String(targetDeck.name),
        saved_count: 1,
        card: newCard,
      };
    }

    function updateCard(payload) {
      const p = payload || {};
      const cid = Number(p.cardId !== undefined ? p.cardId : p.card_id);
      const front = String(p.frontText !== undefined ? p.frontText : p.front_text !== undefined ? p.front_text : p.front || "")
        .replace(/\0/g, "")
        .trim();
      const back = String(p.backText !== undefined ? p.backText : p.back_text !== undefined ? p.back_text : p.back || "")
        .replace(/\0/g, "")
        .trim();
      if (!front || !back) {
        return { ok: false, standalone: true, error_code: "EMPTY_CARD_CONTENT", error: "앞면과 뒷면 내용을 모두 입력해 주세요." };
      }
      if (front.length > MAX_CARD_TEXT_LEN_JS || back.length > MAX_CARD_TEXT_LEN_JS) {
        return { ok: false, standalone: true, error_code: "CARD_CONTENT_TOO_LONG", error: "앞면과 뒷면은 각각 4,000자를 초과할 수 없습니다." };
      }
      const db = loadDb();
      const card = db.cards.find((c) => Number(c.card_id) === cid);
      if (!card) {
        return { ok: false, standalone: true, error_code: "CARD_NOT_FOUND", error: "카드를 찾을 수 없습니다." };
      }
      const prevSnap = JSON.parse(JSON.stringify(card));
      card.front_text = front;
      card.front = front;
      card.back_text = back;
      card.back = back;
      if (p.tags !== undefined) {
        card.tags = (
          Array.isArray(p.tags)
            ? p.tags.map((t) => String(t || "").replace(/\0/g, "").trim().slice(0, 64)).filter(Boolean)
            : String(p.tags || "")
                .split(/[,\s]+/)
                .map((t) => t.replace(/\0/g, "").trim().slice(0, 64))
                .filter(Boolean)
        ).slice(0, 32);
      }
      card.updated_at = new Date().toISOString();
      if (!saveDb(db)) {
        Object.assign(card, prevSnap);
        return {
          ok: false,
          standalone: true,
          error_code: "STORAGE_WRITE_FAILED",
          error: (lastSaveStatus && lastSaveStatus.error) || "QUOTA_EXCEEDED",
        };
      }
      return {
        ok: true,
        standalone: true,
        card_id: card.card_id,
        front_text: card.front_text,
        back_text: card.back_text,
        reps: card.reps,
        stability: card.stability,
        card,
      };
    }

    function deleteCard(payload) {
      const p = payload || {};
      const cid = Number(p.cardId !== undefined ? p.cardId : p.card_id);
      const db = loadDb();
      const prevCards = db.cards.slice();
      db.cards = db.cards.filter((c) => Number(c.card_id) !== cid);
      if (db.cards.length === prevCards.length) {
        return { ok: false, standalone: true, error_code: "CARD_NOT_FOUND", error: "삭제할 카드를 찾을 수 없습니다." };
      }
      if (!saveDb(db)) {
        db.cards = prevCards;
        return {
          ok: false,
          standalone: true,
          error_code: "STORAGE_WRITE_FAILED",
          error: (lastSaveStatus && lastSaveStatus.error) || "QUOTA_EXCEEDED",
        };
      }
      return {
        ok: true,
        standalone: true,
        deleted_card_id: cid,
        remaining_cards: db.cards.length,
        revlog_preserved: true,
      };
    }

    function suspendCard(payload) {
      const p = payload || {};
      const cid = Number(p.cardId !== undefined ? p.cardId : p.card_id);
      const db = loadDb();
      const card = db.cards.find((c) => Number(c.card_id) === cid);
      if (!card) {
        return { ok: false, standalone: true, error_code: "CARD_NOT_FOUND", error: "카드를 찾을 수 없습니다." };
      }
      const prevSusp = card.suspended;
      const prevState = card.state;
      const nextSusp = p.suspended !== undefined ? Boolean(p.suspended) : !Boolean(card.suspended || card.state === "suspended");
      card.suspended = nextSusp;
      card.state = nextSusp ? "suspended" : Number(card.reps || 0) > 0 ? "review" : "new";
      if (!saveDb(db)) {
        card.suspended = prevSusp;
        card.state = prevState;
        return {
          ok: false,
          standalone: true,
          error_code: "STORAGE_WRITE_FAILED",
          error: (lastSaveStatus && lastSaveStatus.error) || "QUOTA_EXCEEDED",
        };
      }
      return {
        ok: true,
        standalone: true,
        card_id: card.card_id,
        suspended: card.suspended,
        state: card.state,
      };
    }

    function applyCardAction(payload) {
      const p = payload || {};
      const cid = Number(p.cardId !== undefined ? p.cardId : p.card_id);
      const db = loadDb();
      const card = db.cards.find((c) => Number(c.card_id) === cid);
      if (!card) {
        return { ok: false, standalone: true, error_code: "CARD_NOT_FOUND", error: "카드를 찾을 수 없습니다." };
      }
      const prevSnap = JSON.parse(JSON.stringify(card));
      const res = applyCardActionCore(card, p.action, p);
      card.flag = Number(res.flag || 0);
      card.suspended = Boolean(res.suspended);
      card.buried_today = Boolean(res.buried_today);
      card.marked = Boolean(res.marked);
      card.state = String(res.state || card.state || "new");
      if (!saveDb(db)) {
        Object.assign(card, prevSnap);
        return {
          ok: false,
          standalone: true,
          error_code: "STORAGE_WRITE_FAILED",
          error: (lastSaveStatus && lastSaveStatus.error) || "QUOTA_EXCEEDED",
        };
      }
      return Object.assign({ ok: true, standalone: true, card_id: card.card_id }, res);
    }

    function evaluateTypedAnswer(frontOrPayload, backText, userTyped) {
      let front = "";
      let back = "";
      let typed = "";
      let expected = "";
      if (frontOrPayload && typeof frontOrPayload === "object") {
        front = String(frontOrPayload.front_text || frontOrPayload.front || "");
        back = String(frontOrPayload.back_text || frontOrPayload.back || "");
        expected = String(frontOrPayload.expected_answer || frontOrPayload.target_answer || "");
        typed = String(frontOrPayload.user_answer || frontOrPayload.typed_answer || frontOrPayload.answer || "");
      } else {
        front = String(frontOrPayload || "");
        back = String(backText || "");
        typed = String(userTyped || "");
      }
      const ext = extractTargetAndExplanation(front, back, expected);
      const res = evaluateTypedAnswerUnderstanding(ext.targetAnswer || back, typed);
      return {
        ok: true,
        standalone: true,
        verdict: res.verdict,
        badge_label: res.badgeLabel,
        badgeLabel: res.badgeLabel,
        tone: res.tone,
        score_pct: res.scorePct,
        scorePct: res.scorePct,
        recommended_rating: res.recommendedRating,
        recommendedRating: res.recommendedRating,
        matched_terms: res.matchedTerms,
        missing_terms: res.missingTerms,
        feedback: res.feedback,
      };
    }

    function generateProgressiveHintForCard(frontOrPayload, backText, step) {
      let front = "";
      let back = "";
      let stepNum = 1;
      let explicitTarget = "";
      let explicitExtra = "";
      if (frontOrPayload && typeof frontOrPayload === "object") {
        front = String(frontOrPayload.front_text || frontOrPayload.front || "");
        back = String(frontOrPayload.back_text || frontOrPayload.back || "");
        explicitTarget = String(frontOrPayload.target_answer || "");
        explicitExtra = String(frontOrPayload.extra_explanation || "");
        stepNum = Number(frontOrPayload.step || 1);
      } else {
        front = String(frontOrPayload || "");
        back = String(backText || "");
        stepNum = Number(step || 1);
      }
      const ext = extractTargetAndExplanation(front, back, explicitTarget, explicitExtra);
      const res = generateProgressiveHint(ext.targetAnswer || back, ext.extraExplanation, stepNum);
      return {
        ok: true,
        standalone: true,
        step: res.step,
        mask: res.mask,
        char_count: res.charCount,
        hint: res.cueText,
        cue_text: res.cueText,
        cueText: res.cueText,
      };
    }

    function decompressBacklog(payload) {
      const p = payload || {};
      const hasExplicitCap = p.daily_cap !== undefined || p.dailyCap !== undefined;
      const horizonDays = Math.max(1, Math.min(30, Number(p.horizon_days || p.horizonDays || p.days || p.spread_days || 7)));
      const dailyCap = hasExplicitCap ? Math.max(1, Math.min(500, Number(p.daily_cap ?? p.dailyCap))) : 0;
      const deckId = p.deckId !== undefined ? p.deckId : p.deck_id;
      const hasDeck = deckId !== undefined && deckId !== null && deckId !== "" && deckId !== "all";
      const db = loadDb();
      const nowMs = Date.now();

      if (!hasExplicitCap) {
        let rescheduledLegacy = 0;
        db.cards.forEach((c, idx) => {
          if (!c || c.suspended || c.state === "suspended") return;
          if (hasDeck && Number(c.deck_id) !== Number(deckId)) return;
          const dueMs = c.due_at ? Date.parse(c.due_at) : nowMs;
          if (!Number.isFinite(dueMs) || dueMs <= nowMs) {
            const offsetDays = (idx % horizonDays) + 1;
            c.due_at = new Date(nowMs + offsetDays * 86400000).toISOString();
            rescheduledLegacy += 1;
          }
        });
        saveDb(db);
        return {
          ok: true,
          standalone: true,
          spread_days: horizonDays,
          horizon_days: horizonDays,
          total_due_evaluated: rescheduledLegacy,
          kept_today: 0,
          deferred_across_days: rescheduledLegacy,
          rescheduled_count: rescheduledLegacy,
          decompressed_count: rescheduledLegacy,
        };
      }

      const overdue = [];
      db.cards.forEach((c) => {
        if (!c || c.suspended || c.state === "suspended" || c.state === "new") return;
        if (hasDeck && Number(c.deck_id) !== Number(deckId)) return;
        const dueMs = c.due_at ? Date.parse(c.due_at) : nowMs;
        if (Number.isFinite(dueMs) && dueMs > nowMs) return;
        const stability = Math.max(0.1, Number(c.stability || 1.2));
        const elapsedDays = Number.isFinite(dueMs)
          ? Math.max(0.1, stability + Math.max(0, (nowMs - dueMs) / 86400000))
          : 1.0;
        const rNow =
          typeof computeRetrievability === "function"
            ? Number(computeRetrievability(elapsedDays, stability))
            : Math.pow(1 + (19 / 81) * (elapsedDays / stability), -0.5);
        const lapses = Math.max(0, Number(c.lapses || 0));
        const urgencyKey = rNow - Math.min(0.15, lapses * 0.03);
        overdue.push({ card: c, urgencyKey, cid: Number(c.card_id || 0) });
      });

      overdue.sort((a, b) => (a.urgencyKey !== b.urgencyKey ? a.urgencyKey - b.urgencyKey : a.cid - b.cid));
      let keptToday = 0;
      let rescheduled = 0;
      overdue.forEach((entry, idx) => {
        const dayOffset = Math.floor(idx / dailyCap);
        if (dayOffset <= 0) {
          keptToday += 1;
        } else {
          entry.card.due_at = new Date(nowMs + dayOffset * 86400000).toISOString();
          rescheduled += 1;
        }
      });
      const effectiveHorizonDays =
        overdue.length > 0 ? Math.max(horizonDays, Math.ceil(overdue.length / dailyCap)) : horizonDays;
      const overflowCards = Math.max(0, overdue.length - dailyCap * horizonDays);
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        spread_days: effectiveHorizonDays,
        horizon_days: effectiveHorizonDays,
        requested_horizon_days: horizonDays,
        overflow_cards: overflowCards,
        daily_cap: dailyCap,
        total_due_evaluated: overdue.length,
        kept_today: keptToday,
        deferred_across_days: rescheduled,
        rescheduled_count: rescheduled,
        decompressed_count: rescheduled,
      };
    }

    function decomposeLeechCard(payload) {
      const p = payload || {};
      const cid = Number(p.cardId !== undefined ? p.cardId : p.card_id);
      const db = loadDb();
      const srcCard = db.cards.find((c) => Number(c.card_id) === cid);
      const front = String((srcCard && srcCard.front_text) || p.front_text || p.front || "핵심 개념").trim();
      const back = String((srcCard && srcCard.back_text) || p.back_text || p.back || "정답").trim();
      const ext = extractTargetAndExplanation(front, back);
      const targetAns = ext.targetAnswer || back;
      const targetDeckId = Number((srcCard && srcCard.deck_id) || p.deck_id || (db.decks[0] && db.decks[0].deck_id) || 1);
      const sub1 = addDirectCard({
        deckId: targetDeckId,
        frontText: `[쪼개기 1단계 · 핵심 키워드] ${front}`,
        backText: targetAns,
        tags: ["leech_subcard", "step1"],
      });
      const sub2 = addDirectCard({
        deckId: targetDeckId,
        frontText: `[쪼개기 2단계 · 빈칸 확인] ${front} ➔ {{c1::${targetAns}}}`,
        backText: back,
        noteType: "cloze",
        tags: ["leech_subcard", "step2"],
      });
      const created = [sub1.card, sub2.card].filter(Boolean);
      return {
        ok: true,
        standalone: true,
        source_card_id: cid,
        created_count: created.length,
        sub_cards: created,
      };
    }

    function _computeLegacyBackupChecksumV80Js(decks, cards, history) {
      const raw = `${(decks || []).length}:${(cards || []).length}:${(history || []).length}:${JSON.stringify(
        (cards || []).slice(0, 50).map((c) => [c.card_id, c.front_text, c.back_text, c.reps])
      )}`;
      let h1 = 0x811c9dc5;
      for (let i = 0; i < raw.length; i += 1) {
        h1 ^= raw.charCodeAt(i);
        h1 = Math.imul(h1, 0x01000193) >>> 0;
      }
      return `bd80_${h1.toString(16).padStart(8, "0")}`;
    }

    const _SHA256_K_JS = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]);

    function _utf8BytesJs(str) {
      if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(String(str));
      }
      const b = Buffer.from(String(str), "utf8");
      return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    }

    function _utf8DecodeJs(bytes) {
      if (typeof TextDecoder !== "undefined") {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      }
      return Buffer.from(bytes).toString("utf8");
    }

    function _sha256BytesJs(msgBytes) {
      const len = msgBytes.length;
      const bitHi = Math.floor(len / 0x20000000);
      const bitLo = (len << 3) >>> 0;
      const padLen = ((len + 9 + 63) & ~63);
      const buf = new Uint8Array(padLen);
      buf.set(msgBytes);
      buf[len] = 0x80;
      const dv = new DataView(buf.buffer);
      dv.setUint32(padLen - 8, bitHi, false);
      dv.setUint32(padLen - 4, bitLo, false);

      let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
      let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
      const w = new Uint32Array(64);
      const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;

      for (let off = 0; off < padLen; off += 64) {
        for (let i = 0; i < 16; i += 1) w[i] = dv.getUint32(off + i * 4, false);
        for (let i = 16; i < 64; i += 1) {
          const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i += 1) {
          const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
          const ch = (e & f) ^ (~e & g);
          const temp1 = (h + S1 + ch + _SHA256_K_JS[i] + w[i]) >>> 0;
          const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
          const maj = (a & b) ^ (a & c) ^ (b & c);
          const temp2 = (S0 + maj) >>> 0;
          h = g; g = f; f = e; e = (d + temp1) >>> 0;
          d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
      }
      const out = new Uint8Array(32);
      const odv = new DataView(out.buffer);
      [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, idx) => odv.setUint32(idx * 4, v, false));
      return out;
    }

    function _bytesToHexJs(bytes) {
      let hex = "";
      for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, "0");
      return hex;
    }

    function _hmacSha256HexJs(keyBytes, msgBytes) {
      const k = keyBytes.length > 64 ? _sha256BytesJs(keyBytes) : keyBytes;
      const ipad = new Uint8Array(64);
      const opad = new Uint8Array(64);
      for (let i = 0; i < 64; i += 1) {
        const kb = i < k.length ? k[i] : 0;
        ipad[i] = kb ^ 0x36;
        opad[i] = kb ^ 0x5c;
      }
      const inner = new Uint8Array(64 + msgBytes.length);
      inner.set(ipad, 0);
      inner.set(msgBytes, 64);
      const innerDigest = _sha256BytesJs(inner);
      const outer = new Uint8Array(64 + 32);
      outer.set(opad, 0);
      outer.set(innerDigest, 64);
      return _bytesToHexJs(_sha256BytesJs(outer));
    }

    function _canonicalJsonForChecksumJs(val) {
      if (val === null || val === undefined) return "null";
      if (typeof val === "number") return Number.isFinite(val) ? JSON.stringify(val) : "null";
      if (typeof val === "boolean" || typeof val === "string") return JSON.stringify(val);
      if (Array.isArray(val)) {
        return "[" + val.map((item) => _canonicalJsonForChecksumJs(item)).join(",") + "]";
      }
      if (typeof val === "object") {
        const keys = Object.keys(val).filter((k) => val[k] !== undefined).sort();
        return "{" + keys.map((k) => JSON.stringify(k) + ":" + _canonicalJsonForChecksumJs(val[k])).join(",") + "}";
      }
      return "null";
    }

    function _computeBackupChecksumJs(decks, cards, history, unlockedPackIds) {
      const canonical = _canonicalJsonForChecksumJs({
        decks: Array.isArray(decks) ? decks : [],
        cards: Array.isArray(cards) ? cards : [],
        review_history: Array.isArray(history) ? history : [],
        unlocked_pack_ids: Array.isArray(unlockedPackIds) ? unlockedPackIds : ["pack.free.starter_k12"],
      });
      const digestHex = _bytesToHexJs(_sha256BytesJs(_utf8BytesJs(canonical)));
      return `bd81_${digestHex.slice(0, 32)}`;
    }

    function exportBackupPayload() {
      const db = loadDb();
      const snapshotDecks = JSON.parse(JSON.stringify(db.decks || []));
      const snapshotCards = JSON.parse(JSON.stringify(db.cards || []));
      const snapshotHist = JSON.parse(JSON.stringify(db.reviewHistory || []));
      const snapshotPacks = (db.unlockedPackIds || ["pack.free.starter_k12"]).slice();
      const checksum = _computeBackupChecksumJs(snapshotDecks, snapshotCards, snapshotHist, snapshotPacks);
      return {
        ok: true,
        standalone: true,
        schema_version: "8.0",
        exported_at: new Date().toISOString(),
        checksum,
        backup_checksum: checksum,
        decks: snapshotDecks,
        cards: snapshotCards,
        review_history: snapshotHist,
        unlocked_pack_ids: snapshotPacks,
      };
    }

    function exportBackupJson() {
      const db = loadDb();
      const snapshotDecks = JSON.parse(JSON.stringify(db.decks || []));
      const snapshotCards = JSON.parse(JSON.stringify(db.cards || []));
      const snapshotHist = JSON.parse(JSON.stringify(db.reviewHistory || []));
      const snapshotPacks = (db.unlockedPackIds || ["pack.free.starter_k12"]).slice();
      const checksum = _computeBackupChecksumJs(snapshotDecks, snapshotCards, snapshotHist, snapshotPacks);
      return {
        ok: true,
        standalone: true,
        schema_version: "8.1",
        exported_at: new Date().toISOString(),
        backup_checksum: checksum,
        decks: snapshotDecks,
        cards: snapshotCards,
        review_history: snapshotHist,
        unlocked_pack_ids: snapshotPacks,
      };
    }

    function importBackupPayload(backupPayload) {
      const rawWrapper = backupPayload || {};
      const b =
        rawWrapper.backup && typeof rawWrapper.backup === "object" && !Array.isArray(rawWrapper.backup)
          ? rawWrapper.backup
          : rawWrapper;
      if (!Array.isArray(b.decks) || !Array.isArray(b.cards)) {
        return { ok: false, standalone: true, error_code: "INVALID_BACKUP_SCHEMA", error: "유효하지 않은 백업 파일 형식입니다." };
      }
      if (b.decks.length > MAX_IMPORT_DECKS_JS || b.cards.length > MAX_IMPORT_CARDS_JS) {
        return {
          ok: false,
          standalone: true,
          error_code: "BACKUP_PAYLOAD_TOO_LARGE",
          error: `백업 항목 수가 허용 한도(덱 ${MAX_IMPORT_DECKS_JS}개 / 카드 ${MAX_IMPORT_CARDS_JS}장)를 초과했습니다.`,
        };
      }
      const schemaVer = String(
        b.schema_version !== undefined && b.schema_version !== null ? b.schema_version : "8.1"
      ).trim();
      const isExplicitLegacySchema = schemaVer === "5.6" || schemaVer === "7.0" || schemaVer === "legacy";
      if (schemaVer === "8.0" && (b.checksum === undefined || b.checksum === null || !String(b.checksum).trim())) {
        return {
          ok: false,
          standalone: true,
          error_code: "BACKUP_CHECKSUM_MISMATCH",
          error: "v8.0 백업 파일에 무결성 체크섬이 누락되었습니다.",
        };
      }
      const rawChkCandidate = b.checksum !== undefined && b.checksum !== null ? b.checksum : b.backup_checksum;
      if (
        !isExplicitLegacySchema &&
        (rawChkCandidate === undefined || rawChkCandidate === null || !String(rawChkCandidate).trim())
      ) {
        return {
          ok: false,
          standalone: true,
          error_code: "BACKUP_CHECKSUM_MISMATCH",
          error: "현재 스키마 백업 파일에 필수 무결성 체크섬이 누락되었습니다.",
        };
      }
      if (rawChkCandidate !== undefined && rawChkCandidate !== null) {
        const chk = String(rawChkCandidate).trim();
        if (chk.startsWith("bd81_")) {
          const expected81 = _computeBackupChecksumJs(
            b.decks,
            b.cards,
            b.review_history || [],
            b.unlocked_pack_ids || b.unlocked_packs || ["pack.free.starter_k12"]
          );
          if (chk !== expected81) {
            return {
              ok: false,
              standalone: true,
              error_code: "BACKUP_CHECKSUM_MISMATCH",
              error: "백업 파일 전체 무결성(bd81 체크섬) 검증에 실패했습니다.",
            };
          }
        } else if (chk.startsWith("bd80_") && schemaVer !== "8.1") {
          const expected80 = _computeLegacyBackupChecksumV80Js(b.decks, b.cards, b.review_history || []);
          if (chk !== expected80) {
            return {
              ok: false,
              standalone: true,
              error_code: "BACKUP_CHECKSUM_MISMATCH",
              error: "백업 파일 무결성(체크섬) 검증에 실패했습니다.",
            };
          }
        } else if (!/^[0-9a-f]{64}$/i.test(chk) || schemaVer === "8.1") {
          return {
            ok: false,
            standalone: true,
            error_code: "BACKUP_CHECKSUM_MISMATCH",
            error: "백업 파일 체크섬 형식이 유효하지 않습니다.",
          };
        }
      }
      const db = loadDb();
      const deckIdMap = new Map();
      let importedDecks = 0;
      b.decks.forEach((incDeck) => {
        if (!incDeck || typeof incDeck !== "object") return;
        const incName = String(incDeck.name || "복원된 덱").replace(/\0/g, "").trim().slice(0, 200) || "복원된 덱";
        let existing = db.decks.find((d) => String(d.name).trim() === incName);
        if (!existing) {
          const newDid = Number(db.nextDeckId) || db.decks.length + 1;
          db.nextDeckId = newDid + 1;
          existing = {
            deck_id: newDid,
            id: newDid,
            name: incName,
            description: String(incDeck.description || "백업 복원 덱").replace(/\0/g, "").slice(0, 1000),
          };
          db.decks.push(existing);
          importedDecks += 1;
        }
        deckIdMap.set(Number(incDeck.deck_id || incDeck.id || 1), Number(existing.deck_id));
      });

      let importedCards = 0;
      let updatedCards = 0;
      b.cards.forEach((incCard) => {
        if (!incCard || typeof incCard !== "object") return;
        const ft = String(incCard.front_text !== undefined ? incCard.front_text : incCard.front || "")
          .replace(/\0/g, "")
          .trim()
          .slice(0, MAX_CARD_TEXT_LEN_JS);
        const bt = String(incCard.back_text !== undefined ? incCard.back_text : incCard.back || "")
          .replace(/\0/g, "")
          .trim()
          .slice(0, MAX_CARD_TEXT_LEN_JS);
        if (!ft || !bt) return;
        const mappedDeckId = deckIdMap.get(Number(incCard.deck_id || 1)) || Number(db.decks[0].deck_id);
        const existingCard = db.cards.find(
          (c) => Number(c.deck_id) === mappedDeckId && String(c.front_text).trim() === ft && String(c.back_text).trim() === bt
        );
        const safeReps = Math.max(0, Math.min(100000, Number(incCard.reps || 0)));
        const safeLapses = Math.max(0, Math.min(100000, Number(incCard.lapses || 0)));
        const safeStability = Math.max(0.1, Math.min(36500, Number(incCard.stability || 1.2)));
        const safeDifficulty = Math.max(1.0, Math.min(10.0, Number(incCard.difficulty || 5.0)));
        const rawState = String(incCard.state || "new");
        const safeState = ["new", "learning", "review", "relearning", "suspended"].includes(rawState) ? rawState : "new";
        if (existingCard) {
          if (safeReps >= Number(existingCard.reps || 0)) {
            existingCard.reps = safeReps;
            existingCard.lapses = safeLapses;
            existingCard.stability = safeStability;
            existingCard.difficulty = safeDifficulty;
            existingCard.state = safeState;
            existingCard.due_at = String(incCard.due_at || existingCard.due_at).slice(0, 64);
            updatedCards += 1;
          }
        } else {
          const newCid = Number(db.nextCardId) || db.cards.length + 1;
          db.nextCardId = newCid + 1;
          const targetDeck = db.decks.find((d) => Number(d.deck_id) === mappedDeckId) || db.decks[0];
          const safeTags = Array.isArray(incCard.tags)
            ? incCard.tags.map((t) => String(t || "").replace(/\0/g, "").trim().slice(0, 64)).filter(Boolean).slice(0, 32)
            : ["restored"];
          db.cards.push({
            card_id: newCid,
            id: newCid,
            deck_id: mappedDeckId,
            deck_name: String(targetDeck.name),
            front_text: ft,
            front: ft,
            back_text: bt,
            back: bt,
            note_type: String(incCard.note_type || "basic") === "cloze" ? "cloze" : "basic",
            tags: safeTags,
            state: safeState,
            reps: safeReps,
            lapses: safeLapses,
            stability: safeStability,
            difficulty: safeDifficulty,
            due_at: String(incCard.due_at || new Date().toISOString()).slice(0, 64),
            flag: Math.max(0, Math.min(7, Number(incCard.flag || 0))),
            suspended: Boolean(incCard.suspended),
          });
          importedCards += 1;
        }
      });

      if (Array.isArray(b.review_history) && b.review_history.length > 0) {
        const existingHist = Array.isArray(db.reviewHistory) ? db.reviewHistory : [];
        const seenHist = new Set(existingHist.map((h) => `${h && h.card_id}:${h && (h.at || h.reviewed_at || "")}`));
        b.review_history.slice(0, 20000).forEach((incH) => {
          if (!incH || typeof incH !== "object") return;
          const ts = String(incH.at || incH.reviewed_at || incH.timestamp || "").slice(0, 64);
          const cid = Number(incH.card_id || 0);
          const key = `${cid}:${ts}`;
          if (!seenHist.has(key)) {
            seenHist.add(key);
            existingHist.push({
              card_id: cid,
              rating: Math.max(1, Math.min(4, Number(incH.rating || 3))),
              at: ts || new Date().toISOString(),
            });
          }
        });
        db.reviewHistory = existingHist.slice(-20000);
      }

      const rawPacks = Array.isArray(b.unlocked_pack_ids)
        ? b.unlocked_pack_ids
        : Array.isArray(b.unlocked_packs)
        ? b.unlocked_packs
        : null;
      if (rawPacks) {
        const cleanPacks = rawPacks
          .map((pid) => String(pid || "").trim().slice(0, 128))
          .filter((pid) => pid && pid !== "__proto__" && pid !== "constructor" && pid !== "prototype")
          .slice(0, 100);
        const packSet = new Set(["pack.free.starter_k12"].concat(db.unlockedPackIds || []).concat(cleanPacks));
        db.unlockedPackIds = Array.from(packSet);
      }
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        imported_decks: importedDecks,
        imported_cards: importedCards + updatedCards,
        new_cards: importedCards,
        updated_cards: updatedCards,
        total_cards: db.cards.length,
      };
    }

    function importBackupJson(backupPayload) {
      const res = importBackupPayload(backupPayload);
      if (!res || !res.ok) {
        throw new Error((res && res.error_code) || "BACKUP_IMPORT_FAILED");
      }
      return res;
    }

    const _DECK_SHARE_HMAC_KEY_JS = "braindeck-v13-zero-config-deck-share-integrity-key";
    const MAX_SHARE_PAYLOAD_BYTES_JS = 128 * 1024;
    const MAX_SHARE_TOKEN_CHARS_JS = 512 * 1024;

    function _encodeBase64UrlBytesJs(bytes) {
      if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes).toString("base64url");
      }
      let bin = "";
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      const stripEqRe = new RegExp("=+$", "g");
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(stripEqRe, "");
    }

    function _decodeBase64UrlBytesJs(b64u) {
      const s = String(b64u || "");
      if (!/^[A-Za-z0-9_-]+$/.test(s)) {
        throw new Error("INVALID_BASE64URL");
      }
      const clean = s.replace(/-/g, "+").replace(/_/g, "/");
      const pad = clean + "=".repeat((4 - (clean.length % 4)) % 4);
      if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(pad, "base64"));
      }
      const bin = atob(pad);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    }

    function _adler32Js(bytes) {
      let a = 1;
      let b = 0;
      for (let i = 0; i < bytes.length; i += 1) {
        a = (a + bytes[i]) % 65521;
        b = (b + a) % 65521;
      }
      return ((b << 16) | a) >>> 0;
    }

    function _zlibCompressRfc1950Js(rawBytes) {
      if (typeof require === "function") {
        try {
          const zlib = require("zlib");
          const comp = zlib.deflateSync(Buffer.from(rawBytes), { level: 9 });
          return new Uint8Array(comp.buffer, comp.byteOffset, comp.byteLength);
        } catch (_ze) {
          // Fall through to RFC 1950 stored-block encoder
        }
      }
      const blockSize = 65535;
      const numBlocks = Math.max(1, Math.ceil(rawBytes.length / blockSize));
      const out = new Uint8Array(2 + numBlocks * 5 + rawBytes.length + 4);
      out[0] = 0x78;
      out[1] = 0x01;
      let pos = 2;
      for (let bIdx = 0; bIdx < numBlocks; bIdx += 1) {
        const start = bIdx * blockSize;
        const chunk = rawBytes.subarray(start, Math.min(rawBytes.length, start + blockSize));
        const len = chunk.length;
        const nlen = (~len) & 0xffff;
        out[pos++] = bIdx === numBlocks - 1 ? 0x01 : 0x00;
        out[pos++] = len & 0xff;
        out[pos++] = (len >>> 8) & 0xff;
        out[pos++] = nlen & 0xff;
        out[pos++] = (nlen >>> 8) & 0xff;
        out.set(chunk, pos);
        pos += len;
      }
      const adler = _adler32Js(rawBytes);
      const dv = new DataView(out.buffer);
      dv.setUint32(pos, adler, false);
      return out;
    }

    function _inflateDeflatePureBoundedJs(deflateBytes, maxOutBytes) {
      let bitPos = 0;
      const totalBits = deflateBytes.length * 8;
      const readBits = (n) => {
        if (bitPos + n > totalBits) throw new Error("TRUNCATED_DEFLATE");
        let val = 0;
        for (let i = 0; i < n; i += 1) {
          const byteIdx = bitPos >>> 3;
          const bitIdx = bitPos & 7;
          val |= ((deflateBytes[byteIdx] >>> bitIdx) & 1) << i;
          bitPos += 1;
        }
        return val;
      };
      const buildHuff = (lengths) => {
        let maxBits = 0;
        for (let i = 0; i < lengths.length; i += 1) if (lengths[i] > maxBits) maxBits = lengths[i];
        if (maxBits === 0) return { maxBits: 1, map: new Map() };
        const blCount = new Int32Array(maxBits + 1);
        for (let i = 0; i < lengths.length; i += 1) if (lengths[i] > 0) blCount[lengths[i]] += 1;
        const nextCode = new Int32Array(maxBits + 1);
        let code = 0;
        for (let bits = 1; bits <= maxBits; bits += 1) {
          code = (code + blCount[bits - 1]) << 1;
          nextCode[bits] = code;
        }
        const map = new Map();
        for (let sym = 0; sym < lengths.length; sym += 1) {
          const len = lengths[sym];
          if (len > 0) {
            const c = nextCode[len]++;
            map.set((len << 16) | c, sym);
          }
        }
        return { maxBits, map };
      };
      const decodeSym = (tree) => {
        let code = 0;
        for (let len = 1; len <= tree.maxBits; len += 1) {
          code = (code << 1) | readBits(1);
          const key = (len << 16) | code;
          if (tree.map.has(key)) return tree.map.get(key);
        }
        throw new Error("INVALID_HUFFMAN_CODE");
      };
      const fixedLitLens = new Int32Array(288);
      for (let i = 0; i <= 143; i += 1) fixedLitLens[i] = 8;
      for (let i = 144; i <= 255; i += 1) fixedLitLens[i] = 9;
      for (let i = 256; i <= 279; i += 1) fixedLitLens[i] = 7;
      for (let i = 280; i <= 287; i += 1) fixedLitLens[i] = 8;
      const fixedDistLens = new Int32Array(32);
      fixedDistLens.fill(5);
      const fixedLitTree = buildHuff(fixedLitLens);
      const fixedDistTree = buildHuff(fixedDistLens);
      const lenBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
      const lenExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
      const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
      const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
      const clOrder = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

      const out = [];
      let isFinal = 0;
      while (!isFinal) {
        isFinal = readBits(1);
        const btype = readBits(2);
        if (btype === 0) {
          bitPos = (bitPos + 7) & ~7;
          const byteIdx = bitPos >>> 3;
          if (byteIdx + 4 > deflateBytes.length) throw new Error("TRUNCATED_STORED_BLOCK");
          const len = deflateBytes[byteIdx] | (deflateBytes[byteIdx + 1] << 8);
          const nlen = deflateBytes[byteIdx + 2] | (deflateBytes[byteIdx + 3] << 8);
          if (((len ^ 0xffff) & 0xffff) !== nlen) throw new Error("CORRUPTED_STORED_LEN");
          const dataStart = byteIdx + 4;
          if (dataStart + len > deflateBytes.length) throw new Error("TRUNCATED_STORED_DATA");
          if (out.length + len > maxOutBytes) throw new Error("SHARE_PAYLOAD_TOO_LARGE");
          for (let i = 0; i < len; i += 1) out.push(deflateBytes[dataStart + i]);
          bitPos = (dataStart + len) * 8;
        } else if (btype === 1 || btype === 2) {
          let litTree = fixedLitTree;
          let distTree = fixedDistTree;
          if (btype === 2) {
            const hlit = readBits(5) + 257;
            const hdist = readBits(5) + 1;
            const hclen = readBits(4) + 4;
            const clLens = new Int32Array(19);
            for (let i = 0; i < hclen; i += 1) clLens[clOrder[i]] = readBits(3);
            const clTree = buildHuff(clLens);
            const combined = new Int32Array(hlit + hdist);
            let idx = 0;
            while (idx < hlit + hdist) {
              const s = decodeSym(clTree);
              if (s < 16) {
                combined[idx++] = s;
              } else if (s === 16) {
                if (idx === 0) throw new Error("BAD_CL_REPEAT");
                const rep = readBits(2) + 3;
                const prev = combined[idx - 1];
                for (let r = 0; r < rep && idx < combined.length; r += 1) combined[idx++] = prev;
              } else if (s === 17) {
                const rep = readBits(3) + 3;
                idx += rep;
              } else {
                const rep = readBits(7) + 11;
                idx += rep;
              }
            }
            litTree = buildHuff(combined.subarray(0, hlit));
            distTree = buildHuff(combined.subarray(hlit));
          }
          for (;;) {
            const sym = decodeSym(litTree);
            if (sym < 256) {
              if (out.length + 1 > maxOutBytes) throw new Error("SHARE_PAYLOAD_TOO_LARGE");
              out.push(sym);
            } else if (sym === 256) {
              break;
            } else {
              const lIdx = sym - 257;
              if (lIdx < 0 || lIdx >= lenBase.length) throw new Error("BAD_LEN_SYM");
              const matchLen = lenBase[lIdx] + (lenExtra[lIdx] ? readBits(lenExtra[lIdx]) : 0);
              const dSym = decodeSym(distTree);
              if (dSym < 0 || dSym >= distBase.length) throw new Error("BAD_DIST_SYM");
              const matchDist = distBase[dSym] + (distExtra[dSym] ? readBits(distExtra[dSym]) : 0);
              if (matchDist > out.length) throw new Error("BAD_BACKREF_DIST");
              if (out.length + matchLen > maxOutBytes) throw new Error("SHARE_PAYLOAD_TOO_LARGE");
              for (let m = 0; m < matchLen; m += 1) {
                out.push(out[out.length - matchDist]);
              }
            }
          }
        } else {
          throw new Error("RESERVED_DEFLATE_BLOCK");
        }
      }
      return new Uint8Array(out);
    }

    function _zlibDecompressRfc1950BoundedJs(compBytes, maxOutBytes) {
      if (!compBytes || compBytes.length < 6) throw new Error("TRUNCATED_ZLIB_HEADER");
      const cmf = compBytes[0];
      const flg = compBytes[1];
      if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0 || (flg & 0x20) !== 0) {
        throw new Error("INVALID_ZLIB_HEADER");
      }
      const dv = new DataView(compBytes.buffer, compBytes.byteOffset, compBytes.byteLength);
      const expectedAdler = dv.getUint32(compBytes.byteLength - 4, false);
      const rawDeflate = compBytes.subarray(2, compBytes.byteLength - 4);
      let inflated = null;
      if (typeof require === "function") {
        const zlib = require("zlib");
        const buf = zlib.inflateRawSync(Buffer.from(rawDeflate), { maxOutputLength: maxOutBytes + 1 });
        if (buf.length > maxOutBytes) throw new Error("SHARE_PAYLOAD_TOO_LARGE");
        inflated = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } else {
        inflated = _inflateDeflatePureBoundedJs(rawDeflate, maxOutBytes);
      }
      if (_adler32Js(inflated) !== expectedAdler) {
        throw new Error("ZLIB_ADLER32_MISMATCH");
      }
      return inflated;
    }

    function _computeDeckShareHmac16Js(b64Body, explicitKey) {
      const keyStr = explicitKey && String(explicitKey).trim() ? String(explicitKey).trim() : _DECK_SHARE_HMAC_KEY_JS;
      return _hmacSha256HexJs(_utf8BytesJs(keyStr), _utf8BytesJs(b64Body)).slice(0, 16);
    }

    function exportDeckShareToken(deckIdOrPayload) {
      const db = loadDb();
      const isObj = Boolean(deckIdOrPayload && typeof deckIdOrPayload === "object");
      const rawDid = isObj ? deckIdOrPayload.deck_id ?? deckIdOrPayload.deckId : deckIdOrPayload;
      const explicitKey = isObj ? deckIdOrPayload.integrity_key : undefined;
      const targetDeck =
        db.decks.find((d) => Number(d.deck_id) === Number(rawDid)) || db.decks[0];
      if (!targetDeck) {
        return { ok: false, standalone: true, error_code: "DECK_NOT_FOUND", error: "공유할 덱을 찾을 수 없습니다." };
      }
      const deckCards = db.cards
        .filter((c) => c && Number(c.deck_id) === Number(targetDeck.deck_id))
        .slice(0, 500)
        .map((c) => ({
          front_text: String(c.front_text || c.front || "").trim().slice(0, MAX_CARD_TEXT_LEN_JS),
          back_text: String(c.back_text || c.back || "").trim().slice(0, MAX_CARD_TEXT_LEN_JS),
        }))
        .filter((c) => c.front_text && c.back_text);
      if (deckCards.length === 0) {
        return { ok: false, standalone: true, error_code: "EMPTY_DECK_SHARE", error: "공유할 카드가 없습니다." };
      }
      const canonicalObj = {
        v: 1,
        deck_name: String(targetDeck.name || "공유 단어장").trim().slice(0, 160),
        category: String((isObj && deckIdOrPayload.category) || "general").trim().slice(0, 64),
        cards: deckCards,
      };
      const rawBytes = _utf8BytesJs(JSON.stringify(canonicalObj));
      if (rawBytes.byteLength > MAX_SHARE_PAYLOAD_BYTES_JS) {
        return { ok: false, standalone: true, error_code: "SHARE_PAYLOAD_TOO_LARGE", error: "공유 덱 크기가 허용 상한(128KB)을 초과했습니다." };
      }
      const compressed = _zlibCompressRfc1950Js(rawBytes);
      const b64Body = _encodeBase64UrlBytesJs(compressed);
      const sig = _computeDeckShareHmac16Js(b64Body, explicitKey);
      const token = `bdshare1:${b64Body}.${sig}`;
      if (token.length > MAX_SHARE_TOKEN_CHARS_JS) {
        return { ok: false, standalone: true, error_code: "SHARE_TOKEN_TOO_LARGE", error: "공유 토큰 길이가 허용 상한을 초과했습니다." };
      }
      return {
        ok: true,
        standalone: true,
        deck_id: targetDeck.deck_id,
        deck_name: targetDeck.name,
        card_count: deckCards.length,
        qr_compatible: token.length <= 2953,
        token,
        share_token: token,
      };
    }

    function importDeckShareToken(tokenOrPayload) {
      const isObj = Boolean(tokenOrPayload && typeof tokenOrPayload === "object");
      const rawToken = String(
        isObj ? tokenOrPayload.token || tokenOrPayload.share_token || "" : tokenOrPayload || ""
      ).trim();
      const explicitKey = isObj ? tokenOrPayload.integrity_key : undefined;
      if (!rawToken.startsWith("bdshare1:") || rawToken.length > MAX_SHARE_TOKEN_CHARS_JS) {
        return { ok: false, standalone: true, error_code: "INVALID_SHARE_TOKEN", error: "유효하지 않거나 허용 크기를 초과한 공유 토큰입니다." };
      }
      const bodyPart = rawToken.slice("bdshare1:".length);
      const dotIdx = bodyPart.lastIndexOf(".");
      if (dotIdx <= 0) {
        return { ok: false, standalone: true, error_code: "INVALID_SHARE_TOKEN", error: "공유 토큰 서명 구분자가 누락되었습니다." };
      }
      const b64Body = bodyPart.slice(0, dotIdx);
      const sig = bodyPart.slice(dotIdx + 1);
      if (!b64Body || sig.length !== 16 || !/^[0-9a-f]{16}$/.test(sig)) {
        return { ok: false, standalone: true, error_code: "INVALID_SHARE_SIGNATURE_FORMAT", error: "공유 토큰 무결성 서명 형식이 올바르지 않습니다." };
      }
      const expectedSig = _computeDeckShareHmac16Js(b64Body, explicitKey);
      let diff = sig.length ^ expectedSig.length;
      for (let i = 0; i < 16; i += 1) {
        diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
      }
      if (diff !== 0) {
        return { ok: false, standalone: true, error_code: "SHARE_SIGNATURE_MISMATCH", error: "공유 토큰 무결성 검증에 실패했습니다." };
      }
      let decodedJsonStr = "";
      try {
        const compBytes = _decodeBase64UrlBytesJs(b64Body);
        const decompressed = _zlibDecompressRfc1950BoundedJs(compBytes, MAX_SHARE_PAYLOAD_BYTES_JS);
        decodedJsonStr = _utf8DecodeJs(decompressed);
      } catch (decErr) {
        const code = String((decErr && decErr.message) || "SHARE_DECODE_FAILED");
        return {
          ok: false,
          standalone: true,
          error_code: code === "SHARE_PAYLOAD_TOO_LARGE" ? "SHARE_PAYLOAD_TOO_LARGE" : "SHARE_DECODE_FAILED",
          error: "공유 토큰 압축 해제 또는 검증에 실패했습니다.",
        };
      }
      let parsed = null;
      try {
        parsed = JSON.parse(decodedJsonStr);
      } catch (_je) {
        return { ok: false, standalone: true, error_code: "INVALID_SHARE_JSON", error: "공유 토큰 JSON 형식이 손상되었습니다." };
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.cards) || parsed.cards.length === 0 || parsed.cards.length > 1000) {
        return { ok: false, standalone: true, error_code: "EMPTY_OR_EXCESSIVE_SHARE", error: "공유 카드 수량이 유효 범위를 벗어났습니다." };
      }
      const cleanName = `${String(parsed.deck_name || parsed.title || "공유 단어장").replace(/\0/g, "").trim().slice(0, 140)} (공유본)`;
      const specs = parsed.cards
        .map((c) => ({
          front_text: String((c && (c.front_text || c.front)) || "").replace(/\0/g, "").trim().slice(0, MAX_CARD_TEXT_LEN_JS),
          back_text: String((c && (c.back_text || c.back)) || "").replace(/\0/g, "").trim().slice(0, MAX_CARD_TEXT_LEN_JS),
          note_type: String((c && c.note_type) || "basic") === "cloze" ? "cloze" : "basic",
          tags: Array.isArray(c && c.tags) ? c.tags.map((t) => String(t || "").slice(0, 64)).filter(Boolean).slice(0, 16) : ["shared_deck"],
        }))
        .filter((s) => s.front_text && s.back_text);
      if (specs.length === 0) {
        return { ok: false, standalone: true, error_code: "EMPTY_SHARE_SPECS", error: "가져올 유효 카드가 없습니다." };
      }
      const saved = insertDeckWithSpecs(cleanName, String(parsed.description || "공유 토큰으로 추가된 덱").slice(0, 500), specs, "sequential");
      return {
        ok: true,
        standalone: true,
        deck_id: saved.deck_id,
        deck_name: saved.deck_name,
        category: String(parsed.category || "general"),
        imported_cards: saved.saved_count,
        card_count: saved.saved_count,
      };
    }

    function getCommercialDashboard() {
      const db = loadDb();
      const hist = Array.isArray(db.reviewHistory) ? db.reviewHistory : [];
      const countsByDay = new Map();
      hist.forEach((h) => {
        if (!h || typeof h !== "object") return;
        const rawTs = h.at || h.reviewed_at || h.timestamp;
        if (!rawTs) return;
        const ms = Date.parse(String(rawTs));
        if (!Number.isFinite(ms)) return;
        const dayKey = new Date(ms).toISOString().slice(0, 10);
        countsByDay.set(dayKey, (countsByDay.get(dayKey) || 0) + 1);
      });
      const heatmapDays = Array.from(countsByDay.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([dateKey, count]) => ({ date: dateKey, count }));
      let streakDays = 0;
      if (countsByDay.size > 0) {
        const nowMs = Date.now();
        const todayKey = new Date(nowMs).toISOString().slice(0, 10);
        const yestKey = new Date(nowMs - 86400000).toISOString().slice(0, 10);
        let cursorMs = countsByDay.has(todayKey) ? nowMs : countsByDay.has(yestKey) ? nowMs - 86400000 : null;
        while (cursorMs !== null) {
          const dKey = new Date(cursorMs).toISOString().slice(0, 10);
          if (!countsByDay.has(dKey)) break;
          streakDays += 1;
          cursorMs -= 86400000;
        }
      }
      return {
        ok: true,
        standalone: true,
        total_cards: (db.cards || []).length,
        review_count: hist.length,
        streak_days: streakDays,
        heatmap_days: heatmapDays,
      };
    }

    function submitErrataReport(payload) {
      const p = payload || {};
      const cardId = Number(p.card_id !== undefined ? p.card_id : p.cardId || 0);
      const issueType = String(p.issue_type || p.category || "typo").replace(/\0/g, "").trim().slice(0, 64) || "typo";
      const description = String(p.description || p.note || p.reason || p.suggested_fix || "").replace(/\0/g, "").trim().slice(0, 1000);
      if (!cardId && !description) {
        return { ok: false, standalone: true, error_code: "EMPTY_ERRATA_REPORT", error: "신고할 카드 또는 오탈자 설명을 입력해 주세요." };
      }
      const db = loadDb();
      const existing = Array.isArray(db.errataReports) ? db.errataReports : [];
      const createdAt = new Date().toISOString();
      const reportDigest = _bytesToHexJs(_sha256BytesJs(_utf8BytesJs(`${cardId}:${issueType}:${description}:${createdAt}:${existing.length}`))).slice(0, 10).toUpperCase();
      const reportId = `ERRATA-${reportDigest}`;
      const record = {
        report_id: reportId,
        card_id: cardId,
        issue_type: issueType,
        description,
        created_at: createdAt,
      };
      db.errataReports = existing.concat([record]).slice(-500);
      const savedOk = saveDb(db);
      if (!savedOk) {
        return { ok: false, standalone: true, error_code: "ERRATA_PERSIST_FAILED", error: "로컬 저장소에 오탈자 제보를 기록하지 못했습니다." };
      }
      return {
        ok: true,
        standalone: true,
        persisted: true,
        report_id: reportId,
        stored_count: db.errataReports.length,
      };
    }

    function syncCrdtDelta(envelope, deletionEpochMs) {
      const crdtMod = _getModule("BrainDeckSyncCrdt");
      const env = envelope || { schema_version: 1, device_id: "web-local", review_events: [] };
      crdtMod.validateSyncDeltaEnvelope(env, deletionEpochMs);
      const db = loadDb();
      const localRevEvents = Array.isArray(db.crdtReviewEvents) ? db.crdtReviewEvents : [];
      const mergedReviews = crdtMod.mergeReviewLogGSet(localRevEvents, env.review_events || [], deletionEpochMs);
      db.crdtReviewEvents = mergedReviews;
      const incomingNotes = Array.isArray(env.note_registers) ? env.note_registers : [];
      const localNotesMap = db.crdtNoteRegisters && typeof db.crdtNoteRegisters === "object" ? db.crdtNoteRegisters : {};
      let mergedNoteCount = 0;
      incomingNotes.forEach((incReg) => {
        if (!incReg || !incReg.note_id) return;
        const nid = String(incReg.note_id);
        if (localNotesMap[nid]) {
          localNotesMap[nid] = crdtMod.mergeNoteLwwRegisters(localNotesMap[nid], incReg);
        } else {
          localNotesMap[nid] = incReg;
        }
        mergedNoteCount += 1;
      });
      db.crdtNoteRegisters = localNotesMap;
      if (!saveDb(db)) {
        return { ok: false, standalone: true, error_code: "STORAGE_WRITE_FAILED", error: "QUOTA_EXCEEDED" };
      }
      return {
        ok: true,
        standalone: true,
        merged_review_count: mergedReviews.length,
        merged_note_count: mergedNoteCount,
        merged_events: mergedReviews,
      };
    }

    function enrichCardCurriculum(payload) {
      const p = payload || {};
      const currMod = _getModule("BrainDeckCurriculumStandards");
      const meta = currMod.enrichConceptCurriculumMetadata(
        String(p.subject || "korean"),
        String(p.term || p.front_text || ""),
        String(p.definition || p.back_text || ""),
        Array.isArray(p.extra_tags) ? p.extra_tags : []
      );
      let staleness = null;
      if (p.statute_ref || String(p.subject || "") === "admin_law") {
        staleness = currMod.checkStatuteStaleness(
          String(p.statute_ref || p.term || "행정기본법"),
          String(p.valid_as_of || meta.valid_as_of || "2026-01-01"),
          p.amendment_registry
        );
      }
      return { ok: true, standalone: true, metadata: meta, staleness };
    }

    async function loadThirdPartyNoticesRaw() {
      const isFileProtocol = typeof location !== "undefined" && Boolean(location && location.protocol === "file:");
      if (isFileProtocol || typeof fetch !== "function") {
        return { source: "offline_embedded", ok: true, rawText: null };
      }
      try {
        const resp = await fetch("./THIRD_PARTY_NOTICES.txt", { cache: "no-store" });
        if (!resp || !resp.ok) {
          return { source: "http", ok: false, status: resp ? resp.status : 0, rawText: "" };
        }
        return { source: "http", ok: true, status: resp.status, rawText: await resp.text() };
      } catch (_netErr) {
        const isOffline = typeof navigator !== "undefined" && Boolean(navigator && navigator.onLine === false);
        if (isOffline) {
          return { source: "offline_embedded", ok: true, rawText: null };
        }
        return { source: "http", ok: false, status: 0, rawText: "" };
      }
    }

    return {
      loadDb,
      saveDb,
      getLastSaveStatus,
      hydrateFromIndexedDb,
      getCatalog,
      getStorePacks,
      installStorePack,
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
      buildCollectionCards,
      buildCombinedExamDeck,
      buildSmartTextDeck,
      batchSaveDeck,
      addDirectCard,
      updateCard,
      deleteCard,
      suspendCard,
      applyCardAction,
      evaluateTypedAnswer,
      generateProgressiveHint: generateProgressiveHintForCard,
      decompressBacklog,
      decomposeLeechCard,
      exportBackupPayload,
      exportBackupJson,
      importBackupPayload,
      importBackupJson,
      exportDeckShareToken,
      importDeckShareToken,
      getCommercialDashboard,
      submitErrataReport,
      submitReview,
      undoLastReview,
      resetStudyProgress,
      extractCleanTargetAnswer,
      buildTypeMatchedQuizOptions,
      classifyScriptProfile: classifyScriptProfileJs,
      cleanCardFrontForDisplay: cleanCardFrontForDisplayJs,
      syncCrdtDelta,
      enrichCardCurriculum,
      checkStatuteStaleness,
      computeRetentionAndForgettingCurveVm,
      advanceOnboardingState,
      resolveWcagKeyboardShortcut,
      loadThirdPartyNoticesRaw,
    };
  }

  return { attachStandaloneEngineOps, STANDALONE_STORE_PACKS };
});
