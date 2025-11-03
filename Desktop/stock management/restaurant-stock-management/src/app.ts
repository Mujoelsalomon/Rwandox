import express from 'express';
import { setStockRoutes } from './routes/stockRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

setStockRoutes(app);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});