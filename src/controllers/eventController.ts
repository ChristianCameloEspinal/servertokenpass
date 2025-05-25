import { Request, Response } from 'express';
import prisma from '../prisma/client';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
    user?: any;
}

export const createEvent = async (req: AuthRequest, res: Response): Promise<any> => {


    const token = req.header('Authorization')?.replace('Bearer ', '') || '';

    if (!token) {
        res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const { eventData } = req.body;
    const { eventDate, eventName, location, type, image, eventDescription } = eventData;
    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;
        const event = await prisma.event.create({
            data: {
                eventDescription: eventDescription,
                eventDate: eventDate,
                eventName: eventName,
                location: location,
                type: type,
                image: image,
                organizerId: decoded.userId
            },
        });
        res.status(200).json({ event: event });
    }
    catch (error) {
        console.error("Error creating event:", error);
        return res.status(500).json({ message: 'Something went wrong while creating the event.' });
    }
};

export const getEvents = async (req: Request, res: Response): Promise<any> => {
    try {
        const events = await prisma.event.findMany();
        res.status(200).json({ events: events });
    } catch (error) {
        console.error("Error fetching events:", error);
        return res.status(500).json({ message: 'Something went wrong while fetching events.' });
    }
};

export const getEventById = async (req: Request, res: Response): Promise<any> => {
    const { id } = req.params;
    try {
        const event = await prisma.event.findUnique({
            where: {
                id: parseInt(id)
            }
        });
        if (!event) {
            return res.status(404).json({ message: `Event with ID ${id} not found.` });
        }
        res.status(200).json({ event: event });
    } catch (error) {
        console.error("Error fetching event by ID:", error);
        return res.status(500).json({ message: `Something went wrong while fetching event with ID ${id}.` });
    }
};

export const updateEvent = async (req: Request, res: Response): Promise<any> => {
    const { id } = req.params;
    const { eventData } = req.body;
    const { eventDate, eventName, location, type, image, eventDescription } = eventData;
    try {
        const updatedEvent = await prisma.event.update({
            where: {
                id: parseInt(id)
            },
            data: {
                eventDescription: eventDescription,
                eventDate: eventDate,
                eventName: eventName,
                location: location,
                type: type,
                image: image
            },
        });
        res.status(200).json({ event: updatedEvent });
    } catch (error) {
        console.error("Error updating event:", error);
        return res.status(500).json({ message: `Something went wrong while updating event with ID ${id}.` });
    }
};

export const deleteEvent = async (req: Request, res: Response): Promise<any> => {
    const { id } = req.params;
    try {
        await prisma.event.delete({
            where: {
                id: parseInt(id)
            }
        });
        res.status(204).send();
    } catch (error) {
        console.error("Error deleting event:", error);
        return res.status(500).json({ message: `Something went wrong while deleting event with ID ${id}.` });
    }
};

export const getEventsByOrganizer = async (req: Request, res: Response): Promise<any> => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Missing token" });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const organizerId = decoded.userId;

        const events = await prisma.event.findMany({
            where: {
                organizerId: organizerId
            }
        });

        return res.status(200).json({ events });
    } catch (error) {
        console.error("Error fetching organizer events:", error);
        return res.status(500).json({ message: "Failed to fetch events." });
    }
};