# BrainDeck v1.0 — Corpus Provenance & Open-Standard License Attribution

## 1. Overview & Legal Compliance
All 11,054 educational items across the 18 graded curriculum collections in BrainDeck v1.0 are derived from public-domain national curriculum standards, open-license phonetic/character databases, and original pedagogical authoring. No proprietary copyrighted sentences or commercial dictionary bodies are redistributed verbatim without open-license or statutory public-domain authority.

## 2. Primary Open-Standard & Public-Domain Sources

| Asset / Domain | Upstream Standard / Source | License / Legal Basis | Verification Artifact |
|---|---|---|---|
| **2022 Revised National Curriculum Vocabulary Lists** (`eng_elem34`, `eng_elem56`, `eng_mid1200`, `eng_high_csat`, `kor_*`, `math`, `sci_*`, `hist_*`) | 대한민국 교육부 고시 제2022-33호 (2022 개정 교육과정 초·중·고 기본 어휘 및 성취기준) | **대한민국 저작권법 제7조 (보호받지 못하는 저작물 — 고시·공고)** / 공공누리 제1유형 (KOGL Type 1) | `MOE_2022_NATIONAL_CURRICULUM` |
| **English Phonetics (IPA)** (`2,981` headwords) | CMU Pronouncing Dictionary (`cmudict-0.7b`) mapped to standard General American IPA (`ARPAbet -> IPA`) | **BSD 2-Clause License** (Carnegie Mellon University) | `CMUDICT_07B_IPA_STANDARD` |
| **English Pedagogical Example Sentences** (`2,981` bilingual sentences) | Original grade-aligned pedagogical sentences authored specifically for BrainDeck (`scripts/bespoke_english_sentences.py`, `scripts/verified_dict_sentences.json`) | **CC0 1.0 / BrainDeck First-Party Original Pedagogical Corpus** (Zero third-party copyrighted textbook excerpts) | `scripts/bespoke_english_sentences.py` |
| **Hanja Radicals & Total Stroke Counts** (`1,727` CJK Unified Ideographs) | Unicode Standard Annex #38 (Unicode Han Database / Unihan `kRSUnicode` & `kTotalStrokes`) and Perl core `Unicode::Collate::CJK::Stroke` | **Unicode License v3** (Permissive Open Standard) | `domain/unihan_irg_radical_strokes.txt`, `domain/unihan_ktotalstrokes_ref.json` |
| **Hanja Grade Allocations & 4-Char Idioms** (`hanja_8geup`..`hanja_mid1800`, `hanja_idiom`) | 한문과 교육과정 기초 한자 1,800자 (교육부 고시) 및 급수별 배정 한자 표준 훈음·사자성어 | **대한민국 저작권법 제7조 (교육부 고시 기초한자)** 및 독자 편찬 뜻풀이 | `scripts/verified_hanja_dict_defs.json` |
| **Korean Orthography & Standard Dictionary Rules** (`kor_dictation`, `kor_orthography_lit`) | 국립국어원 한글 맞춤법 (문화체육관광부 고시) 및 표준 발음법 | **대한민국 저작권법 제7조 (법령·고시)** / 공공누리 제1유형 | `NIKL_STANDARD_KOREAN_ORTHOGRAPHY` |
| **Constitutional & Civil/Criminal Statutes** (`law_constitution`) | 대한민국 헌법·민법·형법·행정소송법 조문 및 대법원·헌법재판소 판례 요지 (국가법령정보센터) | **대한민국 저작권법 제7조 제1호·제3호 (법령 및 법원의 판결·결정)** | `domain/graded_lexicon_ssot.py` |

## 3. Automated CI Audit Gate
`audit_corpus_linguistic_accuracy()` verifies:
1. Presence and SHA-256 integrity of `unihan_irg_radical_strokes.txt` and `unihan_ktotalstrokes_ref.json`.
2. Presence and schema completeness of `corpus_provenance_license.json` and `docs/CORPUS_PROVENANCE_AND_LICENSE.md`.
3. Zero placeholder definitions (`"필수 활용 한자어"`, `"핵심 한자 어휘"`), zero bracket-only contexts (`^【.*】$`), and 100% unique English example sentences (`2,981 / 2,981`).
