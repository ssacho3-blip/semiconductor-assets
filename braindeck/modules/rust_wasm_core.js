/**
 * BrainDeck Unified Rust WebAssembly Bridge (`rust_wasm_core.js`).
 * Loads `wasm/braindeck_core.wasm` synchronously in Node.js and asynchronously in Browser,
 * providing zero-copy FFI calls into the compiled Rust `braindeck-core` engine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrainDeckRustWasmCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATE_CODE_TO_STR = ["new", "learning", "review", "relearning"];
  const STR_TO_STATE_CODE = { new: 0, learning: 1, review: 2, relearning: 3 };

  let _wasmExports = null;
  let _wasmMemory = null;

  function _getQuickVm() {
    if (typeof globalThis !== "undefined" && globalThis.BrainDeckUserGuideQuickVm) {
      return globalThis.BrainDeckUserGuideQuickVm;
    }
    if (typeof require === "function") {
      try {
        return require("./user_guide_and_quick_vm.js");
      } catch (_e) {}
    }
    return null;
  }

  function initFromBuffer(wasmBytes) {
    if (!wasmBytes || typeof WebAssembly === "undefined") return false;
    try {
      const mod = new WebAssembly.Module(wasmBytes);
      const inst = new WebAssembly.Instance(mod, {});
      _wasmExports = inst.exports;
      _wasmMemory = inst.exports.memory;
      return true;
    } catch (_err) {
      return false;
    }
  }

  if (typeof process === "object" && process && process.versions && process.versions.node) {
    try {
      const fs = require("fs");
      const path = require("path");
      const wasmPath = path.resolve(__dirname, "..", "wasm", "braindeck_core.wasm");
      if (fs.existsSync(wasmPath)) initFromBuffer(fs.readFileSync(wasmPath));
    } catch (_e) {}
  }

  async function initBrowserWasm(wasmUrl) {
    if (_wasmExports) return true;
    if (typeof fetch !== "function" || typeof WebAssembly === "undefined") return false;
    try {
      const resp = await fetch(wasmUrl || "./wasm/braindeck_core.wasm");
      if (!resp.ok) return false;
      return initFromBuffer(await resp.arrayBuffer());
    } catch (_err) {
      return false;
    }
  }

  function isWasmLoaded() {
    return Boolean(_wasmExports && _wasmMemory);
  }

  function coreVersion() {
    if (!_wasmExports || typeof _wasmExports.bd_core_version !== "function") return 0;
    return Number(_wasmExports.bd_core_version()) >>> 0;
  }

  function computeRetrievabilityWasm(elapsedDays, stability) {
    if (!_wasmExports) return null;
    return Number(_wasmExports.bd_fsrs_retrievability(Number(elapsedDays) || 0, Number(stability) || 0));
  }

  function computeNextIntervalWasm(stability, desiredRetention, maxInterval) {
    if (!_wasmExports) return null;
    return (
      Number(
        _wasmExports.bd_fsrs_next_interval(
          Number(stability) || 0.1,
          Number(desiredRetention) || 0.9,
          Number(maxInterval) || 36500
        )
      ) >>> 0
    );
  }

  function stepFsrs5Wasm(memory, rating, elapsedDays, desiredRetention) {
    if (!_wasmExports || !_wasmMemory) return null;
    const mem = memory && typeof memory === "object" ? memory : {};
    const curStateStr = String(mem.state || mem.phase || "new");
    const stateCode = STR_TO_STATE_CODE[curStateStr] !== undefined ? STR_TO_STATE_CODE[curStateStr] : 0;
    const outPtr = Number(_wasmExports.bd_scratch_ptr()) >>> 0;
    const g = Math.max(1, Math.min(4, Math.round(Number(rating || 3))));
    const rc = _wasmExports.bd_fsrs_step(
      Number(mem.difficulty || 0.0),
      Number(mem.stability || 0.0),
      Number(mem.reps || 0) >>> 0,
      Number(mem.lapses || 0) >>> 0,
      stateCode >>> 0,
      g >>> 0,
      Math.max(0.0, Number(elapsedDays || 0.0)),
      Math.max(0.7, Math.min(0.99, Number(desiredRetention || 0.9))),
      outPtr
    );
    if (rc !== 0) return null;

    const view = new DataView(_wasmMemory.buffer, outPtr, 40);
    const stability = view.getFloat64(0, true);
    const difficulty = view.getFloat64(8, true);
    const retrievabilityBefore = view.getFloat64(16, true);
    const reps = view.getUint32(24, true);
    const lapses = view.getUint32(28, true);
    const scheduledDays = view.getUint32(32, true);
    const nextStateCode = view.getUint32(36, true);
    const nextState = STATE_CODE_TO_STR[nextStateCode] || "review";
    const label = scheduledDays === 0 ? "10m" : `${scheduledDays}d`;
    const nextMem = { difficulty, stability, reps, lapses, state: nextState };
    return {
      rating: g,
      memory: nextMem,
      stability,
      difficulty,
      reps,
      lapses,
      state: nextState,
      phase: nextState,
      retrievability_before: retrievabilityBefore,
      scheduled_days: scheduledDays,
      scheduled_label: label,
      engine: "rust-wasm",
    };
  }

  function _writeUtf8ToScratch(str, byteOffset) {
    if (!_wasmExports || !_wasmMemory) return { ptr: 0, len: 0 };
    const basePtr = (Number(_wasmExports.bd_scratch_ptr()) >>> 0) + (byteOffset || 0);
    const cap = Number(_wasmExports.bd_scratch_cap()) >>> 0;
    const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    const bytes = enc ? enc.encode(String(str || "")) : Buffer.from(String(str || ""), "utf8");
    const len = Math.min(bytes.length, Math.max(0, cap - (byteOffset || 0) - 64));
    new Uint8Array(_wasmMemory.buffer, basePtr, len).set(bytes.subarray(0, len));
    return { ptr: basePtr, len };
  }

  function _readUtf8FromScratch(byteOffset, byteLen) {
    if (!_wasmExports || !_wasmMemory || byteLen <= 0) return "";
    const basePtr = (Number(_wasmExports.bd_scratch_ptr()) >>> 0) + (byteOffset || 0);
    const slice = new Uint8Array(_wasmMemory.buffer, basePtr, byteLen);
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(slice);
    return Buffer.from(slice).toString("utf8");
  }

  function collectionPriorityRankWasm(collectionId) {
    if (!_wasmExports) return null;
    const s = _writeUtf8ToScratch(collectionId, 128);
    return Number(_wasmExports.bd_collection_priority_rank_slice(s.ptr, s.len)) >>> 0;
  }

  function collectionRecommendedLimitWasm(collectionId) {
    if (!_wasmExports) return null;
    const s = _writeUtf8ToScratch(collectionId, 128);
    return Number(_wasmExports.bd_collection_recommended_limit_slice(s.ptr, s.len)) >>> 0;
  }

  function areDistractorsCompatibleWasm(targetAns, candAns, facetKey) {
    if (!_wasmExports) return null;
    const s1 = _writeUtf8ToScratch(targetAns, 256);
    const s2 = _writeUtf8ToScratch(candAns, 256 + s1.len + 8);
    const s3 = _writeUtf8ToScratch(facetKey, 256 + s1.len + s2.len + 16);
    return Boolean(
      _wasmExports.bd_are_distractors_compatible_slice(s1.ptr, s1.len, s2.ptr, s2.len, s3.ptr, s3.len)
    );
  }

  function hanjaCoachingWasm(text) {
    if (!_wasmExports || typeof _wasmExports.bd_hanja_coaching_slice !== "function") return "";
    const s = _writeUtf8ToScratch(text, 256);
    const outOffset = 2048;
    const outPtr = (Number(_wasmExports.bd_scratch_ptr()) >>> 0) + outOffset;
    const n = Number(_wasmExports.bd_hanja_coaching_slice(s.ptr, s.len, outPtr, 4096));
    return n > 0 ? _readUtf8FromScratch(outOffset, n) : "";
  }

  function englishPhonicsWasm(text) {
    if (!_wasmExports || typeof _wasmExports.bd_english_phonics_slice !== "function") return "";
    const s = _writeUtf8ToScratch(text, 256);
    const outOffset = 2048;
    const outPtr = (Number(_wasmExports.bd_scratch_ptr()) >>> 0) + outOffset;
    const n = Number(_wasmExports.bd_english_phonics_slice(s.ptr, s.len, outPtr, 4096));
    return n > 0 ? _readUtf8FromScratch(outOffset, n) : "";
  }

  function evaluateDailySessionWasm(solvedToday, correctToday, dailyGoal, streakDays) {
    const solved = Math.max(0, Number(solvedToday) || 0);
    const correct = Math.max(0, Math.min(solved, Number(correctToday) || 0));
    const goal = Math.max(5, Number(dailyGoal) || 15);
    const streak = Math.max(1, Number(streakDays) || 1);
    if (_wasmExports && typeof _wasmExports.bd_daily_session_summary_cstr === "function") {
      const outOffset = 2048;
      const outPtr = (Number(_wasmExports.bd_scratch_ptr()) >>> 0) + outOffset;
      const n = Number(_wasmExports.bd_daily_session_summary_cstr(solved, correct, goal, streak, outPtr, 4096));
      if (n > 0) {
        try {
          return JSON.parse(_readUtf8FromScratch(outOffset, n));
        } catch (_e) {}
      }
    }
    const goalReached = solved >= goal;
    const accuracyPct = solved === 0 ? 100 : Math.min(100, Math.floor((correct * 100) / solved));
    const filled = Math.min(10, Math.floor((Math.min(solved, goal) * 10) / goal));
    const stampBar = "⭐".repeat(filled) + "⚪".repeat(10 - filled);
    const remaining = Math.max(0, goal - solved);
    return {
      solved,
      correct,
      goal,
      remaining,
      accuracy_pct: accuracyPct,
      goal_reached: goalReached,
      stamp_bar: stampBar,
      badge_label: goalReached
        ? `🎉 오늘 목표 ${goal}문제 완주 성공! (정답률 ${accuracyPct}% · 🔥 연속 ${streak}일)`
        : `🎯 오늘의 목표 ${solved} / ${goal}문제 (완주까지 ${remaining}문제 남음 · 🔥 ${streak}일째)`,
    };
  }

  function resolvePersonaPolicyWasm(personaId) {
    if (_wasmExports && typeof _wasmExports.bd_resolve_persona_policy_slice === "function") {
      const s = _writeUtf8ToScratch(String(personaId || ""), 256);
      const outOffset = 2048;
      const outPtr = (Number(_wasmExports.bd_scratch_ptr()) >>> 0) + outOffset;
      const n = Number(_wasmExports.bd_resolve_persona_policy_slice(s.ptr, s.len, outPtr, 4096));
      if (n > 0) {
        try {
          return JSON.parse(_readUtf8FromScratch(outOffset, n));
        } catch (_e) {}
      }
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

  const exportedApi = {
    initFromBuffer,
    initBrowserWasm,
    isWasmLoaded,
    coreVersion,
    computeRetrievabilityWasm,
    computeNextIntervalWasm,
    stepFsrs5Wasm,
    collectionPriorityRankWasm,
    collectionRecommendedLimitWasm,
    resolvePersonaPolicyWasm,
    areDistractorsCompatibleWasm,
    hanjaCoachingWasm,
    englishPhonicsWasm,
    evaluateDailySessionWasm,
    bindCommercialKidsFocusExperience(ctx) {
      const qvm = _getQuickVm();
      if (qvm && typeof qvm.bindCommercialKidsFocusDom === "function") {
        return qvm.bindCommercialKidsFocusDom(ctx, exportedApi);
      }
      return null;
    },
  };

  return exportedApi;
});
