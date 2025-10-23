import { Response } from 'express';
/**
 * Send a JSON express response.
 *
 * @param res the ExpressResponse object.
 * @param statusCode the status code (success if in the 200s, failure otherwise).
 * @param message the message.
 * @param items the data contents.
 * @returns {res} the response object, for chaining.
 */
export const customResponse = async (
  res: Response,
  statusCode = 200,
  message = '',
  items: any,
  pagination: any = null,
) => {
  const success = 200 <= statusCode && statusCode < 300;

  return res.status(statusCode).json({
    success,
    status: statusCode,
    message,
    items,
    pagination,
  });
};
