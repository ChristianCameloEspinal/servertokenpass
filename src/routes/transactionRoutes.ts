// routes/auth.ts (O donde defines tus rutas)
import { Router } from 'express';
import { checkUser, validateUser } from '../controllers/validateControllers'; 
import { getBlock, getLatestBlock, getTicketInfo, mintTicket, getTicketOfWallet } from '../controllers/ticketController';

const router = Router();

/*
    Rutas para validar que el usuario si posee el número de teléfono
*/

router.get('/blocks/latest', getLatestBlock);
router.get('/blocks/:blockNumber', getBlock);
router.get('/tickets/:wallet', getTicketOfWallet);
router.get('/ticket-info/:ticketId', getTicketInfo);

router.get('/tickets/:tokenId/event-info', getTicketInfo);
router.post('/tickets/mint', mintTicket );


export default router;
