"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";

type DailyPageStat = {
  page: string;
  label: string;
  views: number;
};

type DailyStatsDay = {
  day: string;
  totalViews: number;
  newAccounts: number;
  newMemorials: number;
  pages: DailyPageStat[];
};

type DailyStatsResponse = {
  daysCount: number;
  from: string;
  to: string;
  totals: {
    views: number;
    newAccounts: number;
    newMemorials: number;
  };
  pages: DailyPageStat[];
  days: DailyStatsDay[];
};

const PERIODS = [7, 14, 30, 60] as const;

const formatDay = (day: string) => {
  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
};

export default function DailyStatsPanel() {
  const [period, setPeriod] = useState<number>(14);
  const [stats, setStats] = useState<DailyStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/admin/daily-stats?days=${period}`, {
          credentials: "include",
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить статистику");
        }
        const data = (await response.json()) as DailyStatsResponse;
        if (isMounted) {
          setStats(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить статистику");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void loadStats();
    return () => {
      isMounted = false;
    };
  }, [period]);

  const latestDay = stats?.days[stats.days.length - 1] ?? null;
  const maxPageViews = useMemo(
    () => Math.max(1, ...(stats?.pages.map((page) => page.views) ?? [1])),
    [stats],
  );
  const daysNewestFirst = useMemo(
    () => [...(stats?.days ?? [])].reverse(),
    [stats],
  );

  return (
    <section className="mt-6 rounded-[28px] border border-white bg-[#fffcf9] p-4 shadow-[0_20px_48px_-34px_rgba(93,64,55,0.5)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
            Статистика
          </p>
          <h2 className="mt-1 text-xl font-black text-[#5d4037]">
            Дневная активность
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#8d6e63]">
            Переходы по основным страницам, новые аккаунты и мемориалы.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-[18px] bg-[#f7f1ee] p-1.5">
          {PERIODS.map((value) => {
            const isActive = period === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`min-h-10 rounded-[13px] px-3 text-[10px] font-black uppercase tracking-[0.12em] transition-[transform,background-color,box-shadow,color] duration-150 active:scale-[0.96] ${
                  isActive
                    ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                    : "bg-white/70 text-[#8d6e63] hover:bg-white"
                }`}
              >
                {value} дн.
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-[20px] bg-[#f7f1ee] px-4 py-5 text-sm font-bold text-[#8d6e63]">
          Загружаю статистику...
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[20px] bg-[#fff4ed] px-4 py-5 text-sm font-bold text-[#9a4d2f]">
          {error}
        </div>
      ) : null}

      {stats && !loading ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-[22px] bg-[#f7f1ee] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f]">
                Переходы
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-[#111827]">
                {stats.totals.views}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#8d6e63]">
                {formatDay(stats.from)} - {formatDay(stats.to)}
              </p>
            </div>
            <div className="rounded-[22px] bg-[#f7f1ee] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f]">
                Аккаунты
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-[#111827]">
                {stats.totals.newAccounts}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#8d6e63]">
                новых за период
              </p>
            </div>
            <div className="rounded-[22px] bg-[#f7f1ee] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f]">
                Мемориалы
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-[#111827]">
                {stats.totals.newMemorials}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#8d6e63]">
                новых за период
              </p>
            </div>
            <div className="rounded-[22px] bg-[#f7f1ee] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f]">
                Сегодня
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-[#111827]">
                {latestDay?.totalViews ?? 0}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#8d6e63]">
                переходов сегодня
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-[22px] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]">
                Основные страницы
              </h3>
              <div className="mt-4 grid gap-3">
                {stats.pages.map((page) => {
                  const width = `${Math.max(3, Math.round((page.views / maxPageViews) * 100))}%`;
                  return (
                    <div key={page.page}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-[#5d4037]">{page.label}</span>
                        <span className="font-black tabular-nums text-[#111827]">
                          {page.views}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f1e7e0]">
                        <div
                          className="h-full rounded-full bg-[#3bceac]"
                          style={{ width }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-[22px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="grid grid-cols-[1fr_0.75fr_0.75fr_0.75fr] gap-2 border-b border-[#f1e7e0] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#d3a27f]">
                <span>Дата</span>
                <span className="text-right">Переходы</span>
                <span className="text-right">Аккаунты</span>
                <span className="text-right">Мемориалы</span>
              </div>
              <div className="max-h-[360px] overflow-auto">
                {daysNewestFirst.map((day) => (
                  <div
                    key={day.day}
                    className="grid grid-cols-[1fr_0.75fr_0.75fr_0.75fr] gap-2 border-b border-[#f7f1ee] px-4 py-3 text-sm last:border-b-0"
                  >
                    <span className="font-bold text-[#5d4037]">{formatDay(day.day)}</span>
                    <span className="text-right font-black tabular-nums text-[#111827]">
                      {day.totalViews}
                    </span>
                    <span className="text-right font-black tabular-nums text-[#111827]">
                      {day.newAccounts}
                    </span>
                    <span className="text-right font-black tabular-nums text-[#111827]">
                      {day.newMemorials}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
