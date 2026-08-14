"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/userContext";
import { listReports, deleteReport, type QuestionReport } from "@/lib/reports";

interface Row {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
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
  const [users, setUsers] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [reportQCode, setReportQCode] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data }, { data: att }, reps] = await Promise.all([
      supabase.from("users").select("*").order("created_at"),
      supabase.from("attempts").select("user_id").limit(100000),
      listReports(),
    ]);
    setUsers((data as Row[]) || []);
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
    await deleteReport(id);
    load();
  }

  useEffect(() => {
    load();
  }, []);

  if (!user?.is_admin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-medium text-slate-800">Admins only</p>
        <p className="mt-1 text-sm text-slate-500">You don&apos;t have access to account management.</p>
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
    setBusy(true);
    setError("");
    const { error } = await supabase
      .from("users")
      .insert({ username: uname, display_name: newName.trim(), is_admin: makeAdmin });
    setBusy(false);
    if (error) {
      setError(error.code === "23505" ? "That username already exists." : error.message);
      return;
    }
    setNewName("");
    setMakeAdmin(false);
    load();
  }

  async function removeUser(id: string, uname: string) {
    if (id === user?.id) return; // don't delete yourself
    if (!confirm(`Delete account "${uname}"? This erases all of their practice history.`)) return;
    await supabase.from("users").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage accounts</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Create an account</h2>
        <form onSubmit={createUser} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Username</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. alex"
              autoCapitalize="none"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} className="h-4 w-4" />
            Admin
          </label>
          <button type="submit" disabled={busy || !newName.trim()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? "Creating…" : "Create"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <p className="mt-2 text-xs text-slate-400">
          Share the username with your friend — they just type it on the login screen (case-insensitive, no password).
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Accounts</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Username</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Questions done</th>
                  <th className="px-3 py-2 font-medium">Last login</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-700">{u.display_name}</td>
                    <td className="px-3 py-2 text-slate-500">{u.is_admin ? "Admin" : "User"}</td>
                    <td className="px-3 py-2 text-slate-700">{counts.get(u.id) || 0}</td>
                    <td className="px-3 py-2 text-slate-500" title={u.last_login_at || "never"}>{timeAgo(u.last_login_at)}</td>
                    <td className="px-3 py-2 text-slate-400">{u.created_at.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">
                      {u.id !== user?.id && (
                        <button onClick={() => removeUser(u.id, u.username)} className="text-xs text-rose-500 hover:underline">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          Reported issues {reports.length > 0 && <span className="text-rose-600">({reports.length})</span>}
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-400">No open reports. 🎉</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const code = reportQCode.get(r.question_uid) || r.question_uid;
              const who = users.find((u) => u.id === r.user_id)?.display_name || "someone";
              return (
                <div key={r.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono">{code}</span>
                      <span>· {who}</span>
                      <span>· {timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700">{r.reason}</p>
                  </div>
                  <button
                    onClick={() => resolveReport(r.id)}
                    className="flex-none rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Resolve
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
