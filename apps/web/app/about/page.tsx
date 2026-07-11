"use client";

import Link from "next/link";
import { useLanguage } from "../../components/LanguageProvider";

export default function AboutPage() {
  const { t } = useLanguage();
  const details = [
    [t("about.legalName"), "ИП Гайтерова Анастасия Сергеевна"],
    [t("about.ogrn"), "326784700202709"],
    [t("about.inn"), "780448549611"],
    [t("about.account"), "40802810720001017530"],
    [t("about.bank"), 'ООО "Банк Точка"'],
    [t("about.bik"), "044525104"],
    [t("about.corrAccount"), "30101810745374525104"],
    [t("about.email"), "support@мяугав.com"],
  ];

  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[#fcf8f5] px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">
          {t("about.eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#5d4037] sm:text-4xl">
          {t("about.title")}
        </h1>
        <p className="mt-4 text-base font-semibold leading-relaxed text-[#7b6a63]">
          {t("about.text")}
        </p>

        <section className="mt-8 rounded-[30px] border-[4px] border-white bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] sm:p-6">
          <h2 className="text-xl font-black text-[#5d4037]">{t("about.contacts")}</h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#7b6a63]">
            {t("about.contactsText")}{" "}
            <a
              href="mailto:support@мяугав.com"
              className="font-black text-[#5d4037] underline decoration-[#d3a27f] underline-offset-4"
            >
              support@мяугав.com
            </a>
            .
          </p>
        </section>

        <section className="mt-8 rounded-[30px] border-[4px] border-white bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] sm:p-6">
          <h2 className="text-xl font-black text-[#5d4037]">
            {t("about.documents")}
          </h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#7b6a63]">
            {t("about.documentsText")}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/politics"
              className="rounded-[22px] border-[3px] border-white bg-[#f7f1ee] px-5 py-4 font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[inset_0_2px_6px_rgba(93,64,55,0.06)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              {t("about.politics")}
            </Link>
            <Link
              href="/offer"
              className="rounded-[22px] border-[3px] border-white bg-[#f7f1ee] px-5 py-4 font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[inset_0_2px_6px_rgba(93,64,55,0.06)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              {t("about.offer")}
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[30px] border-[4px] border-white bg-white/90 p-5 shadow-[0_24px_60px_-34px_rgba(93,64,55,0.55)] sm:p-6">
          <h2 className="text-xl font-black text-[#5d4037]">
            {t("about.businessDetails")}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm font-semibold leading-relaxed text-[#7b6a63] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="rounded-[18px] border border-[#eadfd9] bg-[#f7f1ee] px-4 py-3 sm:contents"
              >
                <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f]">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-[#5d4037] sm:mt-0">
                  {value === "support@мяугав.com" ? (
                    <a
                      href="mailto:support@мяугав.com"
                      className="underline decoration-[#d3a27f] underline-offset-4"
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
