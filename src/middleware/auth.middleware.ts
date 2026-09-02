import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config"

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 401, message: 'No bearer token provided' });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ status: 401, message: 'No bearer token provided' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        res.locals.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ status: 401, message: 'Invalid or expired token' });
    }
}