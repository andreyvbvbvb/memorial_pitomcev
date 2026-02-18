"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MyPets3DView from "../../components/MyPets3DView";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";

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

  return (
    <div className="relative min-h-screen">
      {viewMode === 5 ? <MyPets3DView pets={petsWithPreview} loading={loading} fullScreen /> : null}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 pointer-events-none">
        <div className="pointer-events-auto">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Мои питомцы</h1>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm">
            {[4, 5].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode as 4 | 5)}
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

        {viewMode === 4 ? (
          <section className="mt-10 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

            <div className="mt-6">
              {petsWithPreview.length === 0 && !loading ? (
                <p className="text-sm text-slate-500">Пока нет мемориалов.</p>
              ) : null}

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
            </div>
          </section>
        ) : null}
        <ErrorToast message={error} onClose={() => setError(null)} />
        </div>
      </div>
    </div>
  );
}
