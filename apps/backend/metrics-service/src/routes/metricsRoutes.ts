import { Router } from 'express';
import { authMiddleware ,gestor} from '../middlewares/authMiddleware';
import { getKpis, refreshKpis } from '../controllers/metricsController';


const router = Router();

router.get('/metrics', authMiddleware, gestor, getKpis);
router.post('/metrics/refresh', authMiddleware, gestor, refreshKpis);

export default router;
