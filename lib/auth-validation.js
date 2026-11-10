export function validateSignupInput(input) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (!name || name.length > 100) return "Enter your name (up to 100 characters).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return "Enter a valid email address.";
  if (password.length < 8) return "Use a password of at least 8 characters.";
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  return null;
}

export function validateLoginInput(input) {
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return "Enter a valid email address.";
  if (!password || password.length > 128) return "Enter your password.";
  return null;
}
