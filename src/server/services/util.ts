export function humanizeName(dirName: string, dir?: string): string {
  // If we have the actual directory path, use it (works for both sources)
  if (dir) {
    const parts = dir.split("/").filter(Boolean);
    if (parts.length === 0) return dirName;
    // Find "Projects" and return everything after
    const projIdx = parts.lastIndexOf("Projects");
    if (projIdx >= 0 && projIdx + 1 < parts.length) {
      return parts.slice(projIdx + 1).join("/");
    }
    // Fallback: last 2 path segments
    return parts.slice(-2).join("/");
  }

  // Legacy fallback: Claude format -Users-adrian-Projects-Personal-foo
  const parts = dirName.split("-");
  const idx = parts.lastIndexOf("Projects");
  if (idx >= 0 && idx + 1 < parts.length) {
    return parts.slice(idx + 1).join("/");
  }
  return parts.slice(-2).join("/");
}
