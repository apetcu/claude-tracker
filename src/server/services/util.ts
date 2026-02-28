export function humanizeName(dirName: string): string {
  const parts = dirName.split("-");
  const idx = parts.lastIndexOf("Projects");
  if (idx >= 0 && idx + 1 < parts.length) {
    return parts.slice(idx + 1).join("-");
  }
  return parts.slice(-2).join("-");
}
