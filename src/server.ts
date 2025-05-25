// server.ts
import express, { Express } from 'express';
import cors from 'cors';
import transactionRoutes from './routes/transactionRoutes'; // Asegúrate de que la ruta sea correcta
import authRoutes from './routes/authRoutes'; // Asegúrate de que la ruta sea correcta
import utilsRoutes from './routes/utilsRoutes';
import { env } from 'process';

const app: Express = express();
const port = env.PORT;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/utils',utilsRoutes)

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
