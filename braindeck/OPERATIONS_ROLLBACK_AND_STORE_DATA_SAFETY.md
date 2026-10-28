# BrainDeck v8.2 Production Operations Rollback Runbook & Store Data-Safety Declaration

## 1. Production Operations Rollback Runbook

### 1.1 Personalized FSRS-5 Weight Rollback (`fsrs-5.v8.2`)
- **Automated Non-Degradation Gate**: `optimize_fsrs5_weights` enforces an 80/20 chronological hold-out split (`min_reviews >= 1,000`), `[0.0001, 100.0]` weight bounds, and `rmse_personalized <= rmse_default`.
- **Emergency One-Command Weight Rollback**:
  If a user or operator wishes to revert personalized weights back to canonical `DEFAULT_FSRS5_WEIGHTS`:
  ```bash
  curl -X POST http://127.0.0.1:4390/api/v2/fsrs/reset \
    -H "Content-Type: application/json" \
    -d '{"user_id": "local"}'
  ```
- **Schema Version Fallback**: `_load_persisted_fsrs_weights_in_tx` verifies both `[0.0001, 100.0]` bounds and `19`-element dimensionality on every read, automatically falling back to `DEFAULT_FSRS5_WEIGHTS` if corrupted.

### 1.2 OTA Curriculum Corpus Key Rotation & Rollback (`curriculum_corpus_v8.json`)
- **Pinned Public Key Registry (`TRUSTED_OTA_SIGNING_KEYS`)**:
  - Current active key: `braindeck-ota-root-2026-v1` (2048-bit RSA, `e = 65537`).
  - Revocation registry (`REVOKED_OTA_KEY_IDS`): Any key ID listed in `REVOKED_OTA_KEY_IDS` fails closed with `REVOKED_OTA_SIGNING_KEY` before signature evaluation.
- **Zero-Downtime Rollback to Bundled Asset**:
  If an OTA bundle fails `SSOT_CORPUS_SHA256` or RSA-2048 verification in `AuthenticSubjectCorpusBank.reloadFromJson` or `validate_ota_corpus_bundle_fail_closed`, both Android and Web/Python runtimes reject the payload (`SecurityException("CORPUS_SIGNATURE_INVALID")`) and retain the last verified in-memory/bundled `curriculum_corpus_v8.json` snapshot.

### 1.3 Async Ingest Worker Crash Recovery & DLQ Drain
- **Crash Lease Reclamation**: Orphaned `LEASED` jobs whose `lease_expires_at_ms < now_ms` are automatically reclaimed by the next worker cycle (`status = 'LEASED'` with expired lease -> new `lease_token` and `attempt_count + 1`).
- **Pre-Insert Lease Fencing**: Card persistence verifies `(job_id, status='LEASED', lease_token)` inside `BEGIN IMMEDIATE` before inserting into `notes`/`cards`, guaranteeing zero duplicate cards on worker crash/restart.
- **Health & SLO Telemetry Endpoint**:
  ```bash
  curl -s http://127.0.0.1:4390/api/v2/ops/telemetry
  ```

---

## 2. Litestream / NAS Backup Replica Crypto-Shredding & 24h Purge SLA

1. **Per-Tenant DEK (`tenant_encryption_keys`)**:
   Each tenant (`user_id`) is assigned a dedicated Data Encryption Key (`dek_id`, `dek_ciphertext_hex`).
2. **Immediate Crypto-Shredding on Account Deletion (`crypto_shred_tenant_dek`)**:
   When `erase_account_and_all_user_data` executes:
   - All user data rows across `studio.sqlite` and `reference_pack_store.sqlite` are deleted inside `BEGIN IMMEDIATE`, followed by `PRAGMA wal_checkpoint(TRUNCATE)`.
   - The tenant's DEK is cryptographically shredded (`dek_ciphertext_hex` overwritten with 64 zeroes, `shredded = 1`, `shredded_at_ms` recorded), rendering any historical Litestream / NAS WAL segments encrypted under that key permanently unrecoverable.
   - Off-host Litestream / NAS snapshot retention rolls over within a strict **24-hour Replica Purge SLA (`replica_purge_sla_hours: 24`)**.

---

## 3. Google Play Data Safety & Apple App Store Privacy Nutrition Labels

| Data Category | Collected | Shared with Third Parties | Purpose | Encryption & Erasure |
| :--- | :---: | :---: | :--- | :--- |
| **User Study Progress & Flashcards** (`decks`, `notes`, `cards`, `revlog`) | Yes (Local-first + optional CRDT Sync) | No | Spaced repetition scheduling (FSRS-5 & REA v5.6) | TLS 1.3 in transit; SQLite WAL + Per-Tenant DEK at rest; Instant Two-Phase Erasure (`/api/v2/account/delete`) |
| **Device Identifiers** (`device_id` in CRDT HLC) | Yes (Ephemeral pseudonymous UUID) | No | Multi-device conflict-free sync & post-deletion tombstone fencing | Revoked & fenced via `revoked_sync_sessions` upon account deletion |
| **Purchase Entitlements** (`store_entitlements`, `pack_download_audit`) | Yes | No | Reference Pack Store restoration & refund verification | Wiped across companion DBs during `/api/v2/account/delete` |
| **Diagnostics & Telemetry** (`/api/v2/ops/telemetry`) | Operational counters only (zero PII) | No | Queue health, WAL integrity, and SLO monitoring | Aggregated non-PII counters only |
| **Location / Contacts / Ad ID / Microphone** | **No** | **No** | N/A (Web Speech TTS runs locally on-device) | Never requested or stored |
