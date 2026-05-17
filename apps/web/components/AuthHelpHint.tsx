"use client";

type AuthHelpHintProps = {
  text: string;
  className?: string;
  placement?: "top" | "bottom";
};

export default function AuthHelpHint({
  text,
  className = "",
  placement = "bottom"
}: AuthHelpHintProps) {
  const tooltipPositionClass =
    placement === "top"
      ? "bottom-[calc(100%+0.5rem)] right-0"
      : "right-0 top-[calc(100%+0.5rem)]";

  return (
    <span
      className={`group/auth-hint relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-[#f1e7e0] text-[11px] font-black leading-none text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] outline-none transition hover:bg-white hover:text-[#5d4037] focus:bg-white focus:text-[#5d4037] ${className}`}
      tabIndex={0}
      aria-label={text}
    >
      ?
      <span className={`pointer-events-none absolute z-[1000] w-64 rounded-[18px] border-[3px] border-white bg-white/[0.96] px-4 py-3 text-left text-[11px] font-bold normal-case leading-snug tracking-normal text-[#6f6360] opacity-0 shadow-[0_18px_38px_-22px_rgba(93,64,55,0.55)] backdrop-blur transition-all duration-200 group-hover/auth-hint:opacity-100 group-focus/auth-hint:opacity-100 ${tooltipPositionClass}`}>
        {text}
      </span>
    </span>
  );
}
