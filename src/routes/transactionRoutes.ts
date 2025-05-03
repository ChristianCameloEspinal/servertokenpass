// routes/auth.ts (O donde defines tus rutas)
import { Router } from 'express';
import { checkUser, validateUser } from '../controllers/validateControllers'; 
import { getAllTickets, getTicketInfo } from '../controllers/ticketController';

const router = Router();

/*
    Rutas para validar que el usuario si posee el número de teléfono
*/

//running
router.post('/check', checkUser); 
router.post('/validate', validateUser);

//wip
router.get('/tickets/:tokenId/event-info', getTicketInfo);
router.get('/tickets/all', getAllTickets); 

// disabled
// router.post('/tickets/mint',);
// router.post('/tickets/transfer',);
// router.get('/tickets/:wallet',);
// router.get('/tickets',);

export default router;
