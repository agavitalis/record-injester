import { Response } from 'express';

export const CustomResponse = async (res: Response, statusCode = 200, message = '', data: any, pagination: any = null) => {
  const success = 200 <= statusCode && statusCode < 300;

  return res.status(statusCode).json({
    success,
    status: statusCode,
    message,
    data,
    pagination,
  });
};
