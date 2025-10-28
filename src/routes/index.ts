import { Router } from 'express';
import { articleController } from '../controllers/article.controller';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.get('/articulos', articleController.getAll);
router.get('/articulos/:codigo', articleController.getByCodigo);

export default router;