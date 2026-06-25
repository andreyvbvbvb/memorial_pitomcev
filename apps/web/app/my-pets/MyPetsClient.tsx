"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import ConfirmDialog from "../../components/ConfirmDialog";
import SiteBanner from "../../components/SiteBanner";
import usePortraitLayout from "../../components/usePortraitLayout";
import AuthHelpHint from "../../components/AuthHelpHint";

const MyPets3DView = dynamic(() => import("../../components/MyPets3DView"), {
  ssr: false,
  loading: () => <MyPets3DLoadingFallback />
});

function MyPets3DLoadingFallback() {
  const isPortraitLayout = usePortraitLayout();
  return (
    <div className="fixed inset-0 z-0 h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-[#fcf8f5]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.96),rgba(252,248,245,0.7)_42%,rgba(241,231,224,0.92)_100%)]" />
      <div
        className={`absolute left-1/2 flex w-[min(18rem,78vw)] -translate-x-1/2 flex-col items-center gap-3 rounded-[28px] border-[3px] border-white bg-white/82 px-5 py-5 text-center text-sm font-semibold leading-tight text-[#6f6360] shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] backdrop-blur-md ${
          isPortraitLayout ? "top-[35dvh]" : "top-1/2 -translate-y-1/2"
        }`}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8cfc9] border-t-[#5d4037]" />
        <span className="block w-full text-center text-xs font-bold text-[#8d6e63]">
          Можно вращать сцену и приближать мемориалы после появления превью.
        </span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#eadfd9]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[#8d6e63]" />
        </div>
      </div>
    </div>
  );
}

type PetPhoto = {
  id: string;
  url: string;
};

type PetMarker = {
  previewPhotoId: string | null;
};

type Pet = {
  id: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  epitaph: string | null;
  story?: string | null;
  isPublic: boolean;
  photos: PetPhoto[];
  marker: PetMarker | null;
  memorial?: {
    environmentId: string | null;
    houseId: string | null;
    sceneJson: Record<string, unknown> | null;
    dustStage?: number | null;
    dustUpdatedAt?: string | null;
    createdAt?: string | null;
  } | null;
};

type PetWithPreview = Pet & {
  previewUrl: string | null;
};

type MemorialDraft = {
  id: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  updatedAt: string;
};

type CreationLimit = {
  currentCount: number;
  maxMemorials: number;
  canCreate: boolean;
};

export default function MyPetsClient() {
  const isPortraitLayout = usePortraitLayout();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<MemorialDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<4 | 5>(4);
  const [draftToDelete, setDraftToDelete] = useState<MemorialDraft | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [creationLimit, setCreationLimit] = useState<CreationLimit | null>(null);

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

  useEffect(() => {
    const notice = window.sessionStorage.getItem("memorial-page-toast");
    if (!notice) {
      return;
    }
    window.sessionStorage.removeItem("memorial-page-toast");
    setPageNotice(notice);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
        if (!response.ok) {
          router.replace("/auth");
          return;
        }
        const data = (await response.json()) as { id: string };
        const petsResponse = await fetch(`${apiUrl}/pets?ownerId=${encodeURIComponent(data.id)}`, {
          credentials: "include"
        });
        if (!petsResponse.ok) {
          throw new Error("Не удалось загрузить список");
        }
        const draftsResponse = await fetch(`${apiUrl}/pets/drafts`, {
          credentials: "include"
        });
        if (!draftsResponse.ok) {
          throw new Error("Не удалось загрузить черновики");
        }
        const limitResponse = await fetch(
          `${apiUrl}/pets/create-limit/${encodeURIComponent(data.id)}`,
          { credentials: "include" }
        );
        if (!limitResponse.ok) {
          throw new Error("Не удалось загрузить лимит мемориалов");
        }
        const [petsData, draftsData, limitData] = await Promise.all([
          petsResponse.json() as Promise<Pet[]>,
          draftsResponse.json() as Promise<MemorialDraft[]>,
          limitResponse.json() as Promise<CreationLimit>
        ]);
        if (isMounted) {
          setPets(petsData);
          setDrafts(draftsData);
          setCreationLimit(limitData);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, router]);

  const petsWithPreview = useMemo<PetWithPreview[]>(() => {
    return pets.map((pet) => {
      const previewPhoto = pet.marker?.previewPhotoId
        ? pet.photos.find((photo) => photo.id === pet.marker?.previewPhotoId)
        : pet.photos[0];
      const previewUrl = previewPhoto?.url
        ? previewPhoto.url.startsWith("http")
          ? previewPhoto.url
          : `${apiUrl}${previewPhoto.url}`
        : null;
      return { ...pet, previewUrl };
    });
  }, [pets, apiUrl]);

  const formatLifeRange = (pet: PetWithPreview) => {
    const birthYear = pet.birthDate ? new Date(pet.birthDate).getFullYear() : null;
    const deathYear = pet.deathDate ? new Date(pet.deathDate).getFullYear() : null;
    if (birthYear && deathYear) {
      return `${birthYear} — ${deathYear}`;
    }
    if (birthYear) {
      return `Рождён: ${birthYear}`;
    }
    if (deathYear) {
      return `Ушёл: ${deathYear}`;
    }
    return "Без дат";
  };
  const visibleDrafts = showDrafts ? drafts : [];
  const formatDraftLifeRange = (draft: MemorialDraft) => {
    const birthYear = draft.birthDate ? new Date(draft.birthDate).getFullYear() : null;
    const deathYear = draft.deathDate ? new Date(draft.deathDate).getFullYear() : null;
    if (birthYear && deathYear) {
      return `${birthYear} — ${deathYear}`;
    }
    if (birthYear) {
      return `Рождён: ${birthYear}`;
    }
    if (deathYear) {
      return `Ушёл: ${deathYear}`;
    }
    return "Без дат";
  };
  const closeDraftDeleteDialog = () => {
    if (deletingDraftId) {
      return;
    }
    setDraftToDelete(null);
  };
  const handleDeleteDraft = async () => {
    if (!draftToDelete) {
      return;
    }
    setDeletingDraftId(draftToDelete.id);
    try {
      const response = await fetch(
        `${apiUrl}/pets/drafts/${encodeURIComponent(draftToDelete.id)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!response.ok) {
        setError("Не удалось удалить черновик");
        return;
      }
      setDrafts((current) => current.filter((item) => item.id !== draftToDelete.id));
      setDraftToDelete(null);
    } catch {
      setError("Не удалось удалить черновик");
    } finally {
      setDeletingDraftId(null);
    }
  };
	  const pageContentClass = isPortraitLayout
	    ? "relative z-10 mx-auto max-w-6xl pointer-events-none px-3 pb-20 pt-3"
	    : "relative z-10 mx-auto max-w-6xl pointer-events-none px-6 py-12";
	  const cardsSectionClass = isPortraitLayout
	    ? "grid gap-3"
	    : "rounded-[32px] border-[4px] border-white bg-white/80 p-5 shadow-[0_18px_40px_-24px_rgba(93,64,55,0.45)] backdrop-blur-md sm:p-6";
  const petCardClass = isPortraitLayout
    ? "group relative rounded-[24px] border-[3px] border-[#fdf2e9] bg-white p-2.5 shadow-[0_6px_0_0_#f0e1d1] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_9px_0_0_#f0e1d1] active:translate-y-0 active:scale-[0.96] active:shadow-[0_4px_0_0_#f0e1d1]"
    : "group relative rounded-[32px] border-[4px] border-[#fdf2e9] bg-white p-3 shadow-[0_8px_0_0_#f0e1d1] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_12px_0_0_#f0e1d1] active:translate-y-0 active:scale-[0.96] active:shadow-[0_6px_0_0_#f0e1d1]";
  const viewToggleWrapClass = "pointer-events-auto fixed bottom-6 left-6 z-20";
  const viewToggleShellClass = isPortraitLayout
    ? "flex items-center gap-1 rounded-[18px] border-[3px] border-[#fdf2e9] bg-white/95 p-1 shadow-[0_12px_28px_-16px_rgba(93,64,55,0.45)] backdrop-blur"
    : "flex items-center gap-1 rounded-[26px] border-[3px] border-[#fdf2e9] bg-white/95 p-1.5 shadow-[0_12px_28px_-16px_rgba(93,64,55,0.45)] backdrop-blur";
  const viewModeToggle = (
    <div className={viewToggleShellClass}>
      {[
        { mode: 4 as const, label: "Список" },
        { mode: 5 as const, label: "3D" }
      ].map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => setViewMode(mode)}
          className={`rounded-[14px] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition sm:rounded-[18px] sm:px-4 sm:text-[11px] sm:tracking-[0.14em] ${
            viewMode === mode
              ? "bg-[#3bceac] text-white shadow-[0_3px_0_0_#1e7a63]"
              : "text-[#8d6e63] hover:bg-[#fdf2e9]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={viewMode === 5 ? "relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#fcf8f5] overscroll-none" : "relative min-h-screen overflow-hidden bg-[#fcf8f5]"}>
      {viewMode === 4 ? <SiteBanner /> : <SiteBanner variant="overlay" />}
      <div className="pointer-events-none fixed right-0 top-0 h-80 w-80 rounded-full bg-[#3bceac]/8 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-80 w-80 rounded-full bg-[#d3a27f]/12 blur-[120px]" />
      {viewMode === 5 ? <MyPets3DView pets={petsWithPreview} loading={loading} fullScreen /> : null}
      <div className={pageContentClass}>
        <div className="pointer-events-auto">
          {viewMode === 4 ? (
            <section className={cardsSectionClass}>
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#adb5bd]">
                      Мои питомцы
                    </p>
                    {creationLimit ? (
                      <span className="inline-flex shrink-0 items-center rounded-full border-2 border-white bg-[#fffcf9] px-2.5 py-1 text-[10px] font-black text-[#5d4037] shadow-[0_8px_22px_-18px_rgba(93,64,55,0.45)]">
                        {creationLimit.currentCount} / {creationLimit.maxMemorials}
                      </span>
                    ) : null}
                    <AuthHelpHint
                      placement={isPortraitLayout ? "right" : "bottom"}
                      className={isPortraitLayout ? "h-6 w-6 border-2 text-[10px] [&>span]:!w-[min(18rem,calc(100vw-4rem))]" : "h-6 w-6 border-2 text-[10px]"}
                      text="На этой странице можно открыть опубликованные мемориалы, переключиться в 3D-режим и продолжить работу с сохраненными черновиками. Счетчик показывает, сколько активных мемориалов использовано из доступного лимита. Для увеличения лимита напишите на support@мяугав.com. Черновики хранят данные мемориала без фотографий: фотографии загружаются только при публикации."
                    />
                  </div>
                </div>
                <div className={isPortraitLayout ? "flex items-center justify-between gap-2" : "contents"}>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-[18px] border-[3px] border-white bg-[#f7f1ee] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#5d4037] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.45)] sm:gap-3 sm:px-4 sm:py-3 sm:tracking-[0.12em]">
                    <input
                      type="checkbox"
                      checked={showDrafts}
                      onChange={(event) => setShowDrafts(event.target.checked)}
                      className="h-4 w-4 accent-[#3bceac]"
                    />
                    {isPortraitLayout ? "Черновики" : "Показывать черновики"}
                  </label>
                  {isPortraitLayout ? viewModeToggle : null}
                </div>
              </div>
              {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

              {petsWithPreview.length === 0 && visibleDrafts.length === 0 && !loading ? (
                <p className="text-sm text-slate-500">Пока нет мемориалов.</p>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {visibleDrafts.map((draft) => (
                  <div key={draft.id} className={petCardClass}>
                    <div className="block">
                      <button
                        type="button"
                        onClick={() => router.push(`/create?draft=${encodeURIComponent(draft.id)}`)}
                        className="block w-full text-left"
                      >
                        <div className="relative aspect-square rounded-[24px] border-2 border-white bg-[#efedeb]">
                          <div className="flex h-full w-full overflow-hidden rounded-[22px] items-center justify-center bg-gradient-to-br from-[#fdf2e9] to-[#d3a27f]/10">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-12 w-12 text-[#d3a27f]/25"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M4 5h8a3 3 0 0 1 3 3v11" />
                              <path d="M20 19H10a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h10z" />
                            </svg>
                          </div>
                          <div className="group/draft-badge absolute left-3 top-3 rounded-full border border-white bg-white/90 px-3 py-1 text-[9px] font-black uppercase text-[#5d4037] shadow-sm backdrop-blur">
                            Черновик
                            <span className="pointer-events-none absolute left-0 top-[calc(100%+0.5rem)] z-[1000] w-64 rounded-[18px] border-[3px] border-white bg-white/[0.96] px-4 py-3 text-left text-[11px] font-bold normal-case leading-snug tracking-normal text-[#6f6360] opacity-0 shadow-[0_18px_38px_-22px_rgba(93,64,55,0.55)] backdrop-blur transition-opacity duration-200 group-hover/draft-badge:opacity-100">
                              Фотографии не хранятся в черновике и появятся только после публикации.
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 px-2 pb-2">
                          <h3 className="truncate text-lg font-black uppercase tracking-tight text-[#5d4037]">
                            {draft.name}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-[#8d6e63]/70">
                            Сохранён {new Date(draft.updatedAt).toLocaleDateString("ru-RU")}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-[#8d6e63]/60">
                            {formatDraftLifeRange(draft)}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftToDelete(draft)}
                        className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white/95 text-red-500 shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600"
                        aria-label="Удалить черновик"
                        title="Удалить черновик"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {petsWithPreview.map((pet) => (
                  <div
                    key={pet.id}
                    className={petCardClass}
                  >
                    <Link href={`/pets/${pet.id}`} className="block">
                      <div className="relative aspect-square overflow-hidden rounded-[24px] border-2 border-white bg-[#efedeb]">
                      {pet.previewUrl ? (
                        <img
                          src={pet.previewUrl}
                          alt={`Фото ${pet.name}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fdf2e9] to-[#d3a27f]/10">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-12 w-12 text-[#d3a27f]/25"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="7.5" cy="7.5" r="1.5" />
                            <circle cx="16.5" cy="7.5" r="1.5" />
                            <circle cx="6" cy="14" r="1.75" />
                            <circle cx="12" cy="16" r="2.1" />
                            <circle cx="18" cy="14" r="1.75" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-white bg-white/90 px-3 py-1 shadow-sm backdrop-blur">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            pet.isPublic ? "bg-[#3bceac]" : "bg-[#adb5bd]"
                          }`}
                        />
                        <span className="text-[9px] font-black uppercase text-[#5d4037]">
                          {pet.isPublic ? "Публичный" : "Приватный"}
                        </span>
                      </div>
                      <div className="pointer-events-none absolute -right-1 -top-1 opacity-0 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-2 group-hover:translate-y-[-8px] group-hover:scale-100 group-hover:opacity-100">
                        <div className="h-10 w-6 border border-white bg-gradient-to-t from-[#2da689] to-[#3bceac] shadow-lg [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
                      </div>
                      </div>

                      <div className="mt-4 px-2 pb-2">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <h3 className="truncate text-lg font-black uppercase tracking-tight text-[#5d4037]">
                          {pet.name}
                        </h3>
                      </div>

                      <p className="mb-3 line-clamp-1 text-xs font-bold italic text-[#8d6e63]/70">
                        {pet.epitaph ?? "Без эпитафии"}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full bg-[#fdf2e9] px-3 py-1.5">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3 w-3 text-[#d3a27f]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="5" width="18" height="16" rx="2" />
                            <path d="M16 3v4M8 3v4M3 11h18" />
                          </svg>
                          <span className="whitespace-nowrap text-[10px] font-black text-[#8d6e63]">
                            {formatLifeRange(pet)}
                          </span>
                        </div>
                        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#3bceac] text-white shadow-[0_3px_0_0_#1e7a63] transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-1 group-hover:shadow-[0_5px_0_0_#1e7a63]">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M7 17 17 7" />
                            <path d="M9 7h8v8" />
                          </svg>
                        </span>
                      </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <ErrorToast message={error} onClose={() => setError(null)} />
          <ErrorToast
            message={pageNotice}
            onClose={() => setPageNotice(null)}
            offset={88}
            variant="success"
          />
          <ConfirmDialog
            open={Boolean(draftToDelete)}
            eyebrow="Черновик"
            title="Удалить черновик?"
            message={`Черновик «${draftToDelete?.name ?? ""}» будет удален из списка. Это действие нельзя отменить.`}
            cancelAction={{
              label: "Отмена",
              onClick: closeDraftDeleteDialog,
              disabled: Boolean(deletingDraftId),
              variant: "secondary"
            }}
            confirmAction={{
              label: deletingDraftId ? "Удаление..." : "Удалить",
              onClick: () => {
                void handleDeleteDraft();
              },
              disabled: Boolean(deletingDraftId),
              variant: "danger"
            }}
            onClose={closeDraftDeleteDialog}
          />
        </div>
      </div>

      {isPortraitLayout && viewMode === 5 ? (
        <div className="pointer-events-auto fixed right-3 top-3 z-20">{viewModeToggle}</div>
      ) : null}
      {!isPortraitLayout ? <div className={viewToggleWrapClass}>{viewModeToggle}</div> : null}
    </div>
  );
}
