export function safeAuthNextPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return "/#login";
  }

  return value;
}
