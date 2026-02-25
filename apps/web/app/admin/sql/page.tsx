"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../lib/config";
import ErrorToast from "../../../components/ErrorToast";

const ADMIN_EMAIL = "andreyvbvbvb@gmail.com";

type SqlResult =
  | {
      type: "select";
      rowCount: number;
      rows: unknown;
    }
  | {
      type: "delete";
      affected?: number | string;
      rowCount?: number;
      rows?: unknown;
    };

export default function AdminSqlPage() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include"
        });
        if (!response.ok) {
          router.replace("/auth");
          return;
        }
        const data = (await response.json()) as { email?: string };
        if (!isMounted) {
          return;
        }
        const email = data.email?.toLowerCase() ?? "";
        setIsAdmin(email === ADMIN_EMAIL);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Ошибка авторизации");
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, router]);

  const runQuery = async () => {
    if (!query.trim()) {
      setError("Введите SQL запрос");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${apiUrl}/admin/sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Ошибка выполнения запроса");
      }
      const data = (await response.json()) as SqlResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка выполнения");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main
      className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-slate-50 px-6 py-10"
    >
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Админ · SQL консоль</h1>
        <p className="mt-2 text-sm text-slate-600">
          Разрешены только SELECT и DELETE. Выполняется на сервере API.
        </p>

        {!authChecked ? (
          <div className="mt-6 text-sm text-slate-500">Проверка доступа...</div>
        ) : !isAdmin ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Доступ запрещён.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SELECT * FROM \"User\" LIMIT 20;"
              className="min-h-[160px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={runQuery}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                disabled={running}
              >
                {running ? "Выполняю..." : "Выполнить"}
              </button>
              {result ? (
                <span className="text-sm text-slate-500">
                  {result.type === "select"
                    ? `Строк: ${result.rowCount}`
                    : result.rows
                      ? `Удалено строк: ${result.rowCount ?? 0}`
                      : `Затронуто: ${result.affected ?? 0}`}
                </span>
              ) : null}
            </div>

            {result ? (
              <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
      </div>

      {error ? <ErrorToast message={error} onClose={() => setError(null)} /> : null}
    </main>
  );
}
