"use client";

type PhotoLightboxProps = {
  open: boolean;
  photoUrl?: string | null;
  title?: string | null;
  index?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
};

const ArrowIcon = ({ direction }: { direction: "left" | "right" }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-4 w-4 ${direction === "right" ? "" : "rotate-180"}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.1}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="m13 5 7 7-7 7" />
  </svg>
);

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export default function PhotoLightbox({
  open,
  photoUrl,
  title,
  index = 0,
  total = 0,
  onPrev,
  onNext,
  onClose
}: PhotoLightboxProps) {
  if (!open) {
    return null;
  }

  const canNavigate = total > 1;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#cfe9ff]/68 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="pointer-events-none absolute right-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-white/30 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-80 w-80 rounded-full bg-[#fdf2e9]/70 blur-[120px]" />
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-[38px] border-[8px] border-white bg-white/96 p-3 shadow-[0_40px_100px_rgba(0,0,0,0.28)] sm:rounded-[46px] sm:p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-[#fdf2e9] text-[#c78d68] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition hover:bg-white hover:text-[#5d4037]"
          aria-label="Закрыть просмотр"
        >
          <CloseIcon />
        </button>

        <div className="rounded-[30px] bg-[#fffaf6] p-3 sm:rounded-[36px] sm:p-4">
          <div className="overflow-hidden rounded-[24px] border-[4px] border-white bg-[#f8f9fa] shadow-[inset_0_2px_6px_rgba(93,64,55,0.08)]">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={title ?? "Фотография"}
                className="max-h-[74vh] w-full object-contain bg-[#f8f9fa]"
              />
            ) : (
              <div className="py-20 text-center text-sm font-semibold text-[#8d6e63]">
                Фото не найдено
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {title ? (
                <p className="truncate text-sm font-black uppercase tracking-[0.18em] text-[#8d6e63]">
                  {title}
                </p>
              ) : null}
              <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-[#c78d68]">
                {Math.min(index + 1, Math.max(total, 1))} / {Math.max(total, 1)}
              </p>
            </div>

            <div className="flex items-center gap-3 sm:justify-end">
              <button
                type="button"
                onClick={onPrev}
                disabled={!canNavigate}
                className={`inline-flex items-center gap-2 rounded-[22px] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                  canNavigate
                    ? "border-[3px] border-white bg-white text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] hover:bg-[#fff7f1]"
                    : "cursor-not-allowed border-[3px] border-white bg-white/70 text-[#d2b7aa] shadow-none"
                }`}
              >
                <ArrowIcon direction="left" />
                Назад
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!canNavigate}
                className={`inline-flex items-center gap-2 rounded-[22px] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                  canNavigate
                    ? "bg-[#548ca8] text-white shadow-[0_6px_0_0_#3d667a] hover:bg-[#4b7f99] active:translate-y-[3px] active:shadow-none"
                    : "cursor-not-allowed bg-[#b9ced9] text-white/80 shadow-none"
                }`}
              >
                Вперёд
                <ArrowIcon direction="right" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
