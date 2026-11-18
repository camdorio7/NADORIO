import Link from "next/link";
import PublicSiteNavigation from "./PublicSiteNavigation";
import type { CSSProperties, ReactNode } from "react";
import { organizationTheme } from "../lib/organization-theme";
import styles from "./PublicOrganizationSite.module.css";
export type PublicPage = {
  slug: string;
  title: string;
  body: string;
  published?: boolean;
};
export type PublicSiteData = {
  title: string;
  tagline?: string | null;
  about?: string | null;
  services?: string[] | null;
  pages?: PublicPage[] | null;
  contact_email?: string | null;
  phone?: string | null;
  address?: string | null;
  hero_image_url?: string | null;
};
export type PublicClubData = {
  name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  background_color?: string | null;
  surface_color?: string | null;
  text_color?: string | null;
};
export function PublicOrganizationSite({
  id,
  club,
  site,
  active,
  preview = false,
  children,
}: {
  id: string;
  club: PublicClubData | null;
  site: PublicSiteData;
  active?: string;
  preview?: boolean;
  children: ReactNode;
}) {
  const pages = (Array.isArray(site.pages) ? site.pages : []).filter(
    (p) =>
      p &&
      typeof p.slug === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) &&
      typeof p.title === "string" &&
      (preview || p.published !== false),
  );
  const hero =
    site.hero_image_url && /^https:\/\/[^\s]+$/i.test(site.hero_image_url)
      ? site.hero_image_url
      : null;
  return (
    <div
      className={styles.shell}
      style={
        {
          ...organizationTheme(club),
          "--site-hero-image": hero
            ? `url("${hero.replace(/["\\]/g, "")}")`
            : "none",
        } as CSSProperties
      }
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={styles.brand}
            href={preview ? "#" : `/site/${id}`}
            aria-label={`${club?.name || site.title} home`}
          >
            {club?.logo_url && (
              <img src={club.logo_url} alt="" className={styles.logo} />
            )}
            <span>{club?.name || site.title}</span>
          </Link>
          {preview ? (
            <nav className={styles.nav} aria-label="Draft preview navigation">
              <a href="#" onClick={(e) => e.preventDefault()}>
                Home
              </a>
              {pages.map((p) => (
                <a key={p.slug} href={`#${p.slug}`}>
                  {p.title}
                </a>
              ))}
              <a href="#contact">Contact</a>
              <a className={styles.navAction} href={`/login?organization=${id}`}>
                Member sign in
              </a>
              <a className={styles.navPrimary} href={`/member/join?organization=${id}`}>
                Apply for membership
              </a>
            </nav>
          ) : (
            <PublicSiteNavigation id={id} pages={pages} active={active} />
          )}
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <strong>{club?.name || site.title}</strong>
        <span>Powered by CD7 Technologies</span>
      </footer>
    </div>
  );
}
export { styles as publicSiteStyles };
