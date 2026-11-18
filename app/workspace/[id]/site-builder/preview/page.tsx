"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../../../../../components/WorkspaceShell";
import { createClient } from "../../../../../lib/supabase/client";
import PublicOrganizationHomepage from "../../../../../components/PublicOrganizationHomepage";
import {
  PublicOrganizationSite,
} from "../../../../../components/PublicOrganizationSite";
export default function Preview() {
  const { club } = useWorkspace();
  const [site, setSite] = useState<any>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    createClient()
      .from("site_drafts")
      .select("data")
      .eq("club_id", club.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (live) {
          if (error) setMessage(error.message);
          else if (!data) setMessage("Save a draft in Website Builder first.");
          else setSite(data.data);
        }
      });
    return () => {
      live = false;
    };
  }, [club.id]);
  return (
    <>
      <p className="v11Notice">
        Private preview of the saved draft. Unsaved editor changes are not
        included.{" "}
        <Link href={`/workspace/${club.id}/site-builder`}>Back to editor</Link>
      </p>
      {message && <p role="status">{message}</p>}
      {site && (
        <PublicOrganizationSite id={club.id} club={club} site={site} preview>
          <PublicOrganizationHomepage
            id={club.id}
            club={club}
            site={site}
            preview
          />
        </PublicOrganizationSite>
      )}
    </>
  );
}
