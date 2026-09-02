import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateBody<T extends z.ZodType>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const { fieldErrors, formErrors } = z.flattenError(result.error);
            return res.status(400).json({
                status: 400,
                message: 'Invalid data',
                errors: fieldErrors,
                formErrors,
            });
        }

        req.body = result.data;
        next();
    };
}
