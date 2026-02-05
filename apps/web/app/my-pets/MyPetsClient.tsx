"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";

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
  isPublic: boolean;
  photos: PetPhoto[];
  marker: PetMarker | null;
};

type PetWithPreview = Pet & {
  previewUrl: string | null;
};

export default function MyPetsClient() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<1 | 2 | 3 | 4>(1);

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Мои питомцы</h1>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm">
          {[1, 2, 3, 4].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode as 1 | 2 | 3 | 4)}
              className={`h-9 w-10 rounded-xl text-sm font-semibold transition ${
                viewMode === mode
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

        <div className="mt-6">
          {petsWithPreview.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">Пока нет мемориалов.</p>
          ) : null}

          {viewMode === 1 ? (
            <div className="grid gap-4">
              {petsWithPreview.map((pet) => (
                <div key={pet.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-4">
                    {pet.previewUrl ? (
                      <img
                        src={pet.previewUrl}
                        alt={`Фото ${pet.name}`}
                        className="h-20 w-20 rounded-2xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-slate-200" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/pets/${pet.id}`}
                          className="text-base font-semibold text-slate-900 hover:underline"
                        >
                          {pet.name}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {pet.isPublic ? "Публичный" : "Приватный"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {pet.epitaph ?? "Без эпитафии"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {pet.birthDate
                          ? `Рождение: ${new Date(pet.birthDate).toLocaleDateString()}`
                          : ""}
                        {pet.deathDate
                          ? ` • Уход: ${new Date(pet.deathDate).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {viewMode === 2 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {petsWithPreview.map((pet) => (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {pet.previewUrl ? (
                      <img
                        src={pet.previewUrl}
                        alt={`Фото ${pet.name}`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-slate-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                      {pet.isPublic ? "Публичный" : "Приватный"}
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="text-lg font-semibold text-slate-900 group-hover:underline">
                      {pet.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {pet.epitaph ?? "Без эпитафии"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {pet.birthDate ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Рождение: {new Date(pet.birthDate).toLocaleDateString()}
                        </span>
                      ) : null}
                      {pet.deathDate ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Уход: {new Date(pet.deathDate).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {viewMode === 3 ? (
            <div className="grid gap-4">
              {petsWithPreview.map((pet) => (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-sky-300 via-indigo-300 to-rose-300" />
                  <div className="flex flex-wrap items-start gap-5">
                    <div className="relative">
                      {pet.previewUrl ? (
                        <img
                          src={pet.previewUrl}
                          alt={`Фото ${pet.name}`}
                          className="h-24 w-24 rounded-3xl object-cover ring-2 ring-white"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-24 w-24 rounded-3xl bg-slate-200 ring-2 ring-white" />
                      )}
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow">
                        {pet.isPublic ? "Публичный" : "Приватный"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold text-slate-900 group-hover:underline">
                          {pet.name}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {pet.epitaph ?? "Без эпитафии"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        {pet.birthDate ? (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                            Рождение: {new Date(pet.birthDate).toLocaleDateString()}
                          </span>
                        ) : null}
                        {pet.deathDate ? (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                            Уход: {new Date(pet.deathDate).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {viewMode === 4 ? (
            <div className="columns-1 sm:columns-2 xl:columns-3 [column-gap:1.25rem]">
              {petsWithPreview.map((pet) => (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className="group mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="bg-slate-100">
                    {pet.previewUrl ? (
                      <img
                        src={pet.previewUrl}
                        alt={`Фото ${pet.name}`}
                        className="h-auto w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-40 w-full bg-slate-200" />
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:underline">
                        {pet.name}
                      </h3>
                      <span className="text-xs text-slate-500">
                        {pet.isPublic ? "Публичный" : "Приватный"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {pet.epitaph ?? "Без эпитафии"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {pet.birthDate ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Рождение: {new Date(pet.birthDate).toLocaleDateString()}
                        </span>
                      ) : null}
                      {pet.deathDate ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          Уход: {new Date(pet.deathDate).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
