/**
 * BrainDeck v8.2 Modular UI Dialogs, Store, Catalog & Sheet Renderer (`ui_dialogs_render.js`).
 * Extracted from `app.js` via Strangler Fig pattern. Zero 'BrainDeck' substring.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrainDeckUiDialogsRender = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  async function renderDeckExplorerPanelDom(ctx) {
    const { el, state, apiPost, enrichStandaloneCard, renderCurrentCard, showUxToast } = ctx;
    const panel = el("deck-card-explorer-panel");
    if (!panel || panel.style.display === "none") return;
    const qInput = el("explorer-search-input");
    const bSel = el("explorer-bucket-select");
    const sSel = el("explorer-stage-select");
    const bVal = (bSel && bSel.value) || "all";
    const sVal = (sSel && sSel.value) || "all";
    const res = await apiPost("/api/deck/explorer", {
      deck_id: state.selectedDeckId || null,
      query: (qInput && qInput.value) || "",
      bucket: bVal,
      bucket_filter: bVal,
      stage: sVal,
      stage_filter: sVal,
      limit: 1500,
    });
    if (!res || !res.ok) return;
    const sumEl = el("explorer-result-summary") || el("explorer-total-label");
    if (sumEl) {
      sumEl.textContent = `일치 ${res.matched_count || 0}장 (표시 ${res.returned_count || 0}장 / 전체 ${(state.deckProgress && state.deckProgress.total_cards) || res.matched_count || 0}장)`;
    }
    const listBox = el("explorer-card-rows") || el("explorer-card-list");
    if (!listBox) return;
    listBox.textContent = "";
    const bucketBadges = {
      mature: { label: "장기마스터", bg: "#e8faf0", fg: "#008a50" },
      young: { label: "단기암기", bg: "#eff6ff", fg: "#1d4ed8" },
      learning: { label: "학습·오답", bg: "#fffbeb", fg: "#b45309" },
      unseen: { label: "미학습", bg: "#f1f5f9", fg: "#475569" },
      suspended: { label: "보류", bg: "#fef2f2", fg: "#be123c" },
    };
    (res.cards || []).forEach((c, idx) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:#ffffff;border:1px solid var(--border);font-size:0.78rem;flex-wrap:wrap;";
      const left = document.createElement("div");
      left.style.cssText = "display:flex;align-items:center;gap:6px;flex:1;min-width:200px;flex-wrap:wrap;";
      const bMeta = bucketBadges[c.maturity_bucket] || bucketBadges.unseen;
      const bSpan = document.createElement("span");
      bSpan.style.cssText = `padding:2px 6px;border-radius:6px;background:${bMeta.bg};color:${bMeta.fg};font-weight:700;font-size:0.7rem;`;
      bSpan.textContent = bMeta.label;
      const sSpan = document.createElement("span");
      sSpan.style.cssText = "padding:2px 6px;border-radius:6px;background:var(--surface-2);color:var(--accent);font-weight:700;font-size:0.7rem;";
      sSpan.textContent = c.stage_label || c.stage || "Lv.2";
      const qSpan = document.createElement("span");
      qSpan.style.cssText = "font-weight:700;color:var(--text);";
      qSpan.textContent = `#${idx + 1} ${(c.front_text || "").replace(/\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/g, "[$1]").slice(0, 65)}`;
      const aSpan = document.createElement("span");
      aSpan.style.cssText = "color:var(--muted);";
      aSpan.textContent = `➔ ${(c.target_answer || c.back_text || "").slice(0, 45)} (S:${Number(c.stability || 0).toFixed(1)}d)`;
      left.appendChild(bSpan);
      left.appendChild(sSpan);
      left.appendChild(qSpan);
      left.appendChild(aSpan);

      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.style.cssText = "padding:3px 8px;font-size:0.72rem;";
      jumpBtn.textContent = "바로 풀기";
      jumpBtn.onclick = () => {
        const enriched = enrichStandaloneCard(c);
        const existingIdx = state.dueCards.findIndex((dc) => Number(dc.card_id) === Number(c.card_id));
        if (existingIdx >= 0) {
          state.currentIndex = existingIdx;
        } else {
          state.dueCards.unshift(enriched);
          state.currentIndex = 0;
        }
        renderCurrentCard();
        showUxToast(`선택한 카드(#${c.card_id})로 바로 이동했습니다.`, "emerald");
      };
      row.appendChild(left);
      row.appendChild(jumpBtn);
      listBox.appendChild(row);
    });
  }

  async function renderStudyPlanBannerDom(ctx, planRes) {
    const { el, state, renderDeckProgressDashboard } = ctx;
    const banner = el("bd-study-plan-banner");
    if (!banner || !planRes || !planRes.ok || !planRes.plan) return;
    if (planRes.deck_progress) {
      state.deckProgress = planRes.deck_progress;
      renderDeckProgressDashboard(state.deckProgress);
    }
    const pl = planRes.plan;
    const dq = planRes.daily_quota || {};
    const dp = planRes.deck_progress || state.deckProgress;
    const dailyNewLimit = Number(dq.daily_new_limit || pl.recommended_daily_new || 30);
    const newStudied = Number(dq.new_studied_today || 0);
    const remNew = dq.remaining_new_today !== undefined ? Number(dq.remaining_new_today) : Math.max(0, dailyNewLimit - newStudied);
    const badgeTone =
      pl.status === "FEASIBLE"
        ? "완주 가능"
        : pl.status === "TIGHT_SCHEDULE"
        ? "타이트한 일정"
        : "집중 배분 권장";
    const appliedLabel = dq.plan_applied ? "맞춤 계획 적용 중" : "기본 일일 할당 적용 중";
    const progLine = dp
      ? `\n[전체 덱 진척률] 진도율 ${Number(dp.coverage_pct || 0).toFixed(1)}% (${dp.touched_cards}/${dp.total_cards}장 학습) · 가중 숙련도 ${Number(dp.mastery_pct || 0).toFixed(1)}% · 미학습 ${dp.buckets ? dp.buckets.unseen : 0}장`
      : "";
    banner.style.display = "block";
    banner.textContent =
      `[D-${pl.target_days} 학습 계획 · ${badgeTone} · ${appliedLabel}] 전체 ${pl.total_cards}장 (진도 ${pl.new_intake_days}일 + 총정리 복습 ${pl.consolidation_days}일)\n` +
      `오늘의 할당량: 새 카드 ${dailyNewLimit}장 중 남은 ${remNew}장 (오늘 완료 ${newStudied}장) · 일평균 약 ${pl.avg_daily_minutes}분 (권장 최대 복습 ${pl.recommended_max_reviews}장/일)` +
      progLine +
      `\n코칭: ${(pl.recommendations && pl.recommendations[0]) || ""}`;
  }

  function renderTapBlockQuizDom(ctx) {
    const { el, vm, res, quizBox, revealAnswer, clearRecommendedGlow } = ctx;
      const expectedBlocks = Array.isArray(res.tap_blocks) && res.tap_blocks.length > 0
        ? res.tap_blocks.slice()
        : String(res.target_answer || "").split(/\s+/).filter(Boolean);
      const poolBlocks = expectedBlocks.map((text, idx) => ({ id: idx, text })).reverse();
      let selectedItems = [];

      const trayEl = document.createElement("div");
      trayEl.style.cssText =
        "min-height:42px;padding:8px 10px;border-radius:12px;border:1px dashed var(--accent);background:#ffffff;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;";

      const poolEl = document.createElement("div");
      poolEl.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;";

      const statusEl = document.createElement("div");
      statusEl.style.cssText = "font-size:0.78rem;color:var(--muted);";

      function renderTapBlockState() {
        trayEl.textContent = "";
        poolEl.textContent = "";

        if (selectedItems.length === 0) {
          const placeholder = document.createElement("span");
          placeholder.style.cssText = "font-size:0.78rem;color:var(--muted);";
          placeholder.textContent = "아래 구문 조각 버튼을 순서대로 클릭해 이곳에 문장을 조립하세요...";
          trayEl.appendChild(placeholder);
        } else {
          selectedItems.forEach((item, sIdx) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "btn-primary";
            chip.style.cssText = "padding:5px 10px;font-size:0.8rem;";
            chip.textContent = `${sIdx + 1}. ${item.text} ✕`;
            chip.onclick = () => {
              selectedItems.splice(sIdx, 1);
              renderTapBlockState();
            };
            trayEl.appendChild(chip);
          });
        }

        poolBlocks.forEach((item) => {
          const alreadyUsed = selectedItems.some((s) => s.id === item.id);
          if (alreadyUsed) return;
          const chip = document.createElement("button");
          chip.type = "button";
          chip.style.cssText = "padding:6px 11px;font-size:0.8rem;";
          chip.textContent = `+ ${item.text}`;
          chip.onclick = () => {
            selectedItems.push(item);
            renderTapBlockState();
            if (selectedItems.length === expectedBlocks.length && vm && typeof vm.evaluateTapBlockAttempt === "function") {
              const check = vm.evaluateTapBlockAttempt(
                selectedItems.map((x) => x.text),
                expectedBlocks
              );
              statusEl.textContent = check.feedback;
              statusEl.style.color = check.isCorrect ? "var(--emerald)" : "var(--amber)";
              revealAnswer();
              clearRecommendedGlow();
              const recBtn = el(`rate-${check.recommendedRating}`);
              if (recBtn) recBtn.classList.add("recommended-glow");
            }
          };
          poolEl.appendChild(chip);
        });
      }

      const ctrlRow = document.createElement("div");
      ctrlRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;";
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.style.cssText = "padding:4px 10px;font-size:0.75rem;";
      resetBtn.textContent = "🔄 블록 초기화";
      resetBtn.onclick = () => {
        selectedItems = [];
        statusEl.textContent = "";
        renderTapBlockState();
      };
      ctrlRow.appendChild(statusEl);
      ctrlRow.appendChild(resetBtn);

      renderTapBlockState();
      quizBox.appendChild(trayEl);
      quizBox.appendChild(poolEl);
      quizBox.appendChild(ctrlRow);
  }

  function renderDocumentPreviewCardsDom(ctx) {
    const { el, vm, state, res, listEl, isAlreadySaved, formatted, renderPreviewCards } = ctx;
          listEl.textContent = "";
          const activeCards = (state.pendingDeckPlan && state.pendingDeckPlan.cards) || [];
          activeCards.forEach((c, idx) => {
            const itemDiv = document.createElement("div");
            itemDiv.style.cssText =
              "background:#f9fafb;border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-size:0.82rem;display:flex;flex-direction:column;gap:6px;";

            const headerRow = document.createElement("div");
            headerRow.style.cssText =
              "display:flex;justify-content:space-between;align-items:center;color:var(--accent);font-weight:700;";

            const patLabel = vm.formatPatternBadge(c.pattern);
            const leftSpan = document.createElement("span");
            leftSpan.textContent = `#${idx + 1} [${patLabel} · ${String(c.note_type || "basic").toUpperCase()}]`;

            const rightBox = document.createElement("div");
            rightBox.style.cssText = "display:flex;align-items:center;gap:8px;";
            const pageSpan = document.createElement("span");
            pageSpan.textContent = `📄 p.${c.source_page} 출처 검증됨`;
            rightBox.appendChild(pageSpan);

            if (!isAlreadySaved) {
              const removeBtn = document.createElement("button");
              removeBtn.type = "button";
              removeBtn.textContent = "제외";
              removeBtn.style.cssText =
                "background:rgba(244,63,94,0.18);color:var(--rose);border:1px solid var(--rose);border-radius:5px;padding:1px 7px;font-size:0.72rem;cursor:pointer;";
              removeBtn.addEventListener("click", () => {
                state.pendingDeckPlan.cards.splice(idx, 1);
                renderPreviewCards();
              });
              rightBox.appendChild(removeBtn);
            }

            headerRow.appendChild(leftSpan);
            headerRow.appendChild(rightBox);
            itemDiv.appendChild(headerRow);

            if (isAlreadySaved) {
              const qDiv = document.createElement("div");
              qDiv.style.cssText = "font-weight:600;margin-bottom:2px;";
              qDiv.textContent = `Q: ${c.front_text}`;
              const aDiv = document.createElement("div");
              aDiv.style.cssText = "color:var(--emerald);";
              aDiv.textContent = `A: ${c.back_text}`;
              itemDiv.appendChild(qDiv);
              itemDiv.appendChild(aDiv);
            } else {
              const qInput = document.createElement("input");
              qInput.type = "text";
              qInput.value = c.front_text;
              qInput.setAttribute("aria-label", `카드 ${idx + 1} 질문 편집`);
              qInput.style.cssText =
                "width:100%;background:rgba(9,13,22,0.8);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:0.78rem;font-weight:600;";
              qInput.addEventListener("input", () => {
                c.front_text = qInput.value;
              });

              const aInput = document.createElement("input");
              aInput.type = "text";
              aInput.value = c.back_text;
              aInput.setAttribute("aria-label", `카드 ${idx + 1} 정답 편집`);
              aInput.style.cssText =
                "width:100%;background:rgba(9,13,22,0.8);color:var(--emerald);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:0.78rem;";
              aInput.addEventListener("input", () => {
                c.back_text = aInput.value;
              });

              itemDiv.appendChild(qInput);
              itemDiv.appendChild(aInput);
            }

            listEl.appendChild(itemDiv);
          });

          el("doc-preview-title").textContent = isAlreadySaved
            ? `🎉 '${res.deck_name}' 덱에 ${activeCards.length}장이 즉시 저장되었습니다!`
            : `🔍 미리보기 (${activeCards.length}장) — 앞/뒷면 수정 또는 불필요 카드 제외 후 일괄 생성하세요`;
          el("btn-save-doc-deck").style.display =
            formatted.canSave && activeCards.length > 0 ? "inline-block" : "none";
  }

  function createCatalogAndStoreControllers(ctx) {
    const { el, vm, state, apiGet, apiPost, refreshDashboardAndQueue, switchTabPage, showUxToast, syncOfflineVault } = ctx;
  function renderCatalogLockRecovery(statusEl, apiErrorRes, retryCallback) {
    if (!statusEl) return;
    statusEl.textContent = "";
    const errVm =
      vm && typeof vm.formatApiErrorBanner === "function"
        ? vm.formatApiErrorBanner(apiErrorRes)
        : { title: "🔒 브레인팩 잠금", message: (apiErrorRes && apiErrorRes.error) || "잠금 상태입니다." };

    const msgDiv = document.createElement("div");
    msgDiv.style.cssText = "color:var(--amber);margin-bottom:6px;font-weight:600;";
    msgDiv.textContent = `${errVm.title} — ${errVm.message}`;
    statusEl.appendChild(msgDiv);

    if (errVm.actionPackId) {
      const quickUnlockBtn = document.createElement("button");
      quickUnlockBtn.type = "button";
      quickUnlockBtn.className = "btn-primary";
      quickUnlockBtn.style.cssText = "padding:5px 11px;font-size:0.76rem;";
      quickUnlockBtn.textContent = `⚡ 스토어에서 '${errVm.actionPackId}' 즉시 장착 후 덱 생성하기`;
      quickUnlockBtn.onclick = async () => {
        statusEl.textContent = `⏳ '${errVm.actionPackId}' 브레인팩 즉시 장착 중...`;
        const pRes = await apiPost("/api/store/purchase", {
          pack_id: errVm.actionPackId,
          auto_create_deck: false,
          payment_token: `BDPAY-QUICK-${errVm.actionPackId}`,
        });
        if (pRes && pRes.ok) {
          await loadBrainPackStoreAndBind();
          await loadCatalogAndBind();
          if (typeof retryCallback === "function") {
            await retryCallback();
          }
        }
      };
      statusEl.appendChild(quickUnlockBtn);
    }
  }

  async function loadCatalogAndBind() {
    const cat = await apiGet("/api/catalog");
    if (!cat || !cat.ok) return;
    state.catalog = cat;

    const tbSel = el("catalog-textbook-select");
    const unitsBox = el("catalog-units-box");
    const colSel = el("catalog-collection-select");
    const statusMsgEl = el("catalog-status-msg");
    if (!tbSel || !unitsBox || !colSel) return;

    const prevTbVal = tbSel.value;
    tbSel.textContent = "";
    (cat.textbooks || []).forEach((tb) => {
      const opt = document.createElement("option");
      opt.value = tb.textbook_id;
      const lockBadge = tb.unlocked ? "🔓 보유중" : "🔒 스토어 잠금";
      opt.textContent = `[${lockBadge}] ${tb.title} (${tb.publisher_name} · ${tb.curriculum_revision} 개정)`;
      tbSel.appendChild(opt);
    });
    if (prevTbVal && Array.from(tbSel.options).some((o) => o.value === prevTbVal)) {
      tbSel.value = prevTbVal;
    }

    function renderUnitsForSelectedTextbook() {
      unitsBox.textContent = "";
      const tb = (cat.textbooks || []).find((t) => t.textbook_id === tbSel.value);
      if (!tb || !tb.units) return;
      tb.units.forEach((u, idx) => {
        const lbl = document.createElement("label");
        lbl.style.cssText =
          "display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;padding:6px 10px;border-radius:10px;background:#ffffff;border:1px solid var(--border);cursor:pointer;font-weight:600;";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = u.unit_id;
        cb.className = "exam-unit-cb";
        if (idx < 2) cb.checked = true;
        const span = document.createElement("span");
        span.textContent = `${u.unit_code_label}: ${u.unit_title} (p.${u.page_start}~${u.page_end})`;
        lbl.appendChild(cb);
        lbl.appendChild(span);
        unitsBox.appendChild(lbl);
      });
    }

    tbSel.onchange = renderUnitsForSelectedTextbook;
    renderUnitsForSelectedTextbook();

    const btnToggleAll = el("btn-toggle-all-units");
    if (btnToggleAll) {
      btnToggleAll.onclick = () => {
        const boxes = Array.from(document.querySelectorAll(".exam-unit-cb"));
        const allChecked = boxes.length > 0 && boxes.every((b) => b.checked);
        boxes.forEach((b) => {
          b.checked = !allChecked;
        });
      };
    }

    const prevColVal = colSel.value;
    colSel.textContent = "";
    (cat.collections || []).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.collection_id;
      const lockBadge = c.unlocked ? "🔓 보유중" : "🔒 스토어 잠금";
      opt.textContent = `[${lockBadge}] ${c.level_label} (${c.item_count}문항 · ${c.collection_id})`;
      colSel.appendChild(opt);
    });
    if (prevColVal && Array.from(colSel.options).some((o) => o.value === prevColVal)) {
      colSel.value = prevColVal;
    }

    const diffSel = el("curriculum-difficulty-select");
    const getCurriculumDiff = () => (diffSel && diffSel.value) || "mixed";

    const comboListEl = el("combined-scope-list");
    function renderCombinedScopesList() {
      const btnCombinedSeg = el("btn-curr-seg-combined");
      if (btnCombinedSeg && vm && typeof vm.resolveCurriculumSegmentState === "function") {
        const segState = vm.resolveCurriculumSegmentState("textbook", (state.combinedExamScopes || []).length);
        btnCombinedSeg.textContent = segState.combined_tab_label;
      }
      if (!comboListEl) return;
      comboListEl.textContent = "";
      if (!state.combinedExamScopes.length) {
        const emptyDiv = document.createElement("div");
        emptyDiv.style.cssText =
          "padding:12px;border-radius:12px;background:#ffffff;border:1px dashed var(--border);font-size:0.8rem;color:var(--muted);text-align:center;";
        emptyDiv.textContent =
          "아직 담긴 시험범위가 없습니다. 위에서 교과서 단원이나 급수 팩을 골라 [➕ 통합 시험범위에 추가]를 눌러보세요!";
        comboListEl.appendChild(emptyDiv);
        return;
      }
      state.combinedExamScopes.forEach((item, idx) => {
        const row = document.createElement("div");
        row.style.cssText =
          "display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:#ffffff;border:1px solid var(--border);font-size:0.82rem;font-weight:600;";
        const labelSpan = document.createElement("span");
        labelSpan.textContent = `${idx + 1}. ${item.label} [${String(item.difficulty_level || "mixed").toUpperCase()}]`;
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.style.cssText = "padding:3px 8px;font-size:0.74rem;color:var(--rose);";
        delBtn.textContent = "삭제 ✕";
        delBtn.onclick = () => {
          state.combinedExamScopes.splice(idx, 1);
          renderCombinedScopesList();
        };
        row.appendChild(labelSpan);
        row.appendChild(delBtn);
        comboListEl.appendChild(row);
      });
    }
    renderCombinedScopesList();

    const btnAddExamToCombo = el("btn-add-exam-to-combo");
    if (btnAddExamToCombo) {
      btnAddExamToCombo.onclick = () => {
        const checked = Array.from(document.querySelectorAll(".exam-unit-cb:checked")).map((n) => n.value);
        if (!checked.length) {
          showUxToast("⚠️ 먼저 통합 시험범위에 추가할 단원을 1개 이상 체크해 주세요.", "amber");
          return;
        }
        const tb = (cat.textbooks || []).find((t) => t.textbook_id === tbSel.value);
        const pStart = el("exam-page-start").value.trim();
        const pEnd = el("exam-page-end").value.trim();
        const diffLevel = getCurriculumDiff();
        const pageStr = pStart || pEnd ? ` (p.${pStart || "1"}~${pEnd || "끝"})` : "";
        state.combinedExamScopes.push({
          textbook_id: tbSel.value,
          unit_ids: checked,
          page_start: pStart ? Number(pStart) : null,
          page_end: pEnd ? Number(pEnd) : null,
          difficulty_level: diffLevel,
          label: `🏫 ${(tb && tb.title) || tbSel.value} (${checked.length}개 단원${pageStr})`,
        });
        renderCombinedScopesList();
        showUxToast(`➕ 통합 시험범위에 교과서 ${checked.length}개 단원을 담았습니다! (총 ${state.combinedExamScopes.length}개 범위)`, "emerald");
      };
    }

    const btnAddColToCombo = el("btn-add-col-to-combo");
    if (btnAddColToCombo) {
      btnAddColToCombo.onclick = () => {
        if (!colSel.value) return;
        const cMeta = (cat.collections || []).find((c) => c.collection_id === colSel.value);
        const diffLevel = getCurriculumDiff();
        state.combinedExamScopes.push({
          collection_id: colSel.value,
          limit: 350,
          difficulty_level: diffLevel,
          label: `📚 ${(cMeta && cMeta.level_label) || colSel.value}`,
        });
        renderCombinedScopesList();
        showUxToast(`➕ 통합 시험범위에 '${(cMeta && cMeta.level_label) || colSel.value}' 범위를 담았습니다!`, "emerald");
      };
    }

    const btnPresetCombo = el("btn-preset-midterm-combo");
    if (btnPresetCombo) {
      btnPresetCombo.onclick = () => {
        const diffLevel = getCurriculumDiff();
        const unlockedTbs = (cat.textbooks || []).filter((t) => t.unlocked);
        const unlockedCols = (cat.collections || []).filter((c) => c.unlocked);
        state.combinedExamScopes = [];
        unlockedTbs.slice(0, 2).forEach((tb) => {
          const uIds = (tb.units || []).slice(0, 2).map((u) => u.unit_id);
          if (uIds.length) {
            state.combinedExamScopes.push({
              textbook_id: tb.textbook_id,
              unit_ids: uIds,
              difficulty_level: diffLevel,
              label: `🏫 ${tb.title} (1~${uIds.length}단원)`,
            });
          }
        });
        unlockedCols.slice(0, 3).forEach((c) => {
          state.combinedExamScopes.push({
            collection_id: c.collection_id,
            limit: 350,
            difficulty_level: diffLevel,
            label: `📚 ${c.level_label}`,
          });
        });
        renderCombinedScopesList();
        showUxToast(`⚡ 보유 중인 ${state.combinedExamScopes.length}개 다중 출제범위를 조합 장바구니에 담았습니다!`, "accent");
      };
    }

    const btnClearCombo = el("btn-clear-combined-scopes");
    if (btnClearCombo) {
      btnClearCombo.onclick = () => {
        state.combinedExamScopes = [];
        renderCombinedScopesList();
      };
    }

    const btnGenCombo = el("btn-gen-combined-exam-deck");
    if (btnGenCombo) {
      const runCombinedGen = async () => {
        if (!state.combinedExamScopes.length) {
          showUxToast("⚠️ 먼저 [➕ 통합 시험범위에 추가] 또는 [⚡ 중간고사 다중 범위 예시 담기]로 1개 이상 범위를 담아주세요.", "amber");
          return;
        }
        const customNameEl = el("combined-deck-name");
        const customName = (customNameEl && customNameEl.value.trim()) || "";
        const diffLevel = getCurriculumDiff();
        if (statusMsgEl) {
          statusMsgEl.textContent = "⏳ 다중 시험범위를 스마트 인터리빙 랜덤 알고리즘으로 조합 중입니다...";
        }
        const res = await apiPost("/api/catalog/generate-combined-exam-deck", {
          scopes: state.combinedExamScopes,
          deck_name: customName || null,
          difficulty_level: diffLevel,
          shuffle_mode: "interleaved",
          max_cards: 1000,
        });
        if (res && res.ok) {
          if (statusMsgEl) {
            statusMsgEl.textContent = `✅ '${res.deck_name}' (${res.saved_count}장 · ${state.combinedExamScopes.length}개 범위 인터리빙 조합) 생성 완료!`;
          }
          state.selectedDeckId = String(res.deck_id);
          state.shuffleMode = "interleaved";
          await refreshDashboardAndQueue();
          switchTabPage("study");
          showUxToast(
            `🎲 '${res.deck_name}' (${res.saved_count}장) 지능형 랜덤 통합 학습을 시작합니다!`,
            "emerald"
          );
        } else {
          renderCatalogLockRecovery(statusMsgEl, res, runCombinedGen);
        }
      };
      btnGenCombo.onclick = runCombinedGen;
    }

    const btnExam = el("btn-gen-exam-scope");
    if (btnExam) {
      const runExamScopeGen = async () => {
        const checked = Array.from(document.querySelectorAll(".exam-unit-cb:checked")).map((n) => n.value);
        if (!checked.length) {
          if (statusMsgEl) {
            statusMsgEl.textContent = "⚠️ 먼저 시험범위에 포함할 단원을 1개 이상 체크해 주세요.";
          }
          return;
        }
        const pStart = el("exam-page-start").value.trim();
        const pEnd = el("exam-page-end").value.trim();
        const diffLevel = getCurriculumDiff();
        if (statusMsgEl) {
          statusMsgEl.textContent = "⏳ 선택한 시험범위 암기 카드를 생성 중입니다...";
        }
        const res = await apiPost("/api/catalog/generate-exam-scope-deck", {
          textbook_id: tbSel.value,
          unit_ids: checked,
          page_start: pStart ? Number(pStart) : null,
          page_end: pEnd ? Number(pEnd) : null,
          difficulty_level: diffLevel,
          shuffle_mode: "interleaved",
          limit: 1000,
        });
        if (res && res.ok) {
          if (statusMsgEl) {
            statusMsgEl.textContent = `✅ '${res.deck_name}' (${res.saved_count}장) 생성 완료!`;
          }
          state.selectedDeckId = String(res.deck_id);
          await refreshDashboardAndQueue();
          switchTabPage("study");
          showUxToast(`🎯 '${res.deck_name}' (${res.saved_count}장) 학습을 시작합니다!`, "emerald");
        } else {
          renderCatalogLockRecovery(statusMsgEl, res, runExamScopeGen);
        }
      };
      btnExam.onclick = runExamScopeGen;
    }

    const btnCol = el("btn-gen-collection");
    if (btnCol) {
      const runCollectionGen = async () => {
        if (!colSel.value) return;
        const diffLevel = getCurriculumDiff();
        if (statusMsgEl) {
          statusMsgEl.textContent = "⏳ 급수·시험 암기 카드를 생성 중입니다...";
        }
        const res = await apiPost("/api/catalog/generate-collection-deck", {
          collection_id: colSel.value,
          limit: 1000,
          difficulty_level: diffLevel,
          shuffle_mode: "interleaved",
        });
        if (res && res.ok) {
          if (statusMsgEl) {
            statusMsgEl.textContent = `✅ '${res.deck_name}' (${res.saved_count}장) 생성 완료!`;
          }
          state.selectedDeckId = String(res.deck_id);
          await refreshDashboardAndQueue();
          switchTabPage("study");
          showUxToast(`📚 '${res.deck_name}' (${res.saved_count}장) 학습을 시작합니다!`, "emerald");
        } else {
          renderCatalogLockRecovery(statusMsgEl, res, runCollectionGen);
        }
      };
      btnCol.onclick = runCollectionGen;
    }
  }

  async function loadBrainPackStoreAndBind() {
    const storeRes = await apiGet("/api/store/packs");
    if (!storeRes || !storeRes.ok) return;
    state.storePacks = storeRes.packs || [];

    const lockedPaidAll = state.storePacks.filter((p) => !p.unlocked && Number(p.price_krw) > 0);
    state.selectedBundlePackIds = state.selectedBundlePackIds.filter((id) =>
      lockedPaidAll.some((p) => p.pack_id === id)
    );
    if (state.selectedBundlePackIds.length === 0 && lockedPaidAll.length > 0) {
      state.selectedBundlePackIds = lockedPaidAll.slice(0, 3).map((p) => p.pack_id);
    }

    const summaryBadge = el("store-summary-badge");
    if (summaryBadge) {
      summaryBadge.textContent = `장착 ${storeRes.unlocked_packs || 1} / 전체 ${storeRes.total_packs || state.storePacks.length}팩`;
    }

    const storeListEl = el("store-pack-list");
    const statusMsgEl = el("store-status-msg");
    const bundleBtn = el("btn-buy-bundle-3");
    if (!storeListEl) return;

    function updateBundleButtonQuote() {
      if (!bundleBtn) return;
      const chosenIds = state.selectedBundlePackIds.slice();
      if (chosenIds.length === 0 || !vm || typeof vm.calculateStoreBundleQuote !== "function") {
        bundleBtn.style.display = "none";
        return;
      }
      const quote = vm.calculateStoreBundleQuote(state.storePacks, chosenIds);
      const finalPrice = Number(quote.finalPriceKrw ?? quote.finalKrw ?? 0);
      const subPrice = Number(quote.subtotalKrw ?? 0);
      const discApplied = Boolean(quote.discountApplied);
      bundleBtn.style.display = "inline-block";
      bundleBtn.textContent = discApplied
        ? `🎁 선택 ${chosenIds.length}팩 묶음 15% 할인 장착 (₩${subPrice.toLocaleString("ko-KR")} ➔ ₩${finalPrice.toLocaleString("ko-KR")})`
        : `🛒 선택 ${chosenIds.length}팩 일괄 장착 (₩${finalPrice.toLocaleString("ko-KR")} · 3팩 이상 선택 시 15% 자동 할인)`;
      bundleBtn.onclick = async () => {
        if (statusMsgEl) {
          statusMsgEl.textContent = `⏳ 선택한 ${chosenIds.length}개 브레인팩(₩${finalPrice.toLocaleString("ko-KR")}) 일괄 장착 중...`;
        }
        const res = await apiPost("/api/store/purchase-bundle", {
          pack_ids: chosenIds,
          auto_create_decks: true,
          payment_token: `BDPAY-BUNDLE-${chosenIds.join("-")}`,
        });
        if (res && res.ok) {
          if (statusMsgEl) {
            statusMsgEl.textContent = `🎉 ${res.purchased_count}개 팩 (할인 ₩${Number(res.quote.discount_krw || 0).toLocaleString("ko-KR")}) 일괄 장착 및 학습 덱 생성 완료!`;
          }
          state.selectedBundlePackIds = [];
          await loadBrainPackStoreAndBind();
          await loadCatalogAndBind();
          await refreshDashboardAndQueue();
          await syncOfflineVault(false);
        }
      };
    }

    function renderStoreList() {
      storeListEl.textContent = "";
      const filtered = vm.filterStorePacks(state.storePacks, state.selectedStoreCategory);
      filtered.forEach((rawPack) => {
        const cardVm = vm.formatStorePackCard(rawPack);
        const rowDiv = document.createElement("div");
        rowDiv.style.cssText =
          "background:#f9fafb;border:1px solid var(--border);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;";

        const topRow = document.createElement("div");
        topRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;";

        const titleWrap = document.createElement("label");
        titleWrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;cursor:pointer;";
        if (!cardVm.unlocked && cardVm.priceKrw > 0) {
          const bundleCb = document.createElement("input");
          bundleCb.type = "checkbox";
          bundleCb.className = "store-bundle-cb";
          bundleCb.checked = state.selectedBundlePackIds.includes(cardVm.packId);
          bundleCb.onchange = () => {
            if (bundleCb.checked) {
              if (!state.selectedBundlePackIds.includes(cardVm.packId)) {
                state.selectedBundlePackIds.push(cardVm.packId);
              }
            } else {
              state.selectedBundlePackIds = state.selectedBundlePackIds.filter((id) => id !== cardVm.packId);
            }
            updateBundleButtonQuote();
          };
          titleWrap.appendChild(bundleCb);
        }

        const titleSpan = document.createElement("span");
        titleSpan.style.cssText = "font-size:0.86rem;font-weight:700;color:var(--text);";
        titleSpan.textContent = cardVm.title;
        titleWrap.appendChild(titleSpan);

        const badgeSpan = document.createElement("span");
        badgeSpan.className = "badge-pill";
        const frozenTag = rawPack.status === "refunded_frozen" ? "❄️ 환불·동결됨 · " : "";
        badgeSpan.textContent = `${frozenTag}${cardVm.badgeLabel} · ${cardVm.estimatedCountLabel}`;

        topRow.appendChild(titleWrap);
        topRow.appendChild(badgeSpan);
        rowDiv.appendChild(topRow);

        const subDiv = document.createElement("div");
        subDiv.style.cssText = "font-size:0.76rem;color:var(--muted);";
        subDiv.textContent = cardVm.subtitle;
        rowDiv.appendChild(subDiv);

        if (cardVm.sampleCards.length > 0) {
          const sampleDiv = document.createElement("div");
          sampleDiv.style.cssText =
            "font-size:0.78rem;color:#1b64da;background:#e8f3ff;padding:7px 10px;border-radius:10px;font-weight:600;";
          const s0 = cardVm.sampleCards[0];
          sampleDiv.textContent = `🔍 샘플 미리보기: Q. ${s0.front} ➔ A. ${s0.back}`;
          rowDiv.appendChild(sampleDiv);
        }

        const actionRow = document.createElement("div");
        actionRow.style.cssText = "display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:2px;";

        if (cardVm.unlocked && cardVm.priceKrw > 0) {
          const refundBtn = document.createElement("button");
          refundBtn.type = "button";
          refundBtn.style.cssText =
            "padding:5px 9px;font-size:0.72rem;color:var(--rose);border-color:rgba(244,63,94,0.45);";
          refundBtn.textContent = "❄️ 환불·동결";
          refundBtn.onclick = async () => {
            const refRes = await apiPost("/api/store/refund", {
              pack_id: cardVm.packId,
              reason: "user_store_ui_refund",
            });
            if (refRes && refRes.ok) {
              if (statusMsgEl) {
                statusMsgEl.textContent = `❄️ '${cardVm.title}' 환불·동결 완료 (기존 FSRS 학습 이력은 보존되며 신규 덱 생성만 차단됩니다).`;
              }
              await loadBrainPackStoreAndBind();
              await loadCatalogAndBind();
            }
          };
          actionRow.appendChild(refundBtn);
        }

        const actBtn = document.createElement("button");
        actBtn.type = "button";
        actBtn.setAttribute("data-buy-pack", cardVm.packId);
        actBtn.className = cardVm.unlocked ? "" : "btn-primary";
        actBtn.style.cssText = "padding:6px 12px;font-size:0.78rem;";
        actBtn.textContent = cardVm.unlocked ? "✅ 장착됨 · 이 덱으로 바로 학습" : cardVm.priceLabel;
        actBtn.addEventListener("click", async () => {
          if (statusMsgEl) {
            statusMsgEl.textContent = `⏳ '${cardVm.title}' 장착 및 앱 내 학습 덱 준비 중...`;
          }
          const purchaseRes = await apiPost("/api/store/purchase", {
            pack_id: cardVm.packId,
            auto_create_deck: true,
            payment_token: `BDPAY-${cardVm.packId}`,
          });
          if (purchaseRes && purchaseRes.ok) {
            const deckInfo = purchaseRes.mounted_deck;
            const deckMsg = deckInfo
              ? ` ('${deckInfo.deck_name}' 덱으로 즉시 이동했습니다)`
              : "";
            if (statusMsgEl) {
              statusMsgEl.textContent = `🎉 '${purchaseRes.title}' 구매 및 마운트 완료!${deckMsg}`;
            }
            if (deckInfo && deckInfo.deck_id) {
              state.selectedDeckId = String(deckInfo.deck_id);
            }
            await loadBrainPackStoreAndBind();
            await loadCatalogAndBind();
            await refreshDashboardAndQueue();
            await syncOfflineVault(false);
            if (deckInfo && deckInfo.deck_id) {
              switchTabPage("study");
              showUxToast(`🎉 '${purchaseRes.title}' 구매 및 마운트 완료! 바로 학습을 시작합니다!`, "emerald");
            }
          }
        });

        actionRow.appendChild(actBtn);
        rowDiv.appendChild(actionRow);
        storeListEl.appendChild(rowDiv);
      });
      updateBundleButtonQuote();
    }

    const tabBtns = document.querySelectorAll(".store-cat-btn");
    tabBtns.forEach((btn) => {
      btn.onclick = () => {
        tabBtns.forEach((b) => b.classList.remove("btn-primary"));
        btn.classList.add("btn-primary");
        state.selectedStoreCategory = btn.getAttribute("data-cat") || "all";
        renderStoreList();
      };
    });

    renderStoreList();
  }
    return {
      renderCatalogLockRecovery,
      loadCatalogAndBind,
      loadBrainPackStoreAndBind,
    };
  }

  function bindReaUtilitiesAndPlannerDom(ctx) {
    const {
      el,
      vm,
      state,
      apiPost,
      currentCard,
      enrichStandaloneCard,
      applyStudyFilter,
      renderCurrentCard,
      renderStudyPlanBanner,
      refreshDashboardAndQueue,
      renderDeckExplorerPanel,
      loadBrainPackStoreAndBind,
      loadCatalogAndBind,
      showUxToast,
    } = ctx;
    let summaryMaskAll = true;
    function renderSummarySheetPanel() {
      const panel = el("summary-sheet-panel");
      const rowsBox = el("summary-sheet-rows");
      if (!panel || !rowsBox) return;
      const cards = state.dueCards.length > 0 ? state.dueCards : state.rawDueCards;
      const sheet =
        vm && typeof vm.buildSummarySheetView === "function"
          ? vm.buildSummarySheetView(cards, summaryMaskAll ? "red_filter" : "reveal_all")
          : { rows: [] };
      rowsBox.textContent = "";
      sheet.rows.forEach((r) => {
        const rowEl = document.createElement("div");
        rowEl.style.cssText =
          "display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:0.83rem;";
        const qSpan = document.createElement("div");
        qSpan.style.cssText = "flex:1;font-weight:700;color:#191f28;";
        qSpan.textContent = `${r.index}. ${r.question}`;
        const aBtn = document.createElement("button");
        aBtn.type = "button";
        let masked = summaryMaskAll;
        function syncMaskStyle() {
          if (masked) {
            aBtn.style.cssText =
              "padding:5px 12px;border-radius:8px;background:#be123c;color:#be123c;border:1px solid #be123c;font-weight:800;min-width:95px;user-select:none;";
            aBtn.title = "탭하여 셀로판지 걷어내기";
          } else {
            aBtn.style.cssText =
              "padding:5px 12px;border-radius:8px;background:#fff0f0;color:#be123c;border:1px solid #fecdd3;font-weight:800;min-width:95px;";
          }
          aBtn.textContent = r.clean_answer;
        }
        syncMaskStyle();
        aBtn.addEventListener("click", () => {
          masked = !masked;
          syncMaskStyle();
        });
        rowEl.appendChild(qSpan);
        rowEl.appendChild(aBtn);
        rowsBox.appendChild(rowEl);
      });
    }

    const btnOpenSummary = el("btn-open-summary-sheet");
    if (btnOpenSummary) {
      btnOpenSummary.addEventListener("click", () => {
        const panel = el("summary-sheet-panel");
        if (!panel) return;
        const willShow = panel.style.display === "none";
        panel.style.display = willShow ? "block" : "none";
        if (willShow) renderSummarySheetPanel();
      });
    }
    const btnSummaryToggleAll = el("btn-summary-toggle-all");
    if (btnSummaryToggleAll) {
      btnSummaryToggleAll.addEventListener("click", () => {
        summaryMaskAll = !summaryMaskAll;
        renderSummarySheetPanel();
      });
    }
    const btnSummaryClose = el("btn-summary-close");
    if (btnSummaryClose) {
      btnSummaryClose.addEventListener("click", () => {
        const panel = el("summary-sheet-panel");
        if (panel) panel.style.display = "none";
      });
    }

    const btnPrintExam = el("btn-print-exam-sheet");
    if (btnPrintExam) {
      btnPrintExam.addEventListener("click", () => {
        const cards = state.dueCards.length > 0 ? state.dueCards : state.rawDueCards;
        if (!cards.length) {
          showUxToast("⚠️ 인쇄할 카드가 없습니다.", "amber");
          return;
        }
        const doc =
          vm && typeof vm.buildPrintableExamSheet === "function"
            ? vm.buildPrintableExamSheet(cards, "BrainDeck 2단 실전 쪽지시험지", Date.now() % 100000)
            : null;
        if (doc && doc.printable_html) {
          const w = window.open("", "_blank");
          if (w) {
            try {
              w.opener = null;
            } catch (_e) {}
            w.document.open();
            w.document.write(doc.printable_html);
            w.document.close();
            const pBtn = w.document.getElementById("btn-print-sheet-now");
            if (pBtn) {
              pBtn.addEventListener("click", () => w.print());
            }
          } else {
            showUxToast("🖨️ 팝업 차단됨 — 브라우저 팝업을 허용해 주세요.", "amber");
          }
        }
      });
    }

    let audioLoopTimer = null;
    const btnAudioLoop = el("btn-commute-audio-loop");
    if (btnAudioLoop) {
      btnAudioLoop.addEventListener("click", () => {
        if (audioLoopTimer) {
          clearTimeout(audioLoopTimer);
          audioLoopTimer = null;
          if (window.speechSynthesis) window.speechSynthesis.cancel();
          btnAudioLoop.textContent = "🎧 통학 오디오 루프";
          btnAudioLoop.classList.remove("btn-primary");
          showUxToast("⏹️ 통학 오디오 루프를 종료했습니다.", "accent");
          return;
        }
        const cards = state.dueCards.length > 0 ? state.dueCards : state.rawDueCards;
        if (!cards.length) return;
        const script =
          vm && typeof vm.buildCommuteAudioScript === "function"
            ? vm.buildCommuteAudioScript(cards, 3)
            : { tracks: [] };
        let tIdx = 0;
        btnAudioLoop.textContent = "⏹️ 오디오 루프 중지";
        btnAudioLoop.classList.add("btn-primary");
        showUxToast("🎧 통학 오디오 루프 시작 (질문 ➔ 3초 생각 ➔ 정답)", "emerald");

        function speakSegmentedBrowserText(rawTxt) {
          if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
          const voices = typeof window.speechSynthesis.getVoices === "function" ? window.speechSynthesis.getVoices() : [];
          const segs =
            vm && typeof vm.buildNaturalTtsSegments === "function"
              ? vm.buildNaturalTtsSegments(rawTxt, "", "", false)
              : [{ text: String(rawTxt || ""), lang: /[가-힣]/.test(rawTxt) ? "ko-KR" : "en-US", rate: 0.96, pitch: 1.0 }];
          segs.forEach((seg) => {
            if (!seg || !seg.text) return;
            const u = new SpeechSynthesisUtterance(seg.text);
            u.lang = seg.lang || "en-US";
            u.rate = Number(seg.rate) || 0.96;
            u.pitch = Number(seg.pitch) || 1.0;
            if (vm && typeof vm.selectBestBrowserVoice === "function" && voices && voices.length > 0) {
              const best = vm.selectBestBrowserVoice(voices, u.lang);
              if (best) u.voice = best;
            }
            window.speechSynthesis.speak(u);
          });
        }

        function playNextTrack() {
          if (!audioLoopTimer && tIdx > 0) return;
          const tr = script.tracks[tIdx % script.tracks.length];
          tIdx += 1;
          if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
            window.speechSynthesis.cancel();
            speakSegmentedBrowserText(tr.prompt_tts);
            audioLoopTimer = setTimeout(() => {
              speakSegmentedBrowserText(tr.answer_tts);
              audioLoopTimer = setTimeout(playNextTrack, 3200);
            }, (tr.pause_seconds || 3) * 1000 + 2200);
          }
        }
        audioLoopTimer = setTimeout(playNextTrack, 100);
      });
    }

    const btnCramSandbox = el("btn-toggle-cram-sandbox");
    if (btnCramSandbox) {
      btnCramSandbox.addEventListener("click", () => {
        state.isCramSandbox = !state.isCramSandbox;
        btnCramSandbox.textContent = state.isCramSandbox
          ? "🧪 무오염 벼락치기(CRAM): ON"
          : "🧪 무오염 벼락치기(CRAM): OFF";
        if (state.isCramSandbox) {
          btnCramSandbox.classList.add("btn-primary");
          showUxToast("🧪 무오염 벼락치기 ON: 아무리 많이 반복해도 FSRS 장기기억 간격(S)이 오염되지 않습니다.", "emerald");
        } else {
          btnCramSandbox.classList.remove("btn-primary");
          showUxToast("📚 정규 FSRS 학습 모드로 복귀했습니다.", "accent");
        }
        syncStudyToolsSummaryBadge();
      });
    }

    // Contract C1: Study Tools & Filter Progressive Disclosure Drawer
    function syncStudyToolsSummaryBadge() {
      const badgeEl = el("active-study-filter-summary");
      if (!badgeEl || !vm || typeof vm.computeStudyToolsSummary !== "function") return;
      const summary = vm.computeStudyToolsSummary({
        studyFilter: state.studyFilterMode || "all",
        qtypeFilter: state.questionTypeFilter || "all",
        cramMode: Boolean(state.isCramSandbox),
      });
      if (summary.is_default) {
        badgeEl.style.display = "none";
        badgeEl.textContent = "";
      } else {
        badgeEl.style.display = "inline-flex";
        badgeEl.textContent = summary.summary_badge_text;
      }
    }

    const btnToggleStudyTools = el("btn-toggle-study-tools");
    const studyToolsDrawer = el("study-tools-drawer");
    if (btnToggleStudyTools && studyToolsDrawer) {
      btnToggleStudyTools.addEventListener("click", () => {
        const isOpen = studyToolsDrawer.style.display !== "none";
        const nextOpen = !isOpen;
        studyToolsDrawer.style.display = nextOpen ? "block" : "none";
        btnToggleStudyTools.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        if (nextOpen) {
          btnToggleStudyTools.classList.add("btn-primary");
        } else {
          btnToggleStudyTools.classList.remove("btn-primary");
        }
        syncStudyToolsSummaryBadge();
      });
    }

    // BD-P0-02: 2-Layer Compact Study Header Collapsible Toggle
    const btnToggleCompactHeader = el("btn-toggle-compact-header");
    const collapsibleHeaderZone = el("bd-collapsible-header-zone");
    if (btnToggleCompactHeader && collapsibleHeaderZone) {
      btnToggleCompactHeader.addEventListener("click", () => {
        const isOpen = collapsibleHeaderZone.style.display !== "none";
        const nextOpen = !isOpen;
        collapsibleHeaderZone.style.display = nextOpen ? "block" : "none";
        btnToggleCompactHeader.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        btnToggleCompactHeader.textContent = nextOpen ? "대시보드 접기" : "대시보드 펼치기";
      });
    }

    document.querySelectorAll(".study-filter-btn, .study-qtype-btn").forEach((b) => {
      b.addEventListener("click", syncStudyToolsSummaryBadge);
    });

    // Contract C3: 3-Segment Switcher in Curriculum Tab (textbook | collection | combined)
    function switchCurriculumSegment(seg) {
      const stateObj =
        vm && typeof vm.resolveCurriculumSegmentState === "function"
          ? vm.resolveCurriculumSegmentState(seg, (state.combinedExamScopes || []).length)
          : {
              active_segment: seg || "textbook",
              combined_tab_label: "🎯 시험범위 조합",
              visible_panels: {
                textbook: seg === "textbook",
                collection: seg === "collection",
                combined: seg === "combined",
              },
            };
      document.querySelectorAll(".curr-seg-btn").forEach((b) => {
        const isTarget = b.getAttribute("data-curr-seg") === stateObj.active_segment;
        b.setAttribute("aria-selected", isTarget ? "true" : "false");
        if (isTarget) b.classList.add("btn-primary");
        else b.classList.remove("btn-primary");
      });
      const btnCombinedSeg = el("btn-curr-seg-combined");
      if (btnCombinedSeg) {
        btnCombinedSeg.textContent = stateObj.combined_tab_label;
      }
      ["textbook", "collection", "combined"].forEach((id) => {
        const panelEl = el(`curr-seg-${id}`);
        if (panelEl) {
          panelEl.style.display = stateObj.visible_panels[id] ? "block" : "none";
        }
      });
    }

    document.querySelectorAll(".curr-seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchCurriculumSegment(btn.getAttribute("data-curr-seg") || "textbook");
      });
    });

    // BrainDeck v3 Study Planner & Custom Study Suite bindings
    async function computeAndPreviewPlan(showToastMsg = true) {
      const daysSel = el("bd-plan-days");
      const minsSel = el("bd-plan-minutes");
      const newSel = el("bd-plan-daily-new");
      const targetDays = Number((daysSel && daysSel.value) || 30);
      const dailyMinutes = Number((minsSel && minsSel.value) || 30);
      const customNew = newSel && newSel.value && newSel.value !== "auto" ? Number(newSel.value) : null;
      const res = await apiPost("/api/study-plan", {
        deck_id: state.selectedDeckId || null,
        target_days: targetDays,
        daily_minutes_budget: dailyMinutes,
        new_per_day: customNew,
      });
      if (res && res.ok && res.plan) {
        await renderStudyPlanBanner(res);
        if (showToastMsg) {
          const pl = res.plan;
          const effNew = customNew || pl.recommended_daily_new;
          showUxToast(
            `📅 D-${pl.target_days} 학습계획 산출: 전체 ${pl.total_cards}장 ➔ 하루 새 카드 ${effNew}장 · 평균 ${pl.avg_daily_minutes}분/일`,
            pl.status === "FEASIBLE" ? "emerald" : "amber"
          );
        }
      }
    }

    const btnComputePlan = el("btn-compute-study-plan");
    if (btnComputePlan) {
      btnComputePlan.addEventListener("click", () => computeAndPreviewPlan(true));
    }

    const btnApplyPlan = el("btn-apply-study-plan");
    if (btnApplyPlan) {
      btnApplyPlan.addEventListener("click", async () => {
        const daysSel = el("bd-plan-days");
        const minsSel = el("bd-plan-minutes");
        const newSel = el("bd-plan-daily-new");
        const targetDays = Number((daysSel && daysSel.value) || 30);
        const dailyMinutes = Number((minsSel && minsSel.value) || 30);
        const customNew = newSel && newSel.value && newSel.value !== "auto" ? Number(newSel.value) : null;
        const res = await apiPost("/api/study-plan/apply", {
          deck_id: state.selectedDeckId || null,
          target_days: targetDays,
          daily_minutes_budget: dailyMinutes,
          new_per_day: customNew,
          apply: true,
        });
        if (res && res.ok && res.plan) {
          await refreshDashboardAndQueue();
          const dq = res.daily_quota || {};
          const dailyNewLimit = Number(dq.daily_new_limit || res.plan.recommended_daily_new || 30);
          showUxToast(
            `✅ D-${res.plan.target_days} 일일 학습 계획 적용 완료! 오늘부터 하루 새 카드 ${dailyNewLimit}장씩 맞춤 출제됩니다.`,
            "emerald"
          );
        }
      });
    }

    ["bd-plan-days", "bd-plan-daily-new", "bd-plan-minutes"].forEach((selId) => {
      const sEl = el(selId);
      if (sEl) {
        sEl.addEventListener("change", () => computeAndPreviewPlan(false));
      }
    });

    const btnRunCustomStudy = el("btn-run-custom-study");
    if (btnRunCustomStudy) {
      btnRunCustomStudy.addEventListener("click", async () => {
        const presetSel = el("bd-custom-study-preset");
        const preset = (presetSel && presetSel.value) || "forgotten_recent";
        const res = await apiPost("/api/custom-study", {
          deck_id: state.selectedDeckId || null,
          preset,
          days_ahead: 3,
          limit: 50,
          extra_new: 15,
        });
        if (res && res.ok) {
          if (Array.isArray(res.cards) && res.cards.length > 0) {
            state.dueCards = res.cards.map(enrichStandaloneCard);
            state.currentIndex = 0;
            state.isCramSandbox = res.reschedule === false;
            renderCurrentCard();
            showUxToast(`⚡ ${res.title} (${res.cards.length}장) 세션이 시작되었습니다!`, "emerald");
          } else {
            showUxToast(`ℹ️ 선택한 맞춤학습 조건(${res.title || preset})에 해당하는 카드가 없습니다.`, "amber");
          }
        }
      });
    }

    const selectCardFlag = el("select-card-flag");
    if (selectCardFlag) {
      selectCardFlag.addEventListener("change", async () => {
        const card = currentCard();
        if (!card) return;
        const flagVal = Number(selectCardFlag.value || 0);
        const res = await apiPost("/api/cards/action", {
          card_id: card.card_id,
          action: "set_flag",
          flag: flagVal,
        });
        if (res && res.ok && res.card) {
          card.flag = res.card.flag;
          card.flag_label = res.card.flag_label;
          showUxToast(`🚩 카드 #${card.card_id} 플래그 지정: ${res.card.flag_label}`, "accent");
        }
      });
    }

    // BrainDeck v6.0 Deck Progress Dashboard, Stage Filter & Deck Card Explorer Bindings
    document.querySelectorAll(".bd-stage-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const st = btn.getAttribute("data-stage") || "all";
        state.stageFilter = st;
        document.querySelectorAll(".bd-stage-btn").forEach((b) => {
          if (b.getAttribute("data-stage") === st) b.classList.add("btn-primary");
          else b.classList.remove("btn-primary");
        });
        applyStudyFilter();
        renderCurrentCard();
        showUxToast(
          st === "all"
            ? "📚 전체 단계(Lv.1~Lv.4) 학습 모드로 전환했습니다."
            : `🎯 ${btn.textContent} 단계 카드만 집중 학습합니다 (${state.dueCards.length}장).`,
          "accent"
        );
      });
    });

    const btnOpenExplorer = el("btn-open-deck-explorer");
    const explorerPanel = el("deck-card-explorer-panel");
    if (btnOpenExplorer && explorerPanel) {
      btnOpenExplorer.addEventListener("click", async () => {
        const willShow = explorerPanel.style.display === "none";
        explorerPanel.style.display = willShow ? "block" : "none";
        if (willShow) {
          btnOpenExplorer.classList.add("btn-primary");
          await renderDeckExplorerPanel();
        } else {
          btnOpenExplorer.classList.remove("btn-primary");
        }
      });
    }

    const btnCloseExplorer = el("btn-close-deck-explorer");
    if (btnCloseExplorer && explorerPanel) {
      btnCloseExplorer.addEventListener("click", () => {
        explorerPanel.style.display = "none";
        if (btnOpenExplorer) btnOpenExplorer.classList.remove("btn-primary");
      });
    }

    document.querySelectorAll(".bd-bucket-chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        const bKey = chip.getAttribute("data-bucket") || "all";
        const bSel = el("explorer-bucket-select");
        if (bSel) bSel.value = bKey;
        if (explorerPanel) explorerPanel.style.display = "block";
        if (btnOpenExplorer) btnOpenExplorer.classList.add("btn-primary");
        await renderDeckExplorerPanel();
      });
    });

    ["explorer-search-input", "explorer-bucket-select", "explorer-stage-select"].forEach((id) => {
      const ctrl = el(id);
      if (ctrl) {
        ctrl.addEventListener(id === "explorer-search-input" ? "input" : "change", () => {
          renderDeckExplorerPanel();
        });
      }
    });

    // BD-C02: Inline Card Edit & Delete (Preserving FSRS state & revlog)
    const btnEditCurrentCard = el("btn-edit-current-card");
    if (btnEditCurrentCard) {
      btnEditCurrentCard.addEventListener("click", async () => {
        const card = currentCard();
        if (!card) return;
        const nextFront = window.prompt("카드 앞면(질문) 수정:", card.front_text || card.rendered_question || "");
        if (nextFront === null) return;
        const nextBack = window.prompt("카드 뒷면(정답·해설) 수정:", card.back_text || card.rendered_answer || "");
        if (nextBack === null) return;
        const res = await apiPost("/api/cards/update", {
          card_id: card.card_id,
          front_text: nextFront.trim(),
          back_text: nextBack.trim(),
        });
        if (res && res.ok) {
          card.front_text = res.front_text || nextFront.trim();
          card.back_text = res.back_text || nextBack.trim();
          card.rendered_question = card.front_text;
          card.rendered_answer = card.back_text;
          if (res.target_answer) card.target_answer = res.target_answer;
          renderCurrentCard();
          showUxToast("✏️ 카드 내용이 수정되었습니다 (FSRS 학습 이력 100% 보존).", "emerald");
        }
      });
    }

    const btnDeleteCurrentCard = el("btn-delete-current-card");
    if (btnDeleteCurrentCard) {
      btnDeleteCurrentCard.addEventListener("click", async () => {
        const card = currentCard();
        if (!card) return;
        if (!window.confirm(`정말 이 카드(#${card.card_id})를 영구 삭제하시겠습니까?`)) return;
        const res = await apiPost("/api/cards/delete", { card_id: card.card_id });
        if (res && res.ok) {
          await refreshDashboardAndQueue();
          showUxToast(`🗑️ 카드 #${card.card_id}가 삭제되었습니다.`, "amber");
        }
      });
    }

    // BD-C01: Cross-Platform JSON Backup Export & Lossless Merge Import
    const btnExportBackup = el("btn-export-backup-json");
    if (btnExportBackup) {
      btnExportBackup.addEventListener("click", async () => {
        const res = await apiPost("/api/backup/export-json", {});
        if (res && res.ok) {
          const payload = res.backup || res;
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const dateTag = new Date().toISOString().slice(0, 10);
          a.href = url;
          a.download = `braindeck-backup-${dateTag}.braindeck.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showUxToast("📦 전체 학습 금고(.braindeck.json) 백업 파일을 내보냈습니다!", "emerald");
        }
      });
    }

    const btnImportBackup = el("btn-import-backup-json");
    const backupFileInput = el("backup-json-file-input");
    if (btnImportBackup && backupFileInput) {
      btnImportBackup.addEventListener("click", () => backupFileInput.click());
      backupFileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
          showUxToast("⚠️ 백업 파일 크기가 허용 한도(10MB)를 초과했습니다.", "rose");
          e.target.value = "";
          return;
        }
        try {
          const rawText = await file.text();
          const parsed = JSON.parse(rawText, (k, v) =>
            k === "__proto__" || k === "constructor" || k === "prototype" ? undefined : v
          );
          const res = await apiPost("/api/backup/import-json", { backup: parsed });
          if (res && res.ok) {
            await loadBrainPackStoreAndBind();
            await loadCatalogAndBind();
            await refreshDashboardAndQueue();
            showUxToast("♻️ 백업 금고 무손실 병합 복원이 완료되었습니다!", "emerald");
          } else if (res && res.error_code === "BACKUP_CHECKSUM_MISMATCH") {
            showUxToast("⚠️ 백업 파일 무결성(체크섬) 검증에 실패했습니다.", "rose");
          } else {
            showUxToast((res && res.error) || "⚠️ 백업 파일 형식이 올바르지 않습니다.", "rose");
          }
        } catch (_err) {
          showUxToast("⚠️ 백업 JSON 파일을 읽는 중 오류가 발생했습니다.", "rose");
        }
        e.target.value = "";
      });
    }

    // v13.0 Commercial Mastery & Retention Booster UI Bindings (Contracts C8 ~ C15)
    const apiGet = ctx.apiGet;
    const submitRating = ctx.submitRating;
    async function refreshCommercialMasteryDashboard() {
      if (typeof apiGet !== "function") return;
      const dash = await apiGet("/api/v2/commercial/dashboard?exam_track=toeic").catch(() => null);
      if (!dash || !dash.ok) return;
      const irt = dash.irt_prediction || {};
      const irtText = el("bd-irt-summary-text");
      const irtBadge = el("bd-irt-status-badge");
      if (irtText) {
        if (irt.status === "CALIBRATED" && irt.predicted_score !== null) {
          const ci = Array.isArray(irt.confidence_interval) ? `${irt.confidence_interval[0]}~${irt.confidence_interval[1]}점` : "";
          irtText.textContent = `🎯 예상 TOEIC 환산: ${irt.predicted_score}점 (95% 신뢰구간 ${ci}) · 합격 확률 ${irt.pass_probability_pct}% · 수능 예상 ${irt.csat_grade}등급`;
          if (irtBadge) irtBadge.textContent = `학습 카드 ${irt.reviewed_cards}장 분석됨`;
        } else {
          irtText.textContent = "집계 대기 중: 카드를 1장 이상 복습하면 문항반응이론(2PL IRT) 예상 점수와 합격 확률이 표시됩니다.";
          if (irtBadge) irtBadge.textContent = "데이터 수집 중";
        }
      }
      const alerts = dash.forgetting_alerts || {};
      const alertBanner = el("bd-forgetting-alert-banner");
      if (alertBanner) {
        alertBanner.textContent = alerts.should_notify ? alerts.notification_title : "✅ 망각 임계점(R<85%) 미달 카드 없음";
      }
      const hm = dash.heatmap_365d || {};
      const hmGrid = el("bd-heatmap-365-grid");
      if (hmGrid && Array.isArray(hm.cells) && typeof document !== "undefined") {
        const colors = ["#1e293b", "#064e3b", "#047857", "#10b981", "#34d399"];
        while (hmGrid.firstChild) hmGrid.removeChild(hmGrid.firstChild);
        hm.cells.slice(-106).forEach((c) => {
          const cell = document.createElement("div");
          cell.title = `${c.date}: ${c.count}회 복습`;
          cell.style.cssText = `width:8px;height:8px;border-radius:2px;background:${colors[c.level || 0]};`;
          hmGrid.appendChild(cell);
        });
      }
    }

    const btnOled = el("btn-oled-theme-toggle");
    if (btnOled) {
      btnOled.addEventListener("click", () => {
        state.oledDark = !state.oledDark;
        const spec = vm && typeof vm.resolveMobileErgonomicsSpec === "function"
          ? vm.resolveMobileErgonomicsSpec(0, 0, 64, state.oledDark ? "oled_dark" : "light")
          : null;
        if (spec && spec.theme_tokens && typeof document !== "undefined") {
          const rootStyle = document.documentElement.style;
          rootStyle.setProperty("--bg", spec.theme_tokens.bg);
          rootStyle.setProperty("--panel", spec.theme_tokens.panel);
          rootStyle.setProperty("--border", spec.theme_tokens.border);
          rootStyle.setProperty("--text", spec.theme_tokens.text);
          rootStyle.setProperty("--muted", spec.theme_tokens.muted);
          rootStyle.setProperty("--accent", spec.theme_tokens.accent);
        }
        btnOled.textContent = state.oledDark ? "☀️ 라이트모드" : "🌙 다크모드";
        showUxToast(state.oledDark ? "🌙 OLED True-Black 눈 보호 다크모드가 켜졌습니다." : "☀️ 라이트모드로 전환되었습니다.", "accent");
      });
    }

    const scratchDrawer = el("bd-scratchpad-drawer");
    const scratchCanvas = el("bd-scratchpad-canvas");
    const btnToggleScratch = el("btn-toggle-scratchpad");
    if (btnToggleScratch && scratchDrawer) {
      btnToggleScratch.addEventListener("click", () => {
        scratchDrawer.style.display = scratchDrawer.style.display === "none" ? "block" : "none";
      });
    }
    const btnCloseScratch = el("btn-scratchpad-close");
    if (btnCloseScratch && scratchDrawer) {
      btnCloseScratch.addEventListener("click", () => {
        scratchDrawer.style.display = "none";
      });
    }
    if (scratchCanvas && typeof scratchCanvas.getContext === "function") {
      const ctx2d = scratchCanvas.getContext("2d");
      let drawing = false;
      let recordedStrokes = [];
      let currentStrokePts = [];
      scratchCanvas.addEventListener("pointerdown", (ev) => {
        drawing = true;
        const rect = scratchCanvas.getBoundingClientRect();
        const pt = [Math.round(ev.clientX - rect.left), Math.round(ev.clientY - rect.top)];
        currentStrokePts = [pt];
        if (!ctx2d) return;
        ctx2d.beginPath();
        ctx2d.moveTo(pt[0], pt[1]);
      });
      scratchCanvas.addEventListener("pointermove", (ev) => {
        if (!drawing || !ctx2d) return;
        const rect = scratchCanvas.getBoundingClientRect();
        const pt = [Math.round(ev.clientX - rect.left), Math.round(ev.clientY - rect.top)];
        currentStrokePts.push(pt);
        ctx2d.lineWidth = 2.6;
        ctx2d.lineCap = "round";
        ctx2d.strokeStyle = "#1e293b";
        ctx2d.lineTo(pt[0], pt[1]);
        ctx2d.stroke();
      });
      scratchCanvas.addEventListener("pointerup", () => {
        if (drawing && currentStrokePts.length >= 2) {
          recordedStrokes.push(currentStrokePts.slice());
        }
        drawing = false;
        currentStrokePts = [];
      });
      const btnClearScratch = el("btn-scratchpad-clear");
      if (btnClearScratch) {
        btnClearScratch.addEventListener("click", () => {
          recordedStrokes = [];
          if (ctx2d) ctx2d.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
          const fb = el("bd-scratchpad-feedback");
          if (fb) fb.textContent = "";
        });
      }
      const btnGradeScratch = el("btn-scratchpad-grade");
      if (btnGradeScratch) {
        btnGradeScratch.addEventListener("click", async () => {
          const card = currentCard();
          const rawTxt = String((card && (card.front_text || card.target_answer)) || "學");
          const cjkMatch = rawTxt.match(/[\u4e00-\u9fff\u3400-\u4dbf]/);
          const ch = cjkMatch ? cjkMatch[0] : (rawTxt.trim().charAt(0) || "學");
          const strokeMatch = rawTxt.match(/(\d+)\s*획/);
          const expectedStrokes = strokeMatch ? Number(strokeMatch[1]) : Math.max(1, recordedStrokes.length || 8);
          const res = await apiPost("/api/v2/commercial/production-eval", {
            modality: "scratchpad",
            character: ch,
            stroke_count: expectedStrokes,
            user_strokes: recordedStrokes,
          }).catch(() => null);
          const fb = el("bd-scratchpad-feedback");
          if (fb && res && res.evaluation) {
            const evObj = res.evaluation;
            fb.textContent = `✍️ 필순·방향 채점: ${evObj.score_pct}점 (입력 ${evObj.actual_strokes}획 / 기준 ${evObj.expected_strokes}획 · 방향 일치도 ${evObj.direction_similarity_pct || 85.0}% · 판정: ${evObj.verdict})`;
          }
        });
      }
    }

    // Contract C8 & C9: Active Production Arena (Dictation, Chunk Ordering, Speech Shadowing + Dual-Memory FSRS)
    const prodDrawer = el("bd-active-production-drawer");
    const btnToggleProd = el("btn-toggle-active-production");
    const btnCloseProd = el("btn-prod-close");
    const prodTitle = el("bd-prod-mode-title");
    const prodPrompt = el("bd-prod-prompt-box");
    const prodChunksZone = el("bd-prod-chunks-zone");
    const prodInput = el("bd-prod-input");
    const prodFeedback = el("bd-prod-feedback");
    const btnProdMic = el("btn-prod-mic");
    let activeProdMode = "dictation";
    let currentChunkTarget = [];
    let selectedChunks = [];

    function renderActiveProductionMode(mode) {
      activeProdMode = mode || "dictation";
      const card = currentCard();
      const frontRaw = String((card && (card.front_text || card.rendered_question)) || "");
      const backRaw = String((card && (card.target_answer || card.back_text)) || "");
      const cleanSentence = vm && typeof vm.sanitizeTextForNaturalTts === "function"
        ? vm.sanitizeTextForNaturalTts(frontRaw.includes("\n") ? frontRaw.split("\n").slice(1).join(" ") : (frontRaw || backRaw))
        : (frontRaw || backRaw || "The captain refused to abandon the sinking ship.");
      const targetWord = vm && typeof vm.sanitizeTextForNaturalTts === "function"
        ? vm.sanitizeTextForNaturalTts(frontRaw.split("\n")[0] || backRaw.split("\n")[0])
        : (backRaw.split("\n")[0] || "abandon");

      if (prodFeedback) prodFeedback.textContent = "";
      if (prodInput) prodInput.value = "";
      if (prodChunksZone) {
        prodChunksZone.style.display = "none";
        while (prodChunksZone.firstChild) prodChunksZone.removeChild(prodChunksZone.firstChild);
      }
      if (btnProdMic) btnProdMic.style.display = activeProdMode === "shadowing" ? "inline-block" : "none";

      if (activeProdMode === "dictation") {
        if (prodTitle) prodTitle.textContent = "🎧 받아쓰기 훈련 (원어민 음성을 듣고 철자·문장 입력)";
        if (prodPrompt) prodPrompt.textContent = `🔊 [발음 듣기]를 눌러 음성을 듣고 핵심 어휘·문장을 받아적으세요. (힌트: ${targetWord.slice(0, 1)}___ · ${targetWord.length}글자)`;
      } else if (activeProdMode === "chunk_order") {
        if (prodTitle) prodTitle.textContent = "🧩 문장 어순 배열 훈련 (조각을 순서대로 클릭)";
        const chSpec = vm && typeof vm.buildSentenceChunkChallenge === "function"
          ? vm.buildSentenceChunkChallenge(cleanSentence.split(/\s+/).length >= 3 ? cleanSentence : `${targetWord} is an essential concept`)
          : { canonical_chunks: [{ text: targetWord }], scrambled_chunks: [{ text: targetWord }] };
        currentChunkTarget = (chSpec.canonical_chunks || []).map((c) => c.text);
        selectedChunks = [];
        if (prodPrompt) prodPrompt.textContent = "아래 섞인 어절 조각을 올바른 어순대로 클릭하세요:";
        if (prodChunksZone && typeof document !== "undefined") {
          prodChunksZone.style.display = "flex";
          (chSpec.scrambled_chunks || []).forEach((chunkObj) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.textContent = chunkObj.text;
            chip.style.cssText = "padding:5px 10px;font-size:0.78rem;border-radius:999px;background:#ffffff;border:1px solid #10b981;color:#065f46;cursor:pointer;";
            chip.addEventListener("click", () => {
              selectedChunks.push(chunkObj.text);
              if (prodInput) prodInput.value = selectedChunks.join(" ");
              chip.disabled = true;
              chip.style.opacity = "0.45";
            });
            prodChunksZone.appendChild(chip);
          });
        }
      } else {
        if (prodTitle) prodTitle.textContent = "🎙️ 원어민 발음 섀도잉 훈련 (따라 읽고 발음 정확도 측정)";
        if (prodPrompt) prodPrompt.textContent = `목표 발화 문장: "${cleanSentence || targetWord}"`;
      }
    }

    if (btnToggleProd && prodDrawer) {
      btnToggleProd.addEventListener("click", () => {
        const nextOpen = prodDrawer.style.display === "none";
        prodDrawer.style.display = nextOpen ? "block" : "none";
        if (nextOpen) renderActiveProductionMode(activeProdMode);
      });
    }
    if (btnCloseProd && prodDrawer) {
      btnCloseProd.addEventListener("click", () => { prodDrawer.style.display = "none"; });
    }
    const btnDict = el("btn-prod-dictation");
    if (btnDict) btnDict.addEventListener("click", () => renderActiveProductionMode("dictation"));
    const btnChunk = el("btn-prod-chunk-order");
    if (btnChunk) btnChunk.addEventListener("click", () => renderActiveProductionMode("chunk_order"));
    const btnShadow = el("btn-prod-shadowing");
    if (btnShadow) btnShadow.addEventListener("click", () => renderActiveProductionMode("shadowing"));

    if (btnProdMic && prodInput) {
      btnProdMic.addEventListener("click", () => {
        const SpeechRec = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!SpeechRec) {
          showUxToast("현재 브라우저에서 음성 인식을 지원하지 않아 직접 입력으로 채점합니다.", "amber");
          return;
        }
        try {
          const rec = new SpeechRec();
          const card = currentCard();
          const fTxt = String((card && card.front_text) || "");
          rec.lang = /[A-Za-z]{2,}/.test(fTxt) ? "en-US" : "ko-KR";
          rec.onresult = (ev) => {
            const transcript = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : "";
            prodInput.value = transcript;
          };
          rec.start();
          showUxToast("🎙️ 마이크 수신 중... 제시문을 소리 내어 읽어주세요.", "accent");
        } catch (_e) {}
      });
    }

    const btnProdGrade = el("btn-prod-grade");
    if (btnProdGrade) {
      btnProdGrade.addEventListener("click", async () => {
        const card = currentCard();
        const frontRaw = String((card && (card.front_text || card.rendered_question)) || "");
        const backRaw = String((card && (card.target_answer || card.back_text)) || "");
        const targetWord = vm && typeof vm.sanitizeTextForNaturalTts === "function"
          ? vm.sanitizeTextForNaturalTts(frontRaw.split("\n")[0] || backRaw.split("\n")[0])
          : (backRaw.split("\n")[0] || "abandon");
        const userTxt = String((prodInput && prodInput.value) || "").trim();
        let gradeObj = { accuracy_pct: 0, is_correct: false, recommended_rating: 1 };

        if (activeProdMode === "chunk_order" && vm && typeof vm.gradeSentenceChunkOrdering === "function") {
          const userSeq = selectedChunks.length ? selectedChunks : userTxt.split(/\s+/).filter(Boolean);
          gradeObj = vm.gradeSentenceChunkOrdering(currentChunkTarget, userSeq);
        } else if (activeProdMode === "shadowing" && vm && typeof vm.evaluateSpeechShadowing === "function") {
          gradeObj = vm.evaluateSpeechShadowing(targetWord, userTxt, 1500);
        } else if (vm && typeof vm.gradeDictationResponse === "function") {
          gradeObj = vm.gradeDictationResponse(targetWord, userTxt);
        }

        const dualStep = vm && typeof vm.stepDualMemoryFsrs === "function"
          ? vm.stepDualMemoryFsrs(
              {
                difficulty: Number((card && card.difficulty) || 5.0),
                recognition_stability: Number((card && (card.recognition_stability || card.stability)) || 1.2),
                recall_stability: Number((card && (card.recall_stability || card.stability)) || 0.8),
                reps: Number((card && card.reps) || 1),
                lapses: Number((card && card.lapses) || 0),
                consecutive_recognition_successes: Number((card && card.consecutive_recognition_successes) || 0),
                state: String((card && card.state) || "review"),
              },
              gradeObj.recommended_rating || 3,
              activeProdMode,
              1.0,
              0.9
            )
          : null;

        if (card && card.card_id && typeof apiPost === "function") {
          await apiPost("/api/review", {
            card_id: card.card_id,
            rating: gradeObj.recommended_rating || 3,
            modality: "active_recall",
            response_time_ms: 1800,
          }).catch(() => null);
        }

        if (prodFeedback) {
          const nextDual = dualStep && (dualStep.next_state || dualStep.dual_memory);
          const sRec = nextDual ? nextDual.recognition_stability : "-";
          const sRecall = nextDual ? nextDual.recall_stability : "-";
          prodFeedback.textContent = `✅ 능동 인출 정확도: ${gradeObj.accuracy_pct}% (권장 평가: ${gradeObj.recommended_rating}점) · 인식기억 S=${sRec}일 / 인출기억 S=${sRecall}일`;
        }
      });
    }

    // Contract C11: Interactive Visual Drag-Box Image Occlusion Editor in Create Tab
    const btnToggleIoBuilder = el("btn-toggle-io-builder");
    const ioBuilderDrawer = el("bd-io-builder-drawer");
    const ioBuilderCanvas = el("bd-io-builder-canvas");
    const ioLabelInput = el("bd-io-label-input");
    const btnIoClear = el("btn-io-clear-boxes");
    const directCardFront = el("direct-card-front");

    if (btnToggleIoBuilder && ioBuilderDrawer) {
      btnToggleIoBuilder.addEventListener("click", () => {
        ioBuilderDrawer.style.display = ioBuilderDrawer.style.display === "none" ? "block" : "none";
      });
    }
    if (ioBuilderCanvas && typeof ioBuilderCanvas.getContext === "function") {
      const ioCtx = ioBuilderCanvas.getContext("2d");
      let ioStart = null;
      let ioBoxes = [];

      function redrawIoCanvas() {
        if (!ioCtx) return;
        ioCtx.clearRect(0, 0, ioBuilderCanvas.width, ioBuilderCanvas.height);
        ioCtx.strokeStyle = "#334155";
        ioCtx.lineWidth = 1;
        ioCtx.strokeRect(8, 8, ioBuilderCanvas.width - 16, ioBuilderCanvas.height - 16);
        ioBoxes.forEach((b) => {
          ioCtx.fillStyle = "rgba(245, 158, 11, 0.35)";
          ioCtx.strokeStyle = "#fbbf24";
          ioCtx.lineWidth = 2;
          ioCtx.fillRect(b.x, b.y, b.w, b.h);
          ioCtx.strokeRect(b.x, b.y, b.w, b.h);
          ioCtx.fillStyle = "#fef3c7";
          ioCtx.font = "bold 11px sans-serif";
          ioCtx.fillText(`#${b.ord} ${b.label}`, b.x + 4, b.y + 14);
        });
      }
      redrawIoCanvas();

      ioBuilderCanvas.addEventListener("pointerdown", (ev) => {
        const r = ioBuilderCanvas.getBoundingClientRect();
        ioStart = { x: Math.round(ev.clientX - r.left), y: Math.round(ev.clientY - r.top) };
      });
      ioBuilderCanvas.addEventListener("pointerup", (ev) => {
        if (!ioStart) return;
        const r = ioBuilderCanvas.getBoundingClientRect();
        const endX = Math.round(ev.clientX - r.left);
        const endY = Math.round(ev.clientY - r.top);
        const x = Math.max(0, Math.min(ioStart.x, endX));
        const y = Math.max(0, Math.min(ioStart.y, endY));
        const w = Math.max(28, Math.abs(endX - ioStart.x));
        const h = Math.max(20, Math.abs(endY - ioStart.y));
        ioStart = null;
        const ord = ioBoxes.length + 1;
        const label = String((ioLabelInput && ioLabelInput.value) || `핵심영역_${ord}`).trim();
        ioBoxes.push({ ord, x, y, w, h, label });
        redrawIoCanvas();
        if (directCardFront) {
          const token = `{{io${ord}::${x},${y},${w},${h}::${label}}}`;
          directCardFront.value = (String(directCardFront.value || "").trim() + " " + token).trim();
        }
      });
      if (btnIoClear) {
        btnIoClear.addEventListener("click", () => {
          ioBoxes = [];
          redrawIoCanvas();
        });
      }
    }

    const btnErrata = el("btn-report-errata");
    if (btnErrata) {
      btnErrata.addEventListener("click", async () => {
        const card = currentCard();
        if (!card) return;
        const res = await apiPost("/api/v2/commercial/errata", {
          card_id: card.card_id || 1,
          issue_type: "typo",
          description: `사용자 1클릭 검수 요청: ${String(card.front_text || "").slice(0, 40)}`,
          suggested_fix: "",
        }).catch(() => null);
        if (res && res.ok) {
          showUxToast(`🚨 카드 #${card.card_id || 1} 오류·개선 제보(#${res.report_id})가 접수되었습니다!`, "emerald");
        }
      });
    }

    const btnShareDeck = el("btn-share-deck-token");
    if (btnShareDeck) {
      btnShareDeck.addEventListener("click", async () => {
        const res = await apiPost("/api/v2/commercial/deck-share/export", {
          deck_id: Number(state.selectedDeckId) || 1,
        }).catch(() => null);
        if (res && res.ok && res.token) {
          if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(res.token).catch(() => {});
          }
          showUxToast(`🔗 공유 토큰 생성 완료 (${res.card_count}장, 클립보드 복사됨)`, "emerald");
        }
      });
    }

    const arenaEl = typeof document !== "undefined" ? document.querySelector(".card-arena") : null;
    if (arenaEl && typeof submitRating === "function") {
      let touchStartX = 0;
      let touchStartY = 0;
      arenaEl.addEventListener("touchstart", (ev) => {
        if (ev.touches && ev.touches[0]) {
          touchStartX = ev.touches[0].clientX;
          touchStartY = ev.touches[0].clientY;
        }
      }, { passive: true });
      arenaEl.addEventListener("touchend", (ev) => {
        if (!state.isRevealed || !ev.changedTouches || !ev.changedTouches[0]) return;
        const dx = ev.changedTouches[0].clientX - touchStartX;
        const dy = ev.changedTouches[0].clientY - touchStartY;
        if (vm && typeof vm.resolveMobileErgonomicsSpec === "function") {
          const decision = vm.resolveMobileErgonomicsSpec(dx, dy, 72, state.oledDark ? "oled_dark" : "light");
          if (decision && decision.swipe_rating) {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && decision.haptic_pattern_ms.length) {
              navigator.vibrate(decision.haptic_pattern_ms);
            }
            submitRating(decision.swipe_rating);
          }
        }
      }, { passive: true });
    }

    refreshCommercialMasteryDashboard();
    return {
      syncStudyToolsSummaryBadge,
      switchCurriculumSegment,
      refreshCommercialMasteryDashboard,
    };
  }

  let activeTtsAudioEl = null;
  let cachedBrowserVoices = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis) {
    try {
      cachedBrowserVoices = typeof window.speechSynthesis.getVoices === "function"
        ? window.speechSynthesis.getVoices() || []
        : [];
      window.speechSynthesis.onvoiceschanged = () => {
        try {
          cachedBrowserVoices = window.speechSynthesis.getVoices() || [];
        } catch (_e) {}
      };
    } catch (_e) {}
  }

  async function speakNaturalCardAudio(ctx) {
    const { vm, state, currentCard, apiPost, showUxToast } = ctx || {};
    const card = typeof currentCard === "function" ? currentCard() : null;
    if (!card) return;
    const isRev = Boolean(state && state.isRevealed);
    const frontTxt = String(card.front_text || card.rendered_question || "");
    const backTxt = String(card.back_text || card.rendered_answer || card.target_answer || "");
    const raw = isRev ? backTxt : frontTxt;
    const segments =
      vm && typeof vm.buildNaturalTtsSegments === "function"
        ? vm.buildNaturalTtsSegments(raw, frontTxt, backTxt, isRev)
        : [{ text: String(raw || "").trim(), lang: /[가-힣]/.test(raw) ? "ko-KR" : "en-US", rate: 0.96, pitch: 1.0 }];

    if (activeTtsAudioEl) {
      try { activeTtsAudioEl.pause(); } catch (_e) {}
      activeTtsAudioEl = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (_e) {}
    }

    const previewLabel = segments.map((s) => s.text).join(" ➔ ").slice(0, 36);
    const preCreatedAudio = typeof Audio !== "undefined" ? new Audio() : null;

    if (typeof apiPost === "function" && preCreatedAudio) {
      const neuralRes = await apiPost("/api/v2/tts/neural", {
        text: raw,
        front_text: frontTxt,
        back_text: backTxt,
        is_revealed: isRev,
      }).catch(() => null);
      if (neuralRes && neuralRes.ok && neuralRes.data_uri && neuralRes.engine !== "offline_formant_fallback") {
        try {
          preCreatedAudio.src = neuralRes.data_uri;
          activeTtsAudioEl = preCreatedAudio;
          await preCreatedAudio.play();
          if (typeof showUxToast === "function") {
            showUxToast(`🔊 원어민 음성 재생 중: ${previewLabel}`, "accent");
          }
          return;
        } catch (_playErr) {}
      }
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
      const liveVoices = typeof window.speechSynthesis.getVoices === "function" ? window.speechSynthesis.getVoices() : [];
      const voices = (liveVoices && liveVoices.length > 0) ? liveVoices : cachedBrowserVoices;
      segments.forEach((seg) => {
        if (!seg || !seg.text) return;
        const utter = new SpeechSynthesisUtterance(seg.text);
        utter.lang = seg.lang || "en-US";
        utter.rate = Number(seg.rate) || (utter.lang === "en-US" ? 0.94 : 0.98);
        utter.pitch = Number(seg.pitch) || 1.0;
        if (vm && typeof vm.selectBestBrowserVoice === "function" && voices && voices.length > 0) {
          const bestVoice = vm.selectBestBrowserVoice(voices, utter.lang);
          if (bestVoice) utter.voice = bestVoice;
        }
        window.speechSynthesis.speak(utter);
      });
      if (typeof showUxToast === "function") {
        showUxToast(`🔊 원어민 발음 재생 중: ${previewLabel}`, "accent");
      }
      return;
    }

    if (typeof apiPost === "function" && preCreatedAudio) {
      const firstSeg = segments[0] || { text: raw, lang: "en-US" };
      const wavRes = await apiPost("/api/v2/commercial/production-eval", {
        modality: "offline_tts_wav",
        text: firstSeg.text,
        lang: firstSeg.lang,
      }).catch(() => null);
      if (wavRes && wavRes.data_uri) {
        preCreatedAudio.src = wavRes.data_uri;
        preCreatedAudio.play().catch(() => {});
      }
    }
  }

  return {
    renderDeckExplorerPanelDom,
    renderStudyPlanBannerDom,
    renderTapBlockQuizDom,
    renderDocumentPreviewCardsDom,
    createCatalogAndStoreControllers,
    bindReaUtilitiesAndPlannerDom,
    speakNaturalCardAudio,
  };
});
