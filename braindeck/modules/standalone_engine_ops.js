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
      estimated_card_count: 1020,
      badge_label: "무료 기본 탑재",
      features: ["어문회 8급 기초 한자 + 초등 받아쓰기 기본 내장", "사진·PDF 업로드 무제한 무료"],
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
      estimated_card_count: 1015,
      badge_label: "초등 3~4",
      features: ["초등 3~4학년 기초 필수 영단어(morning, weather, borrow 등)", "Lv.1~3 단계별 카드 & 예문 해설"],
      sample_cards: [{ front: "weather", back: "날씨 — How is the weather today?", tag: "초등 3~4" }],
    },
    {
      pack_id: "pack.moe.eng.elem56",
      title: "초등 5~6학년 영단어 800",
      subtitle: "2022 개정 교육과정 초등 5~6학년군 영단어 800 어휘 & 의사소통 표현",
      category: "k12_textbook",
      age_tier: "junior",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:elementary",
      covered_ref_ids: ["moe-eng:elementary"],
      estimated_card_count: 1040,
      badge_label: "초등 5~6",
      features: ["초등 5~6학년 필수 영단어 800 핵심(library, museum, vacation, between 등)", "중학 진학 전 필수 마스터"],
      sample_cards: [{ front: "museum", back: "박물관, 미술관 — We visited the science museum.", tag: "초등 5~6" }],
    },
    {
      pack_id: "pack.moe.eng.mid1200",
      title: "중학교 영단어 1,200·영문법",
      subtitle: "2022 개정 중학 영단어 1,200 + 현재완료·관계대명사·감각동사 등 내신 8대 영문법",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-eng:middle-1200",
      covered_ref_ids: ["moe-eng:middle-1200"],
      estimated_card_count: 1200,
      badge_label: "중학 영단어·문법",
      features: ["중학 필수 영단어 1,200 핵심 + 내신 8대 핵심 영문법 동시 수록", "단어·문법 분리형 4지선다"],
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
      estimated_card_count: 1150,
      badge_label: "고교·수능",
      features: ["평가원·수능 최빈출 학술 어휘(hypothesis, empirical, correlation, cognitive 등)", "반의어·파생어 해설"],
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
      estimated_card_count: 1035,
      badge_label: "국어·문학",
      features: ["한글 맞춤법·표준어 규정 혼동 어휘 & 필수 문학 개념어(역설법, 객관적 상관물 등)"],
      sample_cards: [{ front: "'오늘이 몇 월 [ ___ ]이지?' 바른 맞춤법 표기는?", back: "며칠 ('몇일'은 틀린 표기)", tag: "한글 맞춤법" }],
    },
    {
      pack_id: "pack.moe.hanja.mid1800",
      title: "중·고교 한자 1,800",
      subtitle: "교육부 고시 한문 교육용 기초한자 1,800자(중등 900·고등 900) & 교과서 성어",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "moe-hanja-1800:middle",
      covered_ref_ids: ["moe-hanja-1800:middle"],
      estimated_card_count: 1350,
      badge_label: "한자 1,800",
      features: ["교육부 고시 중·고교 기초한자 1,800 핵심 훈음·부수·획수 & 사자성어(온고지신 등)"],
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
      estimated_card_count: 1080,
      badge_label: "한국사 연표",
      features: ["시대별 핵심 사건·조약·개혁·문화재 연표 총정리"],
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
      estimated_card_count: 1045,
      badge_label: "과학 법칙·공식",
      features: ["옴의 법칙(V=IR), 뉴턴 가속도 법칙(F=ma), 화학 결합, 미토콘드리아 ATP, 판구조론"],
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
      estimated_card_count: 1060,
      badge_label: "수학 공식",
      features: ["피타고라스 정리, 근의 공식·판별식, 삼각함수 제곱 관계, 등차수열 일반항, 미분계수 정의"],
      sample_cards: [{ front: "첫째항 a, 공차 d인 등차수열의 일반항 aₙ과 미분계수 f'(a)는?", back: "aₙ = a + (n - 1)d · f'(a) = lim(h→0)[f(a+h)-f(a)]/h", tag: "수학 공식" }],
    },
    {
      pack_id: "pack.mid1.eng.donga_yoon.full",
      title: "중1 영어 동아(윤정미)",
      subtitle: "2022 개정 교육과정 · 단원별·쪽수별 시험범위 슬라이싱 + 영단어·문법",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid1.eng.donga_yoon.2022",
      covered_ref_ids: ["kr.mid1.eng.donga_yoon.2022"],
      estimated_card_count: 1024,
      badge_label: "중1 내신",
      features: ["Lesson 1 ~ Lesson 8 전 단원 필수 어휘·숙어·핵심 문법 완벽 매핑 (1,000+ 카드)"],
      sample_cards: [{ front: "introduce (p.12)", back: "소개하다 (동사)", tag: "Lesson 1" }],
    },
    {
      pack_id: "pack.mid2.eng.donga_yoon.full",
      title: "중2 영어 동아(윤정미)",
      subtitle: "중학교 2학년 내신 대비 · 단원/쪽수 슬라이싱 & 4지선다 유의어 구성",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid2.eng.donga_yoon.2022",
      covered_ref_ids: ["kr.mid2.eng.donga_yoon.2022"],
      estimated_card_count: 1032,
      badge_label: "중2 내신",
      features: ["중2 동아(윤정미) 단원별 어휘·문법 수록 (1,000+ 카드)"],
      sample_cards: [{ front: "confident (p.16)", back: "자신감 있는 (형용사)", tag: "Lesson 1" }],
    },
    {
      pack_id: "pack.mid2.hist.miraeen.full",
      title: "중2 역사① 미래엔",
      subtitle: "중학교 역사 내신 출판사 단원 매핑 · 동시대 사건 보기 자동 구성",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.mid2.hist.miraeen.2022",
      covered_ref_ids: ["kr.mid2.hist.miraeen.2022"],
      estimated_card_count: 1018,
      badge_label: "역사 내신",
      features: ["미래엔 중학교 역사① 단원·쪽수별 사건·연표·조약·문화재 정리 (1,000+ 카드)"],
      sample_cards: [{ front: "훈민정음 창제 (1443, 반포 1446)", back: "조선 세종 대 백성을 가르치는 바른 소리 28자 창제", tag: "Ⅰ단원" }],
    },
    {
      pack_id: "pack.high1.sci.visang.full",
      title: "고1 통합과학1 비상",
      subtitle: "고등학교 1학년 통합과학 물리·화학·생명·지구과학 공식 및 원소 대비",
      category: "k12_textbook",
      age_tier: "teen",
      price_krw: 990,
      is_free_starter: false,
      link_kind: "textbook",
      primary_ref_id: "kr.high1.sci.visang.2022",
      covered_ref_ids: ["kr.high1.sci.visang.2022", "sci-element-formula:core"],
      estimated_card_count: 1028,
      badge_label: "고1 내신",
      features: ["비상교육 고1 통합과학1 단원별 핵심 공식 및 원소 매핑 (1,000+ 카드)"],
      sample_cards: [{ front: "옴의 법칙: V = I × R", back: "전압(V)은 전류(I)와 저항(R)의 곱에 비례한다", tag: "통합과학1" }],
    },
    {
      pack_id: "pack.exam.hanja_master",
      title: "어문회 한자 7급~3급·사자성어",
      subtitle: "동음이의어·유사한자 함정선지 방어 + 두음법칙/다음자(樂 락·악·요) 채점",
      category: "hanja_history",
      age_tier: "all",
      price_krw: 1500,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "hanja-grade:7geup",
      covered_ref_ids: ["hanja-grade:7geup", "hanja-grade:6geup", "hanja-grade:5geup", "hanja-grade:4geup", "hanja-grade:3geup", "ko-idiom:essential"],
      estimated_card_count: 1250,
      badge_label: "급수한자",
      features: ["한자 7급~3급 급수별 필수 한자 및 사자성어 전체 잠금해제 (1,200+ 카드)"],
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
      estimated_card_count: 1080,
      badge_label: "한능검",
      features: ["시대별·왕대별 핵심 사건·조약·문화재 연표 양방향 Cloze (1,000+ 카드)"],
      sample_cards: [{ front: "갑신정변 (1884)", back: "김옥균·박영효 등 급진개화파가 일으킨 근대화 개혁 운동", tag: "khist" }],
    },
    {
      pack_id: "pack.exam.lang_toeic_jlpt",
      title: "토익(TOEIC)·JLPT N5~N3",
      subtitle: "비즈니스 영어 어휘 + 일본어 한자·히라가나 발음/원어민 TTS 스피킹 드릴",
      category: "language_exam",
      age_tier: "adult",
      price_krw: 1900,
      is_free_starter: false,
      link_kind: "collection",
      primary_ref_id: "exam-eng:toeic-core",
      covered_ref_ids: ["exam-eng:toeic-core", "exam-ja:jlpt-n5-n3"],
      estimated_card_count: 1180,
      badge_label: "어학",
      features: ["토익 빈출 어휘 및 JLPT 핵심 어휘 동시 수록 (1,200+ 카드)"],
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
      estimated_card_count: 1050,
      badge_label: "수험·자격증",
      features: ["대한민국 헌법 핵심 조문 & 정보처리기사·컴활 필수 개념 완벽 정리 (1,000+ 카드)"],
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

    function buildCollectionCards(collectionId, difficultyLevel, targetCount) {
      const cid = String(collectionId || "hanja-grade:8geup").trim();
      const col = STANDALONE_COLLECTIONS.find((c) => c.collection_id === cid);
      const diff = difficultyLevel || "mixed";
      const cap = Math.max(1, Number(targetCount || 1000));
      return padStandaloneSpecsToTarget(col ? col.items : [], col ? col.collection_id : cid, diff, cap);
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
      const spreadDays = Math.max(1, Math.min(30, Number(p.days || p.spread_days || 3)));
      const deckId = p.deckId !== undefined ? p.deckId : p.deck_id;
      const hasDeck = deckId !== undefined && deckId !== null && deckId !== "" && deckId !== "all";
      const db = loadDb();
      const nowMs = Date.now();
      let rescheduled = 0;
      db.cards.forEach((c, idx) => {
        if (!c || c.suspended || c.state === "suspended") return;
        if (hasDeck && Number(c.deck_id) !== Number(deckId)) return;
        const dueMs = c.due_at ? Date.parse(c.due_at) : nowMs;
        if (!Number.isFinite(dueMs) || dueMs <= nowMs) {
          const offsetDays = (idx % spreadDays) + 1;
          c.due_at = new Date(nowMs + offsetDays * 86400000).toISOString();
          rescheduled += 1;
        }
      });
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        spread_days: spreadDays,
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

    function _computeBackupChecksumJs(decks, cards, history) {
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

    function exportBackupPayload() {
      const db = loadDb();
      const checksum = _computeBackupChecksumJs(db.decks, db.cards, db.reviewHistory);
      return {
        ok: true,
        standalone: true,
        schema_version: "8.0",
        exported_at: new Date().toISOString(),
        checksum,
        decks: db.decks,
        cards: db.cards,
        review_history: db.reviewHistory || [],
        unlocked_pack_ids: db.unlockedPackIds || ["pack.free.starter_k12"],
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
      if (String(b.schema_version || "") === "8.0" && (b.checksum === undefined || b.checksum === null || !String(b.checksum).trim())) {
        return {
          ok: false,
          standalone: true,
          error_code: "BACKUP_CHECKSUM_MISMATCH",
          error: "v8.0 백업 파일에 무결성 체크섬이 누락되었습니다.",
        };
      }
      if (b.checksum !== undefined && b.checksum !== null) {
        const chk = String(b.checksum).trim();
        if (chk.startsWith("bd80_")) {
          const expectedChk = _computeBackupChecksumJs(b.decks, b.cards, b.review_history || []);
          if (chk !== expectedChk) {
            return {
              ok: false,
              standalone: true,
              error_code: "BACKUP_CHECKSUM_MISMATCH",
              error: "백업 파일 무결성(체크섬) 검증에 실패했습니다.",
            };
          }
        } else if (!/^[0-9a-f]{64}$/i.test(chk)) {
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
          if (safeReps > Number(existingCard.reps || 0)) {
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

    return {
      loadDb,
      saveDb,
      getLastSaveStatus,
      hydrateFromIndexedDb,
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
      importBackupPayload,
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
    };
  }

  return { attachStandaloneEngineOps, STANDALONE_STORE_PACKS };
});
