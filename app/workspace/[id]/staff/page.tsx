"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import { createClient } from "../../../../lib/supabase/client";
import { canUseModule, isAdmin } from "../../../../lib/modules";

type TimeEntry = {
  id: string;
  club_id: string;
  user_id: string;
  full_name: string | null;
  clock_in: string;
  clock_out: string | null;
  updated_at: string;
  tips: number | null;
  tips_in_period: number | null;
  period_seconds: number;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthStart = () => `${today().slice(0, 8)}01`;
const localDateTime = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const hours = (seconds: number) => (Number(seconds || 0) / 3600).toFixed(2);

export default function Staff() {
  const { club, access, userId } = useWorkspace();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [openShift, setOpenShift] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [inviteLink, setInviteLink] = useState("");
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(today);
  const [tips, setTips] = useState("");
  const [selected, setSelected] = useState<TimeEntry | null>(null);
  const [draft, setDraft] = useState({ start: "", end: "", tips: "", reason: "" });

  const admin = isAdmin(access.role);
  const canSeeAll = admin || access.permissions.some((p) => p.module_key === "staff" && p.can_view);
  const canEdit = admin || canUseModule(access, "staff", "edit");
  const open = openShift;
  const totals = useMemo(() => {
    const byPerson = new Map<string, { name: string; closed: number; open: number; tips: number }>();
    for (const entry of entries) {
      const item = byPerson.get(entry.user_id) || {
        name: entry.full_name || "Staff member", closed: 0, open: 0, tips: 0,
      };
      item[entry.clock_out ? "closed" : "open"] += Number(entry.period_seconds || 0);
      item.tips += Number(entry.tips_in_period || 0);
      byPerson.set(entry.user_id, item);
    }
    return [...byPerson.values()];
  }, [entries]);

  async function load() {
    setLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.rpc("v12_staff_timesheet", {
        p_club_id: club.id,
        p_start: start,
        p_end: end,
        p_all: canSeeAll,
      });
      if (error) throw error;
      setEntries((data || []) as TimeEntry[]);
      const currentShift = await sb.from("staff_time_entries").select("id,clock_in,clock_out")
        .eq("club_id", club.id).eq("user_id", userId).is("clock_out", null).maybeSingle();
      if (currentShift.error) throw currentShift.error;
      setOpenShift(currentShift.data || null);
      if (admin) {
        const members = await sb
          .from("club_users")
          .select("id,user_id,role,active,profiles(full_name,email)")
          .eq("club_id", club.id)
          .in("role", ["owner", "admin", "staff", "manager"]);
        if (members.error) throw members.error;
        setPeople(members.data || []);
      }
      setMessage("");
    } catch (e: any) {
      setMessage(e.message || "Unable to load staff time records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [club.id, userId, admin, canSeeAll, start, end]);

  async function clock() {
    setBusy(true);
    setMessage("");
    try {
      const sb = createClient();
      const result = open
        ? await sb.from("staff_time_entries").update({
            clock_out: new Date().toISOString(),
            tips: tips.trim() === "" ? null : Number(tips),
          }).eq("id", open.id).eq("club_id", club.id).eq("user_id", userId)
        : await sb.from("staff_time_entries").insert({ club_id: club.id, user_id: userId });
      if (result.error) throw result.error;
      setTips("");
      setMessage(open ? "Clocked out. Your shift has been saved." : "Clocked in. Have a great shift.");
      await load();
    } catch (e: any) {
      setMessage(e.message || "Unable to update your shift.");
    } finally {
      setBusy(false);
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setInviteLink("");
    try {
      const sb = createClient();
      const pending = await sb.from("club_invitations").select("id")
        .eq("club_id", club.id).eq("email", email.trim().toLowerCase())
        .eq("status", "pending").maybeSingle();
      if (pending.error) throw pending.error;
      const record = {
        club_id: club.id, email: email.trim().toLowerCase(), full_name: name.trim(),
        role, invited_by: userId, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      const saved = pending.data
        ? await sb.from("club_invitations").update(record).eq("id", pending.data.id).select("token").single()
        : await sb.from("club_invitations").insert(record).select("token").single();
      if (saved.error) throw saved.error;
      setInviteLink(`${window.location.origin}/join?token=${saved.data.token}`);
      const { data: { session } } = await sb.auth.getSession();
      try {
        const response = await fetch("/api/email/invite", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ token: saved.data.token }),
        });
        const out = await response.json();
        setMessage(response.ok ? "Invitation saved and accepted by the email provider." : `Invitation saved. Email was not sent: ${out.error || "Provider error"}`);
      } catch {
        setMessage("Invitation saved, but email could not be sent. Share the link below.");
      }
      setName(""); setEmail("");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const columns = ["Staff member", "Clock in", "Clock out", "Hours in selected period", "Shift tips"];
    const rows = entries.map((entry) => [
      entry.full_name || "Staff member", entry.clock_in, entry.clock_out || "Open shift",
      hours(entry.period_seconds), entry.tips == null ? "Not reported" : Number(entry.tips).toFixed(2),
    ]);
    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `nadorio-staff-hours-${start}-to-${end}.csv`;
    link.click(); URL.revokeObjectURL(url);
    setMessage("Staff-hours CSV downloaded.");
  }

  async function saveCorrection(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      if (!draft.start) throw new Error("Choose a clock-in date and time.");
      if (draft.reason.trim().length < 5) throw new Error("Enter a correction reason of at least five characters.");
      if (draft.tips.trim() && !/^\d+(?:\.\d{1,2})?$/.test(draft.tips.trim())) throw new Error("Enter tips with no more than two decimal places, or leave blank.");
      const { error } = await createClient().rpc("v12_correct_staff_time", {
        p_club_id: club.id, p_id: selected.id,
        p_start: new Date(draft.start).toISOString(),
        p_end: draft.end ? new Date(draft.end).toISOString() : null,
        p_expected_updated_at: selected.updated_at,
        p_tips: draft.tips.trim() === "" ? null : Number(draft.tips),
        p_reason: draft.reason.trim(),
      });
      if (error) throw error;
      setSelected(null);
      setMessage("Correction saved. The reason and before/after values were added to the organization audit log.");
      await load();
    } catch (e: any) {
      setMessage(e.message || "Unable to save the correction.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Staff & time clock</h1>
      <p>Manage staff access, record shifts, and review organization staff hours.</p>
      {message && <p role="status" className="v11Notice">{message}</p>}

      <section className="panel">
        <h2>{open ? "Your shift is open" : "Start your shift"}</h2>
        {open && <p>Started {new Date(open.clock_in).toLocaleString()}</p>}
        {open && <label>Tips for this shift (optional)
          <input inputMode="decimal" value={tips} onChange={(e) => setTips(e.target.value)} placeholder="0.00" aria-label="Tips for this shift" />
          <small>Leave blank if tips do not apply. Enter 0 if there were no tips.</small>
        </label>}
        <button className="button gradient" disabled={busy || loading || (!!tips.trim() && !/^\d+(?:\.\d{1,2})?$/.test(tips.trim()))} onClick={clock}>
          {busy ? "Saving…" : open ? "Clock out" : "Clock in"}
        </button>
      </section>

      {admin && <>
        <p><Link href={`/workspace/${club.id}/permissions`}>Manage staff permissions →</Link></p>
        <form className="panel v11Form" onSubmit={invite}>
          <h2>Invite a team member</h2>
          <label>Name<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Role<select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Staff</option><option value="manager">Manager</option><option value="admin">Administrator</option>
          </select></label>
          <button className="button gradient" disabled={busy}>Save & email invitation</button>
          {inviteLink && <label>Invitation link<input readOnly value={inviteLink} /></label>}
        </form>
        <div className="v11TableWrap"><table className="v11Table"><thead><tr><th>Team member</th><th>Role</th><th>Access</th></tr></thead>
          <tbody>{people.map((person) => <tr key={person.id}><td>{person.profiles?.full_name || "User"}<small>{person.profiles?.email}</small></td><td>{person.role}</td><td>{person.active ? "Active" : "Inactive"}</td></tr>)}</tbody>
        </table></div>
      </>}

      <div className="top" style={{ marginTop: 28 }}><div><h2>{canSeeAll ? "Staff timesheets" : "My hours"}</h2><p>Hours are calculated only within the selected date range. Open shifts are provisional.</p></div>
        <button className="button" onClick={exportCsv} disabled={loading || entries.length === 0}>Download CSV</button>
      </div>
      <div className="panel" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <label>From<input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Through<input type="date" value={end} min={start} max={today()} onChange={(e) => setEnd(e.target.value)} /></label>
        <button className="button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </div>
      {totals.length > 0 && <div className="metricGrid">
        {totals.map((total) => <div className="metric" key={total.name}><span>{total.name}</span><b>{hours(total.closed)} hrs</b><small>{total.open ? `${hours(total.open)} open hrs · ` : ""}${total.tips.toFixed(2)} tips reported</small></div>)}
      </div>}
      {loading ? <p role="status">Loading timesheets…</p> : <div className="v11TableWrap"><table className="v11Table">
        <thead><tr><th>Team member</th><th>Clock in</th><th>Clock out</th><th>Hours in period</th><th>Tips</th>{canEdit && <th>Action</th>}</tr></thead>
        <tbody>{entries.map((entry) => <tr key={entry.id}>
          <td>{entry.full_name || "Staff"}</td><td>{new Date(entry.clock_in).toLocaleString()}</td>
          <td>{entry.clock_out ? new Date(entry.clock_out).toLocaleString() : "Open shift"}</td>
          <td>{hours(entry.period_seconds)}</td><td>{entry.tips == null ? "Not reported" : `$${Number(entry.tips).toFixed(2)}`}</td>
          {canEdit && <td><button className="button" onClick={() => { setSelected(entry); setDraft({ start: localDateTime(entry.clock_in), end: localDateTime(entry.clock_out), tips: entry.tips == null ? "" : String(entry.tips), reason: "" }); }}>Correct</button></td>}
        </tr>)}</tbody>
      </table>{entries.length === 0 && <p>No shifts in this date range.</p>}</div>}

      {selected && <form className="panel v11Form" onSubmit={saveCorrection}>
        <h2>Correct {selected.full_name || "staff member"}’s shift</h2>
        <label>Clock in<input required type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></label>
        <label>Clock out (leave blank to keep shift open)<input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></label>
        <label>Tips (leave blank if not reported)<input inputMode="decimal" value={draft.tips} onChange={(e) => setDraft({ ...draft, tips: e.target.value })} /></label>
        <label>Reason for correction<input required minLength={5} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label>
        <button className="button gradient" disabled={busy}>{busy ? "Saving…" : "Save correction"}</button>
        <button type="button" className="button" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
      </form>}
    </>
  );
}
