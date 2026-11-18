"use client";

import { FormEvent, Suspense, useEffect, useState, type CSSProperties } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Users,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "../../lib/auth-navigation";
import { createClient } from "../../lib/supabase/client";
import { organizationTheme, type OrganizationBrand } from "../../lib/organization-theme";

type PublicOrganizationBrand = OrganizationBrand & {
  name?: string | null;
  logo_url?: string | null;
};

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const organizationId = params.get("organization") || "";
  const [organization, setOrganization] = useState<PublicOrganizationBrand | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("error"))
      setMsg(
        params.get("error") === "auth_link_expired"
          ? "This sign-in link has expired or could not be verified. Request a new link, or sign in with your password."
          : "This account is not authorized for that area of the organization portal.",
      );
  }, [params]);

  useEffect(() => {
    let live = true;
    setOrganization(null);
    if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return;
    createClient()
      .rpc("v11_public_branding", { target_club: organizationId })
      .maybeSingle()
      .then(({ data }) => {
        if (live) setOrganization((data as PublicOrganizationBrand | null) || null);
      });
    return () => {
      live = false;
    };
  }, [organizationId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const sb = createClient();
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.user) {
        setMsg(error?.message || "Unable to sign in.");
        setBusy(false);
        return;
      }

      const next = safeNextPath(params.get("next"), "");
      if (next) {
        router.replace(next);
        router.refresh();
        return;
      }

      const [
        { data: isSuper, error: accessError },
        { data: profile, error: profileError },
      ] = await Promise.all([
        sb.rpc("is_super_admin"),
        sb
          .from("profiles")
          .select("platform_role")
          .eq("id", data.user.id)
          .maybeSingle(),
      ]);
      if (accessError || profileError)
        throw new Error(
          "Signed in, but your organization access could not be loaded. Please retry.",
        );
      if (isSuper === true || profile?.platform_role === "super_admin") {
        router.replace(organizationId ? `/workspace/${organizationId}` : "/dashboard");
        router.refresh();
        return;
      }

      let membershipsQuery = sb
        .from("club_users")
        .select("club_id, role")
        .eq("user_id", data.user.id)
        .eq("active", true);
      if (organizationId)
        membershipsQuery = membershipsQuery.eq("club_id", organizationId);
      const { data: memberships, error: membershipError } = await membershipsQuery.limit(2);
      if (membershipError)
        throw new Error("Unable to load your organizations. Please retry.");
      if (!memberships?.length) {
        const { data: requests, error: requestError } = await sb.rpc(
          "my_club_join_requests",
        );
        if (requestError)
          throw new Error(
            "Unable to check your membership application. Please retry.",
          );
        const pending = (requests || []).find(
          (r: any) =>
            r.status === "pending" &&
            (!organizationId || r.club_id === organizationId),
        );
        if (pending) {
          router.replace("/member/pending");
          router.refresh();
          return;
        }
        setMsg(
          organizationId
            ? `This account does not have active access to ${organization?.name || "this organization"}. Apply for membership or ask a club administrator for an invitation.`
            : "No active club access was found. If you are joining a club, submit a membership application below.",
        );
        setBusy(false);
        return;
      }
      router.replace(
        organizationId
          ? "/workspace/" + organizationId
          : memberships.length > 1
            ? "/organizations"
            : "/workspace/" + memberships[0].club_id,
      );
      router.refresh();
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please check your connection and retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  const theme = organizationTheme(organization) as CSSProperties;
  const organizationName = organization?.name || "your club";
  return (
    <main className="authPage lindexAuthPage" style={theme}>
      <div className="authGlow authGlowOne" />
      <div className="authGlow authGlowTwo" />
      <section className="authShell">
        <header className="authBrand">
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt={`${organizationName} logo`} />
          ) : (
            <span className="authBrandMark" aria-hidden="true">
              {organization?.name?.slice(0, 2).toUpperCase() || "C"}
            </span>
          )}
          <div>
            <small>{organization ? "SECURE CLUB ACCESS" : "MEMBER & STAFF PORTAL"}</small>
            <strong>{organization?.name || "Club Portal"}</strong>
          </div>
        </header>
        <div className="authCard">
          <div className="authIntro">
            <span className="authEyebrow">{organization ? "SECURE CLUB ACCESS" : "WELCOME TO YOUR CLUB"}</span>
            <h1>Welcome back</h1>
            <p>Sign in to access {organizationName}.</p>
          </div>

          <div className="authAudience" aria-label="Club account types">
            <span>
              <UserRound size={15} /> Members
            </span>
            <span>
              <Users size={15} /> Staff
            </span>
            <span>
              <ShieldCheck size={15} /> Club Admins
            </span>
          </div>

          <form className="authForm" onSubmit={submit}>
            <label className="authField">
              <span>Email address</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="authField">
              <span>Password</span>
              <div className="passwordField">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <div className="authUtilityRow">
              <a className="authUtilityLink" href="/forgot-password">
                Forgot password?
              </a>
            </div>
            {msg && (
              <div className="authError" role="alert">
                {msg}
              </div>
            )}
            <button className="authPrimary" disabled={busy}>
              <LockKeyhole size={17} />
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="authJoin">
            <div>
              <strong>Joining a club?</strong>
              <span>Create your account and request membership.</span>
            </div>
            <a href={organizationId ? `/member/join?organization=${organizationId}` : "/member/join"}>
              Create an account <span>→</span>
            </a>
          </div>
        </div>
        <footer className="authFooter">
          <span>Secure access for your organization</span>
          <span>CD7 Technologies</span>
        </footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="authPage">
          <section className="authShell">
            <header className="authBrand"><span className="authBrandMark">C</span><strong>Club Portal</strong></header>
          </section>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
