import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.ts';
import { ProjectRole } from '../generated/prisma/enums.ts';

export function requireProjectRole(...allowedRoles: ProjectRole[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = res.locals.user?.sub as string | undefined;
        if (!userId) {
            return res.status(401).json({ status: 401, message: 'Authentication required' });
        }

        const projectId = (res.locals.project?.id ?? req.params.id) as string | undefined;
        if (!projectId) {
            return res.status(400).json({ status: 400, message: 'Project id is required' });
        }

        const membership = await prisma.projectMember.findUnique({
            where: { userId_projectId: { userId, projectId } },
        });

        if (!membership) {
            return res.status(403).json({ status: 403, message: 'Not a member of this project' });
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
            return res.status(403).json({ status: 403, message: 'Insufficient project role' });
        }

        res.locals.membership = membership;
        next();
    };
}

export const requireProjectMember = requireProjectRole();
export const requireProjectOwner = requireProjectRole(ProjectRole.OWNER);
