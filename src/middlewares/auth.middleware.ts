import { getSession } from '@auth/express';
import { Request, Response, NextFunction } from 'express';
import { authConfig } from '../config/auth.config';
import { decode } from '@auth/core/jwt';

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Try to get session via cookie
    let session = await getSession(req, authConfig);

    // 2. If no cookie session, check for Bearer Token in Authorization header
    if (!session || !session.user) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          // In development/local it's 'authjs.session-token'. In production HTTPS, it's '__Secure-authjs.session-token'.
          const salt = req.secure || req.headers['x-forwarded-proto'] === 'https' 
            ? '__Secure-authjs.session-token' 
            : 'authjs.session-token';

          const decoded = await decode({
            token,
            secret: process.env.AUTH_SECRET || 'a-very-secure-secret-key-at-least-32-characters-long',
            salt,
          });
          
          if (decoded && decoded.email) {
            session = {
              user: {
                id: decoded.id as string,
                name: decoded.name as string,
                email: decoded.email as string,
                role: (decoded.role as string) || 'retail_client',
              } as any,
              expires: decoded.exp ? new Date(Number(decoded.exp) * 1000).toISOString() : new Date().toISOString(),
            };
          }
        } catch (jwtError) {
          console.error('Failed to decode Bearer token:', jwtError);
        }
      }
    }

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
