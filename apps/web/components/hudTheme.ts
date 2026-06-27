export const hudCanvasBackgroundClass = "bg-[#fcf8f5]";

export const hudMutedSurfaceClass = "bg-[#f1e7e0]";

export const hudPanelChromeClass = (compact: boolean) =>
  compact
    ? "rounded-[20px] border-2 border-white bg-[#efe6e2] p-1.5 shadow-[0_18px_46px_-24px_rgba(93,64,55,0.42)] backdrop-blur"
    : "rounded-[32px] border-[4px] border-white bg-[#efe6e2] p-3 shadow-[0_24px_70px_-22px_rgba(93,64,55,0.36)] backdrop-blur";

export const hudInfoPanelChromeClass = (compact: boolean) =>
  compact
    ? "rounded-[22px] border-[3px] border-white bg-[#f7f1ee] p-2 shadow-[0_18px_44px_-24px_rgba(93,64,55,0.36)] backdrop-blur"
    : "rounded-[32px] border-[4px] border-white bg-[#f7f1ee] p-4 shadow-[0_24px_60px_-20px_rgba(93,64,55,0.34)] backdrop-blur";

export const hudFloatingPanelClass = (compact: boolean) =>
  compact
    ? "rounded-[24px] border-[3px] border-white bg-[#fffcf9] p-2.5 shadow-[0_16px_34px_-24px_rgba(93,64,55,0.4)] backdrop-blur-md"
    : "rounded-[32px] border-[4px] border-white bg-[#fffcf9] p-4 shadow-[0_18px_40px_-24px_rgba(93,64,55,0.4)] backdrop-blur-md";

export const hudSidebarChromeClass = (compact: boolean) =>
  compact
    ? "rounded-[24px] border-[3px] border-white bg-[#fffcf9] p-3 shadow-[0_16px_34px_-24px_rgba(93,64,55,0.38)] backdrop-blur-md"
    : "rounded-[32px] border-[4px] border-white bg-[#fffcf9] shadow-[0_18px_40px_-24px_rgba(93,64,55,0.38)] backdrop-blur-md";

export const hudInnerSurfaceClass = (compact: boolean) =>
  compact
    ? "rounded-[17px] border border-white/70 bg-[#f7f1ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_10px_24px_rgba(126,102,93,0.08)]"
    : "rounded-[26px] border border-white/70 bg-[#f7f1ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_10px_24px_rgba(126,102,93,0.08)]";

export const hudCardSurfaceClass = (compact: boolean) =>
  compact
    ? "rounded-[20px] border border-white/80 bg-[#fffcf9] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]"
    : "rounded-[26px] border border-white/80 bg-[#fffcf9] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]";

export const hudControlButtonClass = (compact: boolean, active: boolean, disabled = false) =>
  `flex shrink-0 touch-manipulation items-center justify-center border-2 text-sm shadow-sm transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.96] [-webkit-tap-highlight-color:transparent] ${
    compact ? "h-9 w-9 rounded-[13px]" : "h-12 w-12 rounded-[18px] sm:h-14 sm:w-14"
  } ${
    disabled
      ? "pointer-events-none cursor-not-allowed border-[#eadfd9] bg-[#f3efec] text-[#c8beb8] opacity-55"
      : active
        ? "border-[#3bceac] bg-[#f0fffb] text-[#3bceac]"
        : compact
          ? "border-[#fdf2e9] bg-[#fffcf9] text-[#c8beb8]"
          : "border-[#fdf2e9] bg-[#fffcf9] text-[#c8beb8] hover:border-[#d3a27f] hover:bg-[#fff7f2] hover:text-[#d3a27f]"
  }`;

export const hudRoundButtonClass = (compact: boolean, active: boolean) =>
  `group relative flex touch-manipulation items-center justify-center border-[3px] shadow-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.96] [-webkit-tap-highlight-color:transparent] ${
    compact ? "h-10 w-10 rounded-[14px]" : "h-14 w-14 rounded-[24px] sm:h-16 sm:w-16"
  } ${
    active
      ? "border-[#3bceac] bg-[#f0fffb] text-[#3bceac]"
      : compact
        ? "border-white bg-[#fffcf9] text-[#d3a27f]"
        : "border-white bg-[#fffcf9] text-[#d3a27f] hover:border-[#d3a27f] hover:bg-[#d3a27f] hover:text-white"
  }`;

export const hudTooltipClass = (placement: "right" | "left" | "top" | "action" = "right") => {
  const base =
    "pointer-events-none absolute z-[300] w-max max-w-[13rem] rounded-xl border-2 border-white bg-[#fffcf9] px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#5d4037] opacity-0 shadow-[0_14px_30px_-18px_rgba(93,64,55,0.5)] backdrop-blur transition-opacity duration-150 group-hover/control:opacity-100 group-focus-visible/control:opacity-100";

  if (placement === "left") {
    return `${base} right-full top-1/2 mr-3 -translate-y-1/2`;
  }

  if (placement === "top") {
    return `${base} bottom-full left-1/2 mb-2 max-w-[12rem] -translate-x-1/2`;
  }

  if (placement === "action") {
    return "pointer-events-none absolute bottom-[calc(100%+0.65rem)] right-0 z-[300] w-64 rounded-[18px] border-[3px] border-white bg-white/[0.96] px-4 py-3 text-left text-[11px] font-bold normal-case leading-snug tracking-normal text-[#6f6360] opacity-0 shadow-[0_18px_38px_-22px_rgba(93,64,55,0.55)] backdrop-blur transition-opacity duration-200";
  }

  return `${base} left-full top-1/2 ml-3 -translate-y-1/2`;
};

export const hudPrimaryActionClass =
  "rounded-[22px] bg-[#111827] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_5px_0_0_#000] transition-[transform,box-shadow,background-color,color] duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[3px] active:scale-[0.96] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#d8cfc9] disabled:text-white/85 disabled:shadow-none";

export const hudEmptyStateTextClass = "text-sm font-semibold text-[#8d6e63]";
