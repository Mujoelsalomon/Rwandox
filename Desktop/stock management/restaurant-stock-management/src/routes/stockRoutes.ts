import { Router } from 'express';
import StockController from '../controllers/stockController';

const router = Router();
const stockController = new StockController();

export function setStockRoutes(app) {
    app.use('/api/stock', router);
    
    router.post('/', stockController.addStock.bind(stockController));
    router.put('/:id', stockController.updateStock.bind(stockController));
    router.delete('/:id', stockController.deleteStock.bind(stockController));
    router.get('/:id', stockController.getStock.bind(stockController));
    router.get('/', stockController.getAllStock.bind(stockController));
}