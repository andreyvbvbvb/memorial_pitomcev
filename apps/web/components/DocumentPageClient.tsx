"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { API_BASE } from "../lib/config";

type DocumentRevision = {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
};

export default function DocumentPageClient({
  documentType,
  title,
  children
}: {
  documentType: "terms" | "offer";
  title: string;
  children: ReactNode;
}) {
  const apiUrl = useMemo(() => API_BASE, []);
  const [tab, setTab] = useState<"current" | "history">("current");
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadRevisions = async () => {
      const response = await fetch(
        `${apiUrl}/content/documents/${documentType}/revisions`
      );
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { revisions?: DocumentRevision[] };
      if (isMounted) {
        setRevisions(Array.isArray(data.revisions) ? data.revisions : []);
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

