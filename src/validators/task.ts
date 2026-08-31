import { z } from 'zod';
import { Status } from '../types/Task.ts';

export const createTaskSchema = z.object({
    name: z.string().trim().min(1, "name is required"),
    description: z.string().trim().min(1, "description is required"),
});

export const patchTaskSchema = z.object({
    name: z.string().trim().min(1, "name cannot be empty").optional(),
    description: z.string().trim().min(1, "description cannot be empty").optional(),
    status: z.enum(Status).optional(),
}).refine(data => Object.keys(data).length > 0, {
    message: "At least one of name, description, or status must be provided",
});
