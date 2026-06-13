export default function LegalDocumentText({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph, index) => {
        const isShortHeading = paragraph.length <= 140;
        const isHeading =
          isShortHeading &&
          (/^[А-ЯЁ0-9\s.,/«»"()-]+$/.test(paragraph) ||
            /^\d+\.\s+[А-ЯЁ]/.test(paragraph));
        return (
          <p
            key={`${index}-${paragraph.slice(0, 12)}`}
            className={
              isHeading
                ? "font-black uppercase tracking-[0.04em] text-[#5d4037]"
                : "whitespace-pre-line"
            }
          >
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}
