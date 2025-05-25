
import e, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { sendVerification, checkVerification } from '../services/smsService';

interface AuthRequest extends Request {
    user?: any;
}

export const checkUser = async (req: AuthRequest, res: Response): Promise<any> => {

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.phone) {
            return res.status(404).json({ message: 'User or private key not found' });
        }

        const phone = user.phone;
        const isSent = await sendVerification(phone);

        if (!isSent) {
            return res.status(500).json({ message: 'Error sending verification code' });
        }

        else {
            return res.status(200).json({ message: 'Verification code sent successfully' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Something went wrong' });
    }
}

export const checkUserRaw = async (req: AuthRequest, res: Response): Promise<any> => {

   const { phone } = req.body;

    try {

        if(!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const isSent = await sendVerification(phone);

        if (!isSent) {
            return res.status(500).json({ message: 'Error sending verification code' });
        }

        else {
            return res.status(200).json({ message: 'Verification code sent successfully' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Something went wrong' });
    }
}

export const validateUser = async (req: AuthRequest, res: Response): Promise<any> => {
    const { code } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.phone) {
            return res.status(404).json({ message: 'User or private key not found' });
        }

        const phone = user.phone;
        const isValidate = await checkVerification(phone, code);

        if (isValidate.valid) {
            console.log(isValidate)
            return res.status(200).json({ message: 'User validated successfully' });
        }
        else {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Something went wrong' });
    }

}
