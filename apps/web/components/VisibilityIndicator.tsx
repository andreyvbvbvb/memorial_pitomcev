type VisibilityIndicatorProps = {
  isPublic?: boolean;
  className?: string;
  tooltipAlign?: "center" | "left" | "right";
};

export default function VisibilityIndicator({
  isPublic = true,
  className = "",
  tooltipAlign = "center"
}: VisibilityIndicatorProps) {
  const label = isPublic ? "Публичный" : "Приватный";
  const description = isPublic
    ? "Мемориал виден другим пользователям и отображается на общей карте."
    : "Мемориал виден только владельцу и не отображается на общей карте.";
  const tooltipPositionClass =
    tooltipAlign === "right"
      ? "right-0 top-[calc(100%+0.55rem)]"
      : tooltipAlign === "left"
        ? "left-0 top-[calc(100%+0.55rem)]"
        : "left-1/2 top-[calc(100%+0.55rem)] -translate-x-1/2";

  return (
    <span
      className={`group/visibility relative z-[80] inline-flex items-center justify-center ${className}`}
      tabIndex={0}
      aria-label={`${label}. ${description}`}
    >
      <span
        className={`h-4 w-4 rounded-full border-[3px] border-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.5)] ${
          isPublic ? "bg-[#3bceac]" : "bg-[#e15c5c]"
        }`}
      />
      <span
        className={`pointer-events-none absolute z-[1000] w-56 rounded-[18px] border-[3px] border-white bg-white/[0.96] px-4 py-3 text-left text-[11px] font-bold leading-snug text-[#6f6360] opacity-0 shadow-[0_18px_38px_-22px_rgba(93,64,55,0.55)] backdrop-blur transition-all duration-200 group-hover/visibility:translate-y-0 group-hover/visibility:opacity-100 group-focus/visibility:translate-y-0 group-focus/visibility:opacity-100 ${tooltipPositionClass}`}
      >
        <strong className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#5d4037]">
          {label}
        </strong>
        <span className="mt-1 block">{description}</span>
      </span>
    </span>
  );
}
