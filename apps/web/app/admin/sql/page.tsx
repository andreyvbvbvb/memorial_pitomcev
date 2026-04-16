"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../lib/config";
import { canAccessAdmin, canManageAdmins, type AccessLevel } from "../../../lib/access";
import ErrorToast from "../../../components/ErrorToast";

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

type LoadingTip = {
  id: string;
  text: string;
  isActive: boolean;
  createdAt?: string;
};

type AccessUser = {
  id: string;
  email: string;
  login?: string | null;
  role: "USER" | "ADMIN";
  accessLevel: AccessLevel;
  isOwner: boolean;
  createdAt?: string;
};

const buildSelectQuery = (tableName: string, limit = 50) =>
  `SELECT * FROM "${tableName}" LIMIT ${limit};`;

const buildCountQuery = (tableName: string) =>
  `SELECT count(*) FROM "${tableName}";`;
const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");

export default function AdminSqlPage() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("USER");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaFilter, setSchemaFilter] = useState("");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [passwordEmail, setPasswordEmail] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [petId, setPetId] = useState("");
  const [loadingTips, setLoadingTips] = useState<LoadingTip[]>([]);
  const [loadingTipsLoading, setLoadingTipsLoading] = useState(false);
  const [loadingTipsError, setLoadingTipsError] = useState<string | null>(null);
  const [newTipText, setNewTipText] = useState("");
  const [savingTipId, setSavingTipId] = useState<string | null>(null);
  const [deletingTipId, setDeletingTipId] = useState<string | null>(null);
  const [creatingTip, setCreatingTip] = useState(false);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [accessUsersLoading, setAccessUsersLoading] = useState(false);
  const [accessUsersError, setAccessUsersError] = useState<string | null>(null);
  const [roleEmail, setRoleEmail] = useState("");
  const [roleSaving, setRoleSaving] = useState<"USER" | "ADMIN" | null>(null);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

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
        const data = (await response.json()) as { accessLevel?: AccessLevel };
        if (!isMounted) {
          return;
        }
        const nextAccessLevel = data.accessLevel ?? "USER";
        setAccessLevel(nextAccessLevel);
        setIsAdmin(canAccessAdmin(nextAccessLevel));
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

  useEffect(() => {
    if (!authChecked || !canManageAdmins(accessLevel)) {
      return;
    }
    let isMounted = true;
    const loadUsers = async () => {
      setAccessUsersLoading(true);
      setAccessUsersError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/access/users`, {
          credentials: "include"
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить доступы");
        }
        const data = (await response.json()) as { users?: AccessUser[] };
        if (isMounted) {
          setAccessUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch (err) {
        if (isMounted) {
          setAccessUsersError(err instanceof Error ? err.message : "Ошибка загрузки доступов");
        }
      } finally {
        if (isMounted) {
          setAccessUsersLoading(false);
        }
      }
    };
    void loadUsers();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, accessLevel]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadTips = async () => {
      setLoadingTipsLoading(true);
      setLoadingTipsError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/loading-tips`, {
          credentials: "include"
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить подсказки");
        }
        const data = (await response.json()) as { tips?: LoadingTip[] };
        if (!isMounted) {
          return;
        }
        setLoadingTips(Array.isArray(data.tips) ? data.tips : []);
      } catch (err) {
        if (isMounted) {
          setLoadingTipsError(
            err instanceof Error ? err.message : "Ошибка загрузки подсказок"
          );
        }
      } finally {
        if (isMounted) {
          setLoadingTipsLoading(false);
        }
      }
    };
    void loadTips();
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

  const runQueryWith = async (nextQuery: string) => {
    if (!nextQuery.trim()) {
      setError("Введите SQL запрос");
      return;
    }
    setQuery(nextQuery);
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${apiUrl}/admin/sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: nextQuery })
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

  const runQuery = async () => runQueryWith(query);

  const handleResetPassword = async () => {
    const email = passwordEmail.trim().toLowerCase();
    const nextPassword = passwordValue.trim();
    if (!email || !nextPassword) {
      setError("Введите email и новый пароль");
      return;
    }
    setPasswordLoading(true);
    setPasswordNotice(null);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, newPassword: nextPassword })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось изменить пароль");
      }
      setPasswordNotice("Пароль обновлён");
      setPasswordValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка изменения пароля");
    } finally {
      setPasswordLoading(false);
    }
  };

  const updateLoadingTip = (id: string, patch: Partial<LoadingTip>) => {
    setLoadingTips((prev) =>
      prev.map((tip) => (tip.id === id ? { ...tip, ...patch } : tip))
    );
  };

  const saveLoadingTip = async (tip: LoadingTip) => {
    setSavingTipId(tip.id);
    setLoadingTipsError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/loading-tips/${tip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: tip.text, isActive: tip.isActive })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сохранить подсказку");
      }
    } catch (err) {
      setLoadingTipsError(
        err instanceof Error ? err.message : "Ошибка сохранения подсказки"
      );
    } finally {
      setSavingTipId(null);
    }
  };

  const createLoadingTip = async () => {
    const text = newTipText.trim();
    if (!text) {
      setLoadingTipsError("Введите текст подсказки");
      return;
    }
    setCreatingTip(true);
    setLoadingTipsError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/loading-tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text })
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Не удалось добавить подсказку");
      }
      setNewTipText("");
      const listResponse = await fetch(`${apiUrl}/admin/loading-tips`, {
        credentials: "include"
      });
      if (listResponse.ok) {
        const data = (await listResponse.json()) as { tips?: LoadingTip[] };
        setLoadingTips(Array.isArray(data.tips) ? data.tips : []);
      }
    } catch (err) {
      setLoadingTipsError(
        err instanceof Error ? err.message : "Ошибка добавления подсказки"
      );
    } finally {
      setCreatingTip(false);
    }
  };

  const deleteLoadingTip = async (id: string) => {
    setDeletingTipId(id);
    setLoadingTipsError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/loading-tips/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Не удалось удалить подсказку");
      }
      setLoadingTips((prev) => prev.filter((tip) => tip.id !== id));
    } catch (err) {
      setLoadingTipsError(
        err instanceof Error ? err.message : "Ошибка удаления подсказки"
      );
    } finally {
      setDeletingTipId(null);
    }
  };

  const updateAccessRole = async (role: "USER" | "ADMIN") => {
    const email = roleEmail.trim().toLowerCase();
    if (!email) {
      setError("Введите email пользователя");
      return;
    }
    setRoleSaving(role);
    setRoleNotice(null);
    setAccessUsersError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/access/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, role })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось обновить доступ");
      }
      const data = (await response.json()) as { user?: AccessUser };
      if (data.user) {
        setAccessUsers((prev) => {
          const rest = prev.filter((item) => item.id !== data.user?.id);
          return [data.user as AccessUser, ...rest];
        });
      }
      setRoleNotice(role === "ADMIN" ? "Пользователь назначен админом" : "Пользователь понижен до user");
      setRoleEmail("");
    } catch (err) {
      setAccessUsersError(err instanceof Error ? err.message : "Ошибка обновления доступа");
    } finally {
      setRoleSaving(null);
    }
  };

  const handlePetAction = async (action: "disable" | "delete" | "memorial" | "photos") => {
    const rawId = petId.trim();
    if (!rawId) {
      setError("Укажите ID питомца");
      return;
    }
    const safeId = escapeSqlLiteral(rawId);
    let nextQuery = "";
    switch (action) {
      case "disable":
        nextQuery = `UPDATE "Pet" SET "isPublic" = false WHERE id = '${safeId}';`;
        break;
      case "delete":
        nextQuery = `DELETE FROM "Pet" WHERE id = '${safeId}';`;
        break;
      case "memorial":
        nextQuery = `DELETE FROM "Memorial" WHERE "petId" = '${safeId}';`;
        break;
      case "photos":
        nextQuery = `DELETE FROM "PetPhoto" WHERE "petId" = '${safeId}';`;
        break;
      default:
        return;
    }
    await runQueryWith(nextQuery);
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
              Смена пароля
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={passwordEmail}
                onChange={(event) => setPasswordEmail(event.target.value)}
                placeholder="Email пользователя"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <input
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                placeholder="Новый пароль"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={passwordLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {passwordLoading ? "Сохраняем..." : "Сменить пароль"}
              </button>
              {passwordNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {passwordNotice}
                </div>
              ) : null}
            </div>
          </div>

          {canManageAdmins(accessLevel) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Управление доступами
              </div>
              <div className="mt-3 grid gap-2">
                <input
                  value={roleEmail}
                  onChange={(event) => setRoleEmail(event.target.value)}
                  placeholder="Email пользователя"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => updateAccessRole("ADMIN")}
                    disabled={roleSaving !== null}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  >
                    {roleSaving === "ADMIN" ? "Сохраняем..." : "Сделать админом"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAccessRole("USER")}
                    disabled={roleSaving !== null}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  >
                    {roleSaving === "USER" ? "Сохраняем..." : "Понизить до user"}
                  </button>
                </div>
                {roleNotice ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                    {roleNotice}
                  </div>
                ) : null}
                {accessUsersError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                    {accessUsersError}
                  </div>
                ) : null}
                <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
                  {accessUsersLoading && accessUsers.length === 0 ? (
                    <div className="text-xs text-slate-500">Загрузка...</div>
                  ) : null}
                  {accessUsers.map((user) => (
                    <div key={user.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-800">
                        {user.email}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span>{user.login || "—"}</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${
                          user.accessLevel === "OWNER"
                            ? "bg-amber-100 text-amber-700"
                            : user.accessLevel === "ADMIN"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {user.accessLevel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Питомец по ID
            </div>
            <input
              value={petId}
              onChange={(event) => setPetId(event.target.value)}
              placeholder="ID питомца"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            />
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => handlePetAction("disable")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                Отключить питомца (сделать приватным)
              </button>
              <button
                type="button"
                onClick={() => handlePetAction("memorial")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                Удалить мемориал
              </button>
              <button
                type="button"
                onClick={() => handlePetAction("photos")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                Удалить фото питомца
              </button>
              <button
                type="button"
                onClick={() => handlePetAction("delete")}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs font-semibold text-red-700 hover:border-red-300"
              >
                Удалить питомца полностью
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Удаление питомца также удалит маркер, мемориал и фото по каскаду.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Подсказки загрузки
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex flex-col gap-2">
                <input
                  value={newTipText}
                  onChange={(event) => setNewTipText(event.target.value)}
                  placeholder="Новая подсказка"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={createLoadingTip}
                  disabled={creatingTip}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                >
                  {creatingTip ? "Добавляем..." : "Добавить подсказку"}
                </button>
              </div>
              {loadingTipsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {loadingTipsError}
                </div>
              ) : null}
              <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                {loadingTipsLoading && loadingTips.length === 0 ? (
                  <div className="text-xs text-slate-500">Загрузка...</div>
                ) : null}
                {!loadingTipsLoading && loadingTips.length === 0 ? (
                  <div className="text-xs text-slate-500">Пока нет подсказок</div>
                ) : null}
                {loadingTips.map((tip) => (
                  <div
                    key={tip.id}
                    className="rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <textarea
                      value={tip.text}
                      onChange={(event) =>
                        updateLoadingTip(tip.id, { text: event.target.value })
                      }
                      className="min-h-[60px] w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={tip.isActive}
                          onChange={(event) =>
                            updateLoadingTip(tip.id, { isActive: event.target.checked })
                          }
                        />
                        Активна
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveLoadingTip(tip)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                          disabled={savingTipId === tip.id}
                        >
                          {savingTipId === tip.id ? "Сохраняем..." : "Сохранить"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLoadingTip(tip.id)}
                          className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
                          disabled={deletingTipId === tip.id}
                        >
                          {deletingTipId === tip.id ? "Удаляем..." : "Удалить"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
