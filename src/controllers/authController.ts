// authController.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { ethers } from 'ethers';

import { sendVerification, checkVerification } from '../services/smsService'; 

export const register = async (req: Request, res: Response): Promise<any> => {
  const { userData } = req.body;
  const { email, password, name, phone, dob } = userData; 
  console.log("USER",userData)
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    console.log("New Wallet Address:", walletAddress);
    console.log("New Private Key (KEEP SECRET!):", privateKey);

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPrivateKey = await bcrypt.hash(privateKey, 10);

    const user = await prisma.user.create({
      data: {
        email: email, 
        password: hashedPassword,
        name: name,  
        phone: phone, 
        wallet: walletAddress,
        dob: new Date(dob).toISOString(),
        token: '',
        privateKey: hashedPrivateKey,
        validated: false,
      },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, wallet: user.wallet } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong during registration' });
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });

    return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
}