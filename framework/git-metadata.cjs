'use strict';

// Reports must not synchronize credentials embedded in a Git remote URL.
// Local filesystem remotes are omitted rather than exposing a user's paths.
function safeRemote(value) {
  if (typeof value !== 'string' || /[\x00-\x20\x7f]/.test(value)) return '';
  try {
    if (/^(?:https?|ssh|git):\/\//i.test(value)) {
      const remote = new URL(value);
      if (!remote.hostname || !remote.pathname || remote.pathname === '/') return '';
      remote.username = '';
      remote.password = '';
      remote.search = '';
      remote.hash = '';
      return remote.href;
    }
    const scp = /^(?:[^@/:]+@)?([a-z0-9.-]+):([^?#]+)(?:[?#].*)?$/i.exec(value);
    if (scp && scp[1].includes('.') && !/^[a-z]:/i.test(value)) return `${scp[1]}:${scp[2]}`;
  } catch { /* Invalid remote metadata must never fall back to the raw value. */ }
  return '';
}

module.exports = { safeRemote };
