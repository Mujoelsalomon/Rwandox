class StockController {
    private stockItems: StockItem[] = [];

    addStock(req: Request, res: Response): void {
        const newItem = new StockItem(req.body.id, req.body.name, req.body.quantity, req.body.price);
        this.stockItems.push(newItem);
        res.status(201).json(newItem);
    }

    updateStock(req: Request, res: Response): void {
        const { id } = req.params;
        const index = this.stockItems.findIndex(item => item.id === id);
        if (index !== -1) {
            const updatedItem = { ...this.stockItems[index], ...req.body };
            this.stockItems[index] = updatedItem;
            res.json(updatedItem);
        } else {
            res.status(404).json({ message: 'Stock item not found' });
        }
    }

    deleteStock(req: Request, res: Response): void {
        const { id } = req.params;
        const index = this.stockItems.findIndex(item => item.id === id);
        if (index !== -1) {
            this.stockItems.splice(index, 1);
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Stock item not found' });
        }
    }

    getStock(req: Request, res: Response): void {
        res.json(this.stockItems);
    }
}

export default StockController;