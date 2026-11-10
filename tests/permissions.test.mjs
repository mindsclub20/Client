import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadClientRecord, isAdminRole, isProjectStatus, signupRole, ROLES } from '../lib/permissions.js';

test('only admin roles receive administrative permissions', () => {
  assert.equal(isAdminRole(ROLES.SUPER_ADMIN), true);
  assert.equal(isAdminRole(ROLES.ADMIN), true);
  assert.equal(isAdminRole(ROLES.CLIENT), false);
});
test('clients can read only their own records', () => {
  assert.equal(canReadClientRecord({id:'a',role:'client'},'a'), true);
  assert.equal(canReadClientRecord({id:'a',role:'client'},'b'), false);
  assert.equal(canReadClientRecord({id:'x',role:'admin'},'b'), true);
  assert.equal(canReadClientRecord(null,'a'), false);
});
test('public signup cannot choose admin role', () => assert.equal(signupRole({role:'admin'}), 'client'));
test('project status is allow-listed', () => {
  assert.equal(isProjectStatus('in_progress'), true);
  assert.equal(isProjectStatus('root'), false);
});
