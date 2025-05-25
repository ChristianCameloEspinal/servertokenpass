// routes/auth.ts (O donde defines tus rutas)
import { Router } from 'express';
import { getBlock, getLatestBlock, mintTicket, getTicketOfWallet, getTicketbyEvent, getTicketListedbyEvent, unlistTicket, listTicket, buyTicket, mintListTicket, fundWalletFromToken, estimateGas, getSales, getSoldTicketsByEvent, generateQR, validateQR } from '../controllers/ticketController';
import { authenticate, authenticateDistributor } from '../middlewares/authMiddleware';


const router = Router();

router.get('/blocks/latest', authenticate, getLatestBlock);
router.get('/blocks/:blockNumber', authenticate, getBlock);

router.post('/tickets/mint', authenticateDistributor, mintTicket);
router.post('/tickets/mint-list', authenticateDistributor, mintListTicket);
router.get('/tickets/wallet', authenticate, getTicketOfWallet);
router.get('/tickets/event/:event', authenticate, getTicketbyEvent);
router.get('/tickets/event/listed/:event', authenticate, getTicketListedbyEvent);
router.get('/tickets/event/bought/:event', authenticateDistributor, getSoldTicketsByEvent);
router.post('/tickets/unlist', authenticate, unlistTicket);
router.post('/tickets/list', authenticate, listTicket);
router.post('/tickets/purchase', authenticate, buyTicket);
router.post('/wallet/fund', authenticate, fundWalletFromToken);
router.post('/estimategas', authenticate, estimateGas);
router.post('/sales',authenticate,getSales)
router.post('/tickets/generateqr',authenticate,generateQR)
router.post('/tickets/validateqr',authenticateDistributor,validateQR)
export default router;
