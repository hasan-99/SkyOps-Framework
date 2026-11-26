#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const policy = require('../framework/license-policy.json');
const root = path.resolve(__dirname, '..');
const audit = path.join(root, 'docs/audit');
const read = (name) => JSON.parse(fs.readFileSync(path.join(audit, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(audit, name), JSON.stringify(value, null, 2) + '\n');
const evidence = 'docs/audit/phase-2-packaging-verification.json';
const receipt = read('phase-2-packaging-verification.json');
if (!receipt.ok || !receipt.command.includes('tests/packaging/licensing.test.cjs')) throw new Error('LICENSING_LOCAL_TEST_EVIDENCE_REQUIRED');
write('licensing-decisions.json', {
  schema_version: 1, authority: 'SKYOPS_TRANSFORMATION_PLAN.md#31-approved-owner-controlled-licensing-and-secure-distribution',
  source: 'User-approved scope addition and explicit answers in this conversation on 26 November 2026',
  decisions: { default_device_limit: policy.default_device_limit, default_offline_validity_seconds: policy.default_offline_validity_seconds, public_registration: false, invitation_only: true, installation_requires_framework_owner_approval: true, individual_accounts_and_licenses: true, source_repository_access_required_for_ordinary_users: false },
  offline_acknowledgment: 'The user finalized a hard maximum 24-hour signed window, online validation at every online startup, automatic active-session revalidation/legitimate renewal and online validation after expiry. Previously issued disconnected leases cannot be instantly revoked. Export/recovery/uninstall remain available.',
  superseded_decisions: [{ default_offline_validity_seconds: 604800, status: 'superseded_by_user_finalized_24_hour_maximum' }],
  runtime_validation: { every_online_startup: true, automatic_active_session_revalidation: true, automatic_valid_lease_renewal: true, maximum_offline_seconds: 86400 },
  safe_deprovisioning: { approved: true, explicit_installation_consent_required: true, fresh_signed_permanent_revocation_required: true, verified_owned_unchanged_components_only: true, uncertainty_or_outage_never_triggers_uninstall: true, user_data_and_unrelated_software_preserved: true },
  production_trust: 'not_configured', backend_authorization: 'pending_phase_4', live_distribution: 'pending_phase_6', scope_approval: 'approved', remaining_personalization_questions: [],
});
const additions = [
  ['owner-controlled-license-lifecycle', ['framework/license-policy.json', 'supabase/migrations/', 'supabase/functions/'], 'pending', ['Supabase invitation/account/owner-approval/licensing lifecycle and isolation tests remain pending']],
  ['license-device-activation', ['supabase/migrations/', 'supabase/functions/'], 'pending', ['Transactional device quota, proof-of-possession, activation/deactivation and race tests remain pending']],
  ['signed-release-and-installation-verification', ['framework/signed-claims.cjs', 'framework/install-authorization.cjs', 'framework/package-store.cjs'], 'in_progress', ['Production pinned trust, bootstrap/rotation/revocation, server-issued grants and native release integration remain pending']],
  ['authorized-package-distribution', ['supabase/functions/', '.github/workflows/', 'framework/package-store.cjs'], 'pending', ['Private Storage, authenticated grant issuance, repository-free user delivery and live integration remain pending']],
  ['signed-offline-license', ['framework/signed-claims.cjs', 'framework/license-policy.json'], 'in_progress', ['Server lease issuance, protected device/session storage, trusted policy/floor integration and offline reconnect acceptance remain pending']],
  ['license-cli-administration', ['bin/skyops.cjs', 'supabase/functions/'], 'in_progress', ['Only read-only license policy command exists; authenticated owner/user/device administration remains pending']],
  ['startup-session-license-validation', ['framework/license-runtime.cjs', 'framework/signed-claims.cjs'], 'in_progress', ['Authenticated Supabase validation/refresh transport, startup/session controller and protected disabled-state persistence remain pending']],
  ['consent-gated-safe-deprovisioning', ['framework/package-store.cjs', 'framework/license-runtime.cjs'], 'in_progress', ['Installation consent UX, protected persisted consent/state, server signed status issuance and native host shutdown integration remain pending']],
];
const parity = read('capability-parity.json');
for (const [id, files, status, issues] of additions) {
  let entry = parity.capabilities.find((item) => item.id === id);
  if (!entry) { entry = { id, category: 'new_requirement', classification: 'new_requirement', original_implementation: [] }; parity.capabilities.push(entry); }
  entry.new_implementation = files;
  entry.migration_status = status;
  entry.validation_status = 'not_run';
  entry.evidence = ['docs/audit/licensing-decisions.json'];
  entry.remaining_issues = issues;
  if (['signed-release-and-installation-verification', 'signed-offline-license', 'startup-session-license-validation', 'consent-gated-safe-deprovisioning'].includes(id)) {
    entry.evidence.push(evidence);
    entry.partial_validation = { status: 'passed', scope: 'Local cryptographic/negative contracts with ephemeral test keys, not a server authorization or full parity claim', evidence: [evidence] };
  }
}
write('capability-parity.json', parity);
const progress = read('progress.json');
progress.updated_at = new Date().toISOString();
progress.licensing = { approved: true, owner_confirmed_device_limit: 2, owner_confirmed_maximum_offline_hours: 24, every_online_startup_validation: true, automatic_active_session_validation_and_renewal: true, consent_gated_safe_deprovisioning: true, production_trust: 'not_configured', backend: 'pending_phase_4', evidence: ['docs/audit/licensing-decisions.json', evidence] };
progress.capability_inventory = { baseline_component_and_new_requirement_entries: 264, licensing_extension_entries: 8, current_total: parity.capabilities.length, note: 'Counts are inventory coverage, not verified functional parity' };
const phase = progress.phases.find((entry) => entry.phase === 2);
phase.evidence = [...new Set([...phase.evidence, 'docs/audit/licensing-decisions.json'])];
phase.remaining_issues = [...new Set([...phase.remaining_issues, 'Production signing trust/bootstrap and license-aware host integration', 'Phase 4 server authorization gates must pass before any ordinary-user production activation'])];
write('progress.json', progress);
console.log(JSON.stringify({ plan_section: 31, devices: 2, maximum_offline_hours: 24, capabilities: parity.capabilities.length, phase_2: phase.implementation_status, production_activation: 'not_available' }));
