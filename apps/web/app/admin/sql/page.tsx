"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

const LOAD_TEST_PRESETS = [
  { label: "Лёгкий", totalRequests: 30, concurrency: 5 },
  { label: "Средний", totalRequests: 100, concurrency: 10 },
  { label: "Тяжёлый", totalRequests: 250, concurrency: 20 }
] as const;

const SYNTHETIC_USER_PRESETS = [
  { label: "20 VU", virtualUsers: 20, durationMs: 25_000 },
  { label: "50 VU", virtualUsers: 50, durationMs: 35_000 },
  { label: "100 VU", virtualUsers: 100, durationMs: 45_000 }
] as const;

const SYNTHETIC_SCENARIOS = [
  { id: "map", label: "Карта", weight: 40 },
  { id: "myPets", label: "Мои питомцы", weight: 25 },
  { id: "memorial", label: "Страница мемориала", weight: 20 },
  { id: "gift", label: "Дарение подарка", weight: 10 },
  { id: "edit", label: "Редактирование", weight: 5 }
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
  maxMemorials: number;
  memorialCount: number;
  createdAt?: string;
};

type LoadProbeResponse = {
  ok: boolean;
  dbMs: number;
  serverMs: number;
  at: string;
};

type LoadTestProgress = {
  label: string;
  totalRequests: number;
  concurrency: number;
  completed: number;
  okCount: number;
  failCount: number;
};

type LoadTestSummary = LoadTestProgress & {
  totalDurationMs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  minMs: number;
  requestsPerSecond: number;
  avgServerMs: number | null;
  p95ServerMs: number | null;
  wasAborted: boolean;
};

type SyntheticScenarioId = (typeof SYNTHETIC_SCENARIOS)[number]["id"];

type SyntheticScenarioCounts = Record<SyntheticScenarioId, number>;

type SyntheticAuthUser = {
  id: string;
};

type SyntheticMarker = {
  petId: string;
};

type SyntheticPetRecord = {
  id: string;
  ownerId?: string | null;
};

type SyntheticRunProgress = {
  label: string;
  virtualUsers: number;
  durationMs: number;
  elapsedMs: number;
  activeUsers: number;
  completedFlows: number;
  totalRequests: number;
  okCount: number;
  failCount: number;
  scenarioCounts: SyntheticScenarioCounts;
};

type SyntheticRunSummary = Omit<SyntheticRunProgress, "elapsedMs" | "activeUsers"> & {
  actualDurationMs: number;
  avgRequestMs: number;
  p95RequestMs: number;
  maxRequestMs: number;
  avgFlowMs: number;
  p95FlowMs: number;
  flowsPerMinute: number;
  requestsPerSecond: number;
  wasAborted: boolean;
};

const buildSelectQuery = (tableName: string, limit = 50) =>
  `SELECT * FROM "${tableName}" LIMIT ${limit};`;

const buildCountQuery = (tableName: string) =>
  `SELECT count(*) FROM "${tableName}";`;
const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");

const getAverage = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getPercentile = (values: number[], percentile: number) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
  );
  return sorted[index] ?? 0;
};

const formatMs = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(value >= 100 ? 0 : 1)} мс`;

const isAbortError = (value: unknown) =>
  value instanceof DOMException && value.name === "AbortError";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

const createEmptySyntheticScenarioCounts = (): SyntheticScenarioCounts => ({
  map: 0,
  myPets: 0,
  memorial: 0,
  gift: 0,
  edit: 0
});

const chooseWeightedScenario = () => {
  const totalWeight = SYNTHETIC_SCENARIOS.reduce((sum, item) => sum + item.weight, 0);
  let point = Math.random() * totalWeight;
  for (const item of SYNTHETIC_SCENARIOS) {
    point -= item.weight;
    if (point <= 0) {
      return item;
    }
  }
  return SYNTHETIC_SCENARIOS[SYNTHETIC_SCENARIOS.length - 1] ?? SYNTHETIC_SCENARIOS[0]!;
};

const pickRandom = <T,>(items: T[]) =>
  items.length > 0 ? items[Math.floor(Math.random() * items.length)] ?? null : null;

const describeLoadSummary = (summary: LoadTestSummary) => {
  if (summary.wasAborted) {
    return "Прогон остановлен вручную. Метрики ниже относятся только к уже завершённым запросам.";
  }
  if (summary.failCount > 0) {
    return "Есть ошибки ответов. На этой нагрузке сервис уже начал давать сбои или упёрся в лимиты.";
  }
  if (summary.p95Ms <= 250) {
    return "Прогон прошёл без ошибок и с низкой задержкой. Для такого профиля нагрузка лёгкая.";
  }
  if (summary.p95Ms <= 800) {
    return "Прогон прошёл без ошибок, но задержка уже заметна. Нагрузка умеренная.";
  }
  return "Прогон завершился без падения, но задержка высокая. Здесь уже есть смысл профилировать API и базу.";
};

const describeSyntheticSummary = (summary: SyntheticRunSummary) => {
  if (summary.wasAborted) {
    return "Сценарий остановлен вручную. Метрики относятся только к уже завершённым действиям виртуальных пользователей.";
  }
  if (summary.failCount > 0) {
    return "Есть ошибки ответов. Это уже похоже на перегрузку части сценариев или проблемы с таймингами под текущим числом виртуальных пользователей.";
  }
  if (summary.p95RequestMs <= 400 && summary.p95FlowMs <= 1800) {
    return "Сервис уверенно выдержал этот профиль синтетических пользователей. Для такого VU уровня запас ещё есть.";
  }
  if (summary.p95RequestMs <= 900 && summary.p95FlowMs <= 3500) {
    return "Сервис справился, но задержка уже заметна. Это рабочая, но не совсем комфортная нагрузка.";
  }
  return "Сценарий проходит тяжело: пользователи ещё не отваливаются массово, но задержка уже высокая. Имеет смысл профилировать web, API и базу.";
};

export default function AdminSqlPage() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const loadTestAbortRef = useRef<AbortController | null>(null);
  const syntheticAbortRef = useRef<AbortController | null>(null);
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
  const [limitEmails, setLimitEmails] = useState("");
  const [limitValue, setLimitValue] = useState("5");
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestError, setLoadTestError] = useState<string | null>(null);
  const [loadTestProgress, setLoadTestProgress] = useState<LoadTestProgress | null>(null);
  const [loadTestSummary, setLoadTestSummary] = useState<LoadTestSummary | null>(null);
  const [syntheticRunning, setSyntheticRunning] = useState(false);
  const [syntheticError, setSyntheticError] = useState<string | null>(null);
  const [syntheticProgress, setSyntheticProgress] = useState<SyntheticRunProgress | null>(null);
  const [syntheticSummary, setSyntheticSummary] = useState<SyntheticRunSummary | null>(null);

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
    return () => {
      loadTestAbortRef.current?.abort();
      syntheticAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
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
  }, [apiUrl, authChecked, isAdmin]);

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

  const updateMemorialLimit = async () => {
    const emails = limitEmails
      .split(/[,\n;]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const maxMemorials = Number(limitValue);
    if (emails.length === 0) {
      setError("Введите хотя бы один email");
      return;
    }
    if (!Number.isInteger(maxMemorials) || maxMemorials < 0 || maxMemorials > 10000) {
      setError("Лимит должен быть целым числом от 0 до 10000");
      return;
    }
    setLimitSaving(true);
    setLimitNotice(null);
    setAccessUsersError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/access/memorial-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emails, maxMemorials })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось обновить лимит");
      }
      const data = (await response.json()) as {
        users?: AccessUser[];
        missingEmails?: string[];
        skippedOwners?: string[];
      };
      if (Array.isArray(data.users)) {
        setAccessUsers((prev) => {
          const next = new Map(prev.map((user) => [user.id, user]));
          data.users!.forEach((user) => next.set(user.id, user));
          return Array.from(next.values());
        });
      }
      const details = [
        data.missingEmails?.length ? `не найдены: ${data.missingEmails.join(", ")}` : "",
        data.skippedOwners?.length ? `owner не менялся: ${data.skippedOwners.join(", ")}` : ""
      ].filter(Boolean);
      setLimitNotice(
        details.length > 0
          ? `Лимит обновлён. ${details.join("; ")}`
          : "Лимит мемориалов обновлён"
      );
    } catch (err) {
      setAccessUsersError(err instanceof Error ? err.message : "Ошибка обновления лимита");
    } finally {
      setLimitSaving(false);
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

  const stopLoadTest = () => {
    loadTestAbortRef.current?.abort();
  };

  const runLoadTest = async (preset: (typeof LOAD_TEST_PRESETS)[number]) => {
    if (loadTestRunning) {
      return;
    }
    const controller = new AbortController();
    loadTestAbortRef.current = controller;
    setLoadTestRunning(true);
    setLoadTestError(null);
    setLoadTestSummary(null);
    setLoadTestProgress({
      label: preset.label,
      totalRequests: preset.totalRequests,
      concurrency: preset.concurrency,
      completed: 0,
      okCount: 0,
      failCount: 0
    });

    const latencies: number[] = [];
    const serverLatencies: number[] = [];
    let nextRequestIndex = 0;
    let completed = 0;
    let okCount = 0;
    let failCount = 0;
    const startedAt = performance.now();

    const updateProgress = () => {
      setLoadTestProgress({
        label: preset.label,
        totalRequests: preset.totalRequests,
        concurrency: preset.concurrency,
        completed,
        okCount,
        failCount
      });
    };

    const worker = async () => {
      while (true) {
        if (controller.signal.aborted) {
          return;
        }
        const currentIndex = nextRequestIndex;
        nextRequestIndex += 1;
        if (currentIndex >= preset.totalRequests) {
          return;
        }
        const requestStartedAt = performance.now();
        try {
          const response = await fetch(`${apiUrl}/admin/load-probe`, {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal
          });
          const duration = performance.now() - requestStartedAt;
          latencies.push(duration);
          if (!response.ok) {
            failCount += 1;
          } else {
            okCount += 1;
            const data = (await response.json()) as LoadProbeResponse;
            if (typeof data.serverMs === "number") {
              serverLatencies.push(data.serverMs);
            }
          }
        } catch (err) {
          if (controller.signal.aborted) {
            return;
          }
          latencies.push(performance.now() - requestStartedAt);
          failCount += 1;
        } finally {
          if (!controller.signal.aborted) {
            completed += 1;
            updateProgress();
          }
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: preset.concurrency }, () => worker())
      );
    } finally {
      const totalDurationMs = performance.now() - startedAt;
      const wasAborted = controller.signal.aborted;
      const summary: LoadTestSummary = {
        label: preset.label,
        totalRequests: preset.totalRequests,
        concurrency: preset.concurrency,
        completed,
        okCount,
        failCount,
        totalDurationMs,
        avgMs: getAverage(latencies),
        p95Ms: getPercentile(latencies, 95),
        maxMs: latencies.length > 0 ? Math.max(...latencies) : 0,
        minMs: latencies.length > 0 ? Math.min(...latencies) : 0,
        requestsPerSecond:
          totalDurationMs > 0 ? completed / (totalDurationMs / 1000) : 0,
        avgServerMs: serverLatencies.length > 0 ? getAverage(serverLatencies) : null,
        p95ServerMs:
          serverLatencies.length > 0 ? getPercentile(serverLatencies, 95) : null,
        wasAborted
      };
      setLoadTestSummary(summary);
      updateProgress();
      if (wasAborted) {
        setLoadTestError("Прогон остановлен вручную");
      }
      loadTestAbortRef.current = null;
      setLoadTestRunning(false);
    }
  };

  const stopSyntheticRun = () => {
    syntheticAbortRef.current?.abort();
  };

  const runSyntheticUsers = async (preset: (typeof SYNTHETIC_USER_PRESETS)[number]) => {
    if (syntheticRunning) {
      return;
    }
    const controller = new AbortController();
    syntheticAbortRef.current = controller;
    setSyntheticRunning(true);
    setSyntheticError(null);
    setSyntheticSummary(null);

    const scenarioCounts = createEmptySyntheticScenarioCounts();
    const requestLatencies: number[] = [];
    const flowLatencies: number[] = [];
    let totalRequests = 0;
    let okCount = 0;
    let failCount = 0;
    let completedFlows = 0;
    let activeUsers = 0;
    const startedAt = performance.now();
    const runUntil = startedAt + preset.durationMs;
    let lastProgressCommit = 0;

    const commitProgress = (force = false) => {
      const now = performance.now();
      if (!force && now - lastProgressCommit < 180) {
        return;
      }
      lastProgressCommit = now;
      setSyntheticProgress({
        label: preset.label,
        virtualUsers: preset.virtualUsers,
        durationMs: preset.durationMs,
        elapsedMs: Math.min(preset.durationMs, now - startedAt),
        activeUsers,
        completedFlows,
        totalRequests,
        okCount,
        failCount,
        scenarioCounts: { ...scenarioCounts }
      });
    };

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const uniqueSuffix = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const withSyntheticQuery = (path: string) =>
      `${origin}${path}${path.includes("?") ? "&" : "?"}synthetic=${uniqueSuffix()}`;

    const requestText = async (url: string, init?: RequestInit) => {
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
          ...init
        });
        const duration = performance.now() - requestStartedAt;
        requestLatencies.push(duration);
        totalRequests += 1;
        if (!response.ok) {
          failCount += 1;
          commitProgress();
          return null;
        }
        okCount += 1;
        commitProgress();
        return response;
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) {
          throw err;
        }
        requestLatencies.push(performance.now() - requestStartedAt);
        totalRequests += 1;
        failCount += 1;
        commitProgress();
        return null;
      }
    };

    const requestJson = async <T,>(url: string, init?: RequestInit) => {
      const response = await requestText(url, init);
      if (!response) {
        return null;
      }
      try {
        return (await response.json()) as T;
      } catch {
        failCount += 1;
        return null;
      }
    };

    const me = await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
    if (!me?.id) {
      setSyntheticRunning(false);
      setSyntheticError("Не удалось подготовить сценарий: auth/me не вернул пользователя");
      syntheticAbortRef.current = null;
      return;
    }
    const ownerPets =
      (await requestJson<SyntheticPetRecord[]>(
        `${apiUrl}/pets?ownerId=${encodeURIComponent(me.id)}`
      )) ?? [];
    const publicMarkers =
      (await requestJson<SyntheticMarker[]>(`${apiUrl}/map/markers`)) ?? [];

    const ownerPetIds = ownerPets.map((item) => item.id).filter(Boolean);
    const publicPetIds = Array.from(
      new Set(publicMarkers.map((item) => item.petId).filter(Boolean))
    );

    const pickOwnerPetId = () => pickRandom(ownerPetIds) ?? pickRandom(publicPetIds);
    const pickPublicPetId = () => pickRandom(publicPetIds) ?? pickRandom(ownerPetIds);

    const runScenario = async (scenarioId: SyntheticScenarioId) => {
      switch (scenarioId) {
        case "map": {
          const pageResponse = await requestText(withSyntheticQuery("/map"));
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticMarker[]>(`${apiUrl}/map/markers`);
          const petId = pickPublicPetId();
          if (petId) {
            await requestJson<SyntheticPetRecord>(`${apiUrl}/pets/${petId}`);
          }
          return;
        }
        case "myPets": {
          const pageResponse = await requestText(withSyntheticQuery("/my-pets"));
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          await requestJson<SyntheticPetRecord[]>(
            `${apiUrl}/pets?ownerId=${encodeURIComponent(me.id)}`
          );
          return;
        }
        case "memorial": {
          const petId = pickPublicPetId();
          if (!petId) {
            return runScenario("map");
          }
          const pageResponse = await requestText(withSyntheticQuery(`/pets/${petId}`));
          await pageResponse?.text().catch(() => null);
          const pet = await requestJson<SyntheticPetRecord>(`${apiUrl}/pets/${petId}`);
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          if (pet?.ownerId) {
            await requestJson<SyntheticPetRecord[]>(
              `${apiUrl}/pets?ownerId=${encodeURIComponent(pet.ownerId)}`
            );
          }
          return;
        }
        case "gift": {
          const petId = pickPublicPetId();
          if (!petId) {
            return runScenario("memorial");
          }
          const pageResponse = await requestText(withSyntheticQuery(`/pets/${petId}`));
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticPetRecord>(`${apiUrl}/pets/${petId}`);
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          await requestJson<unknown[]>(`${apiUrl}/gifts`);
          await requestJson<unknown>(`${apiUrl}/wallet/${encodeURIComponent(me.id)}`);
          return;
        }
        case "edit": {
          const petId = pickOwnerPetId();
          if (!petId) {
            return runScenario("myPets");
          }
          const pageResponse = await requestText(withSyntheticQuery(`/create?edit=${petId}`));
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          await requestJson<unknown[]>(`${apiUrl}/content/loading-tips`);
          await requestJson<unknown>(`${apiUrl}/wallet/${encodeURIComponent(me.id)}`);
          await requestJson<SyntheticPetRecord>(`${apiUrl}/pets/${petId}`);
          return;
        }
      }
    };

    const worker = async () => {
      while (!controller.signal.aborted && performance.now() < runUntil) {
        const scenario = chooseWeightedScenario();
        activeUsers += 1;
        commitProgress();
        const flowStartedAt = performance.now();
        try {
          await runScenario(scenario.id);
        } catch (err) {
          if (isAbortError(err) || controller.signal.aborted) {
            return;
          }
          failCount += 1;
        } finally {
          flowLatencies.push(performance.now() - flowStartedAt);
          completedFlows += 1;
          scenarioCounts[scenario.id] += 1;
          activeUsers = Math.max(0, activeUsers - 1);
          commitProgress();
        }
        if (performance.now() >= runUntil || controller.signal.aborted) {
          return;
        }
        await sleep(1800 + Math.random() * 3400, controller.signal);
      }
    };

    setSyntheticProgress({
      label: preset.label,
      virtualUsers: preset.virtualUsers,
      durationMs: preset.durationMs,
      elapsedMs: 0,
      activeUsers: 0,
      completedFlows: 0,
      totalRequests,
      okCount,
      failCount,
      scenarioCounts: { ...scenarioCounts }
    });

    try {
      await Promise.all(
        Array.from({ length: preset.virtualUsers }, () => worker())
      );
    } catch (err) {
      if (!isAbortError(err) && !controller.signal.aborted) {
        setSyntheticError(err instanceof Error ? err.message : "Ошибка синтетического прогона");
      }
    } finally {
      const actualDurationMs = performance.now() - startedAt;
      const wasAborted = controller.signal.aborted;
      const summary: SyntheticRunSummary = {
        label: preset.label,
        virtualUsers: preset.virtualUsers,
        durationMs: preset.durationMs,
        completedFlows,
        totalRequests,
        okCount,
        failCount,
        scenarioCounts: { ...scenarioCounts },
        actualDurationMs,
        avgRequestMs: getAverage(requestLatencies),
        p95RequestMs: getPercentile(requestLatencies, 95),
        maxRequestMs: requestLatencies.length > 0 ? Math.max(...requestLatencies) : 0,
        avgFlowMs: getAverage(flowLatencies),
        p95FlowMs: getPercentile(flowLatencies, 95),
        flowsPerMinute: actualDurationMs > 0 ? completedFlows / (actualDurationMs / 60000) : 0,
        requestsPerSecond: actualDurationMs > 0 ? totalRequests / (actualDurationMs / 1000) : 0,
        wasAborted
      };
      setSyntheticSummary(summary);
      setSyntheticProgress({
        label: preset.label,
        virtualUsers: preset.virtualUsers,
        durationMs: preset.durationMs,
        elapsedMs: Math.min(preset.durationMs, actualDurationMs),
        activeUsers: 0,
        completedFlows,
        totalRequests,
        okCount,
        failCount,
        scenarioCounts: { ...scenarioCounts }
      });
      if (wasAborted) {
        setSyntheticError("Синтетический прогон остановлен вручную");
      }
      syntheticAbortRef.current = null;
      setSyntheticRunning(false);
    }
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

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Лимит мемориалов
            </div>
            <div className="mt-3 grid gap-2">
              <textarea
                value={limitEmails}
                onChange={(event) => setLimitEmails(event.target.value)}
                placeholder="Email или несколько email через запятую / с новой строки"
                className="min-h-[76px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <input
                type="number"
                min={0}
                max={10000}
                value={limitValue}
                onChange={(event) => setLimitValue(event.target.value)}
                placeholder="Максимум мемориалов"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={updateMemorialLimit}
                disabled={limitSaving}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {limitSaving ? "Сохраняем..." : "Обновить лимит"}
              </button>
              <p className="text-[11px] text-slate-500">
                По умолчанию — 5 мемориалов. Для owner всегда действует лимит 10000.
              </p>
              {limitNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {limitNotice}
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
                      <div className="mt-1 text-[10px] text-slate-500">
                        Мемориалов: {user.memorialCount ?? 0}/{user.maxMemorials ?? 5}
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
            <div className="text-xs font-semibold uppercase text-slate-500">
              Нагрузочный прогон
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Браузер запускает серию параллельных admin-only запросов к API с DB probe.
              Это удобный smoke-тест под реальной HTTP-нагрузкой, но не полноценный benchmark.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {LOAD_TEST_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => runLoadTest(preset)}
                  disabled={loadTestRunning}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                >
                  <div>{preset.label}</div>
                  <div className="mt-1 text-[10px] font-normal text-slate-500">
                    {preset.totalRequests} запросов, concurrency {preset.concurrency}
                  </div>
                </button>
              ))}
            </div>
            {loadTestRunning ? (
              <button
                type="button"
                onClick={stopLoadTest}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs font-semibold text-red-700 hover:border-red-300"
              >
                Остановить прогон
              </button>
            ) : null}
            {loadTestProgress ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800">
                    {loadTestProgress.label}: {loadTestProgress.completed}/{loadTestProgress.totalRequests}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ok {loadTestProgress.okCount} · fail {loadTestProgress.failCount} · concurrency {loadTestProgress.concurrency}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        loadTestProgress.totalRequests > 0
                          ? (loadTestProgress.completed / loadTestProgress.totalRequests) * 100
                          : 0
                      )}%`
                    }}
                  />
                </div>
              </div>
            ) : null}
            {loadTestSummary ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div>
                    Всего времени: <span className="font-semibold text-slate-800">{formatMs(loadTestSummary.totalDurationMs)}</span>
                  </div>
                  <div>
                    Скорость: <span className="font-semibold text-slate-800">{loadTestSummary.requestsPerSecond.toFixed(1)} req/s</span>
                  </div>
                  <div>
                    Средняя задержка: <span className="font-semibold text-slate-800">{formatMs(loadTestSummary.avgMs)}</span>
                  </div>
                  <div>
                    P95: <span className="font-semibold text-slate-800">{formatMs(loadTestSummary.p95Ms)}</span>
                  </div>
                  <div>
                    Max: <span className="font-semibold text-slate-800">{formatMs(loadTestSummary.maxMs)}</span>
                  </div>
                  <div>
                    Server P95: <span className="font-semibold text-slate-800">{formatMs(loadTestSummary.p95ServerMs)}</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  {describeLoadSummary(loadTestSummary)}
                </p>
              </div>
            ) : null}
            {loadTestError ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                {loadTestError}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Синтетические пользователи
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Это приближённая симуляция онлайн-пользователей: виртуальные пользователи
              крутят реальные сценарии проекта с паузами между действиями. Профиль:
              карта 40%, мои питомцы 25%, мемориал 20%, подарок 10%, редактирование 5%.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {SYNTHETIC_USER_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => runSyntheticUsers(preset)}
                  disabled={syntheticRunning}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                >
                  <div>{preset.label}</div>
                  <div className="mt-1 text-[10px] font-normal text-slate-500">
                    {Math.round(preset.durationMs / 1000)} сек, до {preset.virtualUsers} VU
                  </div>
                </button>
              ))}
            </div>
            {syntheticRunning ? (
              <button
                type="button"
                onClick={stopSyntheticRun}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs font-semibold text-red-700 hover:border-red-300"
              >
                Остановить сценарий
              </button>
            ) : null}
            {syntheticProgress ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800">
                    {syntheticProgress.label}: {Math.round(syntheticProgress.elapsedMs / 1000)} / {Math.round(syntheticProgress.durationMs / 1000)} сек
                  </div>
                  <div className="text-[11px] text-slate-500">
                    active {syntheticProgress.activeUsers} · flows {syntheticProgress.completedFlows} · req {syntheticProgress.totalRequests}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        syntheticProgress.durationMs > 0
                          ? (syntheticProgress.elapsedMs / syntheticProgress.durationMs) * 100
                          : 0
                      )}%`
                    }}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div>ok {syntheticProgress.okCount} · fail {syntheticProgress.failCount}</div>
                  <div>виртуальных пользователей: {syntheticProgress.virtualUsers}</div>
                  {SYNTHETIC_SCENARIOS.map((scenario) => (
                    <div key={scenario.id}>
                      {scenario.label}: {syntheticProgress.scenarioCounts[scenario.id]}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {syntheticSummary ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div>
                    Длительность: <span className="font-semibold text-slate-800">{formatMs(syntheticSummary.actualDurationMs)}</span>
                  </div>
                  <div>
                    Скорость: <span className="font-semibold text-slate-800">{syntheticSummary.requestsPerSecond.toFixed(1)} req/s</span>
                  </div>
                  <div>
                    Средний request: <span className="font-semibold text-slate-800">{formatMs(syntheticSummary.avgRequestMs)}</span>
                  </div>
                  <div>
                    P95 request: <span className="font-semibold text-slate-800">{formatMs(syntheticSummary.p95RequestMs)}</span>
                  </div>
                  <div>
                    Средний flow: <span className="font-semibold text-slate-800">{formatMs(syntheticSummary.avgFlowMs)}</span>
                  </div>
                  <div>
                    P95 flow: <span className="font-semibold text-slate-800">{formatMs(syntheticSummary.p95FlowMs)}</span>
                  </div>
                  <div>
                    Max request: <span className="font-semibold text-slate-800">{formatMs(syntheticSummary.maxRequestMs)}</span>
                  </div>
                  <div>
                    Flow/min: <span className="font-semibold text-slate-800">{syntheticSummary.flowsPerMinute.toFixed(1)}</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  {describeSyntheticSummary(syntheticSummary)}
                </p>
              </div>
            ) : null}
            {syntheticError ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                {syntheticError}
              </div>
            ) : null}
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
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[#fcf8f5] px-6 py-10">
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
