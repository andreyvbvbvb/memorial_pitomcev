export const authPageShellClass =
  "relative flex min-h-[calc(100vh-120px)] items-center justify-center overflow-hidden bg-[#fcf8f5] px-6 py-12";

export const authBackdropGlowClass =
  "pointer-events-none absolute rounded-full blur-[100px]";

export const authCardClass =
  "relative overflow-hidden rounded-[46px] border-[8px] border-white bg-white/96 p-5 shadow-[0_40px_100px_rgba(0,0,0,0.24)] sm:rounded-[56px] sm:p-6";

export const authInnerShellClass =
  "rounded-[34px] bg-[#fffaf6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:rounded-[40px] sm:p-5";

export const authTabsRailClass = "flex gap-2 rounded-[28px] bg-[#fdf2e9] p-2";

export const authTabClass = (active: boolean) =>
  `flex-1 rounded-[22px] px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] transition-all ${
    active
      ? "bg-white text-[#5d4037] shadow-[0_10px_24px_-16px_rgba(93,64,55,0.55)]"
      : "text-[#c78d68] hover:bg-white/60"
  }`;

export const authTitleClass = "text-xl font-black text-[#5d4037] sm:text-2xl";

export const authLabelClass =
  "grid gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#8d6e63]";

export const authInputClass =
  "w-full rounded-[22px] border-[4px] border-white bg-[#f8f9fa] px-5 py-4 text-sm font-bold text-[#5d4037] shadow-[inset_0_2px_6px_rgba(93,64,55,0.08)] outline-none transition-all placeholder:text-[#c2a79a] focus:border-[#3bceac] focus:bg-white";

export const authErrorTextClass = "text-xs font-bold text-[#d64550]";

export const authHelperTextClass = "text-xs font-semibold leading-relaxed text-[#8d6e63]";

export const authPrimaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-[26px] bg-[#3bceac] px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_6px_0_0_#2a9b81] transition-all hover:bg-[#34c1a1] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#9ddfce] disabled:text-white/80 disabled:shadow-none";

export const authSecondaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-[24px] border-[3px] border-white bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition-all hover:bg-[#fff7f1]";

export const authTextButtonClass =
  "text-[11px] font-black uppercase tracking-[0.18em] text-[#548ca8] transition hover:text-[#3bceac]";

export const authCheckboxRowClass =
  "flex items-start gap-3 rounded-[22px] border-[3px] border-white bg-[#f8f9fa] px-4 py-3 text-sm font-semibold text-[#6f6360] shadow-[inset_0_2px_6px_rgba(93,64,55,0.06)]";

export const authCheckboxInputClass =
  "mt-1 h-4 w-4 accent-[#3bceac]";

export const authLinkClass = "font-black text-[#548ca8] underline decoration-[#bfd9e8] underline-offset-4";

export const authNoticeClass =
  "rounded-[22px] border-[3px] border-[#dff5ef] bg-[#effbf7] px-4 py-3 text-sm font-semibold text-[#25856e]";

export const authInfoPanelClass =
  "rounded-[24px] border-[3px] border-white bg-[#f8f9fa] px-5 py-4 text-sm font-semibold leading-relaxed text-[#6f6360] shadow-[inset_0_2px_6px_rgba(93,64,55,0.08)]";

export const authDialogOverlayClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-[#cfe9ff]/78 px-4 py-6 backdrop-blur-md";

export const authDialogCardClass =
  "relative w-full max-w-md overflow-hidden rounded-[44px] border-[8px] border-white bg-white/96 p-5 shadow-[0_40px_100px_rgba(0,0,0,0.24)]";

export const authDialogInnerClass =
  "rounded-[32px] bg-[#fffaf6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]";

export const authCloseButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-[#fdf2e9] text-[#c78d68] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition hover:bg-white hover:text-[#5d4037]";
