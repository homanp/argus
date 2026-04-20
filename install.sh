#!/usr/bin/env sh
#
# Argus CLI installer
# -------------------
# curl -fsSL https://argus.dev/install | bash
# curl -fsSL https://github.com/homanp/argus/releases/latest/download/install.sh | bash
#
# Env overrides:
#   ARGUS_VERSION   pin a specific tag, e.g. cli-v0.1.0 (defaults to latest)
#   ARGUS_BIN_DIR   install destination for the binary (default: $HOME/.argus/bin)
#   ARGUS_REPO      GitHub repo in owner/name form (default: homanp/argus)

set -eu

REPO="${ARGUS_REPO:-homanp/argus}"
BIN_DIR="${ARGUS_BIN_DIR:-$HOME/.argus/bin}"

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
  die "curl or wget is required to install the Argus CLI."
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

TAG="${ARGUS_VERSION:-}"
if [ -z "$TAG" ]; then
  # Parse the tag of the latest GitHub release. Keep the dependency surface
  # small — no jq assumed. The `tag_name` field appears on the first line
  # containing it in the response.
  API_URL="https://api.github.com/repos/${REPO}/releases/latest"
  TAG=$($DL "$API_URL" | grep -m1 '"tag_name":' | cut -d '"' -f 4 || true)
  if [ -z "$TAG" ]; then
    die "could not resolve latest release tag from ${API_URL}. Set ARGUS_VERSION to pin a version."
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

# Download the tarball.
if have curl; then
  curl -fSL --progress-bar "$URL" -o "$TMP/$ARCHIVE"
else
  wget -O "$TMP/$ARCHIVE" "$URL"
fi

# Best-effort SHA256 verification. Skipped silently if neither shasum nor
# sha256sum is available — this is a public release URL over HTTPS.
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
