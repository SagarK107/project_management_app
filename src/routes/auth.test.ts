import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.ts';
import { prisma } from '../../lib/prisma.ts';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
}

const testEmails: string[] = [];

function uniqueEmail() {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    testEmails.push(email);
    return email;
}

afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
});

describe('POST /auth/register', () => {
    it('creates a user when given valid fields', async () => {
        const email = uniqueEmail();
        const res = await request(app)
            .post('/auth/register')
            .send({ name: 'Test User', email, password: 'supersecret' });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe(email);
        expect(res.body.name).toBe('Test User');
        expect(res.body.passwordHash).toBeUndefined();
    });

    it('rejects a request missing required fields', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ name: 'No Email Or Password' });

        expect(res.status).toBe(400);
    });

    it('rejects an invalid email format', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ name: 'Bad Email', email: 'not-an-email', password: 'supersecret' });

        expect(res.status).toBe(400);
    });

    it('rejects a duplicate email', async () => {
        const email = uniqueEmail();
        await request(app)
            .post('/auth/register')
            .send({ name: 'First', email, password: 'supersecret' });

        const res = await request(app)
            .post('/auth/register')
            .send({ name: 'Second', email, password: 'anotherpassword' });

        expect(res.status).toBe(409);
    });
});

describe('POST /auth/login', () => {
    it('logs in with correct credentials', async () => {
        const email = uniqueEmail();
        const password = 'supersecret';
        await request(app).post('/auth/register').send({ name: 'Login User', email, password });

        const res = await request(app).post('/auth/login').send({ email, password });

        expect(res.status).toBe(200);
    });

    it('rejects an incorrect password', async () => {
        const email = uniqueEmail();
        await request(app)
            .post('/auth/register')
            .send({ name: 'Wrong Password', email, password: 'correctpassword' });

        const res = await request(app).post('/auth/login').send({ email, password: 'wrongpassword' });

        expect(res.status).toBe(401);
    });

    it('rejects a nonexistent email', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'nobody-really@example.com', password: 'whatever' });

        expect(res.status).toBe(401);
    });

    it('rejects a request missing required fields', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'missing-password@example.com' });

        expect(res.status).toBe(400);
    });
});

describe('GET /auth/me', () => {
    it("returns the authenticated user's data with a valid token", async () => {
        const email = uniqueEmail();
        const password = 'supersecret';
        await request(app).post('/auth/register').send({ name: 'Me User', email, password });
        const loginRes = await request(app).post('/auth/login').send({ email, password });

        const res = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${loginRes.body.token}`);

        expect(res.status).toBe(200);
        expect(res.body.userData.email).toBe(email);
        expect(res.body.userData.name).toBe('Me User');
        expect(res.body.userData.passwordHash).toBeUndefined();
    });

    it('rejects a request with no token', async () => {
        const res = await request(app).get('/auth/me');

        expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
        const res = await request(app)
            .get('/auth/me')
            .set('Authorization', 'Bearer not-a-real-token');

        expect(res.status).toBe(401);
    });

    it('rejects a token signed with the wrong secret', async () => {
        const forgedToken = jwt.sign({ sub: 'someone' }, 'wrong-secret', { algorithm: 'HS256' });

        const res = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${forgedToken}`);

        expect(res.status).toBe(401);
    });

    it('rejects an expired token', async () => {
        const email = uniqueEmail();
        await request(app).post('/auth/register').send({ name: 'Expired User', email, password: 'supersecret' });
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new Error('test setup failed: user was not created');
        }

        const expiredToken = jwt.sign({ sub: user.id }, jwtSecret, {
            algorithm: 'HS256',
            expiresIn: -10,
        });

        const res = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
    });
});
