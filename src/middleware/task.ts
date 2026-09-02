import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.ts';

export async function loadTask(req: Request, res: Response, next: NextFunction) {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
        return res.status(404).json({ status: 404, message: 'Task not found' });
    }

    res.locals.task = task;
    res.locals.project = { id: task.projectId };
    next();
}
