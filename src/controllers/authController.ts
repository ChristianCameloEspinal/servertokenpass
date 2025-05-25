// authController.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { ethers } from 'ethers';
import supervisor from './blockchain/blockchainSupervisor';

import { sendVerification, checkVerification } from '../services/smsService';
import { decryptPrivateKey, encryptPrivateKey } from '../utils/crypto';

interface AuthRequest extends Request {
  user?: any;
}

export const register = async (req: Request, res: Response): Promise<any> => {
  const { email, password, name, phone, dob, distributor } = req.body.userData;
  console.log("USER", req.body)
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
    const encryptedPrivateKey = encryptPrivateKey(privateKey);
    //const hashedPrivateKey = await bcrypt.hash(privateKey, 10);

    const user = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: name,
        phone: phone,
        wallet: walletAddress,
        dob: new Date(dob).toISOString(),
        token: '',
        privateKey: encryptedPrivateKey,
        validated: false,
        distributor: distributor ? distributor : false
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

    return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, distributor:user.distributor, wallet:user.wallet } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
}

export const generateQR = async (req: Request, res: Response): Promise<any> => {
  const { tokenId } = req.body;

  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.wallet) {
    return res.status(404).json({ message: 'User or wallet not found' });
  }

  try {

    const userPrivateKey = await decryptPrivateKey(user.privateKey);
    const signer = new ethers.Wallet(userPrivateKey, supervisor.provider);

    const nonce = Date.now();
    const expiration = Math.floor(Date.now() / 1000) + 3600;

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "uint256"],
      [process.env.CONTRACT_ADRESS!, tokenId, nonce, expiration]
    );

    const messageHashBytes = ethers.getBytes(messageHash);

    const signature = await signer.signMessage(messageHashBytes);

    const qrPayload = {
      tokenId,
      nonce,
      expiration,
      signature
    };

    return res.status(200).json({
      qrPayload
    });

  } catch (error) {
    console.error("Error generating QR", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const validateQR = async (req: AuthRequest, res: Response): Promise<any> => {

  const { tokenId, nonce, expiration, signature } = req.body.qrPayload;
  const token = req.header('Authorization')?.replace('Bearer ', '');

  let decoded: any;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > expiration) {
    return res.status(400).json({ message: 'QR code has expired' });
  }

  try {

    const organizer = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!organizer || !organizer.privateKey) {
      return res.status(404).json({ message: 'User or private key not found' });
    }
    const organizerPrivateKey = await decryptPrivateKey(organizer.privateKey);
    const organizerContract = supervisor.getContractWithPrivateKey(organizerPrivateKey);
    const tx = await organizerContract.validateWithSignature(
      tokenId,
      nonce,
      expiration,
      signature
    );

    await tx.wait();

    return res.status(200).json({ message: 'QR code validated successfully', txHash: tx.hash });

  } catch (error: any) {
    console.error("Error validating QR:", error);

    if (error?.reason) {
      return res.status(400).json({ message: `Smart contract error: ${error.reason}` });
    }

    return res.status(500).json({ message: 'Internal server error during validation' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<any> => {
  
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.userId;

    const { name, email, phone, dob } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        phone,
        dob: dob ? new Date(dob) : undefined,
        distributor: req.body.distributor !== undefined ? req.body.distributor : false
      }
    });

    return res.status(200).json({
      message: 'User updated successfully',
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        dob: updatedUser.dob,
        wallet: updatedUser.wallet,
        distributor: updatedUser.distributor
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ message: 'Something went wrong updating user' });
  }
};

