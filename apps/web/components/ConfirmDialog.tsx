"use client";

type ConfirmDialogAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

type ConfirmDialogProps = {
  open: boolean;
  eyebrow?: string;
  title: string;
  message: string;
  helperText?: string;
  confirmAction: ConfirmDialogAction;
  cancelAction: ConfirmDialogAction;
  extraAction?: ConfirmDialogAction;
  onClose?: () => void;
};

const actionClass = (variant: ConfirmDialogAction["variant"] = "secondary") => {
  if (variant === "primary") {
    return "bg-[#111827] text-white shadow-[0_5px_0_0_#000] hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[3px] active:shadow-none";
  }
  if (variant === "danger") {
    return "bg-red-500 text-white shadow-[0_5px_0_0_#c0392b] hover:-translate-y-[1px] hover:bg-red-600 hover:shadow-[0_6px_0_0_#b91c1c] active:translate-y-[3px] active:shadow-none";
  }
  return "border-[3px] border-white bg-[#fffcf9] text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.45)] hover:-translate-y-[1px] hover:bg-[#fff7f2]";
};

export default function ConfirmDialog({
  open,
  eyebrow = "Подтверждение",
  title,
  message,
  helperText,
  confirmAction,
  cancelAction,
  extraAction,
  onClose
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const renderAction = (action: ConfirmDialogAction) => (
    <button
      key={action.label}
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={`rounded-[18px] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-[#d8cfc9] disabled:text-white disabled:shadow-none ${actionClass(action.variant)}`}
    >
      {action.label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Закрыть окно подтверждения"
        className="absolute inset-0 bg-[#111827]/30 backdrop-blur-md"
        onClick={onClose ?? cancelAction.onClick}
      />
      <div className="relative w-full max-w-md rounded-[36px] border-[4px] border-white bg-[#efe6e2] p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)]">
        <div className="rounded-[28px] border border-white/80 bg-[#fffcf9] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d3a27f]">
                {eyebrow}
              </p>
              <h3 className="mt-1 text-lg font-black text-[#5d4037]">{title}</h3>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border-[3px] border-white bg-[#f1e7e0] text-xl font-black leading-none text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition-[background-color,color,transform] duration-150 ease-out hover:bg-white active:scale-[0.96]"
              onClick={onClose ?? cancelAction.onClick}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <p className="mt-4 text-sm font-semibold leading-relaxed text-[#6f6360]">{message}</p>
          {helperText ? (
            <p className="mt-3 rounded-[18px] bg-[#f7f1ee] px-4 py-3 text-xs font-bold leading-relaxed text-[#8d6e63]">
              {helperText}
            </p>
          ) : null}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            {renderAction(cancelAction)}
            {extraAction ? renderAction(extraAction) : null}
            {renderAction(confirmAction)}
          </div>
        </div>
      </div>
    </div>
  );
}
