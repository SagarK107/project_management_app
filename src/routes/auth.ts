import express, {type Request, type Response} from 'express';
import bcrypt from 'bcrypt';
import { createUserSchema, loginSchema } from '../validators/user.ts';
import { validateBody } from '../middleware/validate.ts';
import { prisma } from '../../lib/prisma.ts';

const router = express.Router();

const SALT_ROUNDS = 10;

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

    return res.status(200).json({status:200, message : 'Login Succesful!'})
})

export default router;