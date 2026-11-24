import { Router } from 'express';
import { authMiddleware ,gestor} from '../middlewares/authMiddleware';
import { getKpis, refreshKpis } from '../controllers/metricsController';
import { dashboardAudience } from '../middlewares/dashboardAudience';
import { dashboardSummary } from '../controllers/dashboardController';
import { listNeighborhoodIndicators } from '../controllers/neighborhoodIndicatorsController';
import { inundationAreas } from '../controllers/inundationController';


const router = Router();

router.get('/metrics/dashboard', authMiddleware, dashboardAudience, dashboardSummary);
router.get('/metrics/inundation', authMiddleware, dashboardAudience, inundationAreas);

router.get('/metrics', authMiddleware, gestor, getKpis);
router.post('/metrics/refresh', authMiddleware, gestor, refreshKpis);
router.get('/metrics/indicators/neighborhoods', authMiddleware, gestor, listNeighborhoodIndicators);

export default router;
