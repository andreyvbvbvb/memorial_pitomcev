import DocumentPageClient from "../../components/DocumentPageClient";
import LegalDocumentText from "../../components/LegalDocumentText";
import { politicsText } from "../../lib/legal-documents";

export default function PoliticsPage() {
  return (
    <DocumentPageClient
      documentType="politics"
      title="Политика в отношении обработки персональных данных"
    >
      <LegalDocumentText text={politicsText} />
      <section className="mt-8 rounded-[24px] border border-[#eadfd9] bg-[#fffcf9] p-5 text-sm leading-relaxed text-[#6f6360]">
        <h2 className="text-lg font-black uppercase tracking-[0.12em] text-[#5d4037]">
          Использование cookie
        </h2>
        <div className="mt-3 grid gap-3">
          <p>
            Сервис использует необходимые технические cookie, включая cookie
            авторизации <span className="font-semibold">access_token</span>,
            чтобы пользователь мог входить в аккаунт, оставаться
            авторизованным и пользоваться закрытыми разделами сайта.
          </p>
          <p>
            На текущий момент Сервис не использует рекламные, маркетинговые
            или аналитические cookie. Если такие cookie появятся, пользователю
            будет предложено отдельно выразить согласие на их использование.
          </p>
        </div>
      </section>
    </DocumentPageClient>
  );
}
