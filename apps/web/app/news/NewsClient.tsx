"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";

type NewsPost = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export default function NewsClient() {
  const apiUrl = useMemo(() => API_BASE, []);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadNews = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/content/news`, {
          credentials: "include"
        });
        if (response.ok) {
          const data = (await response.json()) as { posts?: NewsPost[] };
          if (isMounted) {
            setPosts(Array.isArray(data.posts) ? data.posts : []);
          }
        }
        await fetch(`${apiUrl}/content/news/read`, {
          method: "POST",
          credentials: "include"
        }).catch(() => null);
        window.dispatchEvent(new Event("memorial-news-read"));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void loadNews();
    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  return (
    <main className="min-h-[100svh] bg-[#f7f1ee] px-4 pb-16 pt-[calc(var(--app-header-height,64px)+2rem)] text-[#5d4037]">
      <section className="mx-auto max-w-4xl rounded-[36px] border-[4px] border-white bg-[#efe6e2] p-3 shadow-[0_28px_70px_-34px_rgba(93,64,55,0.55)]">
        <div className="rounded-[28px] border border-white/80 bg-white/[0.88] p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d3a27f]">
            МяуГав
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
            Новости
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#8d6e63]">
            Здесь публикуются обновления сервиса, предупреждения о технических работах и важные сообщения.
          </p>
          <div className="mt-7 grid gap-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`news-skeleton-${index}`}
                  className="h-28 animate-pulse rounded-[24px] border-[3px] border-white bg-[#f7f1ee]"
                />
              ))
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-[24px] border-[3px] border-white bg-[#f7f1ee] px-5 py-4 shadow-[0_16px_38px_-30px_rgba(93,64,55,0.55)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-xl font-black leading-tight text-[#5d4037]">
                      {post.title}
                    </h2>
                    <time className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#8d6e63]">
                      {new Date(post.createdAt).toLocaleDateString("ru-RU")}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-relaxed text-[#6f6360]">
                    {post.body}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border-[3px] border-white bg-[#f7f1ee] px-5 py-5 text-sm font-semibold text-[#8d6e63]">
                Сейчас нет активных новостей.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

