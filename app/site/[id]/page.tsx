import type { PublicClubData } from "../../../components/PublicOrganizationSite";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import ContactForm from "./ContactForm";
import PublicOrganizationHomepage from "../../../components/PublicOrganizationHomepage";
import {
  PublicOrganizationSite,
} from "../../../components/PublicOrganizationSite";
export const dynamic = "force-dynamic";
export default async function PublicSite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return (
      <main className="v11State">
        <h1>Website unavailable</h1>
        <p>The website service is not configured.</p>
      </main>
    );
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: site } = await sb.rpc("v11_public_site", { target_club: id });
  if (!site) notFound();
  const { data: branding } = await sb
    .rpc("v11_public_branding", { target_club: id })
    .maybeSingle();
  const club = branding as PublicClubData | null;
  return (
    <PublicOrganizationSite id={id} site={site} club={club}>
      <PublicOrganizationHomepage
        id={id}
        club={club}
        site={site}
        contactForm={<ContactForm clubId={id} />}
      />
    </PublicOrganizationSite>
  );
}
