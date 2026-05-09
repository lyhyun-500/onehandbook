#!/usr/bin/env bash
# replicate-supabase-schema.sh
# Replicate the production Supabase public schema to the E2E project.
# Idempotent on a clean E2E. Safe by default (refuses to apply on non-empty E2E).

set -euo pipefail

# ---- defaults ----
DRY_RUN=0
ASSUME_YES=0
FORCE=0
KEEP_SCRATCH=0

# ---- exit codes ----
readonly E_ENV=1
readonly E_PRECHECK=2
readonly E_DUMP=3
readonly E_PATCH=4
readonly E_APPLY=5
readonly E_MATRIX=6

SCRATCH_ROOT=".scratch"
RUN_DIR=""

usage() {
  cat <<'EOF'
Usage: replicate-supabase-schema.sh [options]

Replicates production Supabase public schema to the E2E project.
The storage schema is excluded by design (Supabase manages it on both sides).

Required environment variables:
  PROD_DB_URL, PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY
  E2E_DB_URL,  E2E_SUPABASE_URL,  E2E_SERVICE_ROLE_KEY

Options:
  --dry-run        Run all checks and dump+patch, but skip the apply step.
                   The verification matrix runs read-only against current state.
  --yes            Auto-accept interactive confirmations (e.g., extension diff).
  --force          Bypass the "E2E public schema must be empty" check.
                   Note: re-applying on top of an existing schema is NOT
                   idempotent end-to-end (CREATE TABLE has no IF NOT EXISTS).
                   Reset E2E public schema first if you intend to re-sync.
  --keep-scratch   Preserve .scratch/replicate-<timestamp>/ after the run.
  -h, --help       Show this help.

Exit codes:
  0  success
  1  missing/invalid environment variables
  2  pre-flight check failed (connection, separation, empty check)
  3  pg_dump failed
  4  patch failed (sed/perl)
  5  psql apply failed (rolled back via --single-transaction)
  6  verification matrix detected mismatches
EOF
}

log()  { printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
warn() { printf "[%s] WARN: %s\n" "$(date +%H:%M:%S)" "$*" >&2; }
die()  {
  local msg="$1" code="${2:-2}"
  printf "[%s] ERROR: %s\n" "$(date +%H:%M:%S)" "$msg" >&2
  exit "$code"
}

confirm() {
  local prompt="$1"
  if [[ "$ASSUME_YES" -eq 1 ]]; then
    log "[auto-yes] $prompt"
    return 0
  fi
  read -r -p "$prompt [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

cleanup() {
  if [[ -z "$RUN_DIR" || ! -d "$RUN_DIR" ]]; then
    return 0
  fi
  if [[ "$KEEP_SCRATCH" -eq 0 ]]; then
    rm -rf "$RUN_DIR"
    log "Cleaned $RUN_DIR (use --keep-scratch to preserve)."
  else
    log "Run artifacts kept at $RUN_DIR"
  fi
}
trap cleanup EXIT

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)      DRY_RUN=1 ;;
      --yes)          ASSUME_YES=1 ;;
      --force)        FORCE=1 ;;
      --keep-scratch) KEEP_SCRATCH=1 ;;
      -h|--help)      usage; exit 0 ;;
      *)              die "Unknown option: $1" "$E_ENV" ;;
    esac
    shift
  done
}

extract_ref() {
  local url="$1" ref
  ref=$(printf '%s' "$url" | sed -nE 's|^postgresql://postgres\.([a-z0-9]+):.*$|\1|p')
  if [[ -n "$ref" ]]; then printf '%s' "$ref"; return 0; fi
  ref=$(printf '%s' "$url" | sed -nE 's|^postgresql://[^@]+@db\.([a-z0-9]+)\.supabase\.co.*$|\1|p')
  if [[ -n "$ref" ]]; then printf '%s' "$ref"; return 0; fi
  return 1
}

step_1_env() {
  log "[1/10] Validating environment variables..."
  local missing=()
  local v
  for v in PROD_DB_URL PROD_SUPABASE_URL PROD_SERVICE_ROLE_KEY \
           E2E_DB_URL E2E_SUPABASE_URL E2E_SERVICE_ROLE_KEY; do
    if [[ -z "${!v:-}" ]]; then
      missing+=("$v")
    fi
  done
  if [[ "${#missing[@]}" -gt 0 ]]; then
    die "Missing required env vars: ${missing[*]}" "$E_ENV"
  fi
  log "  OK: 6/6 env vars present."
}

step_2_path() {
  log "[2/10] Augmenting PATH for libpq..."
  local added=() p
  for p in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
    if [[ -d "$p" && ":$PATH:" != *":$p:"* ]]; then
      PATH="$p:$PATH"
      added+=("$p")
    fi
  done
  export PATH
  if [[ "${#added[@]}" -gt 0 ]]; then
    log "  Added: ${added[*]}"
  else
    log "  No additions needed."
  fi
}

step_3_precheck() {
  log "[3/10] Pre-flight checks..."
  command -v psql    >/dev/null 2>&1 || die "psql not found in PATH"    "$E_PRECHECK"
  command -v pg_dump >/dev/null 2>&1 || die "pg_dump not found in PATH" "$E_PRECHECK"

  local prod_id e2e_id
  prod_id=$(psql "$PROD_DB_URL" -A -t -c \
    "SELECT current_user || '@' || current_database();" 2>/dev/null) \
    || die "Cannot connect to PROD_DB_URL" "$E_PRECHECK"
  e2e_id=$(psql "$E2E_DB_URL" -A -t -c \
    "SELECT current_user || '@' || current_database();" 2>/dev/null) \
    || die "Cannot connect to E2E_DB_URL" "$E_PRECHECK"
  log "  PROD identity: $prod_id"
  log "  E2E  identity: $e2e_id"

  local prod_ref e2e_ref
  prod_ref=$(extract_ref "$PROD_DB_URL") \
    || die "Cannot extract project_ref from PROD_DB_URL" "$E_PRECHECK"
  e2e_ref=$(extract_ref "$E2E_DB_URL") \
    || die "Cannot extract project_ref from E2E_DB_URL" "$E_PRECHECK"
  log "  PROD ref: $prod_ref"
  log "  E2E  ref: $e2e_ref"
  if [[ "$prod_ref" == "$e2e_ref" ]]; then
    die "PROD and E2E point to the same Supabase project ($prod_ref). Refusing." "$E_PRECHECK"
  fi

  local e2e_tables
  e2e_tables=$(psql "$E2E_DB_URL" -A -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
  log "  E2E public BASE TABLE count: $e2e_tables"
  if [[ "$e2e_tables" -ne 0 && "$FORCE" -ne 1 ]]; then
    die "E2E public is not empty ($e2e_tables tables). Re-run with --force to override." "$E_PRECHECK"
  fi
}

step_4_extensions() {
  log "[4/10] Diffing extensions PROD vs E2E..."
  local prod_ext="$RUN_DIR/prod-extensions.txt"
  local e2e_ext="$RUN_DIR/e2e-extensions.txt"
  psql "$PROD_DB_URL" -A -t -c \
    "SELECT extname FROM pg_extension ORDER BY extname;" > "$prod_ext"
  psql "$E2E_DB_URL"  -A -t -c \
    "SELECT extname FROM pg_extension ORDER BY extname;" > "$e2e_ext"

  local only_prod
  only_prod=$(comm -23 "$prod_ext" "$e2e_ext")
  if [[ -n "$only_prod" ]]; then
    warn "Extensions present in PROD but missing from E2E:"
    printf '  %s\n' "$only_prod" >&2
    confirm "Continue anyway? Apply may fail if functions reference these." \
      || die "Aborted by user." "$E_PRECHECK"
  else
    log "  OK: extensions match."
  fi
}

step_5_dump() {
  log "[5/10] Dumping PROD public schema..."
  local out="$RUN_DIR/prod-schema.sql"
  pg_dump --schema-only --no-owner --no-acl --schema=public \
    "$PROD_DB_URL" > "$out" 2> "$RUN_DIR/prod-schema.err" \
    || die "pg_dump failed (see $RUN_DIR/prod-schema.err)" "$E_DUMP"
  local lines
  lines=$(wc -l < "$out" | tr -d ' ')
  log "  Wrote $out ($lines lines)."
}

step_6_patch() {
  log "[6/10] Patching dump for idempotency..."
  local f="$RUN_DIR/prod-schema.sql"
  perl -i -pe 's/^CREATE SCHEMA /CREATE SCHEMA IF NOT EXISTS /g' "$f" \
    || die "Schema patch failed" "$E_PATCH"
  perl -i -pe 's/^CREATE EXTENSION (?!IF NOT EXISTS)/CREATE EXTENSION IF NOT EXISTS /g' "$f" \
    || die "Extension patch failed" "$E_PATCH"

  local schemas exts
  schemas=$(grep -cE "^CREATE SCHEMA IF NOT EXISTS" "$f" || true)
  exts=$(grep -cE "^CREATE EXTENSION IF NOT EXISTS"  "$f" || true)
  log "  Patched: $schemas SCHEMA, $exts EXTENSION."
}

step_7_safety() {
  log "[7/10] Verifying dump safety..."
  local f="$RUN_DIR/prod-schema.sql"
  local inserts storage_refs creds
  inserts=$(grep -c "^INSERT INTO" "$f" || true)
  storage_refs=$(grep -c "storage\." "$f" || true)
  creds=$(grep -ciE "password|secret|token" "$f" || true)
  log "  INSERT INTO: $inserts (expect 0)"
  log "  storage. refs: $storage_refs (expect 0)"
  log "  password|secret|token matches: $creds (manual review if non-zero)"
  if [[ "$inserts" -ne 0 ]]; then
    die "Dump contains INSERT statements; refusing to apply." "$E_PATCH"
  fi
}

step_8_apply() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[8/10] SKIP apply (dry-run)."
    return 0
  fi
  log "[8/10] Applying schema to E2E (single transaction)..."
  local f="$RUN_DIR/prod-schema.sql"
  local logf="$RUN_DIR/apply.log"
  if ! psql "$E2E_DB_URL" --single-transaction --set ON_ERROR_STOP=1 \
       -f "$f" > "$logf" 2>&1; then
    warn "Apply failed. First error lines:"
    grep -nE "ERROR|FATAL|ROLLBACK" "$logf" | head -5 >&2 || true
    die "psql apply failed (see $logf)" "$E_APPLY"
  fi
  local errs
  errs=$(grep -ciE "ERROR|FATAL" "$logf" || true)
  log "  Apply OK. ERROR/FATAL count in log: $errs."
}

step_9_matrix() {
  log "[9/10] Verification matrix (PROD vs E2E)..."
  local mismatch=0
  local key q pv ev m

  local -a metrics=(
    "public_tables|SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
    "public_policies|SELECT count(*) FROM pg_policies WHERE schemaname='public';"
    "public_functions|SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public';"
    "rls_enabled_tables|SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true;"
    "public_triggers|SELECT count(*) FROM information_schema.triggers WHERE trigger_schema='public';"
  )

  printf "  %-22s %20s %20s %8s\n" "metric" "PROD" "E2E" "match"
  local row
  for row in "${metrics[@]}"; do
    key="${row%%|*}"
    q="${row#*|}"
    pv=$(psql "$PROD_DB_URL" -A -t -c "$q")
    ev=$(psql "$E2E_DB_URL"  -A -t -c "$q")
    m="OK"
    if [[ "$pv" != "$ev" ]]; then m="DIFF"; mismatch=1; fi
    printf "  %-22s %20s %20s %8s\n" "$key" "$pv" "$ev" "$m"
  done

  local sigq="SELECT proname || '/' || pronargs FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='admin_debit_nat';"
  pv=$(psql "$PROD_DB_URL" -A -t -c "$sigq")
  ev=$(psql "$E2E_DB_URL"  -A -t -c "$sigq")
  m="OK"
  if [[ "$pv" != "$ev" ]]; then m="DIFF"; mismatch=1; fi
  printf "  %-22s %20s %20s %8s\n" \
    "admin_debit_nat" "${pv:-<missing>}" "${ev:-<missing>}" "$m"

  if [[ "$mismatch" -ne 0 ]]; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      warn "Matrix mismatches detected (expected in dry-run before apply)."
    else
      die "Verification matrix detected mismatches." "$E_MATRIX"
    fi
  else
    log "  Matrix: all metrics match."
  fi
}

step_10_buckets() {
  log "[10/10] Storage bucket diff..."
  local pc ec
  pc=$(psql "$PROD_DB_URL" -A -t -c "SELECT count(*) FROM storage.buckets;")
  ec=$(psql "$E2E_DB_URL"  -A -t -c "SELECT count(*) FROM storage.buckets;")
  log "  PROD buckets: $pc"
  log "  E2E  buckets: $ec"
  if [[ "$pc" -gt 0 && "$ec" -eq 0 ]]; then
    log "  --- Suggested INSERTs (review before running on E2E) ---"
    psql "$PROD_DB_URL" -A -t -c \
      "SELECT format('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %L, %s, %L);', id, name, public, COALESCE(file_size_limit::text, 'NULL'), allowed_mime_types) FROM storage.buckets ORDER BY name;"
    log "  --- end suggestions ---"
    log "  Storage RLS policies are managed by Supabase platform; verify count parity:"
    local pp ep
    pp=$(psql "$PROD_DB_URL" -A -t -c "SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects';")
    ep=$(psql "$E2E_DB_URL"  -A -t -c "SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects';")
    log "    storage.objects RLS — PROD: $pp, E2E: $ep"
  elif [[ "$pc" == "$ec" ]]; then
    log "  Bucket counts match (no replication action needed)."
  else
    warn "PROD has $pc buckets but E2E has $ec — manual review needed."
  fi
}

main() {
  parse_args "$@"
  local ts
  ts=$(date +%Y%m%d-%H%M%S)
  RUN_DIR="$SCRATCH_ROOT/replicate-$ts"
  mkdir -p "$RUN_DIR"
  log "Run dir: $RUN_DIR (dry-run=$DRY_RUN, yes=$ASSUME_YES, force=$FORCE)"

  step_1_env
  step_2_path
  step_3_precheck
  step_4_extensions
  step_5_dump
  step_6_patch
  step_7_safety
  step_8_apply
  step_9_matrix
  step_10_buckets

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN complete. No changes applied to E2E."
  else
    log "DONE. Schema replicated successfully."
  fi
}

main "$@"
