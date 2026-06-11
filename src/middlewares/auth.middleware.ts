import { getSession } from '@auth/express';
import { Request, Response, NextFunction } from 'express';
import { authConfig } from '../config/auth.config';

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await getSession(req, authConfig);
    if (!session || !session.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be authenticated to access this resource.'
      });
      return;
    }
    
    res.locals.session = session;
    next();
  } catch (error: any) {
    res.status(500).json({
      error: 'Authentication error',
      message: error.message || error
    });
  }
};
