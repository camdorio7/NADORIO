import type { ReactNode } from "react";
import type {
  PublicClubData,
  PublicSiteData,
} from "./PublicOrganizationSite";
import { publicSiteStyles as s } from "./PublicOrganizationSite";

export default function PublicOrganizationHomepage({
  id,
  club,
  site,
  preview = false,
  contactForm,
}: {
  id: string;
  club: PublicClubData | null;
  site: PublicSiteData;
  preview?: boolean;
  contactForm?: ReactNode;
}) {
  const pages = (Array.isArray(site.pages) ? site.pages : []).filter(
    (page) =>
      page &&
      typeof page.slug === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug) &&
      typeof page.title === "string" &&
      typeof page.body === "string" &&
      (preview || page.published !== false),
  );
  const services = (Array.isArray(site.services) ? site.services : [])
    .filter((service): service is string => typeof service === "string" && !!service.trim())
    .slice(0, 20);
  const title = site.title?.trim() || club?.name || "Welcome";

  return (
    <>
      <section className={s.hero}>
        <div className={s.heroInner}>
          <div className={s.heroCopy}>
            <div className={s.eyebrow}>Welcome to {club?.name || title}</div>
            <h1>{title}</h1>
            {site.tagline && <p>{site.tagline}</p>}
            <div className={s.heroActions}>
              <a
                className={s.button}
                href={preview ? "#contact" : `/member/join?organization=${id}`}
              >
                {preview ? "Become a member" : "Apply for membership"}
              </a>
              <a className={`${s.button} ${s.buttonLight}`} href="#contact">
                Contact the club
              </a>
            </div>
          </div>
        </div>
      </section>

      {site.about && (
        <section className={s.content}>
          <div className={s.intro}>
            <div className={s.eyebrow}>Discover {club?.name || "our organization"}</div>
            <h2>Welcome</h2>
            <p>{site.about}</p>
          </div>
        </section>
      )}

      {(services.length > 0 || pages.length > 0) && (
        <section className={s.features}>
          <div className={s.featuresInner}>
            <div className={s.sectionHead}>
              <div className={s.eyebrow}>Explore</div>
              <h2>Experience the club</h2>
            </div>
            <div className={s.grid}>
              {services.map((service, index) => (
                <article className={s.feature} key={`service-${index}`}>
                  <h3>{service}</h3>
                </article>
              ))}
              {pages.map((page) => (
                <article className={s.feature} key={page.slug}>
                  <h3>{page.title}</h3>
                  <p>{page.body.slice(0, 150)}{page.body.length > 150 ? "…" : ""}</p>
                  <a href={preview ? `#${page.slug}` : `/site/${id}/${page.slug}`}>
                    Learn more <span aria-hidden="true">↗</span>
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {pages.map((page) => (
        <section className={s.content} id={page.slug} key={`body-${page.slug}`}>
          <div className={s.intro}>
            <div className={s.eyebrow}>{club?.name || title}</div>
            <h2>{page.title}</h2>
            <p>{page.body}</p>
          </div>
        </section>
      ))}

      <section className={s.contact} id="contact">
        <div className={s.contactInner}>
          <div className={s.contactDetails}>
            <div className={s.eyebrow}>Stay connected</div>
            <h2>Contact us</h2>
            {site.contact_email && (
              <p><a href={`mailto:${site.contact_email}`}>{site.contact_email}</a></p>
            )}
            {site.phone && <p>{site.phone}</p>}
            {site.address && <p>{site.address}</p>}
          </div>
          {contactForm ? (
            <div className={s.contactForm}>{contactForm}</div>
          ) : preview ? (
            <div className={s.contactForm}>
              <h3>Contact form preview</h3>
              <p>Your published website will show the secure contact form here.</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
