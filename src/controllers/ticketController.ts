import { Request, Response } from 'express';

import supervisor from './blockchain/blockchainSupervisor';

export const getLatestBlock = async (req: Request, res: Response): Promise<any> => {
    try {
        console.log("GET LATEST BLOCK", req.params);
        const block = await supervisor.provider.getBlock("latest");
        if (!block) {
            return res.status(404).json({ message: "No se encontraron bloques" });
        }
        res.status(200).json({ block: block });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "No se pudo obtener la info de los bloques" });
    }
}

export const getBlock = async (req: Request, res: Response): Promise<any> => {
    try {
        console.log("GET BLOCK", req.params);
        const { blockNumber } = req.params;
        const block = await supervisor.provider.getBlock(blockNumber);
        if (!block) {
            return res.status(404).json({ message: "No se encontraron bloques" });
        }
        res.status(200).json({ block: block });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "No se pudo obtener la info del bloque" });
    }
}

export const getTicketInfo = async (req: Request, res: Response) => {
    const { ticketId } = req.params;

    try {
        console.log("GET TICKET INFO", req.params);
        const info = await supervisor.contract.getEventInfo(ticketId);
        res.status(200).json({ eventInfo: info });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'No se pudo obtener la info del evento' });
    }
};

export const mintTicket = async (req: Request, res: Response) => {
    const { to, eventInfo, systemWallet } = req.body;

    try {
        console.log("----------------MINT TICKET START----------", req.body);
        const tx = await supervisor.contract.mintAndApprove(eventInfo, systemWallet);  // Llamamos a la función mint()
        const receipt = await tx.wait();  // Esperamos la confirmación de la transacción

        if (receipt && receipt.hash) {
            console.log("RECEIPT", receipt);
            console.log("RECEIPT LOGS FILTER ", `${receipt.blockNumber}|${receipt.blockNumber}`);
            const filter = supervisor.contract.filters.TicketMinted(to, null);
            const events = await supervisor.contract.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
            console.log("EVENTS", events);
            res.status(201).json({
                message: `Ticket minteado | Transacción: ${receipt.hash}`,
            }); // Quede aquí donde no se está imprimiendo el evento
        } else {
            res.status(500).json({ error: 'No se recibió un recibo de transacción válido' });
        }


    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo mintear el ticket" });
    }
};

export const getTicketOfWallet = async (req: Request, res: Response): Promise<any> => {

    const iface = supervisor.contract.interface;

    try {
        console.log("GET TICKET OF WALLET", req.params.wallet);

        const { wallet } = req.params;
        const filter = supervisor.contract.filters.TicketMinted(wallet,null);
        const events = await supervisor.contract.queryFilter(filter, 0, "latest");

        const parsedEvents = events.map((event) => {
            const parsed = iface.parseLog(event);
            return {
                to: parsed?.args.to,
                tokenId: parsed?.args.tokenId.toString(),
                eventInfo: parsed?.args.eventInfo,
                tx: event.transactionHash,
            };
        });

        res.status(200).json({ parsedEvents });

    } catch (error) {
        res.status(500).json({ error: "No se pudo obtener la info de los tickets" });
    }
}

export const transferTicket = async (req: Request, res: Response): Promise<any> => {
    const { from, to, tokenId } = req.body;

    try {
        console.log("TRANSFER TICKET", req.body);
        const tx = await supervisor.contract.transferTicket(from, to, tokenId);
        const receipt = await tx.wait();

        if (receipt && receipt.hash) {
            res.status(200).json({
                message: `Ticket transferido | Transacción: ${receipt.hash}`,
            });
        } else {
            res.status(500).json({ error: 'No se recibió un recibo de transacción válido' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "No se pudo transferir el ticket" });
    }
}

