"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ErrorToast from "../../../components/ErrorToast";
import { API_BASE } from "../../../lib/config";

type AuthUser = {
  id: string;
  email: string;
  login?: string | null;
  accessLevel?: "OWNER" | "ADMIN" | "USER";
};

type ModerationStatus = "PENDING" | "APPROVED" | "NEEDS_CHANGES" | "ALL";
type PendingReviewFilter = "ALL" | "INITIAL" | "REVISION";

type ModerationPet = {
  id: string;
  name: string;
  species?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  epitaph?: string | null;
  story?: string | null;
  isPublic: boolean;
  moderationStatus: Exclude<ModerationStatus, "ALL">;
  moderationComment?: string | null;
  moderationReviewType?: "INITIAL" | "REVISION" | string | null;
  moderationChangedBlocks?: string[] | null;
  createdAt: string;
  owner?: { id: string; email: string; login?: string | null } | null;
  marker?: { lat: number; lng: number; markerStyle?: string | null } | null;
  memorial?: {
    environmentId?: string | null;
    houseId?: string | null;
    activeUntil?: string | null;
  } | null;
  photos?: Array<{ id: string; url: string; sortOrder: number }>;
};

const statusTabs: Array<{ value: ModerationStatus; label: string }> = [
  { value: "PENDING", label: "На проверке" },
  { value: "NEEDS_CHANGES", label: "На правках" },
  { value: "APPROVED", label: "Одобрены" },
  { value: "ALL", label: "Все" },
];

const statusLabels: Record<Exclude<ModerationStatus, "ALL">, string> = {
  PENDING: "На модерации",
  APPROVED: "Одобрен",
  NEEDS_CHANGES: "Нужно поправить",
};

const pendingReviewTabs: Array<{ value: PendingReviewFilter; label: string }> = [
  { value: "ALL", label: "Все" },
  { value: "INITIAL", label: "Первичная" },
  { value: "REVISION", label: "Повторная" },
];

const moderationBlockLabels: Record<string, string> = {
  basic: "Основные данные",
  story: "История",
  photos: "Фотографии",
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "Без даты";
  }
  return new Date(value).toLocaleDateString("ru-RU");
};

export default function AdminModerationClient() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<ModerationStatus>("PENDING");
  const [pendingReviewFilter, setPendingReviewFilter] =
    useState<PendingReviewFilter>("ALL");
  const [pets, setPets] = useState<ModerationPet[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        router.replace(`/auth?next=${encodeURIComponent("/admin/moderation")}`);
        return;
      }
      const data = (await response.json()) as AuthUser;
      if (!cancelled) {
        setIsAdmin(
          data.accessLevel === "ADMIN" || data.accessLevel === "OWNER",
        );
        setAuthChecked(true);
      }
    }
    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, router]);

  const resolveImageUrl = useCallback(
    (url?: string | null) => {
      if (!url) {
        return null;
      }
      return url.startsWith("http") ? url : `${apiUrl}${url}`;
    },
    [apiUrl],
  );

  const loadPets = useCallback(async () => {
    if (!authChecked || !isAdmin) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiUrl}/admin/moderation?status=${encodeURIComponent(status)}`,
        { credentials: "include" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? "Не удалось загрузить модерацию");
      }
      setPets(Array.isArray(data?.pets) ? data.pets : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить модерацию",
      );
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authChecked, isAdmin, status]);

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  const updateStatus = async (
    petId: string,
    nextStatus: Exclude<ModerationStatus, "ALL">,
  ) => {
    setActionId(petId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `${apiUrl}/admin/moderation/${encodeURIComponent(petId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            comment: comments[petId]?.trim() || undefined,
          }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? "Не удалось обновить статус");
      }
      setNotice(
        data?.mailError
          ? `Статус обновлен, но письмо не отправилось: ${data.mailError}`
          : nextStatus === "APPROVED"
            ? "Мемориал одобрен, письмо отправлено владельцу."
            : "Мемориал возвращен на правки, письмо отправлено владельцу.",
      );
      setComments((prev) => ({ ...prev, [petId]: "" }));
      await loadPets();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось обновить статус",
      );
    } finally {
      setActionId(null);
    }
  };

  const visiblePets = useMemo(() => {
    if (status !== "PENDING" || pendingReviewFilter === "ALL") {
      return pets;
    }
    return pets.filter((pet) =>
      pendingReviewFilter === "REVISION"
        ? pet.moderationReviewType === "REVISION"
        : pet.moderationReviewType !== "REVISION",
    );
  }, [pendingReviewFilter, pets, status]);

  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[#fcf8f5] px-4 py-8 text-[#5d4037] sm:px-6">
      <div className="mx-auto w-full max-w-[1320px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d3a27f]">
              Админ
            </p>
            <h1 className="mt-1 text-3xl font-black">Модерация мемориалов</h1>
          </div>
          <Link
            href="/admin/sql"
            className="rounded-[18px] bg-[#fffcf9] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#5d4037] shadow-[0_12px_28px_rgba(93,64,55,0.12)] transition hover:-translate-y-0.5"
          >
            SQL панель
          </Link>
        </div>

        <div className="mt-6 rounded-[30px] border-[5px] border-white bg-[#efe6e2] p-3 shadow-[0_26px_70px_rgba(93,64,55,0.16)]">
          <div className="rounded-[24px] bg-white/80 p-4">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  className={`rounded-[16px] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                    status === tab.value
                      ? "bg-[#111827] text-white shadow-[0_4px_0_#000]"
                      : "bg-[#fffcf9] text-[#8d6e63] hover:bg-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {status === "PENDING" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingReviewTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setPendingReviewFilter(tab.value)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                      pendingReviewFilter === tab.value
                        ? "bg-[#5d4037] text-white"
                        : "bg-[#fffcf9] text-[#8d6e63] hover:bg-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            {!authChecked ? (
              <div className="mt-6 rounded-2xl bg-[#f7f1ee] p-5 text-sm font-bold text-[#8d6e63]">
                Проверяем доступ...
              </div>
            ) : !isAdmin ? (
              <div className="mt-6 rounded-2xl bg-[#fff2ef] p-5 text-sm font-bold text-[#9a5a4c]">
                Доступ запрещен.
              </div>
            ) : loading ? (
              <div className="mt-6 rounded-2xl bg-[#f7f1ee] p-5 text-sm font-bold text-[#8d6e63]">
                Загружаем очередь...
              </div>
            ) : visiblePets.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-[#f7f1ee] p-5 text-sm font-bold text-[#8d6e63]">
                Мемориалов в этом статусе нет.
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {visiblePets.map((pet) => {
                  const previewUrl = resolveImageUrl(pet.photos?.[0]?.url);
                  const isRevision = pet.moderationReviewType === "REVISION";
                  const changedBlocks = (pet.moderationChangedBlocks ?? [])
                    .map((block) => moderationBlockLabels[block] ?? block)
                    .filter(Boolean);
                  return (
                    <article
                      key={pet.id}
                      className="grid gap-4 rounded-[26px] border border-white bg-[#fffcf9] p-4 shadow-[0_16px_35px_rgba(93,64,55,0.1)] lg:grid-cols-[170px_minmax(0,1fr)_320px]"
                    >
                      <div className="aspect-square overflow-hidden rounded-[22px] bg-[#f1e7e0]">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={pet.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-black uppercase tracking-[0.14em] text-[#b0a29c]">
                            Без фото
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#f7f1ee] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                            {statusLabels[pet.moderationStatus]}
                          </span>
                          <span className="rounded-full bg-[#f7f1ee] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                            {pet.isPublic ? "Публичный" : "Приватный"}
                          </span>
                          {pet.moderationStatus === "PENDING" ? (
                            <span
                              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                isRevision
                                  ? "bg-[#fff2ef] text-[#9a5a4c]"
                                  : "bg-[#e9f6ef] text-[#3b6b58]"
                              }`}
                            >
                              {isRevision ? "Повторная проверка" : "Первичная проверка"}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-3 truncate text-2xl font-black">
                          {pet.name}
                        </h2>
                        <p className="mt-1 text-sm font-bold text-[#8d6e63]">
                          {formatDate(pet.birthDate)} —{" "}
                          {formatDate(pet.deathDate)}
                        </p>
                        <p className="mt-2 text-sm font-bold text-[#6d4c41]">
                          Владелец:{" "}
                          {pet.owner?.login ?? pet.owner?.email ?? "—"}
                        </p>
                        <div className="mt-3 grid gap-2 text-sm text-[#6f6360]">
                          <p>
                            <span className="font-black text-[#5d4037]">
                              Эпитафия:
                            </span>{" "}
                            {pet.epitaph || "Не указана"}
                          </p>
                          <p className="line-clamp-4">
                            <span className="font-black text-[#5d4037]">
                              История:
                            </span>{" "}
                            {pet.story || "Не указана"}
                          </p>
                          {pet.moderationComment ? (
                            <p className="rounded-2xl bg-[#fff2ef] px-3 py-2 font-bold text-[#9a5a4c]">
                              Последний комментарий: {pet.moderationComment}
                            </p>
                          ) : null}
                          {pet.moderationStatus === "PENDING" && isRevision ? (
                            <p className="rounded-2xl bg-[#f7f1ee] px-3 py-2 font-bold text-[#6d4c41]">
                              Изменения после доработки:{" "}
                              {changedBlocks.length > 0
                                ? changedBlocks.join(", ")
                                : "не указаны"}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/pets/${pet.id}`}
                            className="rounded-[16px] bg-[#c7ded2] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#34584d]"
                          >
                            Открыть
                          </Link>
                          <Link
                            href={`/create?edit=${pet.id}`}
                            className="rounded-[16px] bg-[#f1e7e0] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#5d4037]"
                          >
                            Редактировать
                          </Link>
                        </div>
                      </div>

                      <div className="grid content-start gap-3">
                        <textarea
                          value={comments[pet.id] ?? ""}
                          onChange={(event) =>
                            setComments((prev) => ({
                              ...prev,
                              [pet.id]: event.target.value,
                            }))
                          }
                          className="min-h-[130px] resize-none rounded-[20px] border border-white bg-[#f7f1ee] px-4 py-3 text-[16px] font-bold text-[#5d4037] outline-none focus:ring-2 focus:ring-[#3bceac]/50 sm:text-sm"
                          placeholder="Что нужно поправить, если возвращаем на правки"
                        />
                        <button
                          type="button"
                          onClick={() => updateStatus(pet.id, "APPROVED")}
                          disabled={actionId === pet.id}
                          className="rounded-[18px] bg-[#111827] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_4px_0_#000] disabled:opacity-60"
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(pet.id, "NEEDS_CHANGES")}
                          disabled={actionId === pet.id}
                          className="rounded-[18px] bg-[#fff2ef] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#9a5a4c] disabled:opacity-60"
                        >
                          Вернуть на правки
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {error ? (
        <ErrorToast message={error} onClose={() => setError(null)} />
      ) : null}
      {notice ? (
        <ErrorToast
          message={notice}
          onClose={() => setNotice(null)}
          variant="success"
        />
      ) : null}
    </main>
  );
}
