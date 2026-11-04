import { SafeMarkdown } from "@/components/trading/markdown";
import { readHowItWorks } from "@/lib/trading/how-it-works";

export function HowItWorks({ value }: { value: unknown }) {
  const sections = readHowItWorks(value);
  if (!sections?.length) return null;
  return (
    <details className="rounded-3xl border border-line bg-card p-4 sm:p-5">
      <summary className="cursor-pointer">
        <h2 className="inline font-serif text-2xl tracking-tight">How it works</h2>
      </summary>
      <div className="mt-3 border-t border-line">
        {sections.map((section, index) => (
          <details key={`${index}-${section.title}`} className="border-b border-line last:border-b-0">
            <summary className="cursor-pointer py-3 text-sm font-medium">{section.title}</summary>
            <div className="pb-4">
              <SafeMarkdown source={section.body_md} />
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
