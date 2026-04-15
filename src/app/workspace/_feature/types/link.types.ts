export interface LinkContent {
  url: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
}

export const EMPTY_LINK_CONTENT: LinkContent = {
  url: '',
};
