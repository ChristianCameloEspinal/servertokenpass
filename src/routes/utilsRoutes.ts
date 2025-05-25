// routes/event.ts
import { Router } from 'express';
import { getEventById, getEvents, deleteEvent, createEvent, updateEvent, getEventsByOrganizer } from '../controllers/eventController';
import { authenticate, authenticateDistributor } from '../middlewares/authMiddleware';

const router = Router();

router.post('/events', authenticateDistributor, createEvent);
router.get('/events', authenticate, getEvents);
router.get('/events/:id', authenticate, getEventById);
router.put('/events/:id', authenticateDistributor, updateEvent);
router.delete('/events/:id', authenticateDistributor, deleteEvent);
router.get("/organizer", authenticateDistributor, getEventsByOrganizer);

export default router;