import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.ts';
import { prisma } from '../../lib/prisma.ts';

const testEmails: string[] = [];

function uniqueEmail() {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    testEmails.push(email);
    return email;
}

async function createUser(name = 'Test User') {
    const email = uniqueEmail();
    const password = 'supersecret';

    await request(app).post('/auth/register').send({ name, email, password });
    const loginRes = await request(app).post('/auth/login').send({ email, password });
    const token = loginRes.body.token as string;
    const { sub: userId } = jwt.decode(token) as { sub: string };

    return { email, token, userId };
}

async function createProject(token: string, overrides: Partial<{ name: string; description: string }> = {}) {
    const res = await request(app)
        .post('/project')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Project', description: 'A test project', ...overrides });

    return res.body;
}

async function createProjectWithTask(ownerToken: string) {
    const project = await createProject(ownerToken);
    const taskRes = await request(app)
        .post(`/project/${project.id}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Original name', description: 'Original description' });

    return { project, task: taskRes.body };
}

afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
});

describe('GET /project', () => {
    it('returns the list of projects when authenticated', async () => {
        const { token } = await createUser();
        await createProject(token, { name: 'Seed Project', description: 'Ensures the list is non-empty' });

        const res = await request(app)
            .get('/project')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('rejects a request with no token', async () => {
        const res = await request(app).get('/project');

        expect(res.status).toBe(401);
    });
});

describe('GET /project/:id', () => {
    it('returns the project for an authenticated member', async () => {
        const { token } = await createUser();
        const project = await createProject(token);

        const res = await request(app)
            .get(`/project/${project.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(project.id);
    });

    it('rejects a request with no token', async () => {
        const { token } = await createUser();
        const project = await createProject(token);

        const res = await request(app).get(`/project/${project.id}`);

        expect(res.status).toBe(401);
    });

    it('rejects an authenticated non-member', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const outsider = await createUser();

        const res = await request(app)
            .get(`/project/${project.id}`)
            .set('Authorization', `Bearer ${outsider.token}`);

        expect(res.status).toBe(403);
    });

    it('returns 404 for a project id that does not exist', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .get('/project/does-not-exist')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });
});

describe('POST /project', () => {
    it('creates a project and makes the creator its owner', async () => {
        const { token, userId } = await createUser();

        const res = await request(app)
            .post('/project')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Test App', description: 'A test project' });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Test App');
        expect(res.body.id).toBeDefined();
        expect(res.body.members).toEqual([
            expect.objectContaining({ userId, role: 'OWNER' }),
        ]);
    });

    it('rejects a request with no token', async () => {
        const res = await request(app)
            .post('/project')
            .send({ name: 'No Auth', description: 'Should be rejected' });

        expect(res.status).toBe(401);
    });

    it('rejects a request missing required fields', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post('/project')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Missing Fields' });

        expect(res.status).toBe(400);
    });
});

describe('POST /project/:id/members', () => {
    it('adds a member when authenticated as the project owner', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const invitee = await createUser();

        const res = await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: invitee.email });

        expect(res.status).toBe(201);
        expect(res.body.role).toBe('MEMBER');
        expect(res.body.user.email).toBe(invitee.email);
    });

    it('allows the owner to specify an explicit role', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const invitee = await createUser();

        const res = await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: invitee.email, role: 'OWNER' });

        expect(res.status).toBe(201);
        expect(res.body.role).toBe('OWNER');
    });

    it('rejects a request with no token', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const invitee = await createUser();

        const res = await request(app)
            .post(`/project/${project.id}/members`)
            .send({ email: invitee.email });

        expect(res.status).toBe(401);
    });

    it('rejects a non-owner member', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const member = await createUser();
        await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: member.email });
        const outsider = await createUser();

        const res = await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${member.token}`)
            .send({ email: outsider.email });

        expect(res.status).toBe(403);
    });

    it('returns 404 when the invited user does not exist', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);

        const res = await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: 'nobody-really@example.com' });

        expect(res.status).toBe(404);
    });

    it('returns 409 when the user is already a member', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const invitee = await createUser();
        await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: invitee.email });

        const res = await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: invitee.email });

        expect(res.status).toBe(409);
    });
});

describe('GET /project/:id/tasks', () => {
    it('returns tasks for an authenticated member', async () => {
        const owner = await createUser();
        const { project } = await createProjectWithTask(owner.token);

        const res = await request(app)
            .get(`/project/${project.id}/tasks`)
            .set('Authorization', `Bearer ${owner.token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('rejects a request with no token', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);

        const res = await request(app).get(`/project/${project.id}/tasks`);

        expect(res.status).toBe(401);
    });

    it('rejects an authenticated non-member', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const outsider = await createUser();

        const res = await request(app)
            .get(`/project/${project.id}/tasks`)
            .set('Authorization', `Bearer ${outsider.token}`);

        expect(res.status).toBe(403);
    });
});

describe('POST /project/:id/tasks', () => {
    it('creates a task when authenticated as the project owner', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token, {
            name: 'Task Parent Project',
            description: 'Holds a task for this test',
        });

        const res = await request(app)
            .post(`/project/${project.id}/tasks`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ name: 'work', description: 'Do some work' });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('work');
        expect(res.body.description).toBe('Do some work');
    });

    it('rejects a request with no token', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);

        const res = await request(app)
            .post(`/project/${project.id}/tasks`)
            .send({ name: 'work', description: 'Do some work' });

        expect(res.status).toBe(401);
    });

    it('rejects an authenticated non-member', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const outsider = await createUser();

        const res = await request(app)
            .post(`/project/${project.id}/tasks`)
            .set('Authorization', `Bearer ${outsider.token}`)
            .send({ name: 'work', description: 'Do some work' });

        expect(res.status).toBe(403);
    });

    it('rejects a member who is not the project owner', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);
        const member = await createUser();
        await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: member.email });

        const res = await request(app)
            .post(`/project/${project.id}/tasks`)
            .set('Authorization', `Bearer ${member.token}`)
            .send({ name: 'work', description: 'Do some work' });

        expect(res.status).toBe(403);
    });

    it('rejects a request missing required fields', async () => {
        const owner = await createUser();
        const project = await createProject(owner.token);

        const res = await request(app)
            .post(`/project/${project.id}/tasks`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ name: 'Missing description' });

        expect(res.status).toBe(400);
    });
});

describe('PATCH /project/tasks/:taskId', () => {
    it('updates a task as the project owner', async () => {
        const owner = await createUser();
        const { task } = await createProjectWithTask(owner.token);

        const res = await request(app)
            .patch(`/project/tasks/${task.id}`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ name: 'Updated name' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated name');
    });

    it('rejects a request with no token', async () => {
        const owner = await createUser();
        const { task } = await createProjectWithTask(owner.token);

        const res = await request(app)
            .patch(`/project/tasks/${task.id}`)
            .send({ name: 'Updated name' });

        expect(res.status).toBe(401);
    });

    it('rejects a member who is not the project owner', async () => {
        const owner = await createUser();
        const { project, task } = await createProjectWithTask(owner.token);
        const member = await createUser();
        await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: member.email });

        const res = await request(app)
            .patch(`/project/tasks/${task.id}`)
            .set('Authorization', `Bearer ${member.token}`)
            .send({ name: 'Updated name' });

        expect(res.status).toBe(403);
    });

    it('returns 404 for a task id that does not exist', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .patch('/project/tasks/does-not-exist')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated name' });

        expect(res.status).toBe(404);
    });

    it('rejects an empty update body', async () => {
        const owner = await createUser();
        const { task } = await createProjectWithTask(owner.token);

        const res = await request(app)
            .patch(`/project/tasks/${task.id}`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.formErrors.length).toBeGreaterThan(0);
    });
});

describe('DELETE /project/tasks/:taskId', () => {
    it('deletes a task as the project owner', async () => {
        const owner = await createUser();
        const { task } = await createProjectWithTask(owner.token);

        const res = await request(app)
            .delete(`/project/tasks/${task.id}`)
            .set('Authorization', `Bearer ${owner.token}`);

        expect(res.status).toBe(204);

        const stored = await prisma.task.findUnique({ where: { id: task.id } });
        expect(stored).toBeNull();
    });

    it('rejects a request with no token', async () => {
        const owner = await createUser();
        const { task } = await createProjectWithTask(owner.token);

        const res = await request(app).delete(`/project/tasks/${task.id}`);

        expect(res.status).toBe(401);
    });

    it('rejects a member who is not the project owner', async () => {
        const owner = await createUser();
        const { project, task } = await createProjectWithTask(owner.token);
        const member = await createUser();
        await request(app)
            .post(`/project/${project.id}/members`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: member.email });

        const res = await request(app)
            .delete(`/project/tasks/${task.id}`)
            .set('Authorization', `Bearer ${member.token}`);

        expect(res.status).toBe(403);
    });

    it('returns 404 for a task id that does not exist', async () => {
        const { token } = await createUser();

        const res = await request(app)
            .delete('/project/tasks/does-not-exist')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });
});
