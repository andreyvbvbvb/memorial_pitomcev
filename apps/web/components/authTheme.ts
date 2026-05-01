export const authPageShellClass =
  "relative flex min-h-[calc(100dvh_-_var(--app-header-height,56px))] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.84),_transparent_34%),linear-gradient(180deg,_#fcf8f5_0%,_#f1e7e0_100%)] px-3 py-8 sm:px-6 sm:py-12";

export const authBackdropGlowClass =
  "pointer-events-none absolute rounded-full blur-[100px]";

export const authCardClass =
  "relative overflow-hidden rounded-[32px] border-[4px] border-white bg-white/90 p-3 shadow-[0_28px_70px_-28px_rgba(93,64,55,0.46)] backdrop-blur sm:rounded-[38px] sm:p-4";

export const authInnerShellClass =
  "rounded-[24px] bg-[#fffaf6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] sm:rounded-[30px] sm:p-5";

export const authTabsRailClass = "flex gap-1.5 rounded-[20px] bg-[#f1e7e0] p-1.5";

export const authTabClass = (active: boolean) =>
  `flex-1 rounded-[15px] px-3 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
    active
      ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
      : "text-[#8d6e63] hover:bg-white/70"
  }`;

export const authTitleClass = "text-2xl font-black leading-tight text-[#5d4037]";

export const authLabelClass =
  "grid gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#8d6e63]";

export const authInputClass =
  "w-full rounded-[18px] border-[3px] border-white bg-[#f7f1ee] px-4 py-3.5 text-sm font-bold text-[#5d4037] shadow-[inset_0_2px_6px_rgba(93,64,55,0.07)] outline-none transition-all placeholder:text-[#c2a79a] focus:border-[#3bceac] focus:bg-white";

export const authErrorTextClass = "text-xs font-bold text-[#d64550]";

export const authHelperTextClass = "text-xs font-semibold leading-relaxed text-[#8d6e63]";

export const authPrimaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-[18px] bg-[#111827] px-6 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_5px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#c8d0da] disabled:text-white/85 disabled:shadow-none";

export const authSecondaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-[18px] border-[3px] border-white bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63] shadow-[0_12px_26px_-20px_rgba(93,64,55,0.55)] transition-all hover:bg-[#fff7f1]";

export const authTextButtonClass =
  "text-[11px] font-black uppercase tracking-[0.16em] text-[#548ca8] transition hover:text-[#3bceac]";

export const authCheckboxRowClass =
  "flex items-start gap-3 rounded-[18px] border-[3px] border-white bg-[#f7f1ee] px-4 py-3 text-sm font-semibold text-[#6f6360] shadow-[inset_0_2px_6px_rgba(93,64,55,0.05)]";

export const authCheckboxInputClass =
  "mt-1 h-4 w-4 accent-[#3bceac]";

export const authLinkClass = "font-black text-[#548ca8] underline decoration-[#bfd9e8] underline-offset-4";

export const authNoticeClass =
  "rounded-[18px] border-[3px] border-[#dff5ef] bg-[#effbf7] px-4 py-3 text-sm font-semibold text-[#25856e]";

export const authInfoPanelClass =
  "rounded-[20px] border-[3px] border-white bg-[#f7f1ee] px-5 py-4 text-sm font-semibold leading-relaxed text-[#6f6360] shadow-[inset_0_2px_6px_rgba(93,64,55,0.06)]";

export const authDialogOverlayClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 px-4 py-6 backdrop-blur-md";

export const authDialogCardClass =
  "relative w-full max-w-md overflow-hidden rounded-[34px] border-[4px] border-white bg-white/[0.92] p-4 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.5)] backdrop-blur";

export const authDialogInnerClass =
  "rounded-[24px] bg-[#fffaf6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]";

export const authCloseButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-[14px] border-[3px] border-white bg-[#f1e7e0] text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition hover:bg-white hover:text-[#5d4037]";
