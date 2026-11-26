#!/usr/bin/env bash
# Optional Pop!_OS/Ubuntu development tools. Preview by default.
# This is not the SkyOps installer and cannot authorize a framework license.
set -euo pipefail

APPLY=0
PROJECT=""
COMPONENTS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --project) shift; PROJECT="${1:?--project requires an absolute project path}" ;;
    --system-packages|--node|--native-tools|--browser|--editor|--terminal|--voice|--python-tools|--optional-modal|--application-tools|--docker|--git-local) COMPONENTS+=("${1#--}") ;;
    --help)
      printf '%s\n' 'Optional isolated Linux development setup.' \
        'Preview: bootstrap-pop-os.sh --node --native-tools' \
        'Apply: add --apply and only the desired component flags.' \
        'Components: --system-packages --node --native-tools --browser --editor --terminal --voice --python-tools --optional-modal --application-tools --docker --git-local' \
        '--git-local requires --project <absolute application repository>.' \
        'No global git/editor/model/shell profile is rewritten. Native hosts must be launched through the licensed isolated SkyOps profile.'
      exit 0 ;;
    *) printf '%s\n' "Unknown bootstrap option: $1" >&2; exit 2 ;;
  esac
  shift
done
if [ "${#COMPONENTS[@]}" -eq 0 ]; then
  printf '%s\n' 'Select optional setup components; use --help. Nothing changed.'
  exit 0
fi
printf 'Requested optional components: %s\n' "${COMPONENTS[*]}"
if [ "$APPLY" -ne 1 ]; then
  printf '%s\n' 'Preview only. Add --apply to perform the selected setup. No files, accounts or system settings changed.'
  exit 0
fi
if [ "$(uname -s)" != Linux ]; then
  printf '%s\n' 'This optional OS helper supports Linux only. Use the cross-platform framework installer for normal installation.' >&2
  exit 1
fi
BOOTSTRAP_ROOT="${SKYOPS_BOOTSTRAP_HOME:-$HOME/.local/share/skyops-framework-bootstrap}"
case "$BOOTSTRAP_ROOT" in /*) ;; *) printf '%s\n' 'SKYOPS_BOOTSTRAP_HOME must be absolute.' >&2; exit 1 ;; esac
case "$BOOTSTRAP_ROOT" in "$HOME"|/) printf '%s\n' 'Unsafe bootstrap directory.' >&2; exit 1 ;; esac
if [ -L "$BOOTSTRAP_ROOT" ]; then printf '%s\n' 'Linked bootstrap directories are refused.' >&2; exit 1; fi
if [ -e "$BOOTSTRAP_ROOT" ]; then
  if [ ! -f "$BOOTSTRAP_ROOT/.skyops-bootstrap-owned" ] || [ "$(cat "$BOOTSTRAP_ROOT/.skyops-bootstrap-owned")" != 'Nexus-AI SkyOps optional development tools v1' ]; then
    printf '%s\n' 'Refusing an existing unowned directory. Select a new dedicated bootstrap directory.' >&2
    exit 1
  fi
else
  mkdir -p -- "$BOOTSTRAP_ROOT"
  chmod 700 "$BOOTSTRAP_ROOT"
  (set -o noclobber; printf '%s\n' 'Nexus-AI SkyOps optional development tools v1' > "$BOOTSTRAP_ROOT/.skyops-bootstrap-owned")
fi
BOOTSTRAP_ROOT="$(cd "$BOOTSTRAP_ROOT" && pwd -P)"
owned_directory() {
  local current="$BOOTSTRAP_ROOT" part
  local relative="$1"
  IFS='/' read -r -a parts <<< "$relative"
  for part in "${parts[@]}"; do
    [[ "$part" != '.' && "$part" != '..' && -n "$part" ]] || { printf '%s\n' 'Unsafe component directory.' >&2; exit 1; }
    current="$current/$part"
    [ ! -L "$current" ] || { printf '%s\n' 'Linked optional tool directory refused.' >&2; exit 1; }
    mkdir -p -- "$current"
  done
}
owned_directory tools
owned_directory downloads
owned_directory config
export PATH="$BOOTSTRAP_ROOT/tools/node/bin:$BOOTSTRAP_ROOT/tools/npm/node_modules/.bin:$BOOTSTRAP_ROOT/tools/bin:$PATH"

install_apt_package() {
  local package="$1"
  if ! apt-cache show "$package" >/dev/null 2>&1; then
    printf 'Package %s is unavailable in configured signed repositories. Configure the official vendor repository first; no unverified installer is run.\n' "$package" >&2
    return 1
  fi
  sudo apt-get install -y "$package"
}

for component in "${COMPONENTS[@]}"; do
  case "$component" in
    system-packages)
      sudo apt-get update
      sudo apt-get install -y git gh build-essential curl wget jq htop neovim vim tree pv inotify-tools ca-certificates gnupg lsb-release unzip zip tar xz-utils python3 python3-pip python3-venv pipx openssh-client rsync ffmpeg pavucontrol fonts-jetbrains-mono fonts-firacode fonts-noto fonts-noto-color-emoji fonts-font-awesome fonts-dejavu fonts-liberation
      ;;
    node)
      case "$(uname -m)" in x86_64) architecture=x64 ;; aarch64|arm64) architecture=arm64 ;; *) printf '%s\n' 'Unsupported Node binary architecture.' >&2; exit 1 ;; esac
      download="$(mktemp -d "$BOOTSTRAP_ROOT/downloads/node.XXXXXX")"
      curl --fail --silent --show-error --proto '=https' --tlsv1.2 https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o "$download/SHASUMS256.txt"
      archive="$(awk -v suffix="-linux-$architecture.tar.xz" '$2 ~ suffix "$" { print $2 }' "$download/SHASUMS256.txt")"
      if [[ ! "$archive" =~ ^node-v22\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]]; then printf '%s\n' 'Unexpected Node release metadata.' >&2; exit 1; fi
      curl --fail --silent --show-error --proto '=https' --tlsv1.2 "https://nodejs.org/dist/latest-v22.x/$archive" -o "$download/$archive"
      (cd "$download"; grep "  $archive$" SHASUMS256.txt | sha256sum --check --status)
      release="${archive%.tar.xz}"
      if [ -e "$BOOTSTRAP_ROOT/tools/node" ] || [ -L "$BOOTSTRAP_ROOT/tools/node" ] || [ -e "$BOOTSTRAP_ROOT/tools/$release" ]; then
        printf '%s\n' 'Isolated Node already exists; use its owner-managed update mechanism. Existing tools were not overwritten.' >&2
        exit 1
      fi
      tar -xJf "$download/$archive" -C "$BOOTSTRAP_ROOT/tools" --no-same-owner
      mv -- "$BOOTSTRAP_ROOT/tools/$release" "$BOOTSTRAP_ROOT/tools/node"
      ;;
    native-tools|application-tools)
      command -v node >/dev/null && command -v npm >/dev/null || { printf '%s\n' 'Install supported Node/npm first (--node is optional).' >&2; exit 1; }
      node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || { printf '%s\n' 'Node 22 or later is required.' >&2; exit 1; }
      owned_directory tools/npm
      manifest="$BOOTSTRAP_ROOT/tools/npm/package.json"
      [ ! -L "$manifest" ] || { printf '%s\n' 'Linked optional tool manifest refused.' >&2; exit 1; }
      if [ ! -e "$manifest" ]; then
        (set -o noclobber; printf '%s\n' '{"name":"skyops-optional-dev-tools","private":true,"version":"0.0.0"}' > "$manifest")
      fi
      node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(p.private!==true||p.name!=="skyops-optional-dev-tools")process.exit(1)' "$manifest" || { printf '%s\n' 'Unexpected optional tool manifest; retained without changes.' >&2; exit 1; }
      if [ "$component" = native-tools ]; then
        npm install --prefix "$BOOTSTRAP_ROOT/tools/npm" --save @anthropic-ai/claude-code @openai/codex pnpm typescript typescript-language-server supabase
      else
        npm install --prefix "$BOOTSTRAP_ROOT/tools/npm" --save eas-cli expo-cli stripe md-to-pdf firecrawl-cli
      fi
      ;;
    browser) install_apt_package google-chrome-stable ;;
    editor) install_apt_package code ;;
    terminal)
      install_apt_package ghostty
      owned_directory config/ghostty
      terminal_config="$BOOTSTRAP_ROOT/config/ghostty/config"
      if [ -e "$terminal_config" ] || [ -L "$terminal_config" ]; then printf '%s\n' 'Existing isolated terminal configuration retained.'; continue; fi
      (set -o noclobber; cat > "$terminal_config" <<'GHOSTTY'
background = #0F172A
foreground = #F8FAFC
cursor-color = #06B6D4
selection-background = #2563EB
selection-foreground = #F8FAFC
font-family = JetBrains Mono
font-size = 14
font-thicken = true
adjust-cell-height = 4
window-padding-x = 12
window-padding-y = 8
window-decoration = auto
confirm-close-surface = true
window-save-state = always
window-inherit-working-directory = true
window-inherit-font-size = true
cursor-style = bar
cursor-style-blink = false
mouse-hide-while-typing = true
copy-on-select = clipboard
link-url = true
scrollback-limit = 100000
clipboard-paste-protection = true
clipboard-trim-trailing-spaces = true
shell-integration = detect
shell-integration-features = cursor,sudo,title
keybind = ctrl+shift+d=new_split:right
keybind = ctrl+shift+e=new_split:down
keybind = ctrl+shift+h=goto_split:left
keybind = ctrl+shift+l=goto_split:right
keybind = ctrl+shift+j=goto_split:bottom
keybind = ctrl+shift+k=goto_split:top
keybind = ctrl+shift+w=close_surface
keybind = ctrl+shift+t=new_tab
keybind = ctrl+shift+n=new_window
keybind = ctrl+1=goto_tab:1
keybind = ctrl+2=goto_tab:2
keybind = ctrl+3=goto_tab:3
keybind = ctrl+4=goto_tab:4
keybind = ctrl+5=goto_tab:5
keybind = ctrl+equal=increase_font_size:1
keybind = ctrl+minus=decrease_font_size:1
keybind = ctrl+0=reset_font_size
keybind = ctrl+shift+left=resize_split:left,20
keybind = ctrl+shift+right=resize_split:right,20
keybind = ctrl+shift+up=resize_split:up,20
keybind = ctrl+shift+down=resize_split:down,20
gtk-single-instance = true
bold-is-bright = true
GHOSTTY
      )
      printf 'Use the isolated configuration explicitly: ghostty --config-file=%q\n' "$terminal_config"
      ;;
    voice)
      owned_directory tools/voice-venv
      python3 -m venv "$BOOTSTRAP_ROOT/tools/voice-venv"
      "$BOOTSTRAP_ROOT/tools/voice-venv/bin/python" -m pip install elevenlabs requests httpx pydantic websockets evdev
      printf '%s\n' 'Voice is optional Linux/Wayland functionality. Configure hardware access and scoped provider secrets explicitly; no key is written into shell startup files.'
      ;;
    python-tools|optional-modal)
      owned_directory tools/pipx
      owned_directory tools/bin
      export PIPX_HOME="$BOOTSTRAP_ROOT/tools/pipx"
      export PIPX_BIN_DIR="$BOOTSTRAP_ROOT/tools/bin"
      if [ "$component" = python-tools ]; then pipx install poetry; else pipx install modal; fi
      ;;
    docker)
      install_apt_package docker.io
      install_apt_package docker-compose-v2
      printf '%s\n' 'Docker is for local development/testing. This helper does not add privileged group membership or alter firewall/SSH policy.'
      ;;
    git-local)
      [ -n "$PROJECT" ] && [[ "$PROJECT" = /* ]] && [ -d "$PROJECT" ] || { printf '%s\n' '--git-local requires an explicit absolute application repository.' >&2; exit 1; }
      selected="$(cd "$PROJECT" && pwd -P)"
      actual="$(git -C "$selected" rev-parse --show-toplevel)"
      [ "$selected" = "$actual" ] || { printf '%s\n' 'Select the application repository root explicitly.' >&2; exit 1; }
      if [ -n "${SKYOPS_GIT_NAME:-}" ]; then git -C "$selected" config --local user.name "$SKYOPS_GIT_NAME"; fi
      if [ -n "${SKYOPS_GIT_EMAIL:-}" ]; then git -C "$selected" config --local user.email "$SKYOPS_GIT_EMAIL"; fi
      git -C "$selected" config --local pull.rebase true
      git -C "$selected" config --local fetch.prune true
      git -C "$selected" config --local merge.conflictstyle diff3
      git -C "$selected" config --local diff.colorMoved zebra
      git -C "$selected" config --local alias.co checkout
      git -C "$selected" config --local alias.br branch
      git -C "$selected" config --local alias.ci commit
      git -C "$selected" config --local alias.st status
      git -C "$selected" config --local alias.unstage 'reset HEAD --'
      git -C "$selected" config --local alias.last 'log -1 HEAD'
      git -C "$selected" config --local alias.amend 'commit --amend --no-edit'
      git -C "$selected" config --local alias.lg 'log --oneline --graph --decorate -20'
      git -C "$selected" config --local alias.aa 'add --all'
      git -C "$selected" config --local alias.cm 'commit -m'
      ;;
  esac
  printf 'Completed selected component: %s\n' "$component"
done
printf '%s\n' 'Optional tools are prepared. No framework installation, activation, cloud project, global shell profile or existing framework configuration was changed.'
printf 'For a temporary tool PATH only: export PATH=%q:%q:%q:$PATH\n' "$BOOTSTRAP_ROOT/tools/node/bin" "$BOOTSTRAP_ROOT/tools/npm/node_modules/.bin" "$BOOTSTRAP_ROOT/tools/bin"
printf '%s\n' 'Use the official owner-authorized signed SkyOps installation/onboarding flow for framework access and isolated host sign-in.'
