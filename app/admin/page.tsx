"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/userContext";
import { listReports, deleteReport, type QuestionReport } from "@/lib/reports";
import { listFeedback, deleteFeedback, type Feedback } from "@/lib/feedback";
import { createAccount, setPassword, setEmail } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { PageLoader } from "@/components/ui/Spinner";
import PasswordInput from "@/components/ui/PasswordInput";

interface Row {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
  email: string | null;
  created_at: string;
  last_login_at: string | null;
}

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminPage() {
  const { user } = useUser();
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [reportQCode, setReportQCode] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data }, { data: att }, reps, fb] = await Promise.all([
      supabase.from("users").select("id, username, display_name, is_admin, email, created_at, last_login_at").order("created_at"),
      supabase.from("attempts").select("user_id").limit(100000),
      listReports(),
      listFeedback(),
    ]);
    setUsers((data as Row[]) || []);
    setFeedback(fb);
    const c = new Map<string, number>();
    for (const a of (att as any[]) || []) {
      if (a.user_id) c.set(a.user_id, (c.get(a.user_id) || 0) + 1);
    }
    setCounts(c);
    setReports(reps);
    // Resolve question codes for the reported questions.
    const uids = Array.from(new Set(reps.map((r) => r.question_uid).filter(Boolean)));
    if (uids.length) {
      const { data: qs } = await supabase.from("questions").select("id, question_id").in("id", uids).limit(5000);
      setReportQCode(new Map(((qs as { id: string; question_id: string }[]) || []).map((q) => [q.id, q.question_id])));
    }
    setLoading(false);
  }

  async function resolveReport(id: string) {
    if (!(await confirm({ title: "Resolve this report?", body: "It will be removed from the list.", confirmLabel: "Resolve" }))) return;
    await deleteReport(id);
    await load();
    toast.success("Report resolved.");
  }

  async function resolveFeedback(id: string) {
    if (!(await confirm({ title: "Dismiss this feedback?", body: "It will be removed from the list.", confirmLabel: "Dismiss" }))) return;
    await deleteFeedback(id);
    await load();
    toast.success("Feedback dismissed.");
  }

  useEffect(() => {
    load();
  }, []);

  if (!user?.is_admin) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
        <p className="font-medium text-slate-800 dark:text-slate-100">Admins only</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">You don&apos;t have access to account management.</p>
      </div>
    );
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const uname = newName.trim().toLowerCase();
    if (!uname) return;
    if (!/^[a-z0-9_]+$/.test(uname)) {
      setError("Usernames can only contain letters, numbers, and underscores.");
      return;
    }
    if (!newPassword) {
      setError("Set a password for the new account.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createAccount({
        username: uname,
        displayName: newName.trim(),
        isAdmin: makeAdmin,
        password: newPassword,
        email: newEmail.trim(),
      });
    } catch (e: any) {
      setBusy(false);
      setError(e?.code === "23505" ? "That username already exists." : e?.message || "Could not create the account.");
      return;
    }
    setBusy(false);
    setNewName("");
    setNewPassword("");
    setNewEmail("");
    setMakeAdmin(false);
    await load();
    toast.success(`Account "${uname}" created.`);
  }

  async function resetPassword(id: string, uname: string) {
    const pw = window.prompt(`New password for "${uname}":`);
    if (pw == null) return;
    if (!pw.trim()) {
      toast.error("Password can't be empty.");
      return;
    }
    await setPassword(id, pw);
    toast.success(`Password reset for "${uname}".`);
  }

  async function editEmail(u: Row) {
    const email = window.prompt(`Email for "${u.username}":`, u.email || "");
    if (email == null) return;
    await setEmail(u.id, email.trim());
    await load();
    toast.success(`Email updated for "${u.username}".`);
  }

  async function removeUser(id: string, uname: string) {
    if (id === user?.id) return; // don't delete yourself
    const ok = await confirm({
      title: `Delete account "${uname}"?`,
      body: "This erases all of their practice history and cannot be undone.",
      confirmLabel: "Delete account",
      danger: true,
    });
    if (!ok) return;
    await supabase.from("users").delete().eq("id", id);
    await load();
    toast.success(`Account "${uname}" deleted.`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage accounts</h1>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Create an account</h2>
        <form onSubmit={createUser} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Username</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. alex"
              autoCapitalize="none"
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Password</span>
            <PasswordInput value={newPassword} onChange={setNewPassword} className="w-44" aria-label="New account password" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">Email <span className="font-normal text-slate-400">(optional)</span></span>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} className="h-4 w-4" />
            Admin
          </label>
          <button type="submit" disabled={busy || !newName.trim() || !newPassword} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50">
            {busy ? "Creating…" : "Create"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Share the username and password with your friend (usernames are case-insensitive). They can be reset any time below.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Accounts</h2>
        {loading ? (
          <PageLoader label="Loading accounts…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Username</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Questions done</th>
                  <th className="px-3 py-2 font-medium">Last login</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{u.display_name}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{u.is_admin ? "Admin" : "User"}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => editEmail(u)} className="text-left text-slate-600 dark:text-slate-300 hover:underline" title="Edit email">
                        {u.email || <span className="text-slate-400 dark:text-slate-500">add email</span>}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{counts.get(u.id) || 0}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400" title={u.last_login_at || "never"}>{timeAgo(u.last_login_at)}</td>
                    <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{u.created_at.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => resetPassword(u.id, u.username)} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
                          Reset password
                        </button>
                        {u.id !== user?.id && (
                          <button onClick={() => removeUser(u.id, u.username)} className="text-xs text-rose-500 dark:text-rose-400 hover:underline">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Reported issues {reports.length > 0 && <span className="text-rose-600 dark:text-rose-400">({reports.length})</span>}
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No open reports. 🎉</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const code = reportQCode.get(r.question_uid) || r.question_uid;
              const who = users.find((u) => u.id === r.user_id)?.display_name || "someone";
              return (
                <div key={r.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                      <span className="font-mono">{code}</span>
                      <span>· {who}</span>
                      <span>· {timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{r.reason}</p>
                  </div>
                  <button
                    onClick={() => resolveReport(r.id)}
                    className="flex-none rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Resolve
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Feedback {feedback.length > 0 && <span className="text-brand-600 dark:text-brand-300">({feedback.length})</span>}
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : feedback.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No feedback yet.</p>
        ) : (
          <div className="space-y-2">
            {feedback.map((f) => {
              const who = users.find((u) => u.id === f.user_id)?.display_name || "someone";
              return (
                <div key={f.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                      <span>{who}</span>
                      <span>· {timeAgo(f.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{f.message}</p>
                  </div>
                  <button
                    onClick={() => resolveFeedback(f.id)}
                    className="flex-none rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
