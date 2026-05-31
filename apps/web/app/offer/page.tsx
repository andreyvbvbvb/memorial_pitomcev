import DocumentPageClient from "../../components/DocumentPageClient";

export default function OfferPage() {
  return (
    <DocumentPageClient documentType="offer" title="Публичная оферта">
      <p>Настоящая оферта определяет условия оказания платных услуг сервиса Memorial.</p>
      <p>
        Оплачивая услуги, Пользователь соглашается с описанием тарифов, сроками и
        порядком предоставления доступа.
      </p>
      <p>
        Возврат средств и изменение условий предоставления услуг регулируются
        законодательством и дополнительными правилами сервиса.
      </p>
    </DocumentPageClient>
  );
}
