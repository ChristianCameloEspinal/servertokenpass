
import e, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { sendVerification, checkVerification } from '../services/smsService';

export const checkUser = async (req: Request, res: Response): Promise<any> => {
    const { phone } = req.body;
    try {

        if (!phone) {
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

export const validateUser = async (req: Request, res: Response): Promise<any> => {
    const { phone, code } = req.body;
    try {

        if (!phone || !code) {
            return res.status(400).json({ message: 'Phone number and code are required' });
        }

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
