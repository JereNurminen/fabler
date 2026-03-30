export const editorRoute = "/editor";
export const editorPageRoute = "/editor/page/:pageId";

export function getLinkToEditor(): string {
  return "/editor";
}

export function getLinkToPage(pageId: string): string {
  return `/editor/page/${pageId}`;
}
