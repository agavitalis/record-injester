import { Request } from 'express';
interface Pagination {
  perPage: number;
  currentPage: number;
  totalPages: number;
  totalDocumentCount: number;
  paginationURI: string;
}

export interface CustomRequest extends Request {
  pagination: Pagination;
}
