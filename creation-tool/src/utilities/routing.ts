export const storyRoute = '/story/:story';
export const getLinkToStoryPage = (story: number) => `/story/${story}`;
export const pageRoute = `${storyRoute}/page/:page`;
export const getLinkToPagePage = (story: number, page: number) => `${getLinkToStoryPage(story)}/page/${page}`;
