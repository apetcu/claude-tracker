import { NavLink } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { useState, useMemo } from "react";

interface ProjectSummary {
  id: string;
  name: string;
  sessionCount: number;
  lastActive: string;
  source?: "claude" | "cursor";
  sources?: ("claude" | "cursor")[];
}

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  project?: ProjectSummary;
}

function buildTree(projects: ProjectSummary[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };

  for (const p of projects) {
    const parts = p.name.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      if (!node.children.has(segment)) {
        node.children.set(segment, { name: segment, children: new Map() });
      }
      node = node.children.get(segment)!;
    }
    const leaf = parts[parts.length - 1];
    if (node.children.has(leaf)) {
      // Folder already exists as a group — attach project to it
      node.children.get(leaf)!.project = p;
    } else {
      node.children.set(leaf, { name: leaf, children: new Map(), project: p });
    }
  }

  return root;
}

function SourceIcon({ sources }: { sources?: string[] }) {
  if (!sources || sources.length === 0) return null;
  const hasClaude = sources.includes("claude");
  const hasCursor = sources.includes("cursor");

  if (hasClaude && hasCursor) {
    return (
      <span className="shrink-0 ml-auto flex items-center gap-0.5" title="Claude + Cursor">
        <svg className="w-3 h-3 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="8" cy="12" r="5" opacity="0.6" />
          <circle cx="16" cy="12" r="5" opacity="0.6" />
        </svg>
      </span>
    );
  }
  if (hasCursor) {
    return (
      <span className="shrink-0 ml-auto" title="Cursor">
        <svg className="w-3 h-3 text-teal-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3l14 9-14 9V3z" />
        </svg>
      </span>
    );
  }
  return null;
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      )}
    </svg>
  );
}

function TreeFolder({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(true);

  const sortedChildren = useMemo(() => {
    const entries = [...node.children.entries()];
    // Folders (has children) first, then leaves
    entries.sort((a, b) => {
      const aIsFolder = a[1].children.size > 0;
      const bIsFolder = b[1].children.size > 0;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [node.children]);

  // If this node is also a project itself (folder that is a project)
  const hasChildren = node.children.size > 0;

  if (!hasChildren && node.project) {
    return <TreeLeaf project={node.project} depth={depth} />;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left px-3 py-1 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-tertiary rounded-md transition-colors"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <svg
          className={`w-2.5 h-2.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        <FolderIcon open={open} />
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <div>
          {/* If this folder is also a project, show a link to it */}
          {node.project && (
            <TreeLeaf project={node.project} depth={depth + 1} label="(root)" />
          )}
          {sortedChildren.map(([key, child]) => {
            if (child.children.size > 0) {
              return <TreeFolder key={key} node={child} depth={depth + 1} />;
            }
            if (child.project) {
              return <TreeLeaf key={key} project={child.project} depth={depth + 1} />;
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

function TreeLeaf({ project, depth, label }: { project: ProjectSummary; depth: number; label?: string }) {
  const displayName = label ?? project.name.split("/").pop() ?? project.name;
  return (
    <NavLink
      to={`/projects/${project.id}`}
      className={({ isActive }) =>
        `flex items-center gap-1.5 py-1 rounded-md text-sm truncate ${isActive ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary"}`
      }
      style={{ paddingLeft: `${depth * 12 + 12}px`, paddingRight: "12px" }}
      title={project.name}
    >
      <span className="truncate">{displayName}</span>
      <SourceIcon sources={project.sources} />
    </NavLink>
  );
}

export function Sidebar() {
  const { data: projects } = useApi<ProjectSummary[]>("/api/projects");

  const tree = useMemo(() => {
    if (!projects) return null;
    return buildTree(projects);
  }, [projects]);

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

      <div className="flex-1 overflow-auto py-2">
        <div className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
          Projects ({projects?.length ?? 0})
        </div>
        {tree && [...tree.children.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, node]) => {
            if (node.children.size > 0) {
              return <TreeFolder key={key} node={node} depth={0} />;
            }
            if (node.project) {
              return <TreeLeaf key={key} project={node.project} depth={0} />;
            }
            return null;
          })}
      </div>
    </aside>
  );
}
