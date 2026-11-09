import test from 'node:test'; import assert from 'node:assert/strict';
import { canReadClientRecord,isAdminRole,isProjectStatus,signupRole,superAdminRoleForEmail,isSuperAdminEmail,ROLES } from '../lib/permissions.js';
test('only admin roles receive administrative permissions',()=>{assert.equal(isAdminRole(ROLES.SUPER_ADMIN),true);assert.equal(isAdminRole(ROLES.ADMIN),true);assert.equal(isAdminRole(ROLES.CLIENT),false);});
test('clients can read only their own records',()=>{assert.equal(canReadClientRecord({id:'a',role:'client'},'a'),true);assert.equal(canReadClientRecord({id:'a',role:'client'},'b'),false);assert.equal(canReadClientRecord({id:'x',role:'admin'},'b'),true);assert.equal(canReadClientRecord(null,'a'),false);});
test('public signup cannot choose admin role',()=>assert.equal(signupRole({role:'admin'}),'client'));
test('project status is allow-listed',()=>{assert.equal(isProjectStatus('in_progress'),true);assert.equal(isProjectStatus('root'),false);});
test('only the two approved and verified emails receive super-admin role',()=>{
 assert.equal(superAdminRoleForEmail('bvshyam7777@gmail.com',true),ROLES.SUPER_ADMIN);
 assert.equal(superAdminRoleForEmail('SAICHARAN8825@gmail.com',true),ROLES.SUPER_ADMIN);
 assert.equal(superAdminRoleForEmail('bvshyam7777@gmail.com',false),null);
 assert.equal(superAdminRoleForEmail('other@example.com',true),null);
 assert.equal(superAdminRoleForEmail('saicharan8825@gmail.com',false),null);
 assert.equal(isSuperAdminEmail(' BVSHYAM7777@gmail.com '),true);
 assert.equal(isSuperAdminEmail('other@example.com'),false);
});
