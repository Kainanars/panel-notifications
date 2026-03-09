const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  host: process.env.DB_HOST || 'postgresql',
  database: process.env.DB_NAME || 'n8n',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

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
app.listen(PORT, () => console.log(`Painel rodando na porta ${PORT}`));
