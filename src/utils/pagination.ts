export const MAX_LIMIT = 48;

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export function pageParams(query: Record<string, unknown>, defaultLimit = 12): PageParams {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const rawLimit = Math.floor(Number(query.limit)) || defaultLimit;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginated<T>(items: T[], total: number, { page, limit }: PageParams): Paginated<T> {
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
