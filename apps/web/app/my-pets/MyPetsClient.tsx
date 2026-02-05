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

export default function MyPetsClient() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Мои питомцы</h1>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

        <div className="mt-6 grid gap-4">
          {pets.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">Пока нет мемориалов.</p>
          ) : null}
          {pets.map((pet) => {
            const previewPhoto = pet.marker?.previewPhotoId
              ? pet.photos.find((photo) => photo.id === pet.marker?.previewPhotoId)
              : pet.photos[0];
            const previewUrl = previewPhoto?.url
              ? previewPhoto.url.startsWith("http")
                ? previewPhoto.url
                : `${apiUrl}${previewPhoto.url}`
              : null;

            return (
              <div key={pet.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-4">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
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
            );
          })}
        </div>
      </section>
    </div>
  );
}
