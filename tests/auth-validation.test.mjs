import test from "node:test";
import assert from "node:assert/strict";
import { validateSignupInput, validateLoginInput } from "../lib/auth-validation.js";

test("signup accepts valid account details", () => {
  assert.equal(validateSignupInput({ name: "Shyam", email: "shyam@example.com", password: "secure-pass-1" }), null);
});
test("signup rejects blank names", () => {
  assert.match(validateSignupInput({ name: "  ", email: "shyam@example.com", password: "secure-pass-1" }), /name/i);
});
test("signup rejects malformed email addresses", () => {
  assert.match(validateSignupInput({ name: "Shyam", email: "not-an-email", password: "secure-pass-1" }), /email/i);
});
test("signup enforces the eight-character minimum", () => {
  assert.match(validateSignupInput({ name: "Shyam", email: "shyam@example.com", password: "short" }), /8 characters/i);
});
test("signup rejects passwords longer than 128 characters", () => {
  assert.match(validateSignupInput({ name: "Shyam", email: "shyam@example.com", password: "x".repeat(129) }), /128 characters/i);
});
test("login accepts valid credentials", () => {
  assert.equal(validateLoginInput({ email: "shyam@example.com", password: "secure-pass-1" }), null);
});
test("login rejects malformed email addresses", () => {
  assert.match(validateLoginInput({ email: "invalid", password: "secure-pass-1" }), /email/i);
});
