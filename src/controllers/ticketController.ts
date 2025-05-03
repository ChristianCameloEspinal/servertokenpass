import { Request, Response } from 'express';
import contract from './blockchain/contractInstance';

export const getTicketInfo = async (req: Request, res: Response) => {
    const { tokenId } = req.params;

    try {
        const info = await contract.getEventInfo(tokenId);
        res.status(200).json({ eventInfo: info });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'No se pudo obtener la info del evento' });
    }
};

export const getAllTickets = async (req: Request, res: Response) => {
    try {
        const events = await contract.queryFilter('TicketMinted', -1000);

        // Mostrar los eventos
        events.forEach((event: any) => {
            console.log(`Ticket Minted:`);
            console.log(`To: ${event.args.to}`);
            console.log(`Token ID: ${event.args.tokenId}`);
            console.log(`Event Info: ${event.args.eventInfo}`);
        });

        res.status(200).json({ eventsInfo: events });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener la info de todos los eventos' });
    }
}