#!/bin/bash
# Resolve EMAT project root — used by all launch scripts.
emat_resolve_home() {
  if [[ -n "${EMAT_HOME:-}" && -f "${EMAT_HOME}/package.json" ]]; then
    printf '%s\n' "$EMAT_HOME"
    return 0
  fi

  local marker="$HOME/.emat/home"
  if [[ -f "$marker" ]]; then
    local recorded
    recorded="$(tr -d '[:space:]' <"$marker")"
    if [[ -n "$recorded" && -f "$recorded/package.json" ]]; then
      printf '%s\n' "$recorded"
      return 0
    fi
  fi

  local lib_dir script_dir
  lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  script_dir="$(cd "$lib_dir/.." && pwd)"
  local fallback
  fallback="$(cd "$script_dir/.." && pwd)"
  if [[ -f "$fallback/package.json" ]]; then
    printf '%s\n' "$fallback"
    return 0
  fi

  return 1
}

emat_require_home() {
  local root
  if ! root="$(emat_resolve_home)"; then
    osascript -e 'display alert "EMAT Tracking Database" message "Project not found. Run npm run app:install once from the maintenance-platform folder." as critical' 2>/dev/null || {
      echo "ERROR: EMAT project not found. Run: cd ~/maintenance-platform && npm run app:install" >&2
    }
    exit 1
  fi
  printf '%s\n' "$root"
}
