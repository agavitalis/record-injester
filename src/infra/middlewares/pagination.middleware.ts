import { Response, NextFunction } from 'express';
import { CustomRequest } from '../dto/custom-request.dto';

export const PaginateResponse = (req: CustomRequest, res: Response, next: NextFunction) => {
  req.pagination = {
    perPage: 50,
    currentPage: 1,
    totalPages: 1,
    totalDocumentCount: 1,
    paginationURI: 'localhost:3009/api/v1/{userType}/{routeName}?currentPage={n}&perPage={n}',
  };

  if (req.query.perPage) {
    req.pagination.perPage = parseInt(req.query.perPage as string);
  }

  if (req.query.currentPage) {
    req.pagination.currentPage = parseInt(req.query.currentPage as string);
  }

  next();
};
