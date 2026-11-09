import { Router } from 'express';
import { authMiddleware, apenascidadao } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { atualizarPrioridadeDenuncia } from '../controllers/gestorController';
import {
  createDenuncia,
  listMinhasDenuncias,
  listarFeedDenuncias,
  getDenunciaDetalhes,
  updateDenuncia,
  deleteDenuncia,
} from '../controllers/cidadaoController';
import {
  atualizarStatusDenuncia,
  listarTodasDenuncias,
  getDenunciaDetalhesGestor,
} from '../controllers/gestorController';
import { createDemand } from '../controllers/demandController';
import { registerPushDevice, unregisterPushDevice } from '../controllers/pushDeviceController';

const router = Router();

// 1. ROTAS DO GESTOR (Sempre primeiro, porque são mais específicas)
router.get('/gestor', authMiddleware, roleMiddleware('gestor'), listarTodasDenuncias);
router.get('/gestor/:id', authMiddleware, roleMiddleware('gestor'), getDenunciaDetalhesGestor);

router.patch('/gestor/:id/status', authMiddleware, roleMiddleware('gestor'), atualizarStatusDenuncia);
router.patch('/gestor/:id/prioridade', authMiddleware, roleMiddleware('gestor'), atualizarPrioridadeDenuncia);

// As rotas de ocorrências próprias mantêm as mesmas regras para os dois papéis.
const canUseCitizenFeatures = roleMiddleware('cidadao', 'gestor');
router.put('/devices/push', authMiddleware, canUseCitizenFeatures, registerPushDevice);
router.delete('/devices/push', authMiddleware, canUseCitizenFeatures, unregisterPushDevice);

router.post('/', authMiddleware, canUseCitizenFeatures, createDenuncia);
router.get('/my-demands', authMiddleware, canUseCitizenFeatures, listMinhasDenuncias);
router.get('/feed', authMiddleware, canUseCitizenFeatures, listarFeedDenuncias);

// 3. ROTA DINÂMICA COMPLETA (Sempre por ÚLTIMO no arquivo)
// Se essa rota ficar em cima, ela tenta "comer" o /gestor/:id achando que "gestor" é o ID da denúncia.
router.get('/:id', authMiddleware, canUseCitizenFeatures, getDenunciaDetalhes);
router.patch('/:id', authMiddleware, canUseCitizenFeatures, updateDenuncia);
router.delete('/:id', authMiddleware, canUseCitizenFeatures, deleteDenuncia);


export default router;
