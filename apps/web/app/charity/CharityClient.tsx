"use client";

import { useEffect, useMemo, useState } from "react";
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

  const pending = Math.max(
    0,
    (summary?.totals.totalAccrued ?? 0) - (summary?.totals.totalPaid ?? 0)
  );

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
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[var(--bg)] px-6 pb-16 pt-[calc(var(--app-header-height,56px)+24px)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10">
        <section className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Благотворительность
            </p>
            <h1 className="text-3xl font-semibold text-[var(--text)]">
              20% от оплат мы направляем в помощь животным
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Здесь мы показываем, сколько средств уже накоплено и сколько перечислено,
              а также публикуем отчёты о переводах.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card flex flex-col gap-2 bg-white/90 p-5">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Должно пойти
              </span>
              <strong className="text-2xl text-[var(--text)]">
                {formatNumber(summary?.totals.totalAccrued ?? 0)} монет
              </strong>
            </div>
            <div className="card flex flex-col gap-2 bg-white/90 p-5">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Уже направили
              </span>
              <strong className="text-2xl text-[var(--text)]">
                {formatNumber(summary?.totals.totalPaid ?? 0)} монет
              </strong>
            </div>
            <div className="card flex flex-col gap-2 bg-white/90 p-5">
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Осталось
              </span>
              <strong className="text-2xl text-[var(--text)]">
                {formatNumber(pending)} монет
              </strong>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text)]">Отчёты</h2>
            {loading ? (
              <span className="text-xs text-[var(--muted)]">Загрузка...</span>
            ) : null}
          </div>

          {summary?.reports?.length ? (
            <div className="grid gap-4">
              {summary.reports.map((report) => (
                <div key={report.id} className="card grid gap-4 bg-white/95 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text)]">
                        {report.title}
                      </h3>
                      <p className="text-xs text-[var(--muted)]">
                        {new Date(report.createdAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <div className="rounded-full border border-[var(--border)] bg-white px-4 py-1 text-xs text-[var(--text)]">
                      {formatNumber(report.amount)} монет
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text)] whitespace-pre-wrap">
                    {report.body}
                  </p>
                  {report.photos?.length ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {report.photos.map((photo) => (
                        <img
                          key={photo}
                          src={photo}
                          alt={report.title}
                          className="h-40 w-full rounded-2xl border border-[var(--border)] object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="card bg-white/90 p-6 text-sm text-[var(--muted)]">
              Пока нет отчётов. Мы добавим их после первых переводов.
            </div>
          )}
        </section>

        {authChecked && isAdmin ? (
          <section className="card grid gap-4 bg-white/95 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--text)]">Добавить отчёт</h2>
              {notice ? (
                <span className="text-xs text-emerald-600">{notice}</span>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--text)]">
                Заголовок
                <input
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Перевод в приют"
                />
              </label>
              <label className="grid gap-1 text-sm text-[var(--text)]">
                Сумма пожертвований (монеты)
                <input
                  className="input"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="1000"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm text-[var(--text)]">
              Текст отчёта
              <textarea
                className="textarea min-h-[140px]"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Расскажите, куда направлены средства..."
              />
            </label>

            <label className="grid gap-1 text-sm text-[var(--text)]">
              Фотографии (можно несколько)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setPhotos(event.target.files ? Array.from(event.target.files) : [])
                }
              />
            </label>
            {photos.length ? (
              <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                {photos.map((file) => (
                  <span
                    key={`${file.name}-${file.size}`}
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1"
                  >
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Добавить отчёт"}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <ErrorToast message={error} onClose={() => setError(null)} />
    </main>
  );
}
