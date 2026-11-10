import test from 'node:test'; import assert from 'node:assert/strict';
import { text,email,money } from '../lib/validation.js';
test('text is trimmed and bounded',()=>{assert.equal(text(' hi '),'hi');assert.equal(text(' '),null);assert.equal(text('long',{max:2}),null);});
test('email is normalised and validated',()=>{assert.equal(email(' A@Example.com '),'a@example.com');assert.equal(email('bad'),null);});
test('email rejects whitespace and malformed addresses',()=>{for(const value of ['person name@example.com','person@@example.com','person@example','@example.com','person@.com','not-an-email'])assert.equal(email(value),null,value);});
test('money rejects invalid and negative values',()=>{assert.equal(money('1.239'),1.24);assert.equal(money('-1'),null);assert.equal(money('NaN'),null);});
