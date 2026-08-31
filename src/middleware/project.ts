import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.ts';

export async function loadProject(req: Request, res: Response, next: NextFunction) {
    const projectId = req.params.id as string;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
        return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    res.locals.project = project;
    next();
}
