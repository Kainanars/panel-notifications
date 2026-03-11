const express = require('express');
const { Pool } = require('pg');
const path = require('node:path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeHost(rawHost) {
  if (!rawHost) return null;
  const trimmed = rawHost.trim();

  // Some providers expose DB_HOST as a full URL instead of a hostname.
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
const dbHost = normalizeHost(process.env.DB_HOST) || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const useSSL = process.env.DB_SSL === 'true';

const pool = connectionString
  ? new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: dbHost,
      database: process.env.DB_NAME || 'n8n',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: dbPort,
      connectionTimeoutMillis: 5000,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });

async function waitForDB() {
  while (true) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Banco conectado');
      break;
    } catch (err) {
      console.log(`Falha ao conectar no banco: ${err.message}`);
      console.log('⏳ Aguardando banco...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res
      .status(503)
      .json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// Listar clientes
app.get('/api/clientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes ORDER BY nome ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar cliente
app.post('/api/clientes', async (req, res) => {
  const { nome, telefone, dia_vencimento, plano, ativo } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO clientes (nome, telefone, dia_vencimento, plano, ativo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, telefone, dia_vencimento, plano, ativo ?? true],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar cliente
app.put('/api/clientes/:id', async (req, res) => {
  const { nome, telefone, dia_vencimento, plano, ativo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE clientes SET nome=$1, telefone=$2, dia_vencimento=$3, plano=$4, ativo=$5 WHERE id=$6 RETURNING *',
      [nome, telefone, dia_vencimento, plano, ativo, req.params.id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ativar/desativar
app.patch('/api/clientes/:id/toggle', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE clientes SET ativo = NOT ativo WHERE id=$1 RETURNING *',
      [req.params.id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir cliente
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM clientes WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3030;
function startServer() {
  waitForDB()
    .then(() => {
      app.listen(PORT, () => {
        const target = connectionString
          ? 'DATABASE_URL/DB_URL'
          : `${dbHost}:${dbPort}`;
        console.log(`Painel rodando na porta ${PORT} | Banco: ${target}`);
      });
    })
    .catch((err) => {
      console.error(`Erro ao iniciar servidor: ${err.message}`);
      process.exit(1);
    });
}

startServer();
