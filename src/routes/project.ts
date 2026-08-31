import express, { type Request, type Response } from 'express';
import { createTaskSchema, patchTaskSchema } from '../validators/task.ts';
import { prisma } from '../../lib/prisma.ts';
import { loadProject } from '../middleware/project.ts';
import { validateBody } from '../middleware/validate.ts';

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
    const projects = await prisma.project.findMany();
    return res.json(projects);
});

router.get('/:id', loadProject, (_req: Request, res: Response) => {
    return res.json(res.locals.project);
});

router.post('/', async (req: Request, res: Response) => {
    const { name, description } = req.body;

    if (!name || !description) {
        return res.status(400).json({ status: 400, message: 'name and description are required' });
    }

    const newProject = await prisma.project.create({
        data: {
            name,
            description,
            createdAt: new Date(),
        }
    });

    return res.status(201).json(newProject);
});

router.get('/:id/tasks', loadProject, async (_req: Request, res: Response) => {
    const tasks = await prisma.task.findMany({
        where: { projectId: res.locals.project.id },
    });

    return res.status(200).json(tasks);
});

router.post('/:id/tasks', loadProject, validateBody(createTaskSchema), async (req: Request, res: Response) => {
    const { name, description } = req.body;

    const newTask = await prisma.task.create({
        data: {
            name,
            description,
            projectId: res.locals.project.id,
            createdAt: new Date(),
        }
    });

    return res.status(201).json(newTask);
});

router.patch('/tasks/:taskId', validateBody(patchTaskSchema), async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
        return res.status(404).json({ status: 404, message: 'Task not found' });
    }

    const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: req.body,
    });

    return res.status(200).json(updatedTask);
});

router.delete('/tasks/:taskId', async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
        return res.status(404).json({ status: 404, message: 'Task not found' });
    }

    await prisma.task.delete({ where: { id: taskId } });

    return res.status(204).send();
});

export default router;
