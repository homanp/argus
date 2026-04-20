#!/usr/bin/env sh
#
# Argus CLI installer
# -------------------
# curl -fsSL https://raw.githubusercontent.com/homanp/argus/main/install.sh | bash
#
# By default this installer builds the `argus` CLI from source by cloning the
# repo and running `cargo build --release`. Once signed release assets exist,
# setting ARGUS_VERSION=cli-vX.Y.Z (or ARGUS_RELEASE=1 for the latest tag) will
# switch to downloading the prebuilt tarball instead.
#
# Env overrides:
#   ARGUS_VERSION   pin a specific release tag, e.g. cli-v0.1.0 (enables the
#                   prebuilt tarball path — requires a GitHub release to exist)
#   ARGUS_RELEASE   set to 1 to auto-resolve the latest release tag instead of
#                   building from source
#   ARGUS_REF       git ref to build from when compiling from source
#                   (default: main)
#   ARGUS_BIN_DIR   install destination for the binary (default: $HOME/.argus/bin)
#   ARGUS_SRC_DIR   clone destination when building from source
#                   (default: $HOME/.argus/src)
#   ARGUS_REPO      GitHub repo in owner/name form (default: homanp/argus)

set -eu

REPO="${ARGUS_REPO:-homanp/argus}"
BIN_DIR="${ARGUS_BIN_DIR:-$HOME/.argus/bin}"
SRC_DIR="${ARGUS_SRC_DIR:-$HOME/.argus/src}"
REF="${ARGUS_REF:-main}"

die() {
  printf 'argus install: %s\n' "$1" >&2
  exit 1
}

have() { command -v "$1" >/dev/null 2>&1; }

if have curl; then
  DL="curl -fsSL"
elif have wget; then
  DL="wget -qO-"
else
  DL=""
fi

OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64|aarch64) TRIPLE="aarch64-apple-darwin" ;;
      x86_64)        TRIPLE="x86_64-apple-darwin" ;;
      *)             die "unsupported macOS architecture: $ARCH" ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64)  TRIPLE="x86_64-unknown-linux-gnu" ;;
      aarch64|arm64) TRIPLE="aarch64-unknown-linux-gnu" ;;
      *)             die "unsupported Linux architecture: $ARCH" ;;
    esac
    ;;
  *)
    die "unsupported OS: $OS. Only macOS and Linux are supported via install.sh."
    ;;
esac

# ── Release-asset path (requires an existing GitHub release) ────────────────

install_from_release() {
  [ -n "$DL" ] || die "curl or wget is required to download release assets."

  TAG="${ARGUS_VERSION:-}"
  if [ -z "$TAG" ]; then
    API_URL="https://api.github.com/repos/${REPO}/releases/latest"
    TAG=$($DL "$API_URL" | grep -m1 '"tag_name":' | cut -d '"' -f 4 || true)
    if [ -z "$TAG" ]; then
      die "could not resolve latest release tag from ${API_URL}. Set ARGUS_VERSION to pin a version, or unset ARGUS_RELEASE to build from source."
    fi
  fi

  case "$TAG" in
    cli-v*) ;;
    *) die "expected tag to start with 'cli-v', got '$TAG'." ;;
  esac

  VERSION="${TAG#cli-v}"
  ARCHIVE="argus-${VERSION}-${TRIPLE}.tar.gz"
  URL="https://github.com/${REPO}/releases/download/${TAG}/${ARCHIVE}"
  SHASUMS_URL="https://github.com/${REPO}/releases/download/${TAG}/SHASUMS256.txt"

  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT

  printf 'Installing argus %s for %s → %s\n' "$TAG" "$TRIPLE" "$BIN_DIR"

  if have curl; then
    curl -fSL --progress-bar "$URL" -o "$TMP/$ARCHIVE"
  else
    wget -O "$TMP/$ARCHIVE" "$URL"
  fi

  if $DL "$SHASUMS_URL" > "$TMP/SHASUMS256.txt" 2>/dev/null; then
    if have shasum; then
      HASHER="shasum -a 256"
    elif have sha256sum; then
      HASHER="sha256sum"
    else
      HASHER=""
    fi

    if [ -n "$HASHER" ]; then
      EXPECTED=$(grep " $ARCHIVE\$" "$TMP/SHASUMS256.txt" | awk '{print $1}')
      if [ -n "$EXPECTED" ]; then
        ACTUAL=$(cd "$TMP" && $HASHER "$ARCHIVE" | awk '{print $1}')
        if [ "$EXPECTED" != "$ACTUAL" ]; then
          die "SHA256 mismatch for $ARCHIVE (expected $EXPECTED, got $ACTUAL)."
        fi
        printf 'SHA256 verified.\n'
      fi
    fi
  fi

  mkdir -p "$BIN_DIR"
  tar -xzf "$TMP/$ARCHIVE" -C "$BIN_DIR"
  chmod +x "$BIN_DIR/argus"
}

# ── Source-build path (default until releases exist) ────────────────────────

install_from_source() {
  have git   || die "git is required to build argus from source."
  have cargo || die "cargo (rustc) is required to build argus from source. Install via https://rustup.rs/."

  printf 'Building argus from source (%s@%s)\n' "$REPO" "$REF"
  mkdir -p "$SRC_DIR"

  CLONE_URL="https://github.com/${REPO}.git"

  if [ -d "$SRC_DIR/.git" ]; then
    git -C "$SRC_DIR" remote set-url origin "$CLONE_URL"
    git -C "$SRC_DIR" fetch --depth 1 origin "$REF"
    git -C "$SRC_DIR" checkout -q FETCH_HEAD
  else
    # Clean out anything stale (e.g. a partial previous run) before cloning.
    rm -rf "$SRC_DIR"
    git clone --depth 1 --branch "$REF" "$CLONE_URL" "$SRC_DIR" \
      || git clone --depth 1 "$CLONE_URL" "$SRC_DIR"
    # --branch only works for branch/tag names; fall back and hard-reset to
    # the requested ref if needed (supports commit SHAs via ARGUS_REF).
    if [ "$REF" != "main" ] && [ -d "$SRC_DIR/.git" ]; then
      git -C "$SRC_DIR" fetch --depth 1 origin "$REF" 2>/dev/null || true
      git -C "$SRC_DIR" checkout -q FETCH_HEAD 2>/dev/null || true
    fi
  fi

  cargo build --release --manifest-path "$SRC_DIR/cli/Cargo.toml"

  mkdir -p "$BIN_DIR"
  cp "$SRC_DIR/cli/target/release/argus" "$BIN_DIR/argus"
  chmod +x "$BIN_DIR/argus"
}

# ── Dispatch ────────────────────────────────────────────────────────────────

if [ -n "${ARGUS_VERSION:-}" ] || [ "${ARGUS_RELEASE:-}" = "1" ]; then
  install_from_release
else
  install_from_source
fi

printf '\nInstalled argus → %s/argus\n' "$BIN_DIR"
"$BIN_DIR/argus" --version || true

case ":$PATH:" in
  *":$BIN_DIR:"*)
    printf '\nargus is on your PATH. Run `argus doctor` to verify your relay is reachable.\n'
    ;;
  *)
    printf '\nAdd %s to your PATH to use argus from anywhere:\n' "$BIN_DIR"
    printf '\n  export PATH="%s:$PATH"\n\n' "$BIN_DIR"
    printf 'Append that line to ~/.bashrc, ~/.zshrc, ~/.profile, or your shell rc of choice.\n'
    ;;
esac
