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

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

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
  const reportCount = summary?.reports.length ?? 0;
  const latestReportDate = summary?.reports[0]?.createdAt ?? null;

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
    <main className="min-h-screen overflow-hidden bg-[#cfe9ff] px-4 pb-16 pt-[calc(var(--app-header-height,56px)+28px)] sm:px-6">
      <div className="pointer-events-none fixed right-[-6rem] top-[-5rem] h-[28rem] w-[28rem] rounded-full bg-[#3bceac]/14 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-8rem] left-[-4rem] h-[30rem] w-[30rem] rounded-full bg-[#fdf2e9]/55 blur-[120px]" />
      <div
        className="pointer-events-none fixed right-[8%] top-[10rem] h-28 w-28 rounded-[36px] border-[6px] border-white bg-[#3bceac] shadow-[0_18px_38px_rgba(59,206,172,0.28)]"
        style={{ animation: "charity-float 7.8s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none fixed bottom-[18%] right-[12%] h-20 w-20 rounded-[28px] border-[6px] border-white bg-[#548ca8] shadow-[0_18px_38px_rgba(84,140,168,0.25)]"
        style={{ animation: "charity-float 6.4s ease-in-out infinite reverse" }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-end">
          <div className="grid gap-5">
            <div className="flex items-center gap-5">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-[28px] border-[4px] border-white bg-[#3bceac] shadow-[0_16px_34px_rgba(59,206,172,0.28)]"
                style={{ transform: "rotate(-5deg)", animation: "charity-wiggle 8.5s ease-in-out infinite" }}
              >
                <svg viewBox="0 0 24 24" className="h-10 w-10 text-white" fill="currentColor" aria-hidden="true">
                  <path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4c1.74 0 3.41.81 4.5 2.09A6.03 6.03 0 0 1 15.5 4 4.5 4.5 0 0 1 20 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#d3a27f]">
                  Благотворительность
                </p>
                <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-[#5d4037] sm:text-[2.8rem]">
                  20% от оплат мы направляем в помощь животным
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm font-bold leading-relaxed text-[#8d6e63]">
              Здесь публикуются подтверждённые отчёты о переводах. Страница показывает
              только реальные отданные суммы и фото-подтверждения по каждому отчёту.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-[32px] border-[6px] border-white bg-white/92 p-5 shadow-[0_18px_42px_-18px_rgba(93,64,55,0.18)]"
                style={{ animation: "charity-float 7.2s ease-in-out infinite" }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#fdf2e9] text-[#d3a27f]">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M7 4v6" />
                      <path d="M17 4v6" />
                      <rect x="4" y="7" width="16" height="13" rx="2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#adb5bd]">
                      Отчётов
                    </p>
                    <p className="text-2xl font-black text-[#5d4037]">{reportCount}</p>
                  </div>
                </div>
              </div>

              <div
                className="rounded-[32px] border-[6px] border-white bg-white/92 p-5 shadow-[0_18px_42px_-18px_rgba(93,64,55,0.18)]"
                style={{ animation: "charity-float 8.1s ease-in-out infinite reverse" }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#cfe9ff] text-[#548ca8]">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 8v4l3 3" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#adb5bd]">
                      Последний отчёт
                    </p>
                    <p className="text-sm font-black text-[#5d4037]">
                      {formatDateLabel(latestReportDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 rounded-[50px] bg-gradient-to-r from-[#3bceac]/30 to-[#548ca8]/25 blur-xl transition duration-700 group-hover:opacity-90" />
            <div className="relative rounded-[42px] border-[8px] border-white bg-white/92 p-4 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.28)]">
              <div className="rounded-[32px] bg-[#fdf2e9] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#3bceac] text-white shadow-[0_14px_30px_rgba(59,206,172,0.28)]">
                    <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 1v22" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#d3a27f]">
                      Уже отдали
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <strong className="text-5xl font-black leading-none text-[#5d4037]">
                        {formatNumber(summary?.totals.totalPaid ?? 0)}
                      </strong>
                      <span className="pb-1 text-sm font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                        монет
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f] shadow-sm">
                    20% от каждой оплаты
                  </span>
                  <span className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#548ca8] shadow-sm">
                    Фотоотчёты по каждому переводу
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-[#5d4037]">Отчёты</h2>
            {loading ? (
              <span className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63] shadow-sm">
                Загрузка...
              </span>
            ) : null}
          </div>

          {summary?.reports?.length ? (
            <div className="grid gap-5">
              {summary.reports.map((report, index) => (
                <article
                  key={report.id}
                  className="group relative rounded-[40px] border-[6px] border-white bg-white/92 p-4 shadow-[0_20px_50px_-18px_rgba(93,64,55,0.18)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_64px_-18px_rgba(93,64,55,0.24)]"
                  style={{ animation: `charity-rise 460ms ease-out ${index * 70}ms both` }}
                >
                  <div className="grid gap-5 rounded-[30px] bg-[#f7f1ee]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] md:grid-cols-[120px_minmax(0,1fr)] md:p-5">
                    <div className="flex flex-row items-center gap-4 md:flex-col md:items-start">
                      <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-[28px] bg-[#fdf2e9] text-[#d3a27f] transition-transform duration-300 group-hover:rotate-[-6deg]">
                        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="4" y="4" width="16" height="16" rx="3" />
                          <path d="M8 9h8" />
                          <path d="M8 13h8" />
                          <path d="M8 17h5" />
                        </svg>
                      </div>
                      <div className="grid gap-2 md:gap-3">
                        <span className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f] shadow-sm">
                          {formatDateLabel(report.createdAt)}
                        </span>
                        <span className="rounded-full bg-[#3bceac]/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#3b8f7a]">
                          {formatNumber(report.amount)} монет
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#adb5bd]">
                            Отчёт о переводе
                          </p>
                          <h3 className="mt-2 text-2xl font-black text-[#5d4037]">
                            {report.title}
                          </h3>
                        </div>
                        {report.photos?.length ? (
                          <span className="rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#548ca8] shadow-sm">
                            Фото: {report.photos.length}
                          </span>
                        ) : null}
                      </div>

                      <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-[#6f6360]">
                        {report.body}
                      </p>

                      {report.photos?.length ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          {report.photos.map((photo, photoIndex) => (
                            <button
                              key={photo}
                              type="button"
                              onClick={() => openPhotoViewer(report.photos, photoIndex, report.title)}
                              className="group/photo overflow-hidden rounded-[24px] border-[4px] border-white bg-[#f8f9fa] shadow-inner transition-all hover:-translate-y-1 hover:shadow-[0_16px_34px_-20px_rgba(84,140,168,0.4)]"
                            >
                              <img
                                src={photo}
                                alt={report.title}
                                className="h-44 w-full object-cover transition duration-500 group-hover/photo:scale-[1.05]"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[40px] border-[6px] border-white bg-white/92 p-8 text-sm font-bold text-[#8d6e63] shadow-[0_20px_50px_-18px_rgba(93,64,55,0.18)]">
              Пока нет отчётов. Мы добавим их после первых переводов.
            </div>
          )}
        </section>

        {authChecked && isAdmin ? (
          <section className="rounded-[42px] border-[6px] border-white bg-white/92 p-4 shadow-[0_20px_50px_-18px_rgba(93,64,55,0.18)]">
            <div className="grid gap-5 rounded-[32px] bg-[#f7f1ee]/88 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#adb5bd]">
                    Панель отчётов
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-[#5d4037]">Добавить отчёт</h2>
                </div>
                {notice ? (
                  <span className="rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">
                    {notice}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-[#8d6e63]">
                  Заголовок
                  <input
                    className="rounded-[24px] border-b-4 border-transparent bg-white px-4 py-4 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Перевод в приют"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-[#8d6e63]">
                  Сумма пожертвований (монеты)
                  <input
                    className="rounded-[24px] border-b-4 border-transparent bg-white px-4 py-4 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="1000"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-black text-[#8d6e63]">
                Текст отчёта
                <textarea
                  className="min-h-[160px] rounded-[24px] border-b-4 border-transparent bg-white px-4 py-4 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Расскажите, куда направлены средства..."
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-[#8d6e63]">
                Фотографии (можно несколько)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="rounded-[24px] border-b-4 border-transparent bg-white px-4 py-4 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all file:mr-3 file:rounded-[18px] file:border-0 file:bg-[#111827] file:px-4 file:py-2 file:text-xs file:font-black file:text-white"
                  onChange={(event) =>
                    setPhotos(event.target.files ? Array.from(event.target.files) : [])
                  }
                />
              </label>

              {photos.length ? (
                <div className="flex flex-wrap gap-2 text-xs font-black text-[#8d6e63]">
                  {photos.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-full border-[3px] border-white bg-white px-4 py-2 shadow-sm"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex w-fit items-center justify-center rounded-[28px] bg-[#3bceac] px-8 py-4 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_6px_0_0_#2a9b81] transition-all hover:-translate-y-[1px] hover:bg-[#2fb193] hover:shadow-[0_7px_0_0_#238670] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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

      <style jsx>{`
        @keyframes charity-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -10px, 0);
          }
        }
        @keyframes charity-wiggle {
          0%,
          100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(2deg);
          }
        }
        @keyframes charity-rise {
          0% {
            opacity: 0;
            transform: translate3d(0, 18px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>

      <ErrorToast message={error} onClose={() => setError(null)} />
    </main>
  );
}
