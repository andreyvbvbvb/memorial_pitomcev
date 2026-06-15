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
    </DocumentPageClient>
  );
}
