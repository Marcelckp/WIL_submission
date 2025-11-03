import express from 'express';
import { authRouter } from './routes/auth.js';
import { boqRouter } from './routes/boq.js';
import { invoicesRouter } from './routes/invoices.js';
import { companyRouter } from './routes/company.js';
import { usersRouter } from './routes/users.js';

export const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/company', companyRouter);
app.use('/api/users', usersRouter);
app.use('/api/boq', boqRouter);
app.use('/api/invoices', invoicesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Smart Invoice API listening on http://localhost:${port}`);
  });
}


