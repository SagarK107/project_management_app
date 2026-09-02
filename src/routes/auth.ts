import express, {type Request, type Response} from 'express';
import bcrypt from 'bcrypt';
import { createUserSchema, loginSchema } from '../validators/user.ts';
import { validateBody } from '../middleware/validate.ts';
import { prisma } from '../../lib/prisma.ts';
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { auth } from '../middleware/auth.middleware.ts';
const router = express.Router();

const SALT_ROUNDS = 10;

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
}

// A fixed valid bcrypt hash with no real corresponding password. Comparing against it
// when a user isn't found keeps that path's timing indistinguishable from a real
// wrong-password check, instead of returning early and leaking which emails are registered.
const DUMMY_PASSWORD_HASH = await bcrypt.hash('no-such-user-placeholder', SALT_ROUNDS);

router.post("/register", validateBody(createUserSchema), async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(409).json({ status: 409, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await prisma.user.create({
        data: {
            name,
            email,
            passwordHash,
        },
        omit: { passwordHash: true },
    });

    return res.status(201).json(newUser);
})

router.post("/login", validateBody(loginSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const existingUser = await prisma.user.findUnique({
        where : {email}
    })

    const isPasswordMatch = await bcrypt.compare(
        password,
        existingUser ? existingUser.passwordHash : DUMMY_PASSWORD_HASH
    );

    if (!existingUser || !isPasswordMatch) {
        return res.status(401).json({status : 401, message : 'Email or password incorrect'})
    }
    const token = jwt.sign({sub : existingUser.id}, jwtSecret, { algorithm: 'HS256', expiresIn:'2h' })

    return res.status(200).json({status:200, message : 'Login Succesful!', token })
})


router.get("/me", auth, async (_req : Request, res: Response) => {
    const userId = res.locals.user.sub

    const prismaUser = await prisma.user.findUnique({
        where : {id : userId},
        omit : {passwordHash : true}
    })

    if(!prismaUser)
    {
        return res.status(404).json({status: 404, message : "User not found"})
    }

    return res.status(200).json({userData : prismaUser, status: 200, message : "User retrieved succesfully"})


})


export default router;