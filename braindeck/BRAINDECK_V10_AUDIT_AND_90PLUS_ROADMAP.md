# BrainDeck (브레인덱) v10.0.0 — 전 과정 감사 기록 · 4대 모델 비앵커링(Cold Unanchored) 재평가 · 90+ 엔터프라이즈 로드맵 정본

- **최종 기준 일시**: 2026-10-27 16:15 KST
- **릴리즈 버전**: `v10.0.0` (`versionCode = 100`, `versionName = "10.0.0"`)
- **GitHub Release**: [https://github.com/ssacho3-blip/BrainDeck/releases/tag/v10.0.0](https://github.com/ssacho3-blip/BrainDeck/releases/tag/v10.0.0)
- **Android APK 다운로드**: [BrainDeck-v10.0.apk (16.4 MB, R8 Minified Signed Release)](https://github.com/ssacho3-blip/BrainDeck/releases/download/v10.0.0/BrainDeck-v10.0.apk) (`SHA-256: cbcf68214fe87f63893ea27f82c2039fd30f0dabb63045a0c0d3fffb5ea725fb`)

---

## 1. 버전별 평가 추이 및 4대 프론티어 모델 비앵커링(Cold Unanchored) 점수 비교표

> **채점 원칙**: 점수 유도나 앵커링을 배제하고, 코드베이스의 검증된 사실과 잔여 한계(단일 노드 SQLite WAL 서버, 인간 교과 전문가 표본 감수 미수행 등)를 그대로 제시하여 4대 프론티어 모델이 독립 채점한 결과입니다.
> - **초기 진단 (`v8.0 이전`)**: 평균 **`52.8 / 100점`**
> - **v9.0 Cold 재감사**: 평균 **`56.6 / 100점`** (`Claude Opus 5.5: 60.5`, `Grok 4.7: 53.0`, `Codex GPT-6.1 Sol: 51.0`, `Gemini 4 Argon High: 62.0` — `NO-SHIP`)
> - **v10.0 Cold 재감사**: 평균 **`78.3 / 100점`** (`+21.7점` 상승 — **전 모델 `CONDITIONAL SHIP` / 소프트 런칭·클로즈드 상용 베타 승인**)

| 평가 영역 (100점 만점) | 초기 (`v8.0` 전) | v9.0 Cold 평균 | Claude Opus 5.5 (`v10.0`) | Grok 4.7 (`v10.0`) | Codex GPT-6.1 Sol (`v10.0`) | Gemini 4 Argon High (`v10.0`) | **v10.0 영역 평균** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **① D1. 도메인 알고리즘 & 교육공학 엔진**<br>*(FSRS-5 19-가중치 revlog 최적화 · 128 골든벡터)* | 74.8 | 75.5 | **80** *(+4)* | **85** *(+11)* | **86** *(+11)* | **86** *(+8)* | **84.3** *(+8.8)* |
| **② D2. 덱·콘텐츠 품질 및 커리큘럼 깊이**<br>*(파생 복제 0건 · 7,000 순수 개념 · 동적 SVG)* | 54.3 | 58.0 | **70** *(+8)* | **77** *(+25)* | **84** *(+30)* | **82** *(+18)* | **78.3** *(+20.3)* |
| **③ D3. 소프트웨어 아키텍처 & 유지보수성**<br>*(Mixin 제거 · 명시적 Composition · UI 분리)* | 37.5 | 45.8 | **68** *(+13)* | **62** *(+14)* | **78** *(+43)* | **75** *(+30)* | **70.8** *(+25.0)* |
| **④ D4. 멀티플랫폼 UI/UX & 클라이언트 완성도**<br>*(Compose Canvas SVG 렌더러 · 탭 화면 분리)* | 49.0 | 56.8 | **66** *(+2)* | **66** *(+11)* | **80** *(+32)* | **78** *(+18)* | **72.5** *(+15.7)* |
| **⑤ D5. 백엔드·보안·멀티테넌시·암호화**<br>*(12테이블 `user_id` · SQLite JTI/영수증 · PKCS#1 v1.5)* | 38.3 | 42.3 | **82** *(+37)* | **76** *(+38)* | **90** *(+52)* | **85** *(+37)* | **83.3** *(+41.0)* |
| **⑥ D6. 테스트 및 품질 보증 (QA Gate)**<br>*(412 pytest · 실서버 HTTP/Playwright E2E · R8 APK)* | 61.3 | 64.3 | **75** *(+7)* | **77** *(+19)* | **86** *(+30)* | **86** *(+11)* | **81.0** *(+16.7)* |
| 🏆 **모델별 최종 종합 점수** | **52.8** | **56.6** | **73.5 / 100** | **73.8 / 100** | **84.0 / 100** | **82.0 / 100** | **78.3 / 100** *(+21.7)* |
| **출시 판정 요약** | 클로즈 베타 | NO-SHIP | **CONDITIONAL**<br>*(소프트 런칭 가능)* | **CONDITIONAL SHIP**<br>*(클로즈드 베타 승인)* | **CONDITIONAL SHIP**<br>*(상용 베타 가능)* | **CONDITIONAL SHIP**<br>*(소프트 런칭 승인)* | **소프트 런칭 / 상용 베타 승인** |

---

## 2. 왜 v9.0 자가 평가(84점)와 Cold 감사(56.6점) 사이에 괴리가 있었고, v10.0에서 어떻게 정공법으로 해결했는가?

### 2.1 D5 — 백엔드·보안·멀티테넌시·암호화 (`42.3점 ➔ 83.3점`, `+41.0점`)
- **v9.0 결함 (Cold 감사 적발)**:
  1. `sqlite_store.py` 12개 테이블 중 7개만 `user_id`가 있었고 5개(`revlog`, `review_events`, `confusion_edges`, `confusion_matrix_weights`, `media_cas`)는 `user_id`가 없어 계정 삭제 시 타 사용자 데이터가 함께 삭제되거나 고아 행이 남았음.
  2. JWT 폐기 목록(`_REVOKED_JTIS`)과 스토어 영수증 재사용 방지 집합(`_CONSUMED_RECEIPT_ORDERS`)이 파이썬 프로세스 RAM(`set`)에만 저장되어 서버 재시작 시 초기화되었고, `validate_store_purchase`에서 기본값 `reject_replay=False`로 영수증 재사용이 허용되었음.
  3. `auth_tokens.py`와 `pack_store.py`에 정적 시크릿 문자열이 하드코딩되어 있었고, `/api/v2/auth/token`이 `require_auth_proof=False`로 열려 있었음.
  4. `ssot_corpus_sync.py`의 RSA-2048 서명이 표준 패딩 없는 교과서식(`pow(h, d, n)`)이었고 Android는 단순 문자열 비교만 수행했음.
- **v10.0 정공법 해결 (`tests/test_v100_true_commercial_no_shortcuts_gates.py` 검증 완료)**:
  1. `sqlite_store.py`의 **12개 핵심 테이블 전수**(`decks`, `notes`, `cards`, `revlog`, `user_settings`, `review_undo_journal`, `review_events`, `note_facets`, `confusion_edges`, `confusion_matrix_weights`, `exam_plans`, `media_cas`)에 `user_id` 컬럼과 복합 PK/유니크 인덱스(`ON CONFLICT(user_id, card_a, card_b)` 등)를 완비하고, `account_erasure.py`에서 12개 테이블 모두 `WHERE user_id = ?`로만 삭제하도록 수정.
  2. `revoked_auth_tokens` 및 `verified_store_receipts` SQLite WAL 테이블(`BEGIN IMMEDIATE`)에 영구 기록하여 인메모리 캐시 초기화·재시작 후에도 폐기된 JWT와 재사용된 영수증을 100% 차단(`reject_replay=True` 기본 강제).
  3. 정적 시크릿 상수를 제거하고 런타임 CSPRNG(`secrets.token_hex(32)`) 및 환경변수 기반으로 교체, `/api/v2/auth/token`에 `require_auth_proof=True` 강제.
  4. `ssot_corpus_sync.py` 및 Android `AuthenticSubjectCorpusBank.kt`(`BigInteger.modPow`) 양쪽에서 **표준 RFC 8017 PKCS#1 v1.5 (`EMSA-PKCS1-v1_5`, 256바이트 `0x00 0x01 || 0xFF*202 || 0x00 || DigestInfo_SHA256 || SHA256`)** 패딩 블록을 검증하고 비패딩 RSA를 거부.

### 2.2 D2 — 덱·콘텐츠 품질 및 커리큘럼 깊이 (`58.0점 ➔ 78.3점`, `+20.3점`)
- **v9.0 결함 (Cold 감사 적발)**:
  1. 7,000개 개념 중 1,929개가 `— 공식·원리`, `— 표준 규범`, `— 실전 적용` 등 접미사만 붙인 파생 복제(Derivative Clone)였고, 이를 제외하면 과학(455개), 수학(460개), 국어(437개), 법률·IT(454개)의 순수 1차 개념이 1,000개에 미달했음.
  2. `educational_media_assets.py`의 SVG 도식이 과목당 고정된 정적 템플릿 1개뿐이었음.
- **v10.0 정공법 해결**:
  1. `lexicon_stem_kor_law.py`와 `lexicon_v10_pure_expansion.py`에서 파생 접미사 생성 루프를 전면 삭제하고 `FORBIDDEN_DERIVATIVE_MARKERS`로 금지.
  2. 과학·수학·국어·법률/IT에 과목당 600개씩 총 2,400개의 진성 고유 1차 표제어(물리/화학/생명/지구과학 원소·법칙·기관, 대수/해석/기하/미적분/확률통계 정리, 국립국어원 맞춤법·표준어·고전문학·한자성어, 헌법/민법/형법/행정법/정보처리기사/네트워크/보안 개념)를 구축하여 **7개 전 과목 순수 1차 개념 1,000개 이상 달성** (`english: 2,130`, `hanja: 1,362`, `history: 1,224`, `science: 1,055`, `math: 1,060`, `korean: 1,037`, `law_it: 1,054`; SSOT 번들 과목당 1,000개 = **총 7,000개 순수 개념 / 14,000장 양방향 카드**).
  3. `educational_media_assets.py`에서 원자번호 $Z$별 전자껍질(`2, 8, 18...`) 보어 모형, 함수식별 좌표 곡선(`sin`, `cos`, `x^2`, `log`, `exp`), 한국사 연도별 타임라인 핀을 동적 생성.

### 2.3 D3 & D4 — 소프트웨어 아키텍처 & 멀티플랫폼 UI/UX (`45.8점 ➔ 70.8점`, `56.8점 ➔ 72.5점`)
- **v9.0 결함 (Cold 감사 적발)**:
  1. God 파일을 분리하면서 파이썬 다중 상속 Mixin(`SqliteStoreOpsMixin`, `StudioOpsMixin`, `StudioStoreIngestMixin`)을 사용해 강한 결합이 유지되었음.
  2. Android `MainActivity.kt`가 1,708줄이었고, 개념별 SVG 다이어그램을 Android Compose에서 렌더링하지 못했음.
- **v10.0 정공법 해결**:
  1. 다중 상속 Mixin을 제거하고 명시적 객체 합성(Composition: `SqliteStore.ops_repo`, `StudioService.ops_service`, `StudioService.ingest_service`)으로 전환.
  2. Android `MainActivity.kt`를 `1,184줄`로 축소하고 탭 화면 본문을 `MainActivityTabBodies.kt`(`827줄`) 및 `BrainDeckTabSubPanels.kt`(`1,037줄`)로 분리.
  3. Android Jetpack Compose Canvas 기반 네이티브 SVG 렌더러(`ConceptSvgDiagramCard`) 탑재.

### 2.4 D1 & D6 — 도메인 알고리즘 & QA 게이트 (`75.5점 ➔ 84.3점`, `64.3점 ➔ 81.0점`)
- `fsrs_personalizer.py`에 사용자 복습 로그(`revlog >= 50건`) 기반 **FSRS-5 19-가중치 경험적 최적화기(`optimize_fsrs5_weights_from_revlog`)**를 구현하여 Brier/BCE 손실 감소 및 안정도 단조성을 검증.
- `tests/golden/fsrs_rea_golden_vectors.json` 교차 런타임 골든 벡터를 **128개**로 확장(Python ↔ Node.js `fsrs_core.js` 100% 일치).
- 실서버 `ThreadingHTTPServer` TCP 소켓 기반 E2E 학습 세션 테스트 및 Headless Chromium Playwright E2E 테스트를 포함해 **전체 412개 pytest 100% 통과** + **Android `:domain:test :app:testDebugUnitTest assembleRelease` 100% 통과**.

---

## 3. 대규모 엔터프라이즈 SaaS 기준 90점+ 달성을 위해 남은 영역별 과제 (Remaining 12 Points)

4대 모델이 공통으로 지적한 **현재 `78.3점`에서 엔터프라이즈 SaaS `90점+`로 가기 위한 마지막 12점 과제**는 단일 리포지토리 코드 수정을 넘어선 **인프라·인간 전문가 감수·실기기 텔레메트리 영역**입니다:

1. **D3 & D5 (인프라 수평 확장 & KMS 키 관리)**:
   - 단일 노드 Python `ThreadingHTTPServer` + SQLite WAL 구조를 **PostgreSQL (Row-Level Security 엔진 강제) + Redis Rate Limiter**로 전환.
   - JWT 및 영수증 서명 시크릿을 AWS KMS / HashiCorp Vault / macOS Keychain에 영속 저장하고 무중단 키 롤오버(`kid` 헤더 기반 다중 키 검증) 지원.
2. **D2 (인간 교과 전문가 표본 검수 & 교육과정 성취기준 매핑)**:
   - 7,000개 순수 개념 중 과목별 무작위 200문항 이상을 현직 교사/교과 전문가(SME)가 블라인드 검수하여 사실 오류율 `< 1.0%` 인증 리포트 확보 및 2022 개정 교육과정 성취기준 코드(`[9영01-02]` 등) 전수 매핑.
3. **D1 & D4 & D6 (실제 학습자 홀드아웃 벤치마크 & Android 실기기 계측/접근성 테스트)**:
   - 실제 학생 코호트 복습 데이터(`revlog`)에서 기본 가중치 대비 개인화 가중치의 홀드아웃 Log-Loss / RMSE 개선율 실측 리포트 작성.
   - Android 실기기/에뮬레이터 계측 테스트(`connectedAndroidTest` Compose UI Rule) 및 TalkBack 스크린리더·명도대비·폰트 스케일링(200%) 접근성 감사 완비.
