import { Suspense } from "react";
import PaymentClient from "./PaymentClient";

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f1ee] px-4 text-center text-[#5d4037]">
          <div className="rounded-[28px] border border-white bg-white/80 px-8 py-6 text-sm font-black uppercase tracking-[0.24em] shadow-[0_20px_55px_rgba(93,64,55,0.16)]">
            Подготовка оплаты
          </div>
        </main>
      }
    >
      <PaymentClient />
    </Suspense>
  );
}
