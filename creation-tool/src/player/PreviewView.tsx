import { convertPageToManifestPage } from "./convertToManifest";
import type { Page } from "../bindings";

interface PreviewViewProps {
  page: Page;
}

export function PreviewView({ page }: PreviewViewProps) {
  const manifestPage = convertPageToManifestPage(page);

  return (
    <div
      className="h-full overflow-y-auto p-6"
      data-theme="light"
      data-font-size="medium"
    >
      <article className="max-w-prose mx-auto">
        <h1 className="text-xl font-bold mb-4 text-gray-900">
          {manifestPage.name}
        </h1>
        <div className="leading-relaxed whitespace-pre-wrap text-gray-900">
          {manifestPage.body}
        </div>
        {manifestPage.choices.length > 0 && (
          <nav className="mt-8 pt-4 border-t border-gray-200">
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {manifestPage.choices.map((choice) => (
                <li key={choice.id}>
                  <div className="w-full text-left p-4 rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                    {choice.text}
                  </div>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {manifestPage.choices.length === 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-center italic text-gray-400">The End</p>
          </div>
        )}
      </article>
    </div>
  );
}
