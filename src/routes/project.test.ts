import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.ts';

describe('GET /project', () => {
    it('returns the list of projects', async () => {
        const res = await request(app).get('/project');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });
});

describe('GET /project/:id', () => {
    it('returns 404 for an id that does not exist', async () => {
        const res = await request(app).get('/project/does-not-exist');

        expect(res.status).toBe(404);
    });
});

describe('POST /project', () => {
    it('creates a project when given valid fields', async () => {
        const res = await request(app)
            .post('/project')
            .send({ name: 'Test App', description: 'A test project', owners: ['sagar'] });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Test App');
        expect(res.body.id).toBeDefined();
    });

    it('rejects a request missing required fields', async () => {
        const res = await request(app)
            .post('/project')
            .send({ name: 'Missing Fields' });

        expect(res.status).toBe(400);
    });
});

describe('POST project/1/task',() => {
    it('creates a task for a given project', async () => {
        const res = await request(app)
                        .post('/project/1/tasks')
                        .send({name : 'work', description : 'Do some work'})

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('work')
        expect(res.body.description).toBe('Do some work')
    })
})
