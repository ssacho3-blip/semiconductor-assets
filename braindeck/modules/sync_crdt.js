/**
 * BrainDeck v8.1 Modular Domain Engine: CRDT G-Set Review Log & HLC Note LWW Merge (`sync_crdt.js`).
 * Pure UMD module with zero DOM or network dependencies.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrainDeckSyncCrdt = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function compareEventOrder(a, b) {
    const tA = Number(a.reviewed_at_ms || 0);
    const tB = Number(b.reviewed_at_ms || 0);
    if (tA !== tB) return tA - tB;
    const hA = String(a.hlc || "");
    const hB = String(b.hlc || "");
    if (hA !== hB) return hA < hB ? -1 : 1;
    const idA = String(a.event_id || "");
    const idB = String(b.event_id || "");
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  }

  function normalizeEvent(evt) {
    if (!evt || !evt.event_id) {
      throw new Error("SyncValidationError: missing event_id");
    }
    const rating = Number(evt.rating);
    const reviewedAtMs = Number(evt.reviewed_at_ms);
    if (![1, 2, 3, 4].includes(rating) || !Number.isFinite(reviewedAtMs) || reviewedAtMs <= 0) {
      throw new Error("SyncValidationError: invalid rating or reviewed_at_ms");
    }
    return {
      event_id: String(evt.event_id).trim(),
      card_id: Number(evt.card_id),
      rating,
      reviewed_at_ms: reviewedAtMs,
      elapsed_days: Number(Number(evt.elapsed_days || 0).toFixed(6)),
      response_time_ms: Number(evt.response_time_ms || 3000),
      device_id: String(evt.device_id || "web-client"),
      hlc: String(evt.hlc || ""),
    };
  }

  function eventsEqual(a, b) {
    return (
      a.event_id === b.event_id &&
      a.card_id === b.card_id &&
      a.rating === b.rating &&
      a.reviewed_at_ms === b.reviewed_at_ms &&
      a.elapsed_days === b.elapsed_days &&
      a.response_time_ms === b.response_time_ms &&
      a.device_id === b.device_id &&
      a.hlc === b.hlc
    );
  }

  function mergeReviewLogGSet(setA, setB, deletionEpochMs) {
    const epoch = Number(deletionEpochMs || 0);
    const byId = new Map();
    const combined = (Array.isArray(setA) ? setA : []).concat(Array.isArray(setB) ? setB : []);
    for (const raw of combined) {
      const evt = normalizeEvent(raw);
      if (epoch > 0 && evt.reviewed_at_ms <= epoch) {
        throw new Error(
          `SyncValidationError: PRE_DELETION_EPOCH_REJECTED: event_id=${evt.event_id}`
        );
      }
      const prev = byId.get(evt.event_id);
      if (prev !== undefined) {
        if (!eventsEqual(prev, evt)) {
          throw new Error(
            `SyncValidationError: Conflicting payload for immutable event_id=${evt.event_id}`
          );
        }
        continue;
      }
      byId.set(evt.event_id, evt);
    }
    return Array.from(byId.values()).sort(compareEventOrder);
  }

  function canonicalTags(tags) {
    if (!Array.isArray(tags)) return [];
    const set = new Set();
    for (const t of tags) {
      const s = String(t || "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }

  function mergeNoteLwwRegisters(regA, regB) {
    if (!regA || !regB || String(regA.note_id) !== String(regB.note_id)) {
      throw new Error("SyncValidationError: Cannot merge NoteLwwRegisters with mismatched note_id");
    }
    const tagsA = canonicalTags(regA.tags);
    const tagsB = canonicalTags(regB.tags);
    const hlcA = String(regA.hlc || "");
    const hlcB = String(regB.hlc || "");
    const tombA = Boolean(regA.deleted_tombstone);
    const tombB = Boolean(regB.deleted_tombstone);
    const frontA = String(regA.front_text || "");
    const frontB = String(regB.front_text || "");
    const backA = String(regA.back_text || "");
    const backB = String(regB.back_text || "");
    const tagJoinA = tagsA.join("\x1f");
    const tagJoinB = tagsB.join("\x1f");

    let chooseA;
    if (hlcA !== hlcB) {
      chooseA = hlcA > hlcB;
    } else if (tombA !== tombB) {
      chooseA = tombA;
    } else if (frontA !== frontB) {
      chooseA = frontA > frontB;
    } else if (backA !== backB) {
      chooseA = backA > backB;
    } else {
      chooseA = tagJoinA >= tagJoinB;
    }

    const winner = chooseA ? regA : regB;
    const winTags = chooseA ? tagsA : tagsB;
    if (Boolean(winner.deleted_tombstone)) {
      return {
        note_id: String(winner.note_id),
        front_text: "",
        back_text: "",
        tags: [],
        hlc: String(winner.hlc),
        deleted_tombstone: true,
      };
    }
    return {
      note_id: String(winner.note_id),
      front_text: String(winner.front_text || ""),
      back_text: String(winner.back_text || ""),
      tags: winTags,
      hlc: String(winner.hlc),
      deleted_tombstone: false,
    };
  }

  function validateSyncDeltaEnvelope(envelope, deletionEpochMs) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("SyncValidationError: envelope must be an object");
    }
    if (envelope.schema_version !== 1) {
      throw new Error("SyncValidationError: unsupported schema_version");
    }
    if (!envelope.device_id || typeof envelope.device_id !== "string") {
      throw new Error("SyncValidationError: missing device_id");
    }
    if (!Array.isArray(envelope.review_events)) {
      throw new Error("SyncValidationError: review_events must be an array");
    }
    mergeReviewLogGSet(envelope.review_events, [], deletionEpochMs);
    return true;
  }

  return {
    mergeReviewLogGSet,
    mergeNoteLwwRegisters,
    validateSyncDeltaEnvelope,
  };
});
