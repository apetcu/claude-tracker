import { useLocation } from "react-router-dom";

export function Header() {
  const location = useLocation();

  const title = (() => {
    if (location.pathname === "/") return "Dashboard";
    if (location.pathname === "/activity") return "Activity Feed";
    if (location.pathname.startsWith("/projects/")) return "Project Detail";
    if (location.pathname.startsWith("/sessions/")) return "Session Detail";
    return "Claude Tracker";
  })();

  return (
    <header className="h-14 border-b border-border bg-surface-secondary flex items-center px-6 shrink-0">
      <h1 className="text-sm font-medium text-text-primary">{title}</h1>
    </header>
  );
}
