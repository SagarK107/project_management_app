import { z } from 'zod';
import { ProjectRole } from '../generated/prisma/enums.ts';

export const addProjectMemberSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email('invalid email')),
    role: z.enum(ProjectRole).optional(),
});
