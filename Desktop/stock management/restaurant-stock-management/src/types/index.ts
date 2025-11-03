export interface StockItemInterface {
    id: number;
    name: string;
    quantity: number;
    price: number;
}

export interface StockControllerInterface {
    addStock(item: StockItemInterface): void;
    updateStock(id: number, item: StockItemInterface): void;
    deleteStock(id: number): void;
    getStock(id: number): StockItemInterface | null;
}