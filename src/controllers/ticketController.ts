import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import supervisor from './blockchain/blockchainSupervisor';
import prisma from '../prisma/client';
import * as TicketNFT from "./blockchain/TicketNFT.json";
import { decryptPrivateKey } from '../utils/crypto';
import { ethers } from 'ethers';
import { checkVerification } from '../services/smsService';
import { usdToWei } from '../utils/blockchainUtils';


interface AuthRequest extends Request {
    user?: any;
}

export const getLatestBlock = async (req: Request, res: Response): Promise<any> => {
    try {
        const block = await supervisor.provider.getBlock("latest");
        if (!block) {
            console.log("[getLatestBlock] 404 response:", { message: "Unable to fetch ledger information" });
            return res.status(404).json({ message: "Unable to fetch ledger information" });
        }
        console.log("[getLatestBlock] 200 response:", { block });
        res.status(200).json({ block: block });
    } catch (error) {
        console.error(error);
        console.log("[getLatestBlock] 500 response:", { error: "Unable to fetch ledger information, internal error" });
        res.status(500).json({ error: "Unable to fetch ledger information, internal error" });
    }
}

export const getBlock = async (req: Request, res: Response): Promise<any> => {
    try {
        const { blockNumber } = req.params;
        const block = await supervisor.provider.getBlock(blockNumber);
        if (!block) {
            console.log("[getBlock] 404 response:", { message: "Unable to fetch ledger information" });
            return res.status(404).json({ message: "Unable to fetch ledger information" });
        }
        console.log("[getBlock] 200 response:", { block });
        res.status(200).json({ block: block });
    }
    catch (error) {
        console.error(error);
        console.log("[getBlock] 500 response:", { error: "Unable to fetch ledger information, internal error" });
        res.status(500).json({ error: "Unable to fetch ledger information, internal error" });
    }
}

export const getTicketbyEvent = async (req: Request, res: Response) => {
    const iface = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).interface;
    try {
        const { event } = req.params;
        const filter = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).filters.TicketMinted(undefined, undefined, event);
        const events = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).queryFilter(filter, 0, "latest");

        const parsedEvents = events.map((event) => {
            const parsed = iface.parseLog(event);
            return {
                to: parsed?.args.to,
                tokenId: parsed?.args.tokenId.toString(),
                eventInfo: parsed?.args.eventInfo,
                tx: event.transactionHash,
            };
        });
        console.log("[getTicketbyEvent] 200 response:", { parsedEvents });
        res.status(200).json({ parsedEvents });

    } catch (error) {
        console.log("[getTicketbyEvent] 500 response:", { error: "Unable to get tickets from the smart contract" });
        res.status(500).json({ error: "Unable to get tickets from the smart contract" });
    }
}

export const getTicketListedbyEvent = async (req: Request, res: Response) => {
    try {
        const { event } = req.params;

        const contract = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!);
        const tokenIds = await contract.getTicketsOnSaleByEvent(event);

        const ticketDetails = await Promise.all(
            tokenIds.map(async (tokenId: any) => {
                const [price, owner, used, forSale] = await Promise.all([
                    contract.getTicketPrice(tokenId),
                    contract.ownerOf(tokenId),
                    contract.ticketsUsed(tokenId),
                    contract.ticketsForSale(tokenId)
                ]);

                return {
                    tokenId: tokenId.toString(),
                    price: price.toString(),
                    owner,
                    used,
                    forSale
                };
            })
        );

        console.log("[getTicketListedbyEvent] 200 response:", ticketDetails);
        res.status(200).json(ticketDetails);
    } catch (error) {
        console.log("[getTicketListedbyEvent] 500 response:", { message: "Error fetching tickets on sale", error });
        res.status(500).json({ message: "Error fetching tickets on sale", error });
    }
};

export const listTicket = async (req: AuthRequest, res: Response): Promise<any> => {

    const { tokenId, price, code } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    let decoded: any;

    if (!token) {
        console.log("[listTicket] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        console.log("[listTicket] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.privateKey) {
            console.log("[listTicket] 404 response:", { message: 'User or private key not found' });
            return res.status(404).json({ message: 'User or private key not found' });
        }

        const phone = user?.phone;
        const isValidate = true;
        //const isValidate = await checkVerification(phone, code);
        console.log(isValidate)

        if (isValidate) {
            const userPrivateKey = await decryptPrivateKey(user.privateKey);
            const userContract = supervisor.getContractWithPrivateKey(userPrivateKey);

            const data = userContract.interface.encodeFunctionData("setTicketForSale", [tokenId, price]);
            const txRequest: ethers.TransactionRequest = {
                to: process.env.CONTRACT_ADDRESS,
                from: user.wallet,
                data
            };

            let gasEstimate: bigint;
            try {
                gasEstimate = await supervisor.provider.estimateGas(txRequest);
            } catch (err: any) {
                console.error("Error estimating gas:", err);
                console.log("[listTicket] 500 response:", { message: 'Gas estimation failed', error: err.message });
                return res.status(500).json({ message: 'Gas estimation failed', error: err.message });
            }

            const feeData = await supervisor.provider.getFeeData();
            const gasPrice: bigint = feeData.gasPrice ?? ethers.parseUnits('20', 'gwei');
            const gasCostWei: bigint = gasEstimate * gasPrice;

            const custodianWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, supervisor.provider);
            const txFund = await custodianWallet.sendTransaction({
                to: user.wallet,
                value: gasCostWei,
            });
            await txFund.wait();

            const weiPrice = usdToWei(price);
            const tx = await userContract.setTicketForSale(tokenId, weiPrice);
            const receipt = await tx.wait();

            if (receipt && receipt.hash) {
                const response = {
                    wallet: user.wallet,
                    message: `Ticket listed | TxHash: ${receipt.hash}`,
                };
                console.log("[listTicket] 200 response:", response);
                return res.status(200).json(response);
            } else {
                console.log("[listTicket] 500 response:", { error: 'Unable to process the purchase' });
                return res.status(500).json({ error: 'Unable to process the purchase' });
            }
        }
        else {
            console.log("[listTicket] 400 response:", { message: 'Invalid verification code, transaction cancelled' });
            return res.status(400).json({ message: 'Invalid verification code, transaction cancelled' });
        }

    } catch (err) {
        console.error(err);
        console.log("[listTicket] 500 response:", { error: "Unable to process the purchase" });
        return res.status(500).json({ error: "Unable to process the purchase" });
    }
};

export const unlistTicket = async (req: AuthRequest, res: Response): Promise<any> => {

    const { tokenId, code } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    let decoded: any;

    if (!token) {
        console.log("[unlistTicket] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        console.log("[unlistTicket] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.privateKey) {
            console.log("[unlistTicket] 404 response:", { message: 'User or private key not found' });
            return res.status(404).json({ message: 'User or private key not found' });
        }

        const phone = user?.phone;
        const isValidate = true;
        //const isValidate = await checkVerification(phone, code);
        console.log(isValidate)

        if (isValidate) {

            const userPrivateKey = await decryptPrivateKey(user.privateKey);
            const userContract = supervisor.getContractWithPrivateKey(userPrivateKey);

            const data = userContract.interface.encodeFunctionData("unsetTicketForSale", [tokenId]);
            const txRequest: ethers.TransactionRequest = {
                to: process.env.CONTRACT_ADDRESS,
                from: user.wallet,
                data
            };

            let gasEstimate: bigint;
            try {
                gasEstimate = await supervisor.provider.estimateGas(txRequest);
            } catch (err: any) {
                console.error("Error estimating gas:", err);
                console.log("[unlistTicket] 500 response:", { message: 'Gas estimation failed', error: err.message });
                return res.status(500).json({ message: 'Gas estimation failed', error: err.message });
            }

            const feeData = await supervisor.provider.getFeeData();
            const gasPrice: bigint = feeData.gasPrice ?? ethers.parseUnits('20', 'gwei');
            const gasCostWei: bigint = gasEstimate * gasPrice;

            const custodianWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, supervisor.provider);
            const txFund = await custodianWallet.sendTransaction({
                to: user.wallet,
                value: gasCostWei,
            });
            await txFund.wait();


            const tx = await userContract.unsetTicketForSale(tokenId);
            const receipt = await tx.wait();

            if (receipt && receipt.hash) {
                const response = {
                    wallet: user.wallet,
                    message: `Ticket unlisted | TxHash: ${receipt.hash}`,
                };
                console.log("[unlistTicket] 200 response:", response);
                return res.status(200).json(response);
            } else {
                console.log("[unlistTicket] 500 response:", { error: 'Unable to process the purchase' });
                return res.status(500).json({ error: 'Unable to process the purchase' });
            }
        }
        else {
            console.log("[unlistTicket] 400 response:", { message: 'Invalid verification code, transaction cancelled' });
            return res.status(400).json({ message: 'Invalid verification code, transaction cancelled' });
        }

    } catch (err) {
        console.error(err);
        console.log("[unlistTicket] 500 response:", { error: "Unable to process the purchase" });
        return res.status(500).json({ error: "Unable to process the purchase" });
    }
};

export const mintTicket = async (req: AuthRequest, res: Response): Promise<any> => {

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        console.log("[mintTicket] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        console.log("[mintTicket] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.privateKey) {
            console.log("[mintTicket] 404 response:", { message: 'User or private key not found' });
            return res.status(404).json({ message: 'User or private key not found' });
        }

        const { eventInfo } = req.body;
        const iface = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).interface;
        let tokenId: string = "";


        const tx = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).mintTicket(user.wallet, eventInfo);
        const receipt = await tx.wait();

        if (!receipt || !receipt.hash) {
            console.log("[mintTicket] 500 response:", { error: 'Tx Hash not provided or invalid' });
            return res.status(500).json({ error: 'Tx Hash not provided or invalid' });
        }

        const filter = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).filters.TicketMinted(undefined, undefined);
        const events = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).queryFilter(filter, receipt.blockNumber, receipt.blockNumber);

        if (events.length === 0) {
            console.log("[mintTicket] 500 response:", { error: "Unable to find TicketMinted" });
            return res.status(500).json({ error: "Unable to find TicketMinted" });
        }

        const parsed = iface.parseLog(events[0]);
        tokenId = parsed?.args.tokenId.toString();

        const response = {
            message: `Ticket minted | TX: MINTED | ${receipt.hash} ${tokenId}`,
        };
        console.log("[mintTicket] 201 response:", response);
        res.status(201).json(response);

    } catch (err) {
        console.error(err);
        console.log("[mintTicket] 500 response:", { error: "Unable to mint ticket | Internal error" });
        res.status(500).json({ error: "Unable to mint ticket | Internal error" });
    }
};

export const mintListTicket = async (req: AuthRequest, res: Response): Promise<any> => {

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        console.log("[mintListTicket] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        console.log("[mintListTicket] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.privateKey) {
            console.log("[mintListTicket] 404 response:", { message: 'User or private key not found' });
            return res.status(404).json({ message: 'User or private key not found' });
        }

        const { eventInfo, price } = req.body;
        const weiPrice = usdToWei(price);
        const iface = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).interface;
        let tokenId: string = "";

        const tx = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).mintAndList(user.wallet, eventInfo, weiPrice);
        const receipt = await tx.wait();

        if (!receipt || !receipt.hash) {
            console.log("[mintListTicket] 500 response:", { error: 'Tx hash invalidad or not provided' });
            return res.status(500).json({ error: 'Tx hash invalidad or not provided' });
        }

        const filter = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).filters.TicketMinted(undefined, undefined);
        const events = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).queryFilter(filter, receipt.blockNumber, receipt.blockNumber);

        if (events.length === 0) {
            console.log("[mintListTicket] 500 response:", { error: "Unable to find TicketMinted" });
            return res.status(500).json({ error: "Unable to find TicketMinted" });
        }

        const parsed = iface.parseLog(events[0]);
        tokenId = parsed?.args.tokenId.toString();

        const response = {
            message: `Ticket minted and listed | Tx: MINTED | ${receipt.hash}`,
        };
        console.log("[mintListTicket] 201 response:", response);
        res.status(201).json(response);

    } catch (err) {
        console.error(err);
        console.log("[mintListTicket] 500 response:", { error: "Unable to mint ticket | Internal error" });
        res.status(500).json({ error: "Unable to mint ticket | Internal error" });
    }
};

export const getTicketOfWallet = async (req: AuthRequest, res: Response): Promise<any> => {

    const iface = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).interface;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        console.log("[getTicketOfWallet] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        console.log("[getTicketOfWallet] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.privateKey) {
            console.log("[getTicketOfWallet] 404 response:", { message: 'User or private key not found' });
            return res.status(404).json({ message: 'User or private key not found' });
        }
        const filter = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).filters.TicketTransferred(undefined, user.wallet);
        const events = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).queryFilter(filter, 0, "latest");

        const tokenIds = events.map((event) => {
            const parsed = iface.parseLog(event);
            return parsed?.args.tokenId.toString();
        });

        const uniqueTokenIds = [...new Set(tokenIds)];

        const ticketDetails = await Promise.all(
            uniqueTokenIds.map(async (tokenId: any) => {
                const [price, owner, used, forSale, event] = await Promise.all([
                    supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).getTicketPrice(tokenId),
                    supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).ownerOf(tokenId),
                    supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).ticketsUsed(tokenId),
                    supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).ticketsForSale(tokenId),
                    supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).eventInfo(tokenId)
                ]);

                return {
                    tokenId: tokenId.toString(),
                    price: price.toString(),
                    event: event,
                    owner,
                    used,
                    forSale
                };
            })
        );
        const response = { wallet: user.wallet, tickets: ticketDetails };
        console.log("[getTicketOfWallet] 200 response:", response);
        return res.status(200).json(response);

    } catch (error) {
        console.log("[getTicketOfWallet] 500 response:", { error: "Internal error" });
        return res.status(500).json({ error: "Internal error" });
    }
};

export const buyTicket = async (req: AuthRequest, res: Response): Promise<any> => {

    const { tokenId, code } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    let decoded: any;

    if (!token) {
        console.log("[buyTicket] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        console.log("[buyTicket] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }
    try {
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.privateKey) {
            console.log("[buyTicket] 404 response:", { message: 'User or private key not found' });
            return res.status(404).json({ message: 'User or private key not found' });
        }

        const isValidate = true;
        if (!isValidate) {
            console.log("[buyTicket] 400 response:", { message: 'Invalid verification code, transaction cancelled' });
            return res.status(400).json({ message: 'Invalid verification code, transaction cancelled' });
        }

        const ticketPrice = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).getTicketPrice(tokenId);
        console.log(`Ticket price (wei): ${ticketPrice.toString()}`);

        const custContract = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!);
        const data = custContract.interface.encodeFunctionData("buyTicket", [tokenId, user.wallet]);
        const txRequest: ethers.TransactionRequest = {
            to: process.env.CONTRACT_ADDRESS,
            data,
            value: ticketPrice,
        };

        let gasEstimate: bigint;
        try {
            gasEstimate = await supervisor.provider.estimateGas(txRequest);
        } catch (err: any) {
            console.error("Error estimating gas:", err);
            console.log("[buyTicket] 500 response:", { message: 'Gas estimation failed', error: err.message });
            return res.status(500).json({ message: 'Gas estimation failed', error: err.message });
        }

        const feeData = await supervisor.provider.getFeeData();
        const gasPrice: bigint = feeData.gasPrice ?? ethers.parseUnits('20', 'gwei');
        const gasCostWei: bigint = gasEstimate * gasPrice;

        const userBalance = await supervisor.provider.getBalance(user.wallet);
        const totalCost = gasCostWei + ticketPrice;

        const custodianWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, supervisor.provider);
        const custodianBalance = await supervisor.provider.getBalance(custodianWallet);

        console.log(`Custodian balance: ${custodianBalance.toString()}`);
        console.log(`User balance: ${userBalance.toString()}, total cost needed: ${totalCost.toString()}`);

        const txFund = await custodianWallet.sendTransaction({
            to: user.wallet,
            value: totalCost
        });
        await txFund.wait();

        const userPrivateKey = await decryptPrivateKey(user.privateKey);
        const userContract = supervisor.getContractWithPrivateKey(userPrivateKey);
        const tx = await userContract.buyTicket(tokenId, user.wallet, { value: ticketPrice });
        const receipt = await tx.wait();

        if (receipt && receipt.hash) {
            const response = {
                wallet: user.wallet,
                message: `Ticket transferred | TxHash: ${receipt.hash}`,
            };
            console.log("[buyTicket] 200 response:", response);
            return res.status(200).json(response);
        } else {
            console.log("[buyTicket] 500 response:", { error: 'Unable to process the purchase' });
            return res.status(500).json({ error: 'Unable to process the purchase' });
        }

    } catch (err) {
        console.error(err);
        console.log("[buyTicket] 500 response:", { error: "Unable to process the purchase" });
        return res.status(500).json({ error: "Unable to process the purchase" });
    }
};

export const fundWalletFromToken = async (req: AuthRequest, res: Response): Promise<any> => {

    const { amount } = req.body;

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        console.log("[fundWalletFromToken] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch {
        console.log("[fundWalletFromToken] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.privateKey || !user.wallet || !amount) {
            console.log("[fundWalletFromToken] 404 response:", { message: 'User, private key, amount, or public key not found' });
            return res.status(404).json({ message: 'User, private key, amount, or public key not found' });
        }

        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, supervisor.provider);
        const tx = await wallet.sendTransaction({
            to: user.wallet,
            value: ethers.parseEther(amount),
        });
        await tx.wait();
        const response = { message: 'Wallet funded successfully', txHash: tx.hash, fundedAddress: user.wallet };
        console.log("[fundWalletFromToken] 200 response:", response);
        res.status(200).json(response);

    } catch (error: any) {
        console.error('Error funding wallet:', error?.message || error);
        console.log("[fundWalletFromToken] 500 response:", { message: 'Error funding wallet', error: error?.message });
        res.status(500).json({ message: 'Error funding wallet', error: error?.message });
    }
};

export const estimateGas = async (req: Request, res: Response): Promise<any> => {
    let { functionName, args = [], value } = req.body;

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        console.log("[estimateGas] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        console.log("[estimateGas] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    let walletToUse = "";
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.wallet) {
        console.log("[estimateGas] 404 response:", { message: 'User or wallet not found' });
        return res.status(404).json({ message: 'User or wallet not found' });
    }
    if (functionName === 'buyTicket') {
        if (args.length !== 1) {
            console.log("[estimateGas] 400 response:", { message: 'buyTicket requires exactly 1 argument: [tokenId]' });
            return res.status(400).json({
                message: 'buyTicket requires exactly 1 argument: [tokenId]'
            });
        }
        const tokenId = args[0];
        args = [tokenId, user.wallet];
        walletToUse = user.wallet;
    }
    if (functionName === 'mintAndList') {
        if (args.length !== 2) {
            console.log("[estimateGas] 400 response:", { message: 'mintAndList requires exactly 2 arguments: [eventInfo, price]' });
            return res.status(400).json({
                message: 'mintAndList requires exactly 2 arguments: [eventInfo, price]'
            });
        }
        const eventInfo = args[0];
        const price = args[1];
        const weiPrice = usdToWei(price);
        args = [user.wallet, eventInfo, weiPrice.toString()];
        walletToUse = new ethers.Wallet(process.env.PRIVATE_KEY!, supervisor.provider).address;
    }
    if (functionName === 'setTicketForSale') {
        if (args.length !== 2) {
            console.log("[estimateGas] 400 response:", { message: 'setTicketForSale requires exactly 2 arguments: [tokenId, price]' });
            return res.status(400).json({
                message: 'setTicketForSale requires exactly 2 arguments: [tokenId, price]'
            });
        }
        const tokenId = args[0];
        const price = args[1];
        args = [tokenId, price];
        walletToUse = user.wallet;
    }
    const contract = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!);
    let data: string;

    try {
        data = contract.interface.encodeFunctionData(functionName, args);
    } catch (err: any) {
        console.log("[estimateGas] 400 response:", { message: `Error encoding function data: ${err.message}` });
        return res.status(400).json({ message: `Error encoding function data: ${err.message}` });
    }

    const fragment = await contract.interface.getFunction(functionName);
    const isPayable = await fragment.payable;

    const txRequest: ethers.TransactionRequest = {
        to: process.env.CONTRACT_ADDRESS,
        data,
        from: walletToUse,
        ...(value && isPayable ? { value: ethers.parseUnits(value.toString(), 'wei') } : {})
    };

    try {
        const gasEstimate: bigint = await supervisor.provider.estimateGas(txRequest);
        const feeData = await supervisor.provider.getFeeData();
        const gasPrice: bigint = feeData.gasPrice ?? ethers.parseUnits('20', 'gwei');
        const totalCostWei: bigint = gasEstimate * gasPrice;

        const response = {
            functionName,
            args,
            gasEstimate: gasEstimate.toString(),
            gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
            totalCostWei: totalCostWei.toString()
        };
        console.log("[estimateGas] 200 response:", response);
        return res.status(200).json(response);
    } catch (err: any) {
        console.error('Error estimating gas:', err);
        console.log("[estimateGas] 500 response:", { message: 'Gas estimation failed', error: err.message });
        return res.status(500).json({ message: 'Gas estimation failed', error: err.message });
    }
};

export const getSales = async (req: Request, res: Response): Promise<any> => {

    const iface = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).interface;
    const { eventId } = req.body;

    try {
        if (!eventId) {
            console.log("[getSales] 404 response:", { message: 'Event not provided to look up' });
            res.status(404).json({ message: 'Event not provided to look up' });
        }

        const filter = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).filters.TicketSold(undefined, undefined, eventId);
        const logs = await supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!).queryFilter(filter, 0, "latest");

        const sales = await Promise.all(logs.map(async log => {
            let parsedLog = iface.parseLog(log);
            let timestamp: any = "";
            const block = await supervisor.provider.getBlock(log.blockNumber);
            if (block?.timestamp !== undefined) timestamp = new Date(block?.timestamp * 1000);
            return {
                seller: parsedLog?.args.owner.toString(),
                newOwner: parsedLog?.args.newOwner.toString(),
                price: parsedLog?.args.price.toString(),
                hash: log?.transactionHash.toString(),
                timestamp: timestamp
            }

        }));
        const response = { message: sales };
        console.log("[getSales] 200 response:", response);
        res.status(200).json(response);

    } catch (error) {
        console.error("STATUS", error);
        console.log("[getSales] 500 response:", { message: 'Unable to perform a ticket look up' });
        res.status(500).json({ message: 'Unable to perform a ticket look up' });
    }
}

export const getSoldTicketsByEvent = async (req: Request, res: Response): Promise<any> => {

    try {
        const { event } = req.params;

        const contract = supervisor.getContractWithPrivateKey(process.env.PRIVATE_KEY!);
        const tokenIds = await contract.getTicketsBoughtByEvent(event);

        const ticketDetails = await Promise.all(
            tokenIds.map(async (tokenId: any) => {
                const [price, owner, forSale] = await Promise.all([
                    contract.getTicketPrice(tokenId),
                    contract.ownerOf(tokenId),
                    contract.ticketsForSale(tokenId)
                ]);

                return {
                    tokenId: tokenId.toString(),
                    price: price.toString(),
                    owner,
                    forSale
                };
            })
        );

        console.log("[getSoldTicketsByEvent] 200 response:", ticketDetails);
        res.status(200).json(ticketDetails);
    } catch (error) {
        console.log("[getSoldTicketsByEvent] 500 response:", { message: "Error fetching tickets on sale", error });
        res.status(500).json({ message: "Error fetching tickets on sale", error });
    }
};

export const generateQR = async (req: Request, res: Response): Promise<any> => {
    const { tokenId } = req.body;

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        console.log("[generateQR] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        console.log("[generateQR] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.wallet) {
        console.log("[generateQR] 404 response:", { message: 'User or wallet not found' });
        return res.status(404).json({ message: 'User or wallet not found' });
    }

    try {

        const userPrivateKey = await decryptPrivateKey(user.privateKey);
        const signer = new ethers.Wallet(userPrivateKey, supervisor.provider);

        const nonce = Date.now();
        const expiration = Math.floor(Date.now() / 1000) + 3600;

        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256", "uint256", "uint256"],
            [process.env.CONTRACT_ADDRESS!, tokenId, nonce, expiration]
        );

        const messageHashBytes = ethers.getBytes(messageHash);

        const signature = await signer.signMessage(messageHashBytes);

        const qrPayload = {
            tokenId,
            nonce,
            expiration,
            signature
        };

        const response = { qrPayload };
        console.log("[generateQR] 200 response:", response);
        return res.status(200).json(response);

    } catch (error) {
        console.error("Error generating QR", error);
        console.log("[generateQR] 500 response:", { message: "Internal server error" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const validateQR = async (req: AuthRequest, res: Response): Promise<any> => {
    const { tokenId, nonce, expiration, signature } = req.body.qrPayload;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        console.log("[validateQR] 401 response:", { message: 'Access denied. No token provided.' });
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
    } catch (error) {
        console.log("[validateQR] 401 response:", { message: 'Invalid token' });
        return res.status(401).json({ message: 'Invalid token' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > expiration) {
        console.log("[validateQR] 400 response:", { message: 'QR code has expired' });
        return res.status(400).json({ message: 'QR code has expired' });
    }

    try {
        const organizer = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!organizer || !organizer.privateKey || !organizer.wallet) {
            console.log("[validateQR] 404 response:", { message: 'User, wallet or private key not found' });
            return res.status(404).json({ message: 'User, wallet or private key not found' });
        }

        const organizerPrivateKey = await decryptPrivateKey(organizer.privateKey);
        const organizerContract = supervisor.getContractWithPrivateKey(organizerPrivateKey);

        const data = organizerContract.interface.encodeFunctionData("validateWithSignature", [
            tokenId,
            nonce,
            expiration,
            signature
        ]);

        const txRequest: ethers.TransactionRequest = {
            to: process.env.CONTRACT_ADDRESS,
            from: organizer.wallet,
            data
        };

        let gasEstimate: bigint;
        try {
            gasEstimate = await supervisor.provider.estimateGas(txRequest);
        } catch (err: any) {
            console.error("Error estimating gas:", err);
            console.log("[validateQR] 500 response:", { message: 'Gas estimation failed', error: err.message });
            return res.status(500).json({ message: 'Gas estimation failed', error: err.message });
        }

        const feeData = await supervisor.provider.getFeeData();
        const gasPrice: bigint = feeData.gasPrice ?? ethers.parseUnits('20', 'gwei');
        const gasCostWei: bigint = gasEstimate * gasPrice;

        const custodianWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, supervisor.provider);
        const txFund = await custodianWallet.sendTransaction({
            to: organizer.wallet,
            value: gasCostWei,
        });
        await txFund.wait();

        const tx = await organizerContract.validateWithSignature(
            tokenId,
            nonce,
            expiration,
            signature
        );

        await tx.wait();

        const response = {
            message: 'QR code validated successfully',
            txHash: tx.hash
        };
        console.log("[validateQR] 200 response:", response);
        return res.status(200).json(response);

    } catch (error: any) {
        console.error("Error validating QR:", error);

        if (error?.reason) {
            console.log("[validateQR] 400 response:", { message: `Smart contract error: ${error.reason}` });
            return res.status(400).json({ message: `Smart contract error: ${error.reason}` });
        }

        console.log("[validateQR] 500 response:", { message: 'Internal server error during validation' });
        return res.status(500).json({ message: 'Internal server error during validation' });
    }
};
