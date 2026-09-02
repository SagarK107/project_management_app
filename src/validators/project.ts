import { z } from 'zod';

export const createProjectSchema = z.object({
    name: z.string().trim().min(1, 'name is required'),
    description: z.string().trim().min(1, 'description is required'),
});
