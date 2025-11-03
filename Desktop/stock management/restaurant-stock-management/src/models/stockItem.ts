export class StockItem {
    id: number;
    name: string;
    quantity: number;
    price: number;

    constructor(id: number, name: string, quantity: number, price: number) {
        this.id = id;
        this.name = name;
        this.quantity = quantity;
        this.price = price;
    }

    validate(): boolean {
        if (this.quantity < 0) {
            throw new Error("Quantity cannot be negative");
        }
        if (this.price < 0) {
            throw new Error("Price cannot be negative");
        }
        return true;
    }
}