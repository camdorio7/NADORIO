"use client";
import { useWorkspace } from "./WorkspaceShell";
export default function WorkspaceHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { club } = useWorkspace();
  return (
    <div className="top">
      <div>
        <div className="eyebrow">
          {club.portal_title?.trim() || "CLUB WORKSPACE"}
        </div>
        <h1>{title}</h1>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
    </div>
  );
}
