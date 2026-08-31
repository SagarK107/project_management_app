import {z} from "zod";

export const createUserSchema = z.object({
    name: z.string().trim().min(1, "name is required"),
    email: z.string().trim().toLowerCase().pipe(z.email("invalid email")),
    password: z.string().trim().min(8, "password is required"),
})

export const loginSchema = z.object({
    email :  z.string().trim().toLowerCase().pipe(z.email("invalid email")),
    password: z.string().trim().min(1,"password is required")
})