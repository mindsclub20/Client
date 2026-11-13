export function safeAuthNextPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\\r\\n]/.test(value)
  ) {
    return "/#login";
  }

  return value;
}
