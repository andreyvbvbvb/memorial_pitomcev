"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../lib/config";
import ErrorToast from "../../../components/ErrorToast";

const ADMIN_EMAIL = "andreyvbvbvb@gmail.com";

const QUICK_QUERIES = [
  {
    label: "Пользователи (10)",
    query:
      'SELECT id, email, login, "coinBalance", "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 10;'
  },
  {
    label: "Питомцы (10)",
    query:
      'SELECT id, name, "ownerId", "createdAt", "isPublic" FROM "Pet" ORDER BY "createdAt" DESC LIMIT 10;'
  },
  {
    label: "Мемориалы (10)",
    query:
      'SELECT id, "petId", "environmentId", "houseId", "createdAt" FROM "Memorial" ORDER BY "createdAt" DESC LIMIT 10;'
  },
  {
    label: "Маркеры (10)",
    query:
      'SELECT id, "petId", lat, lng, "markerStyle", "createdAt" FROM "MapMarker" ORDER BY "createdAt" DESC LIMIT 10;'
  },
  {
    label: "Фото (10)",
    query:
      'SELECT id, "petId", url, "sortOrder", "createdAt" FROM "PetPhoto" ORDER BY "createdAt" DESC LIMIT 10;'
  },
  {
    label: "Подарки (10)",
    query:
      'SELECT id, code, name, price, "createdAt" FROM "GiftCatalog" ORDER BY "createdAt" DESC LIMIT 10;'
  },
  {
    label: "Размещения подарков (10)",
    query:
      'SELECT id, "petId", "giftId", "ownerId", "slotName", "placedAt", "expiresAt" FROM "GiftPlacement" ORDER BY "placedAt" DESC LIMIT 10;'
  }
] as const;

type SqlResult = {
  type: "select" | "delete" | "update";
  rowCount?: number;
  affected?: number | string;
  rows?: unknown;
};

type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
};

type SchemaTable = {
  name: string;
  columns: SchemaColumn[];
};

const buildSelectQuery = (tableName: string, limit = 50) =>
  `SELECT * FROM "${tableName}" LIMIT ${limit};`;

const buildCountQuery = (tableName: string) =>
  `SELECT count(*) FROM "${tableName}";`;

export default function AdminSqlPage() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaFilter, setSchemaFilter] = useState("");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadSchema = async () => {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/schema`, {
          credentials: "include"
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить схему");
        }
        const data = (await response.json()) as { tables?: SchemaTable[] };
        if (!isMounted) {
          return;
        }
        setSchema(Array.isArray(data.tables) ? data.tables : []);
      } catch (err) {
        if (isMounted) {
          setSchemaError(err instanceof Error ? err.message : "Ошибка загрузки схемы");
        }
      } finally {
        if (isMounted) {
          setSchemaLoading(false);
        }
      }
    };
    void loadSchema();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  const refreshSchema = async () => {
    if (!isAdmin) {
      return;
    }
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/schema`, {
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось загрузить схему");
      }
      const data = (await response.json()) as { tables?: SchemaTable[] };
      setSchema(Array.isArray(data.tables) ? data.tables : []);
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : "Ошибка загрузки схемы");
    } finally {
      setSchemaLoading(false);
    }
  };

  const applyQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setResult(null);
    setError(null);
  };

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

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const normalizedFilter = schemaFilter.trim().toLowerCase();
  const filteredTables = normalizedFilter
    ? schema.filter((table) => {
        const nameMatch = table.name.toLowerCase().includes(normalizedFilter);
        if (nameMatch) {
          return true;
        }
        return table.columns.some((column) =>
          column.name.toLowerCase().includes(normalizedFilter)
        );
      })
    : schema;

  let content: ReactNode = null;
  if (!authChecked) {
    content = <div className="mt-6 text-sm text-slate-500">Проверка доступа...</div>;
  } else if (!isAdmin) {
    content = (
      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Доступ запрещён.
      </div>
    );
  } else {
    content = (
      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Быстрые запросы
            </div>
            <div className="mt-3 grid gap-2">
              {QUICK_QUERIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => applyQuery(item.query)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase text-slate-500">Таблицы</div>
              <button
                type="button"
                onClick={refreshSchema}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                disabled={schemaLoading}
              >
                {schemaLoading ? "..." : "Обновить"}
              </button>
            </div>
            <input
              value={schemaFilter}
              onChange={(event) => setSchemaFilter(event.target.value)}
              placeholder="Фильтр таблиц"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            />
            {schemaError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {schemaError}
              </div>
            ) : null}
            <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
              {schemaLoading && schema.length === 0 ? (
                <div className="text-xs text-slate-500">Загрузка...</div>
              ) : null}
              {!schemaLoading && filteredTables.length === 0 ? (
                <div className="text-xs text-slate-500">Ничего не найдено</div>
              ) : null}
              {filteredTables.map((table) => (
                <div key={table.name} className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTable(table.name)}
                      className="text-left text-xs font-semibold text-slate-800"
                    >
                      {expandedTables[table.name] ? "▾" : "▸"} {table.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applyQuery(buildSelectQuery(table.name))}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                      >
                        SELECT
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuery(buildCountQuery(table.name))}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                      >
                        COUNT
                      </button>
                    </div>
                  </div>
                  {expandedTables[table.name] ? (
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      {table.columns.map((column) => (
                        <div key={column.name} className="flex items-center justify-between">
                          <span>{column.name}</span>
                          <span className="text-slate-400">
                            {column.type}
                            {column.nullable ? " · null" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='SELECT * FROM "User" LIMIT 20;'
            className="min-h-[180px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none"
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
                  ? `Строк: ${result.rowCount ?? 0}`
                  : result.rows
                    ? `${result.type === "update" ? "Обновлено" : "Удалено"} строк: ${result.rowCount ?? 0}`
                    : `${result.type === "update" ? "Обновлено" : "Удалено"}: ${result.affected ?? 0}`}
              </span>
            ) : null}
          </div>

          {result ? (
            <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Админ · SQL консоль</h1>
        <p className="mt-2 text-sm text-slate-600">
          Разрешены только SELECT, DELETE и UPDATE. Выполняется на сервере API.
        </p>
        {content}
      </div>
      {error ? <ErrorToast message={error} onClose={() => setError(null)} /> : null}
    </main>
  );
}
