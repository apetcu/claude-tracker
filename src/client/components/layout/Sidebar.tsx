import { NavLink } from "react-router-dom";
import { useApi } from "../../hooks/useApi";

interface ProjectSummary {
  id: string;
  name: string;
  sessionCount: number;
  lastActive: string;
}

export function Sidebar() {
  const { data: projects } = useApi<ProjectSummary[]>("/api/projects");

  return (
    <aside className="w-64 bg-surface-secondary border-r border-border flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border">
        <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <span className="text-accent">&#9673;</span> Claude Tracker
        </NavLink>
      </div>

      <nav className="p-2 border-b border-border">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `block px-3 py-2 rounded-md text-sm ${isActive ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary"}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/activity"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-md text-sm ${isActive ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary"}`
          }
        >
          Activity Feed
        </NavLink>
      </nav>

      <div className="flex-1 overflow-auto p-2">
        <div className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
          Projects ({projects?.length ?? 0})
        </div>
        {projects?.map((p) => (
          <NavLink
            key={p.id}
            to={`/projects/${p.id}`}
            className={({ isActive }) =>
              `block px-3 py-1.5 rounded-md text-sm truncate ${isActive ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary"}`
            }
            title={p.name}
          >
            {p.name}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
