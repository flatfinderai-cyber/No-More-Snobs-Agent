#!/usr/bin/env bash
set -euo pipefail

APP_NAME="No More Snobs"
REPO="flatfinderai-cyber/no-more-snobs-agent"
INSTALL_DIR_MAC="/Applications/No More Snobs.app"
INSTALL_DIR_LINUX="$HOME/.local/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}→${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}⚠${NC}  %s\n" "$*"; }
error() { printf "${RED}✗${NC}  %s\n" "$*" >&2; exit 1; }

detect_os() {
  case "$(uname -s)" in
    Darwin)  echo "macos" ;;
    Linux)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) error "Unsupported operating system: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) echo "x64" ;;
  esac
}

check_command() {
  command -v "$1" &>/dev/null
}

get_latest_version() {
  if check_command curl; then
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' \
      | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/'
  elif check_command wget; then
    wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' \
      | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/'
  else
    error "Neither curl nor wget found. Please install one and try again."
  fi
}

download_file() {
  local url="$1"
  local dest="$2"
  info "Downloading from GitHub releases…"
  if check_command curl; then
    curl -fsSL -o "$dest" "$url"
  elif check_command wget; then
    wget -q -O "$dest" "$url"
  else
    error "Neither curl nor wget found."
  fi
}

install_macos() {
  local version="$1"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local dmg_file="${tmp_dir}/NoMoreSnobs.dmg"

  # Try universal first, fall back to x64
  local arch
  arch="$(detect_arch)"
  local dmg_name
  if [[ "$arch" == "arm64" ]]; then
    dmg_name="No.More.Snobs_${version}_universal.dmg"
  else
    dmg_name="No.More.Snobs_${version}_x64.dmg"
  fi

  local url="https://github.com/${REPO}/releases/download/${version}/${dmg_name}"
  download_file "$url" "$dmg_file"

  info "Mounting installer…"
  local mount_point
  mount_point="$(hdiutil attach "$dmg_file" -nobrowse -quiet | awk 'END{print $NF}')"

  info "Installing No More Snobs…"
  if [[ -d "$INSTALL_DIR_MAC" ]]; then
    rm -rf "$INSTALL_DIR_MAC"
  fi
  cp -R "${mount_point}/No More Snobs.app" /Applications/

  hdiutil detach "$mount_point" -quiet
  rm -rf "$tmp_dir"

  info "Done! No More Snobs has been installed to /Applications."
  info "Double-click the app icon to open it."

  # Set up launch agent for auto-start (optional)
  setup_launchd
}

setup_launchd() {
  local plist_dir="$HOME/Library/LaunchAgents"
  local plist_file="${plist_dir}/com.nomoresnobs.app.plist"

  mkdir -p "$plist_dir"
  cat > "$plist_file" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nomoresnobs.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/No More Snobs.app/Contents/MacOS/no-more-snobs</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <dict>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>/tmp/no-more-snobs.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/no-more-snobs.err</string>
</dict>
</plist>
EOF
}

install_linux() {
  local version="$1"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local appimage_file="${tmp_dir}/NoMoreSnobs.AppImage"

  local appimage_name="no-more-snobs_${version}_amd64.AppImage"
  local url="https://github.com/${REPO}/releases/download/${version}/${appimage_name}"
  download_file "$url" "$appimage_file"

  chmod +x "$appimage_file"

  mkdir -p "$INSTALL_DIR_LINUX"
  local install_path="${INSTALL_DIR_LINUX}/no-more-snobs"
  mv "$appimage_file" "$install_path"
  rm -rf "$tmp_dir"

  # Create desktop entry
  local desktop_dir="$HOME/.local/share/applications"
  mkdir -p "$desktop_dir"
  cat > "${desktop_dir}/no-more-snobs.desktop" <<EOF
[Desktop Entry]
Name=No More Snobs
Comment=One person's answer to pretentious, overly convoluted waste of time.
Exec=${install_path}
Icon=no-more-snobs
Terminal=false
Type=Application
Categories=Utility;Productivity;
EOF

  # Set up systemd user service for auto-restart
  setup_systemd "$install_path"

  info "Done! No More Snobs is installed at ${install_path}"
  info "You can launch it from your application menu or run: no-more-snobs"
}

setup_systemd() {
  local exec_path="$1"
  local service_dir="$HOME/.config/systemd/user"
  mkdir -p "$service_dir"

  cat > "${service_dir}/no-more-snobs.service" <<EOF
[Unit]
Description=No More Snobs
After=graphical-session.target

[Service]
ExecStart=${exec_path}
Restart=on-failure
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
EOF

  if check_command systemctl; then
    systemctl --user daemon-reload 2>/dev/null || true
  fi
}

install_windows() {
  warn "Windows installation requires downloading the installer manually."
  local version="$1"
  local url="https://github.com/${REPO}/releases/download/${version}/No-More-Snobs_${version}_x64-setup.exe"
  info "Download the installer from:"
  printf "\n  %s\n\n" "$url"
  info "Run it and follow the on-screen steps. That's it."
}

main() {
  printf "\n"
  printf "  ╔══════════════════════════════════════╗\n"
  printf "  ║         No More Snobs                ║\n"
  printf "  ║  Installing your factory…            ║\n"
  printf "  ╚══════════════════════════════════════╝\n\n"

  local os
  os="$(detect_os)"

  info "Checking for the latest version…"
  local version
  version="$(get_latest_version)"

  if [[ -z "$version" ]]; then
    error "Couldn't find a release. Please check your internet connection and try again."
  fi

  info "Installing version ${version} for ${os}…"

  case "$os" in
    macos)   install_macos "$version" ;;
    linux)   install_linux "$version" ;;
    windows) install_windows "$version" ;;
  esac

  printf "\n"
  printf "  ┌──────────────────────────────────────┐\n"
  printf "  │  No More Snobs is ready.             │\n"
  printf "  │                                      │\n"
  printf "  │  Open the app, paste your key,       │\n"
  printf "  │  type your goal, press Start.        │\n"
  printf "  │                                      │\n"
  printf "  │  That's it. Genuinely.               │\n"
  printf "  └──────────────────────────────────────┘\n\n"
}

main "$@"
