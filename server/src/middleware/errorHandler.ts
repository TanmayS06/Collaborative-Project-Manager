import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error Logger]:', err);

  const status = err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred.';

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
