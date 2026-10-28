/**
 * BrainDeck v8.1 Modular Domain Engine: 2022 Revised Curriculum Standards & Statute Provenance (`curriculum_standards.js`).
 * Pure UMD module with zero DOM or network dependencies.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrainDeckCurriculumStandards = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SUBJECT_SPECS = Object.freeze({
    korean: {
      prefix: "9국",
      standard_type: "MOE_2022",
      source: "2022 개정 교육과정 국어과 성취기준 (교육부 고시 제2022-33호)",
      valid_as_of: "2026-03-01",
      default_code: "02-01",
      keyword_domains: [
        [["음운", "품사", "형태소", "문장", "맞춤법", "표준어", "어간", "어미", "조사", "피동", "사동", "높임"], "04-01"],
        [["시", "운율", "비유", "상징", "소설", "서술자", "갈등", "희곡", "수필", "고전", "향가", "시조", "가사"], "05-01"],
        [["토론", "협상", "발표", "연설", "면담", "담화", "경청", "말하기"], "01-02"],
        [["논설", "설명", "보고서", "고쳐쓰기", "개요", "작문", "쓰기"], "03-01"],
        [["매체", "뉴스", "광고", "정보", "인터넷"], "06-01"],
      ],
    },
    math: {
      prefix: "10수",
      standard_type: "MOE_2022",
      source: "2022 개정 교육과정 수학과 성취기준 (교육부 고시 제2022-33호)",
      valid_as_of: "2026-03-01",
      default_code: "01-02",
      keyword_domains: [
        [["다항식", "인수분해", "복소수", "방정식", "부등식", "근과 계수", "판별식", "항등식", "나머지정리"], "01-01"],
        [["점", "직선", "원", "포물선", "평행이동", "대칭이동", "도형", "기하", "벡터", "삼각형", "피타고라스"], "02-01"],
        [["집합", "명제", "필요충분", "대우", "역", "함수", "역함수", "합성함수", "유리함수", "무리함수", "지수", "로그", "삼각함수", "미분", "적분", "극한", "수열"], "03-01"],
        [["경우의 수", "순열", "조합", "확률", "통계", "평균", "분산", "표준편차", "정규분포"], "04-01"],
      ],
    },
    social: {
      prefix: "10통사",
      standard_type: "MOE_2022",
      source: "2022 개정 교육과정 사회과·통합사회 성취기준 (교육부 고시 제2022-33호)",
      valid_as_of: "2026-03-01",
      default_code: "01-01",
      keyword_domains: [
        [["인권", "헌법", "기본권", "민주주의", "법치", "삼권분립", "선거", "정당", "시민"], "04-01"],
        [["시장", "수요", "공급", "물가", "실업", "인플레이션", "GDP", "금융", "무역", "비교우위", "환율"], "05-01"],
        [["기후", "지형", "환경", "도시", "인구", "자원", "지리", "생태"], "02-01"],
        [["문화", "다문화", "세계화", "정보화", "불평등", "복지", "정의"], "06-01"],
      ],
    },
    science: {
      prefix: "10통과",
      standard_type: "MOE_2022",
      source: "2022 개정 교육과정 과학과·통합과학 성취기준 (교육부 고시 제2022-33호)",
      valid_as_of: "2026-03-01",
      default_code: "01-02",
      keyword_domains: [
        [["힘", "운동", "가속도", "에너지", "파동", "전기", "자기", "유도", "열역학", "빛", "굴절", "스펙트럼", "상대성"], "01-01"],
        [["원자", "주기율표", "이온", "공유결합", "산화", "환원", "산", "염기", "중화", "몰", "반응속도", "평형"], "02-01"],
        [["세포", "염색체", "DNA", "RNA", "유전", "광합성", "호흡", "항상성", "신경", "호르몬", "면역", "생태계", "진화"], "03-01"],
        [["지구", "판구조론", "지진", "화산", "대기", "해류", "엘니뇨", "별", "은하", "우주", "빅뱅", "외계행성"], "04-01"],
      ],
    },
    history: {
      prefix: "10한사",
      standard_type: "MOE_2022",
      source: "2022 개정 교육과정 역사·한국사 성취기준 및 한능검 표준",
      valid_as_of: "2026-03-01",
      default_code: "01-02",
      keyword_domains: [
        [["구석기", "신석기", "청동기", "고조선", "부여", "고구려", "백제", "신라", "가야", "통일신라", "발해", "삼국"], "01-01"],
        [["고려", "태조", "광종", "성종", "묘청", "무신", "팔만대장경", "공민왕", "과전법"], "01-03"],
        [["조선", "세종", "훈민정음", "경국대전", "사림", "임진왜란", "병자호란", "실학", "영조", "정조", "세도"], "02-01"],
        [["흥선대원군", "강화도", "갑신정변", "동학", "갑오개혁", "독립협회", "대한제국", "을사늑약", "의병", "애국계몽"], "03-01"],
        [["3·1", "임시정부", "무장독립", "신간회", "광복", "제헌", "6·25", "4·19", "5·18", "6월 민주", "남북"], "04-01"],
      ],
    },
    morals: {
      prefix: "9도",
      standard_type: "MOE_2022",
      source: "2022 개정 교육과정 도덕·윤리과 성취기준 (교육부 고시 제2022-33호)",
      valid_as_of: "2026-03-01",
      default_code: "01-02",
      keyword_domains: [
        [["자아", "성찰", "양심", "도덕적 추론", "자율", "덕윤리", "행복"], "01-01"],
        [["타인", "배려", "공감", "예절", "가족", "친구", "이웃", "갈등 해결", "폭력"], "02-01"],
        [["정의", "인권", "롤스", "분배", "시민불복종", "국가", "통일", "평화", "세계시민"], "03-01"],
        [["생명", "환경", "기후윤리", "과학기술", "정보윤리", "인공지능", "생태"], "04-01"],
      ],
    },
    english: {
      prefix: "CEFR",
      standard_type: "CEFR",
      source: "2022 개정 영어과 어휘표 및 CEFR A2-C1 / 수능 필수 어휘",
      valid_as_of: "2026-03-01",
      default_code: "B1",
      keyword_domains: [],
    },
    hanja: {
      prefix: "한자검정",
      standard_type: "HANJA_GRADE",
      source: "교육부 한문 교육용 기초한자 1,800자 및 어문회 급수 표준",
      valid_as_of: "2026-03-01",
      default_code: "3급",
      keyword_domains: [],
    },
    admin_law: {
      prefix: "행정법총론",
      standard_type: "STATUTE",
      source: "대한민국 현행 행정기본법·행정절차법·행정소송법 및 대법원 판례",
      valid_as_of: "2026-01-01",
      default_code: "행정기본법",
      keyword_domains: [
        [["처분", "청문", "공청회", "의견제출", "사전통지", "이유제시", "행정절차", "행정지도", "신고"], "행정절차법"],
        [["취소소송", "무효등확인", "부작위위법", "집행정지", "사정판결", "원고적격", "대상적격", "제소기간", "처분사유", "기속력", "행정소송"], "행정소송법"],
        [["행정심판", "재결", "의무이행심판", "임시처분"], "행정심판법"],
        [["국가배상", "영조물", "공무원", "배상책임", "이중배상"], "국가배상법"],
        [["손실보상", "수용", "토지수용", "정당한 보상", "생활보상"], "공익사업법"],
        [["대집행", "이행강제금", "직접강제", "즉시강제", "강제징수"], "행정대집행법"],
        [["정보공개", "비공개"], "정보공개법"],
        [["개인정보", "정보주체"], "개인정보보호법"],
      ],
    },
    cert_it: {
      prefix: "NCS-IT",
      standard_type: "NCS_CERT",
      source: "국가직무능력표준(NCS) 정보처리기사·SQLD·리눅스마스터 출제기준",
      valid_as_of: "2026-01-01",
      default_code: "SW개발",
      keyword_domains: [
        [["SQL", "정규화", "트랜잭션", "인덱스", "조인", "JOIN", "뷰", "키", "릴레이션", "무결성", "DB", "데이터베이스", "스키마"], "SQLD-DB"],
        [["프로세스", "스레드", "데드락", "교착상태", "스케줄링", "페이지", "가상메모리", "커널", "리눅스", "파일시스템"], "OS-SYS"],
        [["TCP", "UDP", "IP", "HTTP", "HTTPS", "DNS", "라우팅", "서브넷", "방화벽", "암호화", "대칭키", "공개키", "해시", "보안"], "NET-SEC"],
        [["UML", "디자인 패턴", "객체지향", "캡슐화", "다형성", "상속", "결합도", "응집도", "요구사항", "아키텍처", "테스트"], "SW설계"],
      ],
    },
  });

  const DEFAULT_AMENDMENT_REGISTRY = Object.freeze({
    행정기본법: "2025-07-01",
    행정절차법: "2025-05-01",
    행정소송법: "2025-03-01",
    행정심판법: "2025-04-01",
    국가배상법: "2025-02-01",
    공익사업법: "2025-01-15",
    행정대집행법: "2024-12-01",
    정보공개법: "2025-06-01",
    개인정보보호법: "2025-09-15",
    질서위반행위규제법: "2025-01-01",
  });

  function isValidIsoCalendarDate(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || "").trim());
    if (!m) return false;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    const dt = new Date(Date.UTC(year, month - 1, day));
    return (
      dt.getUTCFullYear() === year &&
      dt.getUTCMonth() === month - 1 &&
      dt.getUTCDate() === day
    );
  }

  function enrichConceptCurriculumMetadata(subjectKey, conceptIndex, term, definition, extraContext) {
    let subj = String(subjectKey || "korean").trim().toLowerCase();
    const combined = `${String(term || "")} ${String(definition || "")} ${String(extraContext || "")}`;

    if (subj === "law_it") {
      const itSpec = SUBJECT_SPECS.cert_it;
      const isIt =
        itSpec.keyword_domains.some(([kws]) => kws.some((kw) => combined.includes(kw))) ||
        ["알고리즘", "네트워크", "운영체제", "프로그래밍", "컴파일러", "깃(Git)", "도커"].some((t) =>
          combined.includes(t)
        );
      subj = isIt ? "cert_it" : "admin_law";
    }

    const spec = SUBJECT_SPECS[subj] || SUBJECT_SPECS.korean;
    let achievementStd;
    let statuteRef = "N/A";

    if (subj === "english") {
      const wLen = String(term || "").trim().length;
      const band = wLen <= 5 ? "A2" : wLen <= 7 ? "B1" : wLen <= 9 ? "B2" : "C1";
      achievementStd = `[CEFR-${band}]`;
    } else if (subj === "hanja") {
      const gm = /([1-8]급)/.exec(combined);
      achievementStd = `[한자검정-${gm ? gm[1] : "3급"}]`;
    } else if (subj === "admin_law") {
      let matchedLaw = null;
      for (const lawName of Object.keys(DEFAULT_AMENDMENT_REGISTRY)) {
        if (combined.includes(lawName)) {
          matchedLaw = lawName;
          break;
        }
      }
      if (!matchedLaw) {
        for (const [kws, lawTarget] of spec.keyword_domains) {
          if (kws.some((kw) => combined.includes(kw))) {
            matchedLaw = lawTarget;
            break;
          }
        }
      }
      matchedLaw = matchedLaw || "행정기본법";
      const artMatch = /(제\d+조(?:의\d+)?)/.exec(combined);
      achievementStd = `[STATUTE-${matchedLaw}]`;
      statuteRef = artMatch
        ? `${matchedLaw} ${artMatch[1]} (${String(term || "")})`
        : `${matchedLaw} 관련 조문 (${String(term || "")})`;
    } else if (subj === "cert_it") {
      let code = spec.default_code;
      for (const [kws, target] of spec.keyword_domains) {
        if (kws.some((kw) => combined.includes(kw))) {
          code = target;
          break;
        }
      }
      achievementStd = `[NCS-IT-${code}]`;
    } else {
      let code = spec.default_code;
      for (const [kws, target] of spec.keyword_domains) {
        if (kws.some((kw) => combined.includes(kw))) {
          code = target;
          break;
        }
      }
      achievementStd = `[${spec.prefix}${code}]`;
    }

    const defLen = String(definition || "").length;
    const difficultyBand = defLen < 28 ? "basic" : defLen < 65 ? "standard" : "advanced";

    return {
      standard_type: spec.standard_type,
      achievement_std: achievementStd,
      source: spec.source,
      valid_as_of: spec.valid_as_of,
      difficulty_band: difficultyBand,
      statute_ref: statuteRef,
    };
  }

  function checkStatuteStaleness(statuteRef, validAsOf, amendmentRegistry) {
    const refStr = String(statuteRef || "").trim();
    const validStr = String(validAsOf || "").trim();
    const reg = Object.assign({}, DEFAULT_AMENDMENT_REGISTRY, amendmentRegistry || {});
    if (!refStr || refStr === "N/A") {
      return {
        statute_ref: refStr || "N/A",
        valid_as_of: validStr,
        latest_amendment_date: null,
        stale: false,
        status: "NON_STATUTE_SUBJECT",
        warning_badge: "비법령 일반 과목",
      };
    }
    let matchedLaw = null;
    let latestDate = null;
    for (const [lawName, amendDate] of Object.entries(reg)) {
      if (refStr.includes(lawName)) {
        matchedLaw = lawName;
        latestDate = amendDate;
        break;
      }
    }
    if (!latestDate) {
      return {
        statute_ref: refStr,
        matched_law: null,
        valid_as_of: validStr,
        latest_amendment_date: null,
        stale: true,
        status: "UNVERIFIED_LAW",
        warning_badge: "법령 미등록·확인 불가",
      };
    }
    if (!isValidIsoCalendarDate(validStr) || !isValidIsoCalendarDate(latestDate)) {
      return {
        statute_ref: refStr,
        matched_law: matchedLaw,
        valid_as_of: validStr,
        latest_amendment_date: latestDate,
        stale: true,
        status: "INVALID_DATE_FAIL_CLOSED",
        warning_badge: "법령 기준일 형식 오류·확인 필요",
      };
    }
    const isStale = validStr < latestDate;
    return {
      statute_ref: refStr,
      matched_law: matchedLaw,
      valid_as_of: validStr,
      latest_amendment_date: latestDate,
      stale: isStale,
      status: isStale ? "STALE_AMENDMENT" : "VERIFIED_CURRENT",
      warning_badge: isStale ? "법령 개정 확인 필요" : "현행 법령 검증 완료",
    };
  }

  function formatConceptCardTransparencyLabel(uniqueConceptCount, totalCardCount) {
    const concepts = Math.max(1, Number(uniqueConceptCount) || 560);
    const cards = Math.max(concepts, Number(totalCardCount) || concepts * 2);
    return `고유 1차 개념 ${concepts}개 · 양방향 인출 카드 ${cards}장`;
  }

  return {
    SUBJECT_SPECS,
    DEFAULT_AMENDMENT_REGISTRY,
    enrichConceptCurriculumMetadata,
    checkStatuteStaleness,
    formatConceptCardTransparencyLabel,
  };
});
