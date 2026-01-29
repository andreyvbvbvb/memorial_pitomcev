"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";

type Pet = {
  id: string;
  ownerId: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  epitaph: string | null;
  isPublic: boolean;
  createdAt: string;
};

export default function MyPetsClient() {
  const [ownerFilter, setOwnerFilter] = useState("");
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = useMemo(() => API_BASE, []);

  const loadPets = async (ownerId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
      const response = await fetch(`${apiUrl}/pets${query}`);
      if (!response.ok) {
        throw new Error("Не удалось загрузить список");
      }
      const data = (await response.json()) as Pet[];
      setPets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
        if (response.ok) {
          const data = (await response.json()) as { id: string };
          setOwnerFilter(data.id);
          await loadPets(data.id);
          return;
        }
      } catch {
        // ignore
      }
      await loadPets();
    };
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Личный кабинет</p>
        <h1 className="text-3xl font-semibold text-slate-900">Мои питомцы</h1>
        <p className="text-slate-600">
          Здесь только список мемориалов. Создание и кошелёк вынесли в профиль.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/create"
          className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Создать мемориал
        </Link>
        <Link
          href="/profile"
          className="rounded-2xl border border-slate-200 px-5 py-2 text-sm text-slate-700"
        >
          Профиль
        </Link>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-full flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            placeholder="Фильтр по ownerId (необязательно)"
          />
          <button
            type="button"
            onClick={() => loadPets(ownerFilter.trim() || undefined)}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            disabled={loading}
          >
            {loading ? "Загрузка..." : "Обновить"}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 grid gap-4">
          {pets.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">Пока нет мемориалов.</p>
          ) : null}
          {pets.map((pet) => (
            <div key={pet.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
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
              <p className="mt-2 text-xs text-slate-500">Owner: {pet.ownerId}</p>
              <p className="mt-2 text-sm text-slate-700">
                {pet.epitaph ?? "Без эпитафии"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {pet.birthDate ? `Рождение: ${new Date(pet.birthDate).toLocaleDateString()}` : ""}
                {pet.deathDate
                  ? ` • Уход: ${new Date(pet.deathDate).toLocaleDateString()}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Создан: {new Date(pet.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
