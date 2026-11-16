import 'dotenv/config';
import express from 'express';
import demandRoutes from './routes/demandRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorMiddleware } from './middlewares/errorMiddleware';

const app = express();
const requestBodyLimit = '5mb';
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ limit: requestBodyLimit, extended: true }));
app.use(healthRoutes);         
app.use('/demandas', demandRoutes);
app.use(errorMiddleware);

export default app;
