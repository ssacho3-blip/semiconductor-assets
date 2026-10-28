/**
 * BrainDeck v8.1 Modular ViewModel: Onboarding, Forgetting Curve Analytics & WCAG 2.2 AA Shortcuts (`analytics_onboarding_vm.js`).
 * Pure UMD module enforcing Zero Fabricated Status ("집계 없음" on 0 valid reviews).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrainDeckAnalyticsOnboardingVm = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const GOAL_TRACK_TO_CATEGORY = Object.freeze({
    k12_school: "korean",
    csat_exam: "english",
    civil_service_law: "admin_law",
    it_certification: "cert_it",
    language_mastery: "hanja",
  });

  function computeRetentionAndForgettingCurveVm(reviewLogs, desiredRetention) {
    const targetPct = Number(
      (Math.max(0.70, Math.min(0.99, Number(desiredRetention || 0.90))) * 100.0).toFixed(1)
    );
    const validLogs = Array.isArray(reviewLogs)
      ? reviewLogs.filter(function (r) {
          return (
            r &&
            typeof r === "object" &&
            typeof r.rating === "number" &&
            [1, 2, 3, 4].includes(r.rating)
          );
        })
      : [];

    if (validLogs.length === 0) {
      return {
        total_reviews: 0,
        empirical_retention_pct: null,
        target_retention_pct: targetPct,
        retention_delta_pct: null,
        display_label: "집계 없음",
        forgetting_curve_points: [],
        heatmap_active_days: 0,
        heatmap_by_day: {},
      };
    }

    const total = validLogs.length;
    let passed = 0;
    let stabSum = 0;
    let stabCount = 0;
    const heatmapByDay = {};

    for (const r of validLogs) {
      if (Number(r.rating) >= 2) passed += 1;
      const s = Number(r.stability);
      if (Number.isFinite(s) && s > 0) {
        stabSum += Math.max(0.5, s);
        stabCount += 1;
      }
      const dayStr = String(r.reviewed_day || "").trim();
      if (dayStr) {
        heatmapByDay[dayStr] = (heatmapByDay[dayStr] || 0) + 1;
      }
    }

    const empPct = Number(((passed / total) * 100.0).toFixed(1));
    const deltaPct = Number((empPct - targetPct).toFixed(1));
    const meanStability = stabCount > 0 ? stabSum / stabCount : 7.0;

    const horizons = [0, 1, 3, 7, 14, 30, 60];
    const curvePoints = horizons.map(function (dayT) {
      const ret = Math.pow(1.0 + (19.0 / 81.0) * (dayT / meanStability), -0.5);
      return {
        day: dayT,
        retrievability_pct: Number((ret * 100.0).toFixed(2)),
        target_pct: targetPct,
      };
    });

    return {
      total_reviews: total,
      empirical_retention_pct: empPct,
      target_retention_pct: targetPct,
      retention_delta_pct: deltaPct,
      display_label: `${empPct.toFixed(1)}% (목표 ${targetPct.toFixed(1)}%)`,
      mean_stability_days: Number(meanStability.toFixed(2)),
      forgetting_curve_points: curvePoints,
      heatmap_active_days: Object.keys(heatmapByDay).length,
      heatmap_by_day: heatmapByDay,
    };
  }

  function advanceOnboardingState(currentState, payload) {
    const state = Object.assign({ step: 1, completed: false }, currentState || {});
    const p = payload || {};
    const step = Number(state.step || 1);

    if (step <= 1) {
      const track = String(p.goal_track || "k12_school").trim();
      return Object.assign({}, state, {
        step: 2,
        goal_track: track,
        recommended_deck_category: GOAL_TRACK_TO_CATEGORY[track] || "korean",
        completed: false,
        status: "STEP_2_BUDGET",
        estimated_elapsed_sec: 15,
      });
    }
    if (step === 2) {
      const dailyMin = Math.max(5, Math.min(180, Number(p.daily_minutes || 20)));
      const targetDays = Math.max(7, Math.min(365, Number(p.target_days || 30)));
      const dailyNew = Math.max(5, Math.min(60, Math.round((dailyMin * 60) / 45.0)));
      return Object.assign({}, state, {
        step: 3,
        daily_minutes: dailyMin,
        target_days: targetDays,
        daily_new_quota: dailyNew,
        completed: false,
        status: "STEP_3_DIAGNOSTIC_REQUIRED",
        estimated_elapsed_sec: 30,
      });
    }
    const rawRatings = Array.isArray(p.diagnostic_ratings) ? p.diagnostic_ratings : [];
    const ratings = rawRatings.filter(function (x) {
      return typeof x === "number" && [1, 2, 3, 4].includes(x);
    });
    if (ratings.length < 3) {
      return Object.assign({}, state, {
        step: 3,
        diagnostic_count: ratings.length,
        completed: false,
        status: "DIAGNOSTIC_INCOMPLETE",
      });
    }
    const avgR =
      ratings.reduce(function (a, b) {
        return a + b;
      }, 0) / ratings.length;
    const desiredRet = avgR >= 3.3 ? 0.92 : avgR >= 2.5 ? 0.90 : 0.87;
    return Object.assign({}, state, {
      step: 3,
      diagnostic_count: ratings.length,
      calibrated_desired_retention: desiredRet,
      completed: true,
      status: "ONBOARDING_COMPLETED",
      estimated_elapsed_sec: 50,
    });
  }

  function resolveWcagKeyboardShortcut(key, isInputFocused, shortcutsEnabled, customKeymap) {
    const k = String(key || "");
    if (isInputFocused) {
      return {
        key: k,
        action: "IGNORE_INPUT_FOCUSED",
        rating: null,
        aria_announcement: null,
      };
    }
    if (shortcutsEnabled === false) {
      return {
        key: k,
        action: "SHORTCUTS_DISABLED_SC_2_1_4",
        rating: null,
        aria_announcement: null,
      };
    }
    if (customKeymap && typeof customKeymap === "object" && k in customKeymap) {
      const mappedAction = String(customKeymap[k]);
      const ratingMap = { RATE_AGAIN: 1, RATE_HARD: 2, RATE_GOOD: 3, RATE_EASY: 4 };
      return {
        key: k,
        action: mappedAction,
        rating: ratingMap[mappedAction] || null,
        aria_announcement: `사용자 지정 단축키 실행: ${mappedAction}`,
      };
    }
    if ([" ", "Space", "Spacebar", "Enter"].includes(k)) {
      return { key: k, action: "FLIP_CARD", rating: null, aria_announcement: "카드 정답 및 해설 표시" };
    }
    if (["1", "Digit1", "Numpad1"].includes(k)) {
      return { key: k, action: "RATE_AGAIN", rating: 1, aria_announcement: "1번 다시 학습 평가 완료" };
    }
    if (["2", "Digit2", "Numpad2"].includes(k)) {
      return { key: k, action: "RATE_HARD", rating: 2, aria_announcement: "2번 어려움 평가 완료" };
    }
    if (["3", "Digit3", "Numpad3"].includes(k)) {
      return { key: k, action: "RATE_GOOD", rating: 3, aria_announcement: "3번 알맞음 평가 완료" };
    }
    if (["4", "Digit4", "Numpad4"].includes(k)) {
      return { key: k, action: "RATE_EASY", rating: 4, aria_announcement: "4번 쉬움 평가 완료" };
    }
    if (["u", "U", "z", "Z"].includes(k)) {
      return { key: k, action: "UNDO_REVIEW", rating: null, aria_announcement: "직전 복습 평가 실행 취소" };
    }
    if (["?", "/"].includes(k)) {
      return { key: k, action: "TOGGLE_SHORTCUT_HELP", rating: null, aria_announcement: "키보드 단축키 도움말 전환" };
    }
    return { key: k, action: "NOOP", rating: null, aria_announcement: null };
  }

  return {
    GOAL_TRACK_TO_CATEGORY,
    computeRetentionAndForgettingCurveVm,
    advanceOnboardingState,
    resolveWcagKeyboardShortcut,
  };
});
