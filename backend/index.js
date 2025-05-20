// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kedb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();

// API Routes

// Create KEBD record
// Create KEBD record
app.post('/api/kebd', async (req, res) => {
  try {
    const {
      errorId, // ID
      title,
      description,
      rootCause,
      impact,
      category,
      subcategory,
      workaround,
      resolution,
      status,
      dateIdentified,
      linkedIncidents,
      owner,
      priority,
      environment,
      attachments
    } = req.body;

    const query = `
      INSERT INTO knowledge_errors (
        error_id, 
        title, 
        description, 
        root_cause, 
        impact, 
        category,
        subcategory,
        workaround, 
        resolution, 
        status, 
        date_identified, 
        linked_incidents, 
        owner, 
        priority,
        environment,
        attachments,
        last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const [result] = await pool.execute(query, [
      errorId,
      title,
      description,
      rootCause,
      impact,
      category,
      subcategory,
      workaround,
      resolution || null,
      status,
      dateIdentified,
      linkedIncidents || null,
      owner,
      priority,
      environment,
      attachments || null
    ]);

    res.status(201).json({
      message: 'KEBD record created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating KEBD record:', error);
    res.status(500).json({ message: 'Failed to create KEBD record', error: error.message });
  }
});

// Get all KEBD records
app.get('/api/kebd', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM knowledge_errors ORDER BY id DESC');
    
    // Convert snake_case to camelCase for frontend
    const records = rows.map(row => ({
      id: row.id,
      errorId: row.error_id,
      title: row.title,
      description: row.description,
      rootCause: row.root_cause,
      impact: row.impact,
      category: row.category,
      subcategory: row.subcategory,
      workaround: row.workaround,
      resolution: row.resolution,
      status: row.status,
      dateIdentified: row.date_identified,
      lastUpdated: row.last_updated,
      linkedIncidents: row.linked_incidents,
      owner: row.owner,
      priority: row.priority,
      environment: row.environment,
      attachments: row.attachments,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching KEBD records:', error);
    res.status(500).json({ message: 'Failed to fetch KEBD records', error: error.message });
  }
});

// Get KEBD record by ID
app.get('/api/kebd/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM knowledge_errors WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'KEBD record not found' });
    }
    
    const row = rows[0];
    const record = {
      id: row.id,
      errorId: row.error_id,
      title: row.title,
      description: row.description,
      rootCause: row.root_cause,
      impact: row.impact,
      category: row.category,
      subcategory: row.subcategory,
      workaround: row.workaround,
      resolution: row.resolution,
      status: row.status,
      dateIdentified: row.date_identified,
      lastUpdated: row.last_updated,
      linkedIncidents: row.linked_incidents,
      owner: row.owner,
      priority: row.priority,
      environment: row.environment,
      attachments: row.attachments,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    res.status(200).json(record);
  } catch (error) {
    console.error('Error fetching KEBD record:', error);
    res.status(500).json({ message: 'Failed to fetch KEBD record', error: error.message });
  }
});

// Update KEBD record
app.put('/api/kebd/:id', async (req, res) => {
  try {
    const {
      errorId,
      title,
      description,
      rootCause,
      impact,
      category,
      subcategory,
      workaround,
      resolution,
      status,
      dateIdentified,
      linkedIncidents,
      owner,
      priority,
      environment,
      attachments
    } = req.body;

    const query = `
      UPDATE knowledge_errors SET
        error_id = ?,
        title = ?,
        description = ?,
        root_cause = ?,
        impact = ?,
        category = ?,
        subcategory = ?,
        workaround = ?,
        resolution = ?,
        status = ?,
        date_identified = ?,
        linked_incidents = ?,
        owner = ?,
        priority = ?,
        environment = ?,
        attachments = ?,
        last_updated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const [result] = await pool.execute(query, [
      errorId,
      title,
      description,
      rootCause,
      impact,
      category,
      subcategory,
      workaround,
      resolution || null,
      status,
      dateIdentified,
      linkedIncidents || null,
      owner,
      priority,
      environment,
      attachments || null,
      req.params.id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'KEBD record not found' });
    }

    res.status(200).json({ message: 'KEBD record updated successfully' });
  } catch (error) {
    console.error('Error updating KEBD record:', error);
    res.status(500).json({ message: 'Failed to update KEBD record', error: error.message });
  }
});

// Delete KEBD record - this remains the same
app.delete('/api/kebd/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM knowledge_errors WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'KEBD record not found' });
    }

    res.status(200).json({ message: 'KEBD record deleted successfully' });
  } catch (error) {
    console.error('Error deleting KEBD record:', error);
    res.status(500).json({ message: 'Failed to delete KEBD record', error: error.message });
  }
});
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});