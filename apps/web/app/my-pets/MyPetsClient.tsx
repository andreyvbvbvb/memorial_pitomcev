"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MyPets3DView from "../../components/MyPets3DView";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import usePortraitLayout from "../../components/usePortraitLayout";

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
  } | null;
};

type PetWithPreview = Pet & {
  previewUrl: string | null;
};

export default function MyPetsClient() {
  const isPortraitLayout = usePortraitLayout();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<4 | 5>(4);

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

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
        const petsData = (await petsResponse.json()) as Pet[];
        if (isMounted) {
          setPets(petsData);
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
  const pageContentClass = isPortraitLayout
    ? "relative z-10 mx-auto max-w-6xl pointer-events-none px-3 pb-20 pt-3"
    : "relative z-10 mx-auto max-w-6xl pointer-events-none px-6 py-12";
  const cardsSectionClass = isPortraitLayout
    ? "rounded-[24px] border-[3px] border-white bg-white/82 p-3 shadow-[0_16px_34px_-24px_rgba(93,64,55,0.45)] backdrop-blur-md"
    : "rounded-[32px] border-[4px] border-white bg-white/80 p-5 shadow-[0_18px_40px_-24px_rgba(93,64,55,0.45)] backdrop-blur-md sm:p-6";
  const petCardClass = isPortraitLayout
    ? "group relative rounded-[24px] border-[3px] border-[#fdf2e9] bg-white p-2.5 shadow-[0_6px_0_0_#f0e1d1] transition-all hover:-translate-y-1 hover:shadow-[0_9px_0_0_#f0e1d1] active:translate-y-0 active:shadow-[0_4px_0_0_#f0e1d1]"
    : "group relative rounded-[32px] border-[4px] border-[#fdf2e9] bg-white p-3 shadow-[0_8px_0_0_#f0e1d1] transition-all hover:-translate-y-1 hover:shadow-[0_12px_0_0_#f0e1d1] active:translate-y-0 active:shadow-[0_6px_0_0_#f0e1d1]";
  const viewToggleWrapClass = isPortraitLayout
    ? "pointer-events-auto fixed bottom-3 left-1/2 z-20 -translate-x-1/2"
    : "pointer-events-auto fixed bottom-6 left-6 z-20";
  const viewToggleShellClass = isPortraitLayout
    ? "flex items-center gap-1 rounded-[22px] border-[3px] border-[#fdf2e9] bg-white/95 p-1 shadow-[0_12px_28px_-16px_rgba(93,64,55,0.45)] backdrop-blur"
    : "flex items-center gap-1 rounded-[26px] border-[3px] border-[#fdf2e9] bg-white/95 p-1.5 shadow-[0_12px_28px_-16px_rgba(93,64,55,0.45)] backdrop-blur";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fcf8f5]">
      <div className="pointer-events-none fixed right-0 top-0 h-80 w-80 rounded-full bg-[#3bceac]/8 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-80 w-80 rounded-full bg-[#d3a27f]/12 blur-[120px]" />
      {viewMode === 5 ? <MyPets3DView pets={petsWithPreview} loading={loading} fullScreen /> : null}
      <div className={pageContentClass}>
        <div className="pointer-events-auto">
          {viewMode === 4 ? (
            <section className={cardsSectionClass}>
              {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

              {petsWithPreview.length === 0 && !loading ? (
                <p className="text-sm text-slate-500">Пока нет мемориалов.</p>
              ) : null}

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
                      <div className="pointer-events-none absolute -right-1 -top-1 opacity-0 transition-all duration-300 group-hover:translate-x-2 group-hover:translate-y-[-8px] group-hover:scale-100 group-hover:opacity-100">
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
                          <span className="text-[10px] font-black text-[#8d6e63]">
                            {formatLifeRange(pet)}
                          </span>
                        </div>
                        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#3bceac] text-white shadow-[0_3px_0_0_#1e7a63] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-1 group-hover:shadow-[0_5px_0_0_#1e7a63]">
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
        </div>
      </div>

      <div className={viewToggleWrapClass}>
        <div className={viewToggleShellClass}>
          {[
            { mode: 4 as const, label: "Карточки" },
            { mode: 5 as const, label: "3D" }
          ].map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-[18px] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                viewMode === mode
                  ? "bg-[#3bceac] text-white shadow-[0_3px_0_0_#1e7a63]"
                  : "text-[#8d6e63] hover:bg-[#fdf2e9]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
