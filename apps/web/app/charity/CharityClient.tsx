"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";
import { canAccessAdmin, type AccessLevel } from "../../lib/access";
import ErrorToast from "../../components/ErrorToast";

type CharityTotals = {
  totalAccrued: number;
  totalPaid: number;
};

type CharityReport = {
  id: string;
  title: string;
  amount: number;
  body: string;
  photos: string[];
  createdAt: string;
};

type CharitySummary = {
  totals: CharityTotals;
  reports: CharityReport[];
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value);

export default function CharityClient() {
  const apiUrl = useMemo(() => API_BASE, []);
  const [summary, setSummary] = useState<CharitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{
    photos: string[];
    index: number;
    title: string;
  } | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/charity/summary`, {
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось загрузить данные");
      }
      const data = (await response.json()) as CharitySummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, [apiUrl]);

  useEffect(() => {
    let mounted = true;
    const loadAuth = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include"
        });
        if (!response.ok) {
          if (mounted) {
            setIsAdmin(false);
          }
          return;
        }
        const data = (await response.json()) as { accessLevel?: AccessLevel };
        if (!mounted) {
          return;
        }
        setIsAdmin(canAccessAdmin(data.accessLevel));
      } catch {
        if (mounted) {
          setIsAdmin(false);
        }
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    };
    void loadAuth();
    return () => {
      mounted = false;
    };
  }, [apiUrl]);

  const openPhotoViewer = (photos: string[], index: number, title: string) => {
    setPhotoViewer({ photos, index, title });
  };

  const closePhotoViewer = () => setPhotoViewer(null);

  const goPrevPhoto = useCallback(() => {
    setPhotoViewer((prev) => {
      if (!prev || prev.photos.length === 0) {
        return prev;
      }
      return {
        ...prev,
        index: (prev.index - 1 + prev.photos.length) % prev.photos.length
      };
    });
  }, []);

  const goNextPhoto = useCallback(() => {
    setPhotoViewer((prev) => {
      if (!prev || prev.photos.length === 0) {
        return prev;
      }
      return {
        ...prev,
        index: (prev.index + 1) % prev.photos.length
      };
    });
  }, []);

  useEffect(() => {
    if (!photoViewer) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePhotoViewer();
      }
      if (event.key === "ArrowLeft") {
        goPrevPhoto();
      }
      if (event.key === "ArrowRight") {
        goNextPhoto();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [photoViewer, goPrevPhoto, goNextPhoto]);

  const activePhoto = photoViewer?.photos[photoViewer.index] ?? null;

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("Заполните заголовок и текст отчёта");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("Введите корректную сумму пожертвований");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", trimmedTitle);
      formData.append("amount", String(Math.round(numericAmount)));
      formData.append("body", trimmedBody);
      photos.forEach((file) => formData.append("photos", file));

      const response = await fetch(`${apiUrl}/charity/reports`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось создать отчёт");
      }

      setTitle("");
      setAmount("");
      setBody("");
      setPhotos([]);
      setNotice("Отчёт добавлен");
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fcf8f5] px-4 pb-16 pt-[calc(var(--app-header-height,56px)+28px)] sm:px-6">
      <div className="pointer-events-none fixed right-0 top-0 h-80 w-80 rounded-full bg-[#3bceac]/8 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-80 w-80 rounded-full bg-[#d3a27f]/12 blur-[120px]" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-end">
          <div className="grid gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d3a27f]">
              Благотворительность
            </p>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-[#5d4037] sm:text-4xl">
              20% от оплат мы направляем в помощь животным
            </h1>
            <p className="max-w-2xl text-sm font-semibold leading-relaxed text-[#8d6e63]">
              Здесь опубликованы подтверждённые отчёты о переводах и итоговая сумма,
              которую проект уже передал на благотворительность.
            </p>
          </div>

          <div className="rounded-[32px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_24px_60px_-26px_rgba(93,64,55,0.45)]">
            <div className="rounded-[26px] border border-white/70 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#adb5bd]">
                Уже отдали
              </span>
              <div className="mt-2 flex items-end gap-2">
                <strong className="text-4xl font-black leading-none text-[#5d4037]">
                  {formatNumber(summary?.totals.totalPaid ?? 0)}
                </strong>
                <span className="pb-1 text-sm font-black uppercase text-[#8d6e63]">
                  монет
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-[#5d4037]">Отчёты</h2>
            {loading ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[#8d6e63]">
                Загрузка...
              </span>
            ) : null}
          </div>

          {summary?.reports?.length ? (
            <div className="grid gap-4">
              {summary.reports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-[32px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_18px_42px_-24px_rgba(93,64,55,0.42)]"
                >
                  <div className="grid gap-4 rounded-[26px] border border-white/70 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#adb5bd]">
                          {new Date(report.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                        <h3 className="mt-1 text-xl font-black text-[#5d4037]">
                          {report.title}
                        </h3>
                      </div>
                      <div className="rounded-full bg-[#fdf2e9] px-4 py-2 text-xs font-black uppercase text-[#8d6e63]">
                        {formatNumber(report.amount)} монет
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#6f6360]">
                      {report.body}
                    </p>

                    {report.photos?.length ? (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {report.photos.map((photo, index) => (
                          <button
                            key={photo}
                            type="button"
                            onClick={() => openPhotoViewer(report.photos, index, report.title)}
                            className="group overflow-hidden rounded-[22px] border-[3px] border-white bg-[#f8f9fa] shadow-inner"
                          >
                            <img
                              src={photo}
                              alt={report.title}
                              className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[32px] border-[4px] border-white bg-white/85 p-6 text-sm font-semibold text-[#8d6e63] shadow-[0_18px_42px_-24px_rgba(93,64,55,0.42)]">
              Пока нет отчётов. Мы добавим их после первых переводов.
            </div>
          )}
        </section>

        {authChecked && isAdmin ? (
          <section className="rounded-[32px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_18px_42px_-24px_rgba(93,64,55,0.42)]">
            <div className="grid gap-4 rounded-[26px] border border-white/70 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)] sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black text-[#5d4037]">Добавить отчёт</h2>
                {notice ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                    {notice}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-[#8d6e63]">
                  Заголовок
                  <input
                    className="rounded-2xl border-b-4 border-transparent bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Перевод в приют"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#8d6e63]">
                  Сумма пожертвований (монеты)
                  <input
                    className="rounded-2xl border-b-4 border-transparent bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="1000"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold text-[#8d6e63]">
                Текст отчёта
                <textarea
                  className="min-h-[140px] rounded-2xl border-b-4 border-transparent bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Расскажите, куда направлены средства..."
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-[#8d6e63]">
                Фотографии (можно несколько)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="rounded-2xl border-b-4 border-transparent bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all file:mr-3 file:rounded-xl file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
                  onChange={(event) =>
                    setPhotos(event.target.files ? Array.from(event.target.files) : [])
                  }
                />
              </label>
              {photos.length ? (
                <div className="flex flex-wrap gap-2 text-xs font-bold text-[#8d6e63]">
                  {photos.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-full border border-white bg-[#fdf2e9] px-3 py-1"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex w-fit items-center justify-center rounded-xl bg-[#111827] px-6 py-3 text-sm font-black text-white shadow-[0_4px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_5px_0_0_#000] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Добавить отчёт"}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {photoViewer ? (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={closePhotoViewer}
        >
          <div
            className="relative w-full max-w-5xl rounded-[28px] border border-white/15 bg-slate-950/95 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {activePhoto ? (
              <img
                src={activePhoto}
                alt={photoViewer.title}
                className="max-h-[72vh] w-full rounded-[20px] object-contain"
              />
            ) : (
              <div className="py-16 text-center text-sm text-slate-200">Фото не найдено</div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-slate-200">
              <button
                type="button"
                onClick={goPrevPhoto}
                className="rounded-full border border-slate-600 px-4 py-2 transition hover:border-slate-300"
              >
                Назад
              </button>
              <span>
                {Math.min(photoViewer.index + 1, photoViewer.photos.length)} / {photoViewer.photos.length}
              </span>
              <button
                type="button"
                onClick={goNextPhoto}
                className="rounded-full border border-slate-600 px-4 py-2 transition hover:border-slate-300"
              >
                Вперёд
              </button>
            </div>
            <button
              type="button"
              onClick={closePhotoViewer}
              className="absolute right-4 top-4 rounded-full border border-slate-600 bg-slate-950/75 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-slate-300"
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}

      <ErrorToast message={error} onClose={() => setError(null)} />
    </main>
  );
}
