"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";
import { canAccessAdmin, type AccessLevel } from "../../lib/access";
import ErrorToast from "../../components/ErrorToast";
import PhotoLightbox from "../../components/PhotoLightbox";

type NewsPost = {
  id: string;
  title: string;
  body: string;
  photos?: string[];
  createdAt: string;
};

export default function NewsClient() {
  const apiUrl = useMemo(() => API_BASE, []);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [photoViewer, setPhotoViewer] = useState<{
    photos: string[];
    index: number;
    title: string;
  } | null>(null);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/content/news`, {
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось загрузить новости");
      }
      const data = (await response.json()) as { posts?: NewsPost[] };
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      await fetch(`${apiUrl}/content/news/read`, {
        method: "POST",
        credentials: "include"
      }).catch(() => null);
      window.dispatchEvent(new Event("memorial-news-read"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки новостей");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

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
        if (mounted) {
          setIsAdmin(canAccessAdmin(data.accessLevel));
        }
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

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("Заполните заголовок и текст новости");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", trimmedTitle);
      formData.append("body", trimmedBody);
      formData.append("isActive", "true");
      photos.forEach((file) => formData.append("photos", file));

      const response = await fetch(`${apiUrl}/admin/news`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось опубликовать новость");
      }
      setTitle("");
      setBody("");
      setPhotos([]);
      setNotice("Новость опубликована");
      await loadNews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка публикации");
    } finally {
      setSaving(false);
    }
  };

  const activePhoto = photoViewer?.photos[photoViewer.index] ?? null;

  return (
    <main className="min-h-[100svh] bg-[#f7f1ee] px-3 pb-28 pt-[calc(var(--app-header-height,0px)+1rem)] text-[#5d4037] sm:px-4 sm:pb-16 sm:pt-[calc(var(--app-header-height,64px)+2rem)]">
      <section className="mx-auto max-w-4xl rounded-[28px] border-[3px] border-white bg-[#efe6e2] p-2 shadow-[0_28px_70px_-34px_rgba(93,64,55,0.55)] sm:rounded-[36px] sm:border-[4px] sm:p-3">
        <div className="rounded-[22px] border border-white/80 bg-white/[0.88] p-4 sm:rounded-[28px] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d3a27f] sm:text-[11px] sm:tracking-[0.28em]">
            МяуГав
          </p>
          <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl">
            Новости
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#8d6e63]">
            Здесь публикуются обновления сервиса, предупреждения о технических работах и важные сообщения.
          </p>

          {authChecked && isAdmin ? (
            <section className="mt-5 rounded-[24px] border-[3px] border-white bg-[#f7f1ee] p-3 shadow-[0_16px_38px_-30px_rgba(93,64,55,0.55)] sm:mt-7 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black text-[#5d4037]">
                  Опубликовать новость
                </h2>
                {notice ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                    {notice}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-sm font-bold text-[#8d6e63]">
                  Заголовок
                  <input
                    className="rounded-2xl border-b-4 border-transparent bg-white px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Технические работы"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#8d6e63]">
                  Текст новости
                  <textarea
                    className="min-h-[130px] rounded-2xl border-b-4 border-transparent bg-white px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Что нужно сообщить пользователям..."
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#8d6e63]">
                  Фотографии
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="rounded-2xl border-b-4 border-transparent bg-white px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all file:mr-3 file:rounded-xl file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
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
                  disabled={saving}
                  className="inline-flex w-fit items-center justify-center rounded-xl bg-[#111827] px-6 py-3 text-sm font-black text-white shadow-[0_4px_0_0_#000] transition-all hover:scale-[1.02] hover:shadow-[0_5px_0_0_#000] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {saving ? "Публикуем..." : "Опубликовать"}
                </button>
              </div>
            </section>
          ) : null}

          <div className="mt-6 grid gap-4 sm:mt-7">
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
                  className="rounded-[24px] border-[3px] border-white bg-[#f7f1ee] px-4 py-4 shadow-[0_16px_38px_-30px_rgba(93,64,55,0.55)] sm:px-5"
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
                  {post.photos?.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {post.photos.map((photo, index) => (
                        <button
                          key={photo}
                          type="button"
                          onClick={() => setPhotoViewer({ photos: post.photos ?? [], index, title: post.title })}
                          className="group overflow-hidden rounded-[20px] border-[3px] border-white bg-[#fff7f1] p-1 shadow-[0_14px_26px_-20px_rgba(93,64,55,0.5)] transition-all duration-300 hover:-translate-y-[2px]"
                        >
                          <img
                            src={photo}
                            alt={post.title}
                            className="h-28 w-full rounded-[15px] object-cover transition duration-300 group-hover:scale-[1.04] sm:h-36"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
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

      <PhotoLightbox
        open={Boolean(photoViewer)}
        photoUrl={activePhoto}
        title={photoViewer?.title ?? null}
        index={photoViewer?.index ?? 0}
        total={photoViewer?.photos.length ?? 0}
        onPrev={goPrevPhoto}
        onNext={goNextPhoto}
        onClose={closePhotoViewer}
      />

      <ErrorToast message={error} onClose={() => setError(null)} />
    </main>
  );
}
