"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { API_BASE } from "../lib/config";

type DocumentRevision = {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
};

type LegalDocumentType = "offer" | "politics";

const builtInRevisions: Record<LegalDocumentType, DocumentRevision[]> = {
  offer: [
    {
      id: "offer-2026-06-13",
      title: "Публичная оферта от 13.06.2026",
      fileUrl: "/documents/offer-2026-06-13.pdf",
      fileName: "offer-2026-06-13.pdf",
      createdAt: "2026-06-13T12:00:00.000Z"
    }
  ],
  politics: [
    {
      id: "politics-2026-06-13",
      title: "Политика в отношении обработки персональных данных от 13.06.2026",
      fileUrl: "/documents/politics-2026-06-13.pdf",
      fileName: "politics-2026-06-13.pdf",
      createdAt: "2026-06-13T12:00:00.000Z"
    }
  ]
};

export default function DocumentPageClient({
  documentType,
  title,
  children
}: {
  documentType: LegalDocumentType;
  title: string;
  children: ReactNode;
}) {
  const apiUrl = useMemo(() => API_BASE, []);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadRevisions = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/content/documents/${documentType}/revisions`
        );
        if (!response.ok) {
          if (isMounted) {
            setRevisions(builtInRevisions[documentType]);
          }
          return;
        }
        const data = (await response.json()) as { revisions?: DocumentRevision[] };
        if (isMounted) {
          const apiRevisions = Array.isArray(data.revisions)
            ? data.revisions
            : [];
          const mergedRevisions = [
            ...apiRevisions,
            ...builtInRevisions[documentType].filter(
              (builtIn) =>
                !apiRevisions.some(
                  (revision) => revision.fileUrl === builtIn.fileUrl
                )
            )
          ];
          setRevisions(mergedRevisions);
        }
      } catch {
        if (isMounted) {
          setRevisions(builtInRevisions[documentType]);
        }
      }
    };
    void loadRevisions();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, documentType]);

  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[#fcf8f5] px-6 py-10">
      <article className="mx-auto w-full max-w-3xl rounded-[34px] border-[4px] border-white bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] sm:p-8">
        <Link
          href="/about"
          aria-label="Вернуться на страницу о проекте"
          title="О проекте"
          className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-[#f7f1ee] text-2xl font-black leading-none text-[#5d4037] shadow-[0_12px_26px_-18px_rgba(93,64,55,0.55)] transition hover:-translate-x-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#3bceac]/30"
        >
          ←
        </Link>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">
          Документ
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#5d4037]">
          {title}
        </h1>
        <div className="mt-6 inline-flex rounded-[20px] bg-[#f1e7e0] p-1.5">
          {[
            ["current", "Актуальный текст"],
            ["history", "История"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as "current" | "history")}
              className={`rounded-[15px] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                tab === value
                  ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                  : "text-[#8d6e63] hover:bg-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "current" ? (
          <div className="mt-6 space-y-4 text-base font-semibold leading-relaxed text-[#6f6360]">
            {children}
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {revisions.length > 0 ? (
              revisions.map((revision) => (
                <a
                  key={revision.id}
                  href={revision.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[20px] border-[3px] border-white bg-[#f7f1ee] px-4 py-4 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <span className="block text-sm font-black text-[#5d4037]">
                    {revision.title}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[#8d6e63]">
                    Добавлен {new Date(revision.createdAt).toLocaleDateString("ru-RU")} · скачать PDF
                  </span>
                </a>
              ))
            ) : (
              <p className="rounded-[20px] border-[3px] border-white bg-[#f7f1ee] px-4 py-4 text-sm font-semibold text-[#8d6e63]">
                Старые редакции пока не загружены.
              </p>
            )}
          </div>
        )}
      </article>
    </main>
  );
}
