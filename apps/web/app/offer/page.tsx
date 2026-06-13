import DocumentPageClient from "../../components/DocumentPageClient";
import LegalDocumentText from "../../components/LegalDocumentText";
import { offerText } from "../../lib/legal-documents";

export default function OfferPage() {
  return (
    <DocumentPageClient documentType="offer" title="Публичная оферта">
      <LegalDocumentText text={offerText} />
    </DocumentPageClient>
  );
}
