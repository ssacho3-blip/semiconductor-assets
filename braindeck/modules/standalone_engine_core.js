(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BrainDeckStandaloneEngineCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createStandaloneEngineCore(customStorage, deps) {
    const {
      DAY_MS_V56,
      STANDALONE_COLLECTIONS,
      STANDALONE_TEXTBOOKS,
      _getModule,
      applyC4ReviewCalibration,
      buildV3DailyQueue,
      cleanCardFrontForDisplayJs,
      computeStudyPlan,
      computeDeckMasteryProgress,
      computeRetentionAndForgettingCurveVm,
      computeStudyDayKey,
      deduplicateSessionSiblings,
      enrichConceptCurriculumMetadata,
      expandStandaloneItemByDifficulty,
      extractCardTagList,
      extractMeaningfulAnswerTokens,
      extractTargetAndExplanation,
      filterCardsForExplorer,
      foldReviewEvents,
      interleaveAndShuffleStudyQueue,
      isGenericSectionLabel,
      isTocOrStructuralHeading,
      maskTermInDescJs,
      padStandaloneSpecsToTarget,
      quantize1e6,
      stepFsrs5,
      updateConfusionMatrixWeight,
    } = deps;
    const STORAGE_KEY = "braindeck_standalone_v56_db";
    const storageObj = customStorage || (typeof localStorage !== "undefined" ? localStorage : null);
    let memoryDbRaw = null;

    function normalizeLoadedDb(parsed) {
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.decks) || parsed.decks.length === 0 || !Array.isArray(parsed.cards)) {
        return null;
      }
      parsed.decks.forEach((d, idx) => {
        if (d && typeof d === "object") {
          const did = Number(d.deck_id || d.id || idx + 1);
          d.deck_id = did;
          d.id = did;
        }
      });
      parsed.cards.forEach((c, idx) => {
        if (c && typeof c === "object") {
          const cid = Number(c.card_id || c.id || idx + 1);
          c.card_id = cid;
          const ft = cleanCardFrontForDisplayJs(c.front_text !== undefined ? c.front_text : c.front || "")
            .replace(/^(【\s*[A-Za-z][A-Za-z0-9\s'-]*\s*】)\n[^\n]*\[\s*[A-Za-z][^\]]*\][^\n]*$/g, "$1")
            .trim();
          const bt = String(c.back_text !== undefined ? c.back_text : c.back || "");
          c.front_text = ft;
          c.front = ft;
          c.back_text = bt;
          c.back = bt;
          if (typeof c.flag !== "number") c.flag = Number(c.flag || 0);
          if (typeof c.suspended !== "boolean") c.suspended = Boolean(c.suspended || c.state === "suspended");
        }
      });
      const isLegacySyntheticCard = (c) => {
        const f = String((c && c.front_text) || "").trim();
        if (!f) return true;
        if (/Practice using\s+(?:\{\{c\d+::[^}]+}}|\[ ___ \])\s+in context\./i.test(f)) return true;
        if (/^「[^」]+」$/.test(f)) return true;
        if (/^\[\s*___\s*\]\s*[—:]/.test(f)) return true;
        if (/[—➔]\s*\[\s*___\s*\]$/.test(f)) return true;
        if (f.includes("· 단계 ") || f.includes("· 핵심 정리 】")) return true;
        return false;
      };
      const filteredCards = parsed.cards.filter((c) => !isLegacySyntheticCard(c));
      if (filteredCards.length > 0) {
        parsed.cards = filteredCards;
      }
      if (!Array.isArray(parsed.reviewHistory)) {
        parsed.reviewHistory = [];
      }
      if (!Number.isFinite(Number(parsed.nextDeckId)) || Number(parsed.nextDeckId) < 2) {
        const maxDeckId = parsed.decks.reduce((acc, d) => Math.max(acc, Number((d && d.deck_id) || 0)), 1);
        parsed.nextDeckId = maxDeckId + 1;
      }
      if (!Number.isFinite(Number(parsed.nextCardId)) || Number(parsed.nextCardId) < 1) {
        const maxCardId = parsed.cards.reduce((acc, c) => Math.max(acc, Number((c && c.card_id) || 0)), 0);
        parsed.nextCardId = maxCardId + 1;
      }
      return parsed;
    }

    function loadDb() {
      if (memoryDbRaw) {
        try {
          const parsedMem = normalizeLoadedDb(JSON.parse(memoryDbRaw));
          if (parsedMem) {
            return parsedMem;
          }
        } catch (_e) {
          // ignore
        }
      }
      if (storageObj) {
        try {
          const raw = storageObj.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = normalizeLoadedDb(JSON.parse(raw));
            if (parsed) {
              return parsed;
            }
          }
        } catch (_e) {
          // ignore
        }
      }
      // Seed initial starter deck so Apple/Web users can study immediately on first launch!
      const seedCards = [];
      let nextCardId = 1;
      const engStarterItems = STANDALONE_TEXTBOOKS[0].entries.slice(0, 4).map((it) => ({
        item: it,
        srcTag: "textbook:mid1-eng-neungyul-kim",
      }));
      const histStarterItems = STANDALONE_COLLECTIONS[3].items.slice(0, 3).map((it) => ({
        item: it,
        srcTag: "khist:essential",
      }));
      engStarterItems.concat(histStarterItems).forEach(({ item: it, srcTag }) => {
        const expanded = expandStandaloneItemByDifficulty(it, srcTag, "lv1");
        expanded.forEach((spec) => {
          seedCards.push({
            card_id: nextCardId++,
            deck_id: 1,
            deck_name: "기초 한자 8급·초등 스타터",
            front_text: spec.front_text,
            back_text: spec.back_text,
            note_type: spec.note_type,
            tags: spec.tags,
            state: "new",
            reps: 0,
            lapses: 0,
            stability: 1.2,
            difficulty: 5.0,
            due_at: new Date().toISOString(),
          });
        });
      });

      const initialDb = normalizeLoadedDb({
        nextDeckId: 2,
        nextCardId,
        decks: [
          {
            deck_id: 1,
            id: 1,
            name: "기초 한자 8급·초등 스타터",
            description: "아이폰·아이패드·웹 즉시 학습용 기본 탑재 덱",
          },
        ],
        cards: seedCards,
        reviewHistory: [],
      });
      saveDb(initialDb);
      return initialDb;
    }

    let lastSaveStatus = { ok: true, compacted: false, error: null };

    function _mirrorToIndexedDbAsync(rawJson) {
      if (typeof indexedDB === "undefined" || !indexedDB || typeof indexedDB.open !== "function") return;
      try {
        const req = indexedDB.open("braindeck_idb_v70", 1);
        req.onupgradeneeded = function (ev) {
          const idb = ev.target.result;
          if (!idb.objectStoreNames.contains("snapshots")) {
            idb.createObjectStore("snapshots");
          }
        };
        req.onsuccess = function (ev) {
          try {
            const idb = ev.target.result;
            const tx = idb.transaction("snapshots", "readwrite");
            tx.objectStore("snapshots").put(rawJson, STORAGE_KEY);
          } catch (_txErr) {
            // ignore IDB write error
          }
        };
      } catch (_idbErr) {
        // ignore IDB open error
      }
    }

    function hydrateFromIndexedDb(onHydrated) {
      if (typeof indexedDB === "undefined" || !indexedDB || typeof indexedDB.open !== "function") {
        if (typeof onHydrated === "function") onHydrated({ ok: false, reason: "IDB_UNAVAILABLE" });
        return;
      }
      try {
        const req = indexedDB.open("braindeck_idb_v70", 1);
        req.onupgradeneeded = function (ev) {
          const idb = ev.target.result;
          if (!idb.objectStoreNames.contains("snapshots")) {
            idb.createObjectStore("snapshots");
          }
        };
        req.onsuccess = function (ev) {
          try {
            const idb = ev.target.result;
            const tx = idb.transaction("snapshots", "readonly");
            const getReq = tx.objectStore("snapshots").get(STORAGE_KEY);
            getReq.onsuccess = function () {
              const rawSnap = getReq.result;
              if (typeof rawSnap === "string" && rawSnap.trim()) {
                try {
                  const idbDb = normalizeLoadedDb(JSON.parse(rawSnap));
                  const localDb = loadDb();
                  const idbHist = (idbDb && Array.isArray(idbDb.reviewHistory) ? idbDb.reviewHistory.length : 0);
                  const localHist = (localDb && Array.isArray(localDb.reviewHistory) ? localDb.reviewHistory.length : 0);
                  const idbCards = (idbDb && Array.isArray(idbDb.cards) ? idbDb.cards.length : 0);
                  const localCards = (localDb && Array.isArray(localDb.cards) ? localDb.cards.length : 0);
                  if (idbDb && (idbHist > localHist || idbCards > localCards)) {
                    saveDb(idbDb);
                    if (typeof onHydrated === "function") onHydrated({ ok: true, hydrated: true, cards: idbCards });
                    return;
                  }
                } catch (_parseErr) {
                  // ignore
                }
              }
              if (typeof onHydrated === "function") onHydrated({ ok: true, hydrated: false });
            };
          } catch (_txErr) {
            if (typeof onHydrated === "function") onHydrated({ ok: false, reason: "IDB_READ_ERR" });
          }
        };
      } catch (_idbErr) {
        if (typeof onHydrated === "function") onHydrated({ ok: false, reason: "IDB_OPEN_ERR" });
      }
    }

    function saveDb(db) {
      const prevMemoryDbRaw = memoryDbRaw;
      let serialized = JSON.stringify(db);
      if (storageObj) {
        try {
          storageObj.setItem(STORAGE_KEY, serialized);
          memoryDbRaw = serialized;
          lastSaveStatus = { ok: true, compacted: false, error: null };
        } catch (quotaErr) {
          try {
            if (Array.isArray(db.reviewHistory) && db.reviewHistory.length > 200) {
              db.reviewHistory = db.reviewHistory.slice(-200).map((h) => {
                const copy = Object.assign({}, h);
                delete copy.prev_review_events;
                return copy;
              });
            }
            if (Array.isArray(db.cards)) {
              db.cards.forEach((c) => {
                if (c && Array.isArray(c.review_events) && c.review_events.length > 30) {
                  c.review_events = c.review_events.slice(-30);
                }
              });
            }
            serialized = JSON.stringify(db);
            storageObj.setItem(STORAGE_KEY, serialized);
            memoryDbRaw = serialized;
            lastSaveStatus = { ok: true, compacted: true, error: null };
          } catch (finalErr) {
            memoryDbRaw = prevMemoryDbRaw;
            lastSaveStatus = {
              ok: false,
              compacted: true,
              error_code: "STORAGE_WRITE_FAILED",
              error: String((finalErr && finalErr.message) || quotaErr || "QUOTA_EXCEEDED"),
            };
            return false;
          }
        }
      } else {
        memoryDbRaw = serialized;
        lastSaveStatus = { ok: true, compacted: false, error: null };
      }
      _mirrorToIndexedDbAsync(serialized);
      return true;
    }

    function getLastSaveStatus() {
      return lastSaveStatus;
    }

    function getCatalog() {
      return {
        ok: true,
        standalone: true,
        textbooks: STANDALONE_TEXTBOOKS,
        collections: STANDALONE_COLLECTIONS,
      };
    }

    function enrichCardWithRenderedFields(card) {
      const c = Object.assign({}, card || {});
      const rawFront = String(c.front_text || c.rendered_question || "").trim();
      const rawBack = String(c.back_text || c.rendered_answer || "").trim();
      const ext = extractTargetAndExplanation(rawFront, rawBack, c.target_answer, c.extra_explanation);
      const renderedQ = rawFront.replace(/\{\{c\d+::([^:}]+)(?:::([^}]+))?\}\}/g, function (_, ans, hint) {
        return hint ? `[힌트: ${hint}]` : "[ ... ]";
      });
      c.rendered_question = renderedQ || rawFront;
      c.rendered_answer = ext.targetAnswer || rawBack;
      c.target_answer = ext.targetAnswer || rawBack;
      c.extra_explanation = ext.extraExplanation || "";
      if (!c.curriculum_metadata) {
        c.curriculum_metadata = _getModule("BrainDeckCurriculumStandards").enrichConceptCurriculumMetadata(
          String(c.category || "korean"),
          c.target_answer,
          c.rendered_question,
          extractCardTagList(c)
        );
      }
      return c;
    }

    const LEARN_AHEAD_WINDOW_MS = 20 * 60 * 1000;

    function isCardDueNow(card, nowMs) {
      if (!card) return false;
      const st = String(card.state || "new").toLowerCase();
      if (st === "suspended" || card.suspended || card.buried_today) return false;
      if (st === "new") return true;
      if (st === "learning" || st === "relearning") {
        if (!card.due_at) return true;
        const parsed = Date.parse(card.due_at);
        if (!Number.isFinite(parsed)) return true;
        return parsed <= nowMs + LEARN_AHEAD_WINDOW_MS;
      }
      if (!card.due_at) return true;
      const dueTime = Date.parse(card.due_at);
      if (!Number.isFinite(dueTime)) return true;
      return dueTime <= nowMs;
    }

    function getDeckDailyQuota(db, deckId, nowMsOverride) {
      const nowMs = Number.isFinite(Number(nowMsOverride)) ? Number(nowMsOverride) : Date.now();
      const todayKey = computeStudyDayKey(nowMs, 4, 9);
      const hasDeck = deckId !== undefined && deckId !== null && deckId !== "" && deckId !== "all";
      const targetDeck = hasDeck ? db.decks.find((d) => Number(d.deck_id) === Number(deckId)) : null;
      const deckCards = db.cards.filter((c) => !hasDeck || Number(c.deck_id) === Number(deckId));
      const deckCardIds = new Set(deckCards.map((c) => Number(c.card_id)));
      const defaultNewLimit = deckCardIds.size >= 50
        ? Math.max(10, Math.min(80, Math.ceil(deckCardIds.size / 26)))
        : 30;
      const targetDays = Math.max(1, Number((targetDeck && targetDeck.target_days) || 30));
      const dailyNewLimit = Math.max(1, Number((targetDeck && targetDeck.daily_new_limit) || defaultNewLimit));
      const dailyReviewLimit = Math.max(10, Number((targetDeck && targetDeck.daily_review_limit) || 200));
      const planApplied = Boolean(targetDeck && targetDeck.plan_applied);
      const history = Array.isArray(db.reviewHistory) ? db.reviewHistory : [];

      const seenNewCards = new Set();
      const seenReviewCards = new Set();
      const graduatedNewCards = new Set();
      const graduatedReviewCards = new Set();
      const graduatedTodayCards = new Set();

      history.forEach((h) => {
        if (!h || !deckCardIds.has(Number(h.card_id))) return;
        const cid = Number(h.card_id);
        const hKey = h.at ? computeStudyDayKey(h.at, 4, 9) : "";
        if (hKey && hKey !== todayKey) return;
        const rating = Number(h.rating || h.raw_rating || 3);
        const isFirstTouchToday = !seenNewCards.has(cid) && !seenReviewCards.has(cid);
        if (isFirstTouchToday) {
          if (h.prev_state === "new" || Number(h.prev_reps || 0) === 0) {
            seenNewCards.add(cid);
          } else {
            seenReviewCards.add(cid);
          }
        }
        if (rating >= 2) {
          graduatedTodayCards.add(cid);
          if (seenNewCards.has(cid)) {
            graduatedNewCards.add(cid);
          } else {
            graduatedReviewCards.add(cid);
          }
        } else {
          graduatedTodayCards.delete(cid);
          graduatedNewCards.delete(cid);
          graduatedReviewCards.delete(cid);
        }
      });

      const newStudiedToday = graduatedNewCards.size;
      const inProgressNewToday = Math.max(0, seenNewCards.size - graduatedNewCards.size);
      const reviewsStudiedToday = graduatedReviewCards.size;
      const inProgressRevToday = Math.max(0, seenReviewCards.size - graduatedReviewCards.size);
      const dueReviewCount = deckCards.filter(
        (c) => String(c.state || "").toLowerCase() === "review" && isCardDueNow(c, nowMs)
      ).length;

      return {
        deck_id: hasDeck ? Number(deckId) : null,
        study_day_key: todayKey,
        target_days: targetDays,
        daily_new_limit: dailyNewLimit,
        daily_review_limit: dailyReviewLimit,
        plan_applied: planApplied,
        new_studied_today: newStudiedToday,
        in_progress_today: inProgressNewToday,
        reviews_studied_today: reviewsStudiedToday,
        in_progress_review_today: inProgressRevToday,
        graduated_today: graduatedTodayCards.size,
        due_review_count: dueReviewCount,
        remaining_new_today: Math.max(0, dailyNewLimit - seenNewCards.size),
        remaining_review_today: Math.max(0, dailyReviewLimit - seenReviewCards.size),
      };
    }

    function computeDeckSummaries(db) {
      const nowMs = Date.now();
      return db.decks.map((d) => {
        const dCards = db.cards.filter((c) => Number(c.deck_id) === Number(d.deck_id));
        const dueCards = dCards.filter((c) => isCardDueNow(c, nowMs));
        const newCount = dueCards.filter((c) => c.state === "new").length;
        const learnCount = dueCards.filter((c) => c.state === "learning" || c.state === "relearning").length;
        const reviewCount = dueCards.filter((c) => c.state === "review").length;
        const q = getDeckDailyQuota(db, d.deck_id);
        const prog = computeDeckMasteryProgress(dCards, q);
        return {
          deck_id: d.deck_id,
          name: d.name,
          description: d.description || "",
          total_cards: dCards.length,
          due_cards: dueCards.length,
          new_count: newCount,
          learn_count: learnCount,
          review_count: reviewCount,
          unseen_cards: prog.unseen_cards,
          learning_cards: prog.learning_cards,
          young_cards: prog.young_cards,
          mature_cards: prog.mature_cards,
          touched_cards: prog.touched_cards,
          coverage_pct: prog.coverage_pct,
          mastery_pct: prog.mastery_pct,
          target_days: q.target_days,
          daily_new_limit: q.daily_new_limit,
          daily_review_limit: q.daily_review_limit,
          plan_applied: q.plan_applied,
          new_studied_today: q.new_studied_today,
          remaining_new_today: Math.min(newCount, q.remaining_new_today),
        };
      });
    }

    function getDashboard() {
      const db = loadDb();
      const nowMs = Date.now();
      const decks = computeDeckSummaries(db);
      const totalCards = db.cards.length;
      const dueNowCount = db.cards.filter((c) => isCardDueNow(c, nowMs)).length;
      const avgStability = totalCards > 0
        ? db.cards.reduce((acc, c) => acc + Number(c.stability || 1.2), 0) / totalCards
        : 0;
      const revEvents = (db.reviewHistory || []).map((r) => ({
        rating: Number(r.rating || r.raw_rating || 3),
        reviewed_at_ms: r.at ? Date.parse(r.at) : nowMs,
        stability: Number(r.prev_stability || avgStability || 1.2),
      }));
      const analyticsVm = _getModule("BrainDeckAnalyticsOnboardingVm").computeRetentionAndForgettingCurveVm(revEvents, 0.90);
      return {
        ok: true,
        standalone: true,
        brand: "BrainDeck (브레인덱 Web/iOS)",
        decks,
        stats: {
          total_cards: totalCards,
          due_now: dueNowCount,
          reviews_today: (db.reviewHistory || []).length,
          retention_rate_30d: analyticsVm.empirical_retention_pct,
          retention_display_label: analyticsVm.display_label,
          forgetting_curve: analyticsVm.forgetting_curve_points,
          heatmap_by_day: analyticsVm.heatmap_by_day,
          avg_stability_days: Number(avgStability.toFixed(1)),
          leech_cards: db.cards.filter((c) => Number(c.lapses || 0) >= 3).length,
        },
      };
    }

    function getDueCards(opts) {
      const options = opts && typeof opts === "object" ? opts : {};
      const db = loadDb();
      const nowMs = Date.now();
      let pool = db.cards.slice();
      const hasDeck = options.deck_id !== undefined && options.deck_id !== null && options.deck_id !== "" && options.deck_id !== "all";
      if (hasDeck) {
        pool = pool.filter((c) => Number(c.deck_id) === Number(options.deck_id));
      }
      if (!options.include_all_cards) {
        pool = pool.filter((c) => isCardDueNow(c, nowMs));
      }
      const shuffleMode = String(options.shuffle_mode || "interleaved").toLowerCase();
      if (shuffleMode !== "sequential" && pool.length > 1) {
        pool = interleaveAndShuffleStudyQueue(pool, shuffleMode);
      }
      if (options.bury_siblings === true) {
        pool = deduplicateSessionSiblings(pool);
      }
      const quota = getDeckDailyQuota(db, hasDeck ? options.deck_id : null, nowMs);
      const explicitFullDump = Boolean(options.include_all_cards === true || options.respect_plan === false || Number(options.limit || 0) > 100);
      const shouldSliceByQuota =
        !explicitFullDump &&
        Boolean(options.respect_plan === true || options.respect_daily_quota === true || quota.plan_applied);
      if (shouldSliceByQuota) {
        if (options.bury_siblings !== false) {
          pool = deduplicateSessionSiblings(pool);
        }
        const sliced = [];
        let newTaken = 0;
        let revTaken = 0;
        for (let i = 0; i < pool.length; i += 1) {
          const c = pool[i];
          const st = String(c.state || "new").toLowerCase();
          if (st === "learning" || st === "relearning") {
            sliced.push(c);
          } else if (st === "review") {
            if (revTaken < quota.remaining_review_today) {
              sliced.push(c);
              revTaken += 1;
            }
          } else {
            if (newTaken < quota.remaining_new_today) {
              sliced.push(c);
              newTaken += 1;
            }
          }
        }
        pool = sliced;
      }

      // 3-Tier Intraday Ordering: Due Intraday (due <= now) -> Review & New -> Learn-Ahead Intraday (now < due <= now + 20m)
      const dueIntraday = [];
      const coreQueue = [];
      const learnAheadIntraday = [];
      pool.forEach((c) => {
        const st = String((c && c.state) || "new").toLowerCase();
        if (st === "learning" || st === "relearning") {
          const parsedDue = c.due_at ? Date.parse(c.due_at) : 0;
          if (Number.isFinite(parsedDue) && parsedDue > nowMs) {
            learnAheadIntraday.push(c);
          } else {
            dueIntraday.push(c);
          }
        } else {
          coreQueue.push(c);
        }
      });
      learnAheadIntraday.sort((a, b) => (Date.parse(a.due_at || "") || 0) - (Date.parse(b.due_at || "") || 0));
      pool = dueIntraday.concat(coreQueue).concat(learnAheadIntraday);

      const allDeckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(options.deck_id))
        : db.cards;
      const deckProgress = computeDeckMasteryProgress(allDeckCards, quota);
      pool = pool.map(enrichCardWithRenderedFields);
      return {
        ok: true,
        standalone: true,
        count: pool.length,
        shuffle_mode: shuffleMode,
        daily_quota: quota,
        deck_progress: deckProgress,
        cards: pool,
      };
    }

    function exploreDeckCards(payload) {
      const p = payload || {};
      const db = loadDb();
      const hasDeck = p.deck_id !== undefined && p.deck_id !== null && p.deck_id !== "" && p.deck_id !== "all";
      const deckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(p.deck_id))
        : db.cards;
      const quota = getDeckDailyQuota(db, hasDeck ? p.deck_id : null);
      const deckProgress = computeDeckMasteryProgress(deckCards, quota);
      const res = filterCardsForExplorer(deckCards, {
        query: p.query || "",
        bucket_filter: p.bucket_filter || p.bucket || "all",
        stage_filter: p.stage_filter || p.stage || "all",
        limit: p.limit || 1500,
      });
      res.cards = res.cards.map(enrichCardWithRenderedFields);
      return Object.assign(
        {
          ok: true,
          standalone: true,
          deck_id: hasDeck ? Number(p.deck_id) : null,
          deck_progress: deckProgress,
        },
        res
      );
    }

    function getStudyPlan(payload) {
      const p = payload || {};
      const db = loadDb();
      const hasDeck = p.deck_id !== undefined && p.deck_id !== null && p.deck_id !== "" && p.deck_id !== "all";
      const deckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(p.deck_id))
        : db.cards;
      const totalCards = deckCards.length > 0 ? deckCards.length : 1020;
      const newCount = deckCards.length > 0 ? deckCards.filter((c) => c.state === "new").length : totalCards;
      const learnCount = deckCards.filter((c) => c.state === "learning" || c.state === "relearning").length;
      const revCount = deckCards.filter((c) => c.state === "review").length;
      const quota = getDeckDailyQuota(db, hasDeck ? p.deck_id : null);
      const targetDays = Math.max(1, Number(p.target_days || quota.target_days || 30));
      const dailyMinutes = Math.max(5, Number(p.daily_minutes_budget || 30));
      const plan = computeStudyPlan({
        total_cards: totalCards,
        new_count: newCount,
        learning_count: learnCount,
        review_due_count: revCount,
        target_days: targetDays,
        daily_minutes_budget: dailyMinutes,
      });
      const effDailyNew =
        p.new_per_day !== undefined && p.new_per_day !== null && p.new_per_day !== "" && Number(p.new_per_day) > 0
          ? Number(p.new_per_day)
          : quota.plan_applied
          ? quota.daily_new_limit
          : plan.recommended_daily_new;
      const budgetRevCap = Math.max(20, Math.floor((dailyMinutes * 60) / 8));
      const effDailyRev = Math.max(20, Math.min(quota.daily_review_limit || 200, budgetRevCap));
      if (hasDeck && !quota.plan_applied && deckCards.length >= 100) {
        db.decks.forEach((d) => {
          if (Number(d.deck_id) === Number(p.deck_id)) {
            d.target_days = targetDays;
            d.daily_new_limit = effDailyNew;
            d.daily_review_limit = effDailyRev;
            d.plan_applied = true;
          }
        });
        saveDb(db);
        quota.plan_applied = true;
        quota.daily_new_limit = effDailyNew;
        quota.daily_review_limit = effDailyRev;
        quota.remaining_new_today = Math.max(0, effDailyNew - quota.new_studied_today - (quota.in_progress_today || 0));
        quota.remaining_review_today = Math.max(0, effDailyRev - quota.reviews_studied_today - (quota.in_progress_review_today || 0));
      }
      const queueRes = buildV3DailyQueue(deckCards, {
        new_per_day: Math.max(0, effDailyNew - quota.new_studied_today - (quota.in_progress_today || 0)),
        max_reviews_per_day: quota.remaining_review_today,
      });
      const updatedQuota = Object.assign({}, quota, {
        target_days: targetDays,
        daily_new_limit: effDailyNew,
        remaining_new_today: Math.max(0, effDailyNew - quota.new_studied_today - (quota.in_progress_today || 0)),
      });
      const deckProgress = computeDeckMasteryProgress(deckCards, updatedQuota);
      return {
        ok: true,
        standalone: true,
        deck_id: hasDeck ? Number(p.deck_id) : null,
        plan,
        daily_quota: updatedQuota,
        deck_progress: deckProgress,
        daily_queue_counts: queueRes.counts,
      };
    }

    function applyStudyPlan(payload) {
      const p = payload || {};
      const db = loadDb();
      const hasDeck = p.deck_id !== undefined && p.deck_id !== null && p.deck_id !== "" && p.deck_id !== "all";
      const deckCards = hasDeck
        ? db.cards.filter((c) => Number(c.deck_id) === Number(p.deck_id))
        : db.cards;
      const totalCards = deckCards.length > 0 ? deckCards.length : 1020;
      const newCount = deckCards.length > 0 ? deckCards.filter((c) => c.state === "new").length : totalCards;
      const targetDays = Math.max(1, Number(p.target_days || 30));
      const dailyMinutes = Math.max(5, Number(p.daily_minutes_budget || 30));
      const plan = computeStudyPlan({
        total_cards: totalCards,
        new_count: newCount,
        target_days: targetDays,
        daily_minutes_budget: dailyMinutes,
      });
      const rawNewLimit = p.new_per_day !== undefined && p.new_per_day !== null && p.new_per_day !== ""
        ? Number(p.new_per_day)
        : p.daily_new_limit !== undefined && p.daily_new_limit !== null && p.daily_new_limit !== ""
        ? Number(p.daily_new_limit)
        : 0;
      const effDailyNew = rawNewLimit > 0 ? rawNewLimit : Math.max(1, Number(plan.recommended_daily_new || 30));
      const budgetRevCap = Math.max(20, Math.floor((dailyMinutes * 60) / 8));
      const effDailyRev = Math.max(
        20,
        Math.min(Number(p.max_reviews_per_day || p.daily_review_limit || plan.recommended_max_reviews || 200), budgetRevCap)
      );

      db.decks.forEach((d) => {
        if (!hasDeck || Number(d.deck_id) === Number(p.deck_id)) {
          d.target_days = targetDays;
          d.daily_new_limit = effDailyNew;
          d.daily_review_limit = effDailyRev;
          d.plan_applied = true;
        }
      });
      saveDb(db);
      return getStudyPlan({
        deck_id: hasDeck ? p.deck_id : null,
        target_days: targetDays,
        daily_minutes_budget: dailyMinutes,
        new_per_day: effDailyNew,
      });
    }

    function insertDeckWithSpecs(deckName, description, specs, shuffleMode) {
      const db = loadDb();
      const cleanDeckName = String(deckName || "기본 덱").trim();
      let ordered = specs.slice();
      if (shuffleMode && shuffleMode !== "sequential" && ordered.length > 1) {
        ordered = interleaveAndShuffleStudyQueue(ordered, shuffleMode);
      }

      // BD-Q14: When auto-initializing the 1,000-card starter deck on first boot, upgrade the 7-card seed deck (deck_id=1) in-place
      const existingFirstDeckName = String((db.decks[0] && db.decks[0].name) || "").trim();
      const isSeedDeckOne =
        existingFirstDeckName === "기초 한자 8급·초등 스타터" ||
        existingFirstDeckName.includes("무료 기초 한자·어휘 스타터");
      const allCardsFromSeed =
        Array.isArray(db.cards) &&
        db.cards.length > 0 &&
        db.cards.every((c) => {
          const tags = Array.isArray(c && c.tags) ? c.tags : [];
          return tags.includes("textbook:mid1-eng-neungyul-kim") || tags.includes("khist:essential");
        });
      const isStarterAutoUpgrade =
        (cleanDeckName === "한자 8급" ||
          cleanDeckName.includes("무료 기초 한자·어휘 스타터") ||
          cleanDeckName.includes("기초 한자 8급·초등 스타터")) &&
        db.decks.length === 1 &&
        Number(db.decks[0].deck_id) === 1 &&
        isSeedDeckOne &&
        allCardsFromSeed &&
        db.cards.length <= 25 &&
        (!Array.isArray(db.reviewHistory) || db.reviewHistory.length === 0);

      if (isStarterAutoUpgrade) {
        const deckId = 1;
        db.decks[0].name = cleanDeckName;
        db.decks[0].description = description || db.decks[0].description || "";
        db.nextCardId = 1;
        const createdCards = ordered.map((s) => ({
          card_id: db.nextCardId++,
          deck_id: deckId,
          deck_name: cleanDeckName,
          front_text: s.front_text,
          back_text: s.back_text,
          note_type: s.note_type || (String(s.front_text || "").includes("{{c") ? "cloze" : "basic"),
          tags: Array.isArray(s.tags) ? s.tags : [],
          state: "new",
          reps: 0,
          lapses: 0,
          stability: 1.2,
          difficulty: 5.0,
          due_at: new Date().toISOString(),
        }));
        db.cards = createdCards;
        saveDb(db);
        return {
          ok: true,
          standalone: true,
          deck_id: deckId,
          deck_name: cleanDeckName,
          saved_count: createdCards.length,
          newly_inserted_count: createdCards.length,
          cards: createdCards,
        };
      }

      // BD-P0-10 / BD-Q13: Idempotent deck creation by deckName and (front_text, back_text)
      const existingDeck = db.decks.find((d) => String(d.name || "").trim() === cleanDeckName);
      if (existingDeck) {
        const deckId = Number(existingDeck.deck_id);
        const existingDeckCards = db.cards.filter((c) => Number(c.deck_id) === deckId);
        const seenSignatures = new Set(
          existingDeckCards.map((c) => `${String(c.front_text || "").trim()}|||${String(c.back_text || "").trim()}`)
        );
        const newCards = [];
        ordered.forEach((s) => {
          const fText = String(s.front_text || "").trim();
          const bText = String(s.back_text || "").trim();
          const sig = `${fText}|||${bText}`;
          if (!fText || !bText || seenSignatures.has(sig)) return;
          seenSignatures.add(sig);
          newCards.push({
            card_id: db.nextCardId++,
            deck_id: deckId,
            deck_name: cleanDeckName,
            front_text: fText,
            back_text: bText,
            note_type: s.note_type || (fText.includes("{{c") ? "cloze" : "basic"),
            tags: Array.isArray(s.tags) ? s.tags : [],
            state: "new",
            reps: 0,
            lapses: 0,
            stability: 1.2,
            difficulty: 5.0,
            due_at: new Date().toISOString(),
          });
        });
        if (newCards.length > 0) {
          db.cards = db.cards.concat(newCards);
          saveDb(db);
        }
        const mergedDeckCards = existingDeckCards.concat(newCards);
        return {
          ok: true,
          standalone: true,
          deck_id: deckId,
          deck_name: cleanDeckName,
          saved_count: mergedDeckCards.length,
          newly_inserted_count: newCards.length,
          already_existed: newCards.length === 0,
          cards: mergedDeckCards,
        };
      }

      const deckId = db.nextDeckId++;
      const seenNewSigs = new Set();
      const createdCards = [];
      ordered.forEach((s) => {
        const fText = String(s.front_text || "").trim();
        const bText = String(s.back_text || "").trim();
        const sig = `${fText}|||${bText}`;
        if (!fText || !bText || seenNewSigs.has(sig)) return;
        seenNewSigs.add(sig);
        createdCards.push({
          card_id: db.nextCardId++,
          deck_id: deckId,
          deck_name: cleanDeckName,
          front_text: fText,
          back_text: bText,
          note_type: s.note_type || (fText.includes("{{c") ? "cloze" : "basic"),
          tags: Array.isArray(s.tags) ? s.tags : [],
          state: "new",
          reps: 0,
          lapses: 0,
          stability: 1.2,
          difficulty: 5.0,
          due_at: new Date().toISOString(),
        });
      });
      db.decks.unshift({
        deck_id: deckId,
        name: cleanDeckName,
        description: description || "",
      });
      db.cards = createdCards.concat(db.cards);
      saveDb(db);
      return {
        ok: true,
        standalone: true,
        deck_id: deckId,
        deck_name: cleanDeckName,
        saved_count: createdCards.length,
        newly_inserted_count: createdCards.length,
        cards: createdCards,
      };
    }

    function buildExamScopeDeck(payload) {
      const p = payload || {};
      const tb = STANDALONE_TEXTBOOKS.find((t) => t.textbook_id === p.textbook_id) || STANDALONE_TEXTBOOKS[0];
      const unitSet = new Set(Array.isArray(p.unit_ids) && p.unit_ids.length > 0 ? p.unit_ids : tb.units.map((u) => u.unit_id));
      const matched = tb.entries.filter((e) => unitSet.has(e.unit_id));
      const diff = p.difficulty_level || "mixed";
      const targetCap = Math.max(1000, Number(p.limit || 1000));
      const specs = padStandaloneSpecsToTarget(matched.length > 0 ? matched : tb.entries, tb.textbook_id, diff, targetCap);
      const deckName = (p.deck_name || "").trim() || `${tb.title} (${unitSet.size}개 단원)`;
      return insertDeckWithSpecs(deckName, "시험범위 맞춤 덱 (1,000+ 문항)", specs, p.shuffle_mode || "interleaved");
    }

    function buildCollectionDeck(payload) {
      const p = payload || {};
      const cid = String(p.collection_id || "hanja-grade:8geup").trim();
      const col = STANDALONE_COLLECTIONS.find((c) => c.collection_id === cid);
      const diff = p.difficulty_level || "mixed";
      const targetCap = Math.max(1000, Number(p.limit || 1000));
      const specs = padStandaloneSpecsToTarget(col ? col.items : [], col ? col.collection_id : cid, diff, targetCap);
      const deckName = (p.deck_name || "").trim() || (col ? col.level_label : cid);
      return insertDeckWithSpecs(deckName, "급수·자격증 맞춤 덱 (1,000+ 문항)", specs, p.shuffle_mode || "interleaved");
    }

    function buildCombinedExamDeck(payload) {
      const p = payload || {};
      const scopes = Array.isArray(p.scopes) ? p.scopes : [];
      const diff = p.difficulty_level || "mixed";
      const seedPool = [];
      const labels = [];

      scopes.forEach((sc) => {
        const stype = String(sc.source_type || "collection").toLowerCase();
        const refId = String(sc.ref_id || "");
        if (sc.label) labels.push(sc.label);
        if (stype === "textbook") {
          const tb = STANDALONE_TEXTBOOKS.find((t) => t.textbook_id === refId);
          if (tb) {
            const unitSet = new Set(Array.isArray(sc.unit_ids) && sc.unit_ids.length > 0 ? sc.unit_ids : tb.units.map((u) => u.unit_id));
            tb.entries.filter((e) => unitSet.has(e.unit_id)).forEach((e) => seedPool.push(e));
          }
        } else {
          const col = STANDALONE_COLLECTIONS.find((c) => c.collection_id === refId);
          if (col) {
            col.items.forEach((item) => seedPool.push(item));
          }
        }
      });

      const targetCap = Math.max(1000, Number(p.max_cards || 1000));
      const specs = padStandaloneSpecsToTarget(seedPool, "combined_exam_scope", diff, targetCap);
      const deckName = (p.deck_name || "").trim() || `통합 시험범위 (${labels.slice(0, 2).join(" + ") || `${scopes.length}개 범위`})`;
      const shuffleMode = p.interleave_shuffle === false ? "sequential" : "interleaved";
      return insertDeckWithSpecs(deckName, "다중 시험범위 교차 덱 (1,000+ 문항)", specs, shuffleMode);
    }

    function extractContentPivotJs(sentence) {
      const tokens = extractMeaningfulAnswerTokens(sentence).filter((tok) => {
        if (tok.length < 2) return false;
        if (isGenericSectionLabel(tok)) return false;
        if (/(?:이다|입니다|한다|된다|있다|없다|말한다|뜻한다|의미한다|가리킨다|정의된다|합성하는|과정|경우|통해|대한|위한)$/.test(tok)) {
          return false;
        }
        return true;
      });
      if (tokens.length === 0) return "";
      tokens.sort((a, b) => {
        const aNum = /\d/.test(a) ? 1 : 0;
        const bNum = /\d/.test(b) ? 1 : 0;
        if (aNum !== bNum) return bNum - aNum;
        return b.length - a.length;
      });
      return tokens[0];
    }

    function buildSmartTextDeck(payload) {
      const p = payload || {};
      const rawText = String(p.text || p.raw_text || "").trim();
      const diff = String(p.difficulty_level || "standard").toLowerCase();
      const rawLines = rawText
        .split(/\r?\n/)
        .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
        .filter((l) => l.length >= 2);
      const specs = [];
      let activeHeadingTopic = "";

      rawLines.forEach((rawLine, idx) => {
        if (isTocOrStructuralHeading(rawLine, "paragraph")) {
          const cleanH = rawLine.replace(/^[#*•\-\s[\]<>《》「」『』]+|[\]<>《》「」『』\s]+$/g, "").trim();
          if (
            cleanH.length >= 2 &&
            cleanH.length <= 40 &&
            !isGenericSectionLabel(cleanH) &&
            !/(?:목\s*차|차\s*례|table\s+of\s+contents|\.{2,}|…+)/i.test(cleanH)
          ) {
            activeHeadingTopic = cleanH;
          }
          return;
        }
        if (rawLine.length < 4) return;

        let line = rawLine;
        const conceptTag = `concept:doc_${idx + 1}`;
        const colonMatch = line.match(/^([^\n:：\-–—]{2,55}?)\s*(?::|：|\s—\s|\s-\s|->|→|\|)\s*(.{3,300})$/);
        let topicPrefix = "";

        if (colonMatch) {
          const term = colonMatch[1].trim();
          const defText = colonMatch[2].trim();
          if (isTocOrStructuralHeading(defText, "paragraph")) {
            return;
          }
          if (isGenericSectionLabel(term)) {
            line = defText;
            if (activeHeadingTopic && !line.includes(activeHeadingTopic)) {
              topicPrefix = `[${activeHeadingTopic}] `;
            }
          } else {
            const safeDef = maskTermInDescJs(defText, term);
            const conciseBack = `${term}\n\n💡 해설: ${defText}`;
            const cLv1 = {
              front_text: safeDef,
              back_text: conciseBack,
              note_type: "basic",
              tags: ["custom_doc", conceptTag, "role:core_concept", "diff_lv1"],
            };
            const cLv2 = {
              front_text: `{{c1::${term}::핵심 개념}}: ${safeDef}`,
              back_text: conciseBack,
              note_type: "cloze",
              tags: ["custom_doc", conceptTag, "role:core_concept", "diff_lv2"],
            };
            const cLv3 = {
              front_text: `【 ${term} 】`,
              back_text: `${defText}\n\n💡 해설: ${term} — ${defText}`,
              note_type: "basic",
              tags: ["custom_doc", conceptTag, "role:core_concept", "diff_lv3"],
            };
            if (diff === "lv2") {
              specs.push(cLv2);
            } else if (diff === "lv3") {
              specs.push(cLv3);
            } else if (diff === "mixed" || diff === "all") {
              specs.push(cLv1, cLv3);
            } else {
              specs.push(cLv1);
            }
            return;
          }
        }

        const pivot = extractContentPivotJs(line);
        if (!pivot) return;
        const escapedPivot = pivot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const clozeLine = `${topicPrefix}${line.replace(new RegExp(escapedPivot, "i"), `{{c1::${pivot}::핵심 키워드}}`)}`;
        const maskedLine = `${topicPrefix}${line.replace(new RegExp(escapedPivot, "i"), "[ ___ ]")}`;
        const backText = `${pivot}\n\n💡 해설: ${topicPrefix}${line}`;
        if (diff === "lv3") {
          specs.push({
            front_text: maskedLine,
            back_text: backText,
            note_type: "basic",
            tags: ["custom_doc", conceptTag, "diff_lv3"],
          });
        } else {
          specs.push({
            front_text: clozeLine,
            back_text: backText,
            note_type: "cloze",
            tags: ["custom_doc", conceptTag, `diff_${diff}`],
          });
        }
      });

      const deckName = (p.deck_name || "").trim() || `스마트 노트 덱 (${specs.length}장)`;
      if (p.auto_save === false) {
        return { ok: true, standalone: true, deck_name: deckName, generated_count: specs.length, cards: specs };
      }
      return insertDeckWithSpecs(deckName, "노트·문서 기반 자동 생성 덱", specs, "interleaved");
    }

    function submitReview(payload) {
      const p = payload || {};
      const db = loadDb();
      const card = db.cards.find((c) => Number(c.card_id) === Number(p.card_id));
      const rawRating = Math.max(1, Math.min(4, Number(p.rating || 3)));
      if (!card) {
        return { ok: false, error: "Card not found" };
      }
      const cardSnapshot = JSON.parse(JSON.stringify(card));
      const prevHistLen = Array.isArray(db.reviewHistory) ? db.reviewHistory.length : 0;
      const nowMs = Date.now();
      const prevEvents = Array.isArray(card.review_events) ? card.review_events.slice() : [];
      const prevRtSamples = Array.isArray(card.rt_samples) ? card.rt_samples.slice() : [];
      const prevGoodStreak = Number(card.consecutive_good_streak || 0);

      if (!db.confusionMatrix || typeof db.confusionMatrix !== "object") {
        db.confusionMatrix = {};
      }
      let activeConfusionWeight = Number(p.confusion_weight || 0.0);
      const confusedPeerId = p.confused_with_card_id !== undefined && p.confused_with_card_id !== null ? String(p.confused_with_card_id).trim() : "";
      if (confusedPeerId && confusedPeerId !== String(card.card_id)) {
        const edgeKey = `${card.card_id}->${confusedPeerId}`;
        const prevEdge = db.confusionMatrix[edgeKey] || { weight: 0.0, ts_ms: nowMs, seen_ids: [] };
        const elapsedDays = Math.max(0.0, (nowMs - Number(prevEdge.ts_ms || nowMs)) / DAY_MS_V56);
        const revKey = String(p.review_id || `rev_${card.card_id}_${nowMs}`);
        const cmRes = updateConfusionMatrixWeight(
          prevEdge.weight,
          elapsedDays,
          String(card.card_id),
          confusedPeerId,
          revKey,
          prevEdge.seen_ids || [],
          30.0
        );
        db.confusionMatrix[edgeKey] = {
          weight: cmRes.weight,
          ts_ms: nowMs,
          seen_ids: (prevEdge.seen_ids || []).concat([revKey]).slice(-50),
        };
        activeConfusionWeight = Math.max(activeConfusionWeight, cmRes.weight);
      } else {
        Object.keys(db.confusionMatrix).forEach((k) => {
          if (k.startsWith(`${card.card_id}->`)) {
            activeConfusionWeight = Math.max(activeConfusionWeight, Number(db.confusionMatrix[k].weight || 0.0));
          }
        });
      }

      const c4 = applyC4ReviewCalibration(
        rawRating,
        p.response_time_ms !== undefined ? p.response_time_ms : null,
        Array.isArray(p.baseline_rt_ms_samples) ? p.baseline_rt_ms_samples : prevRtSamples,
        p.consecutive_good_streak !== undefined ? p.consecutive_good_streak : prevGoodStreak,
        activeConfusionWeight
      );
      const rating = c4.effective_rating;

      const lastEvTs = prevEvents.length > 0 ? Number(prevEvents[prevEvents.length - 1].ts_ms || nowMs) : nowMs;
      const elapsedDaysForStep = Math.max(0.0, (nowMs - lastEvTs) / DAY_MS_V56);
      const fsrsStepOut = stepFsrs5(
        {
          state: card.state || "new",
          reps: Number(card.reps || 0),
          lapses: Number(card.lapses || 0),
          stability: Number(card.stability || 0.0),
          difficulty: Number(card.difficulty || 0.0),
        },
        rating,
        elapsedDaysForStep,
        0.90
      );

      db.reviewHistory.push({
        card_id: card.card_id,
        prev_state: card.state,
        prev_reps: card.reps,
        prev_lapses: card.lapses,
        prev_stability: card.stability,
        prev_difficulty: card.difficulty,
        prev_due_at: card.due_at,
        prev_events_count: prevEvents.length,
        prev_review_events: prevEvents.slice(-10),
        prev_rt_samples: prevRtSamples,
        prev_good_streak: prevGoodStreak,
        raw_rating: rawRating,
        rating,
        at: new Date(nowMs).toISOString(),
      });

      if (
        typeof p.response_time_ms === "number" &&
        Number.isFinite(p.response_time_ms) &&
        p.response_time_ms >= 300 &&
        p.response_time_ms <= 60000
      ) {
        card.rt_samples = prevRtSamples.concat([Math.round(p.response_time_ms)]).slice(-20);
      }
      card.consecutive_good_streak = rating >= 3 ? prevGoodStreak + 1 : 0;

      const nextEvents = prevEvents.concat([
        {
          event_id: `ev_${card.card_id}_${nowMs}_${prevEvents.length + 1}`,
          card_id: card.card_id,
          rating,
          ts_ms: nowMs,
          kind: String(p.kind || "REVIEW"),
          idem_key: `idem_${card.card_id}_${nowMs}_${prevEvents.length + 1}`,
        },
      ]);
      const folded = foldReviewEvents(nextEvents);
      card.review_events = nextEvents;
      card.reps = folded.reps;
      card.lapses = folded.lapses;
      card.stability = quantize1e6(folded.s * c4.effective_interval_factor);
      card.difficulty = folded.d;
      card.retrievability = fsrsStepOut.retrievability_before;

      const prevStateNorm = String(card.state || "new").toLowerCase();
      if (rating === 1) {
        card.state = (prevStateNorm === "new" || prevStateNorm === "learning") ? "learning" : "relearning";
        const intradayMs = card.state === "learning" ? 60 * 1000 : 10 * 60 * 1000;
        card.due_at = new Date(nowMs + intradayMs).toISOString();
      } else if (rating === 2) {
        card.state = "review";
        card.stability = Math.max(1.0, card.stability);
        const ivlDays = Math.max(1, Math.round(card.stability));
        card.due_at = new Date(nowMs + ivlDays * DAY_MS_V56).toISOString();
      } else {
        card.state = "review";
        card.stability = Math.max(1.0, card.stability);
        const ivlDays = Math.max(1, Math.round(card.stability));
        card.due_at = new Date(nowMs + ivlDays * DAY_MS_V56).toISOString();
      }
      const savedOk = saveDb(db);
      if (!savedOk) {
        Object.keys(card).forEach((k) => { delete card[k]; });
        Object.assign(card, cardSnapshot);
        if (Array.isArray(db.reviewHistory)) {
          db.reviewHistory.length = prevHistLen;
        }
        return {
          ok: false,
          standalone: true,
          error_code: "STORAGE_WRITE_FAILED",
          error: (lastSaveStatus && lastSaveStatus.error) || "QUOTA_EXCEEDED",
        };
      }
      const schedDays = rating === 1 ? 0 : Math.max(1, Math.round(card.stability));
      const labelMap = {
        1: "10분 후 재학습",
        2: `${schedDays}일 후 복습`,
        3: `${schedDays}일 후 복습`,
        4: `${schedDays}일 후 복습`,
      };
      return {
        ok: true,
        standalone: true,
        card_id: card.card_id,
        raw_rating: rawRating,
        rating,
        effective_rating: rating,
        fluency_status: c4.status,
        fluency_z_score: c4.z_score,
        effective_interval_factor: c4.effective_interval_factor,
        scheduled_days: schedDays,
        scheduled_label: labelMap[rating],
        due_at: card.due_at,
        memory: {
          state: card.state,
          reps: card.reps,
          lapses: card.lapses,
          stability: Number(card.stability.toFixed(2)),
          difficulty: Number(card.difficulty.toFixed(2)),
        },
      };
    }


    return {
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
    };
  }

  return { createStandaloneEngineCore };
});
