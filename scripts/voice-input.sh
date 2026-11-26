#!/bin/bash
# Voice-to-text: Record mic → ElevenLabs STT → paste into focused app
# Usage: Bind to a hotkey. Press once to start recording, press again to stop & transcribe.
# Requires: arecord, curl, wl-copy, wtype, notify-send
# Requires: SKYOPS_ELEVENLABS_API_KEY env var

set -euo pipefail

SKYOPS_ELEVENLABS_API_KEY="${SKYOPS_ELEVENLABS_API_KEY:-}"
if [[ ! "$SKYOPS_ELEVENLABS_API_KEY" =~ ^[A-Za-z0-9_-]+$ ]]; then
    printf '%s\n' 'Configure SKYOPS_ELEVENLABS_API_KEY securely before enabling voice input.' >&2
    exit 1
fi
LOCKFILE="/tmp/voice-input.lock"
AUDIO_FILE="/tmp/voice-input.wav"

# Toggle: if already recording, stop; otherwise start
if [ -f "$LOCKFILE" ]; then
    # === STOP RECORDING ===
    PID=$(cat "$LOCKFILE")
    kill "$PID" 2>/dev/null || true
    rm -f "$LOCKFILE"

    notify-send -t 2000 "Voice Input" "Transcribing..."

    # Send to ElevenLabs STT
    RESPONSE=$(printf 'header = "xi-api-key: %s"\n' "$SKYOPS_ELEVENLABS_API_KEY" | curl --config - -s --max-time 30 -X POST "https://api.elevenlabs.io/v1/speech-to-text" \
        -F "file=@$AUDIO_FILE" \
        -F "model_id=scribe_v1")

    # Extract text from JSON response
    TEXT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('text',''))" 2>/dev/null || echo "")

    rm -f "$AUDIO_FILE"

    if [ -z "$TEXT" ]; then
        notify-send -t 3000 "Voice Input" "No speech detected"
        exit 0
    fi

    # Copy to clipboard and paste via wtype (Wayland-native, no daemon needed)
    echo -n "$TEXT" | wl-copy
    sleep 0.1
    wtype -M ctrl v -m ctrl

    notify-send -t 2000 "Voice Input" "$TEXT"
else
    # === START RECORDING ===
    notify-send -t 2000 "Voice Input" "Recording... Press hotkey again to stop"

    # Record from USB mic (card 1), 16kHz mono WAV (optimal for STT)
    arecord -D plughw:1,0 -f S16_LE -r 16000 -c 1 "$AUDIO_FILE" &
    echo $! > "$LOCKFILE"
fi
