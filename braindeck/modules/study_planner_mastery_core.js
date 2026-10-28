(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BrainDeckStudyPlannerMasteryCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function clampV56(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }
  function quantize1e6(x) {
    return Math.round(Number(x) * 1e6) / 1e6;
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

  const STUDY_FLAG_LABELS = {
    0: "플래그 없음",
    1: "집중 요주의 (Red)",
    2: "시험 전 재확인 (Orange)",
    3: "암기 완료 후보 (Green)",
    4: "예문·문맥 보충 (Blue)",
    5: "오답 노트 (Pink)",
    6: "발음·듣기 체크 (Turquoise)",
    7: "심화·함정 변별 (Purple)",
  };

  function computeStudyPlanCore(params) {
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
        `시험 직전 마지막 ${consolidationDays}일은 새 카드 진도를 멈추고(0장/일) 취약·오답 카드만 집중 인출하는 '집중 총정리 구간'으로 자동 배정되었습니다.`
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

  function extractConceptGroupCore(card) {
    const c = card || {};
    const noteId = String(c.note_id || "").trim();
    if (noteId) return `note:${noteId}`;
    const rawTags = c.tags || [];
    const tags = Array.isArray(rawTags) ? rawTags : String(rawTags).split(/[\s,]+/);
    for (let i = 0; i < tags.length; i++) {
      const t = String(tags[i] || "").trim();
      if (t.startsWith("root_concept:") && t.length > 13) {
        return t;
      }
    }
    for (let i = 0; i < tags.length; i++) {
      const t = String(tags[i] || "").trim();
      if (t.startsWith("concept:") || t.startsWith("note:") || t.startsWith("entry:")) {
        return t;
      }
    }
    return "";
  }

  function estimateCardRetrievabilityCore(card) {
    const c = card || {};
    const rVal = Number(c.retrievability);
    if (Number.isFinite(rVal) && rVal > 0 && rVal <= 1) return rVal;
    const s = Number(c.s ?? c.stability ?? 0);
    if (!Number.isFinite(s) || s <= 0) return 0.0;
    const dueDays = Number(c.due_days ?? 0);
    const elapsed = dueDays < 0 ? s + Math.abs(dueDays) : Math.max(0.0, s - dueDays);
    return Math.pow(1.0 + (19.0 / 81.0) * (elapsed / Math.max(0.1, s)), -0.5);
  }

  function buildV3DailyQueueCore(cards, options) {
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
      rc.retrievability = Number(estimateCardRetrievabilityCore(rc).toFixed(4));
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
      const cg = extractConceptGroupCore(lc);
      if (cg) seenConcepts.add(cg);
    });

    const selectedReviews = [];
    for (let i = 0; i < reviewRaw.length; i++) {
      const rc = reviewRaw[i];
      const cid = String(rc.card_id ?? rc.id ?? "");
      const cg = extractConceptGroupCore(rc);
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
      const cg = extractConceptGroupCore(nc);
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

  function applyCardActionCore(card, action, opts) {
    const updated = Object.assign({}, card || {});
    const o = opts || {};
    const act = String(action || "").trim().toLowerCase();
    let tags = Array.isArray(updated.tags) ? updated.tags.map((t) => String(t).trim()).filter(Boolean) : [];

    if (act === "set_flag" || act === "flag") {
      const fVal = Math.trunc(Number(o.flag ?? 0));
      if (!(fVal in STUDY_FLAG_LABELS)) {
        throw new Error(`Invalid card flag: ${fVal}`);
      }
      tags = tags.filter((t) => !t.startsWith("flag:"));
      if (fVal > 0) tags.push(`flag:${fVal}`);
      updated.flag = fVal;
      updated.flag_label = STUDY_FLAG_LABELS[fVal];
    } else if (act === "mark") {
      updated.marked = true;
      if (!tags.includes("marked")) tags.push("marked");
    } else if (act === "unmark") {
      updated.marked = false;
      tags = tags.filter((t) => t !== "marked");
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
      throw new Error(`Unsupported card action: ${action}`);
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
      title = "최근 오답·망각 카드 집중 복습";
    } else if (preset === "review_ahead") {
      selected = active
        .filter((c) => String(c.state || "") === "review" && Number(c.due_days ?? 0) <= daysAhead)
        .sort((a, b) => Number(a.due_days || 0) - Number(b.due_days || 0))
        .slice(0, limit);
      eventKind = "REVIEW_AHEAD";
      title = `시험 대비 ${daysAhead}일 선행 복습`;
    } else if (preset === "preview_new") {
      selected = active.filter((c) => String(c.state || "new") === "new").slice(0, limit);
      eventKind = "CRAM";
      reschedule = false;
      title = "새 카드 무오염 미리보기";
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
      title = "플래그·거머리 취약 카드 특훈";
    } else if (preset === "increase_new_quota") {
      selected = active.filter((c) => String(c.state || "new") === "new").slice(0, extraNew);
      title = `오늘의 새 카드 할당량 +${extraNew}장 추가`;
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
    calibrateFluencyGrade,
    updateConfusionMatrixWeight,
    computeConfusionIntervalFactor,
    applyC4ReviewCalibration,
    computeStudyDayWindowUtc,
    computeStudyDayKey,
    STUDY_FLAG_LABELS,
    computeStudyPlanCore,
    extractConceptGroupCore,
    estimateCardRetrievabilityCore,
    buildV3DailyQueueCore,
    evaluateLeechStatus,
    applyCardActionCore,
    buildCustomStudySession,
    STAGE_LABELS,
    MILESTONE_STEPS,
    computePercentTenths,
    normalizeTagListJs,
    classifyCardMaturityBucket,
    classifyCardStage,
    computeDeckMasteryProgress,
    filterCardsForExplorer,
  };
});
