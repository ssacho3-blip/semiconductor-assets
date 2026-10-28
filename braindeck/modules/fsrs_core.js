/**
 * BrainDeck v8.2 Modular Domain Engine: FSRS-5 Core & REA Event Folder (`fsrs_core.js`).
 * Pure UMD module with zero DOM or network dependencies.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrainDeckFsrsCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_FSRS5_WEIGHTS = Object.freeze([
    0.40255, 1.18385, 3.17300, 15.69105, 7.19490,
    0.53450, 1.46040, 0.00460, 1.54575, 0.11920,
    1.01925, 1.93950, 0.11000, 0.29605, 2.26980,
    0.23150, 2.98980, 0.51655, 0.66210,
  ]);
  const DAY_MS_V56 = 86400000;

  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  function quantize1e6(val) {
    if (!Number.isFinite(val)) return 0.0;
    return Math.round(Number(val) * 1000000) / 1000000;
  }

  function computeRetrievability(elapsedDays, stability) {
    const s = Math.max(0.05, Number(stability) || 0.1);
    const t = Math.max(0.0, Number(elapsedDays) || 0.0);
    return Math.pow(1.0 + (19.0 / 81.0) * (t / s), -0.5);
  }

  function stepFsrs5(memory, rating, elapsedDays = 0.0, desiredRetention = 0.90, weights = DEFAULT_FSRS5_WEIGHTS) {
    const w = Array.isArray(weights) && weights.length >= 19 ? weights.map(Number) : DEFAULT_FSRS5_WEIGHTS;
    const g = Math.max(1, Math.min(4, Math.round(Number(rating || 3))));
    const mem = memory && typeof memory === "object" ? memory : {};
    const curState = String(mem.state || mem.phase || "new");
    const curReps = Number(mem.reps || 0);
    const curLapses = Number(mem.lapses || 0);
    const curS = Number(mem.stability || 0.0);
    const curD = Number(mem.difficulty || 0.0);
    const el = Math.max(0.0, Number(elapsedDays || 0.0));
    const dr = clamp(Number(desiredRetention || 0.90), 0.70, 0.99);
    const factorF = 19.0 / 81.0;
    const decayC = -0.5;

    function nextIntervalDays(sVal) {
      const raw = (sVal / factorF) * (Math.pow(dr, 1.0 / decayC) - 1.0);
      return Math.max(1, Math.min(36500, Math.round(raw)));
    }
    function initDiff(grade) {
      return clamp(w[4] - Math.exp(w[5] * (grade - 1.0)) + 1.0, 1.0, 10.0);
    }

    if (curState === "new" || curReps <= 0 || curS <= 0.0) {
      const dNew = initDiff(g);
      const sNew = Math.max(0.1, Number(w[g - 1]));
      let nextState = "review";
      let scheduledDays = 1;
      let label = "1d";
      if (g === 1) {
        nextState = "learning";
        scheduledDays = 0;
        label = "10m";
      } else if (g === 2) {
        nextState = "learning";
        scheduledDays = 1;
        label = "1d";
      } else {
        nextState = "review";
        scheduledDays = nextIntervalDays(sNew);
        label = `${scheduledDays}d`;
      }
      const nextMem = {
        difficulty: Math.round(dNew * 10000) / 10000,
        stability: Math.round(sNew * 10000) / 10000,
        reps: curReps + 1,
        lapses: curLapses,
        state: nextState,
      };
      return {
        rating: g,
        memory: nextMem,
        stability: nextMem.stability,
        difficulty: nextMem.difficulty,
        reps: nextMem.reps,
        lapses: nextMem.lapses,
        state: nextState,
        phase: nextState,
        retrievability_before: 1.0,
        scheduled_days: scheduledDays,
        scheduled_label: label,
      };
    }

    const rNow = el <= 0.0 ? 1.0 : clamp(Math.pow(1.0 + factorF * (el / curS), decayC), 0.0001, 1.0);
    const safeD = clamp(curD > 0.0 ? curD : 5.0, 1.0, 10.0);
    const safeS = clamp(curS, 0.1, 36500.0);
    const deltaD = -w[6] * (g - 3.0);
    const dDamped = safeD + deltaD * ((10.0 - safeD) / 9.0);
    const d0Easy = initDiff(4);
    const dNext = clamp(w[7] * d0Easy + (1.0 - w[7]) * dDamped, 1.0, 10.0);

    let sNext = safeS;
    let nextState = "review";
    let scheduledDays = 1;
    let label = "1d";
    let lapses = curLapses;

    if (g === 1) {
      const sFail = w[11] * Math.pow(safeD, -w[12]) * (Math.pow(safeS + 1.0, w[13]) - 1.0) * Math.exp(w[14] * (1.0 - rNow));
      sNext = clamp(Math.min(safeS, sFail), 0.1, 36500.0);
      nextState = curState === "review" || curState === "relearning" ? "relearning" : "learning";
      scheduledDays = 0;
      label = "10m";
      lapses = curLapses + (curState === "review" ? 1 : 0);
    } else {
      const hardPenalty = g === 2 ? w[15] : 1.0;
      const easyBonus = g === 4 ? w[16] : 1.0;
      const inc = Math.exp(w[8]) * (11.0 - safeD) * Math.pow(safeS, -w[9]) * (Math.exp(w[10] * (1.0 - rNow)) - 1.0) * hardPenalty * easyBonus;
      sNext = clamp(safeS * (1.0 + inc), 0.1, 36500.0);
      nextState = "review";
      scheduledDays = nextIntervalDays(sNext);
      label = `${scheduledDays}d`;
    }

    const nextMem = {
      difficulty: Math.round(dNext * 10000) / 10000,
      stability: Math.round(sNext * 10000) / 10000,
      reps: curReps + 1,
      lapses: lapses,
      state: nextState,
    };
    return {
      rating: g,
      memory: nextMem,
      stability: nextMem.stability,
      difficulty: nextMem.difficulty,
      reps: nextMem.reps,
      lapses: nextMem.lapses,
      state: nextState,
      phase: nextState,
      retrievability_before: Math.round(rNow * 10000) / 10000,
      scheduled_days: scheduledDays,
      scheduled_label: label,
    };
  }

  function foldReviewEvents(events, params) {
    const w = Array.isArray(params) && params.length >= 19 ? params.map(Number) : DEFAULT_FSRS5_WEIGHTS;
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
        d = quantize1e6(clamp(d0, 1.0, 10.0));
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
      const dNext = quantize1e6(clamp(w[7] * d0Good + (1.0 - w[7]) * dPrime, 1.0, 10.0));

      let sNext = s;
      if (elapsedDays < 1.0 && ev.kind === "REVIEW_AHEAD") {
        sNext = quantize1e6(clamp(s * Math.exp(w[17] * (g - 3.0 + w[18])), 0.1, 36500.0));
        if (g === 1) lapses += 1;
      } else if (g === 1) {
        lapses += 1;
        const sFail =
          w[11] *
          Math.pow(dNext, -w[12]) *
          (Math.pow(s + 1.0, w[13]) - 1.0) *
          Math.exp(w[14] * (1.0 - rNow));
        sNext = quantize1e6(clamp(Math.min(s, sFail), 0.1, 36500.0));
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
        sNext = quantize1e6(clamp(s * (1.0 + inc), 0.1, 36500.0));
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

  return {
    DEFAULT_FSRS5_WEIGHTS,
    quantize1e6,
    computeRetrievability,
    stepFsrs5,
    foldReviewEvents,
  };
});
