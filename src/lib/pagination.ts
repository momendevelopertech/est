export type PaginationQuery = {
  page?: number;
  pageSize?: number;
};

export type PaginationMeta = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
};

type ResolvedPagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function resolvePagination(query: PaginationQuery): ResolvedPagination | null {
  if (query.page === undefined && query.pageSize === undefined) {
    return null;
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function buildPaginationMeta(
  total: number,
  pagination: Pick<ResolvedPagination, "page" | "pageSize"> | null
): PaginationMeta {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? total;
  const pageCount =
    pagination && pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  return {
    page,
    pageSize,
    total,
    pageCount,
    hasPreviousPage: page > 1,
    hasNextPage: pagination ? page < pageCount : false
  };
}
