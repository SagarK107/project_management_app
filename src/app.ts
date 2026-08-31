import express, {type Express, type Request, type Response} from 'express';
import project from './routes/project.ts'
import auth from './routes/auth.ts'

const app:Express = express();

app.use(express.json());

// ROUTERS
app.use('/project', project)
app.use('/auth',auth)

app.get('/', (req:Request, res: Response) => {
    res.send('Hello World!');
})

app.get('/health', (req:Request, res: Response) => {
    res.json({
        "status" : "ok"
    })
})

export default app;
