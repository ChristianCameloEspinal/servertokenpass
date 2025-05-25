import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {

  const token = req.header('Authorization')?.replace('Bearer ', '') || '';

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }

};

export const authenticateDistributor = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {

  const token = req.header('Authorization')?.replace('Bearer ', '') || '';

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    console.log("USER",user)

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (!user.distributor) {
      res.status(403).json({ message: 'Access denied. Not a distributor.' });

      return;
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }

};

