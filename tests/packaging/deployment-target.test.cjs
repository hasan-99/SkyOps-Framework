'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isDeploymentCommand, validateDeploymentTarget } = require('../../framework/deployment-target.cjs');
const context = { project_id: 'test-project', workspace_id: 'test-workspace', application_supabase_ref: 'test-app-ref', framework_supabase_ref: 'test-framework-ref', repository: 'fixture/project' };

test('target checking covers local delivery entry points for both shells', () => {
  for (const command of ['supabase db push', 'npx supabase functions deploy api', 'gh release create v1', 'gh workflow run deploy.yml', 'skyops deploy', 'npm test && gh release create v1', '$env:MODE="release"; supabase functions deploy api']) assert.equal(isDeploymentCommand(command), true, command);
  assert.equal(isDeploymentCommand('npm run build'), false);
});

test('unconfigured projects cannot perform a remote deployment', () => {
  assert.equal(validateDeploymentTarget('supabase db push', null).allowed, false);
  assert.equal(validateDeploymentTarget('npm run build', null).allowed, true);
});

test('the selected application target must match and cannot be the framework database', () => {
  assert.equal(validateDeploymentTarget('supabase functions deploy api --project-ref test-app-ref', context).allowed, true);
  assert.equal(validateDeploymentTarget('supabase functions deploy api --project-ref wrong-ref', context).allowed, false);
  assert.equal(validateDeploymentTarget('supabase functions deploy api --project-ref test-framework-ref', { ...context, application_supabase_ref: 'test-framework-ref' }).reason, 'FRAMEWORK_AND_APPLICATION_PROJECTS_MUST_BE_SEPARATE');
  assert.equal(validateDeploymentTarget('supabase db push', { ...context, linked_supabase_ref: 'test-app-ref' }).allowed, true);
});

test('a different repository and destructive remote reset are blocked', () => {
  assert.equal(validateDeploymentTarget('gh release create v1 --repo=someone/else', context).allowed, false);
  assert.equal(validateDeploymentTarget('gh release create v1 -R someone/else', context).allowed, false);
  assert.equal(validateDeploymentTarget('gh release create v1 --repo fixture/project', context).allowed, true);
  assert.equal(validateDeploymentTarget('supabase db reset --linked', { ...context, linked_supabase_ref: 'test-app-ref' }).allowed, false);
  assert.equal(validateDeploymentTarget('supabase db push --db-url postgres://other-host/db', { ...context, linked_supabase_ref: 'test-app-ref' }).allowed, false);
  assert.equal(validateDeploymentTarget('gh release create v1 --repo fixture/project; gh release create v1 -R someone/else', context).allowed, false);
});
