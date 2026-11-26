'use strict';

function isDeploymentCommand(command) {
  return /(?:^|[;&|]\s*|\s)(?:npx\s+)?(?:supabase\s+(?:db\s+(?:push|reset)|functions\s+deploy|link)|gh\s+(?:release\s+create|workflow\s+run)|skyops\s+(?:deploy|publish))\b/i.test(command || '');
}

function flag(command, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\s)--${escaped}(?:=|\\s+)(?:"([^"\\r\\n]+)"|'([^'\\r\\n]+)'|([^\\s;&|]+))`, 'i').exec(command);
  return match ? match[1] || match[2] || match[3] : null;
}

function validateDeploymentTarget(command, context) {
  if (!isDeploymentCommand(command)) return { allowed: true, scope: 'not_a_deployment_command' };
  if (/[;&|`\r\n]|\$\(|\b(?:GH_REPO|GH_HOST|SUPABASE_DB_URL)\s*=/.test(command)) return { allowed: false, reason: 'COMPOUND_OR_OVERRIDDEN_DEPLOYMENT_REQUIRES_SEPARATE_STEPS' };
  if (!context || !context.project_id || !context.workspace_id) return { allowed: false, reason: 'SELECT_AUTHORIZED_WORKSPACE_AND_PROJECT' };
  if (/\bsupabase\s+/i.test(command)) {
    if (/--db-url(?:=|\s)/i.test(command)) return { allowed: false, reason: 'DIRECT_DATABASE_URL_CANNOT_BYPASS_SELECTED_TARGET' };
    const actual = flag(command, 'project-ref') || context.linked_supabase_ref;
    if (!context.application_supabase_ref || !actual || actual !== context.application_supabase_ref) return { allowed: false, reason: 'APPLICATION_SUPABASE_TARGET_MISMATCH' };
    if (actual === context.framework_supabase_ref) return { allowed: false, reason: 'FRAMEWORK_AND_APPLICATION_PROJECTS_MUST_BE_SEPARATE' };
    if (/\bdb\s+reset\b/i.test(command) && /--linked\b|--db-url\b/i.test(command)) return { allowed: false, reason: 'REMOTE_DATABASE_RESET_REQUIRES_SEPARATE_AUTHORIZATION' };
  }
  if (/\bgh\s+/i.test(command)) {
    const shortRepo = /(?:^|\s)-R(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/.exec(command);
    const actual = flag(command, 'repo') || (shortRepo ? shortRepo[1] || shortRepo[2] || shortRepo[3] : null) || context.repository;
    if (!context.repository || actual !== context.repository) return { allowed: false, reason: 'GITHUB_REPOSITORY_TARGET_MISMATCH' };
  }
  return { allowed: true, scope: 'declared_project_target', limitation: 'Local target consistency only; server/provider authorization and mandatory quality gates still apply' };
}

module.exports = { isDeploymentCommand, validateDeploymentTarget };
