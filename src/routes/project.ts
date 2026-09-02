import express, { type Request, type Response } from 'express';
import { createTaskSchema, patchTaskSchema } from '../validators/task.ts';
import { createProjectSchema } from '../validators/project.ts';
import { addProjectMemberSchema } from '../validators/projectMember.ts';
import { prisma } from '../../lib/prisma.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { ProjectRole } from '../generated/prisma/enums.ts';
import { loadProject } from '../middleware/project.ts';
import { loadTask } from '../middleware/task.ts';
import { validateBody } from '../middleware/validate.ts';
import { auth } from '../middleware/auth.middleware.ts';
import { requireProjectMember, requireProjectOwner } from '../middleware/authorization.middleware.ts';

const router = express.Router();

router.get('/', auth, async (_req: Request, res: Response) => {
    const projects = await prisma.project.findMany();
    return res.json(projects);
});

router.get('/:id', auth, loadProject, requireProjectMember, (_req: Request, res: Response) => {
    return res.json(res.locals.project);
});

router.post('/', auth, validateBody(createProjectSchema), async (req: Request, res: Response) => {
    const { name, description } = req.body;

    const userId = res.locals.user.sub as string;

    const newProject = await prisma.project.create({
        data: {
            name,
            description,
            createdAt: new Date(),
            members: {
                create: {
                    userId,
                    role: ProjectRole.OWNER,
                },
            },
        },
        include: {
            members: true,
        },
    });

    return res.status(201).json(newProject);
});

router.get('/:id/tasks',auth, loadProject,requireProjectMember, async (_req: Request, res: Response) => {
    const tasks = await prisma.task.findMany({
        where: { projectId: res.locals.project.id },
    });

    return res.status(200).json(tasks);
});

router.post('/:id/tasks', auth, loadProject, requireProjectOwner, validateBody(createTaskSchema), async (req: Request, res: Response) => {
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

router.post('/:id/members', auth, loadProject, requireProjectOwner, validateBody(addProjectMemberSchema), async (req: Request, res: Response) => {
    const { email, role } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(404).json({ status: 404, message: 'User not found' });
    }

    try {
        const membership = await prisma.projectMember.create({
            data: {
                userId: user.id,
                projectId: res.locals.project.id,
                role: role ?? ProjectRole.MEMBER,
            },
            select: {
                projectId: true,
                role: true,
                createdAt: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });

        return res.status(201).json(membership);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(409).json({ status: 409, message: 'User is already a member of this project' });
        }
        throw error;
    }
});

router.patch('/tasks/:taskId', auth, loadTask, requireProjectOwner, validateBody(patchTaskSchema), async (req: Request, res: Response) => {
    const updatedTask = await prisma.task.update({
        where: { id: res.locals.task.id },
        data: req.body,
    });

    return res.status(200).json(updatedTask);
});

router.delete('/tasks/:taskId', auth, loadTask, requireProjectOwner, async (_req: Request, res: Response) => {
    await prisma.task.delete({ where: { id: res.locals.task.id } });

    return res.status(204).send();
});



export default router;
