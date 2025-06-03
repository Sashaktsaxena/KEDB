// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Secret key for JWT signing
const JWT_SECRET = process.env.JWT_SECRET || 'littlecoder';

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

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin role middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin privileges required' });
  }
};

// Configure multer for memory storage (not disk)
const storage = multer.memoryStorage();

// File filter to restrict file types
const fileFilter = (req, file, cb) => {
  // Accept images and common document types
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: images, PDF, Word, Excel, text files'), false);
  }
};

// Setup multer upload with memory storage
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// API Routes

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Check if user exists
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR employee_id = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = users[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      // For security, use the same message as when user doesn't exist
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Update last login time
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        employeeId: user.employee_id,
        username: user.username, 
        role: user.role,
        fullName: user.full_name 
      }, 
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Return user info and token
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        employeeId: user.employee_id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, employee_id, username, full_name, email, role, department, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    res.status(200).json({
      id: user.id,
      employeeId: user.employee_id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department,
      createdAt: user.created_at,
      lastLogin: user.last_login
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ message: 'Failed to fetch user info', error: error.message });
  }
});

// Register new user (admin only)
app.post('/api/auth/register', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { employeeId, username, password, fullName, email, role, department } = req.body;
    
    // Validate required fields
    if (!employeeId || !username || !password || !fullName || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check for duplicate employeeId or username
    const [duplicates] = await pool.query(
      'SELECT * FROM users WHERE employee_id = ? OR username = ? OR email = ?',
      [employeeId, username, email]
    );
    
    if (duplicates.length > 0) {
      return res.status(409).json({ message: 'Employee ID, username or email already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const [result] = await pool.execute(
      'INSERT INTO users (employee_id, username, password, full_name, email, role, department) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [employeeId, username, hashedPassword, fullName, email, role || 'user', department]
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Failed to register user', error: error.message });
  }
});

// Update password
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    
    // Get user's current password
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check current password
    const passwordMatch = await bcrypt.compare(currentPassword, users[0].password);
    
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash and update new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    
    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
});
app.get('/api/users',async (req, res) => {
  try{
    const [users]=await pool.query('SELECT id,employee_id, full_name , department FROM users ORDER BY full_name ');
    res.status(200).json(users);
  }catch(error){
    console.error('error fetching users:',error);
    res.status(500).json({message: 'Failed to fetch users', error: error.message});
  }
  }
)
// Create KEBD record
app.post('/api/kebd', async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const currentYearShort=year.toString().slice(-2);
    const nextyearshort=(year+1).toString().slice(-2);
    const yearPrefix=`${currentYearShort}${nextyearshort}`;
    const [maxIdResult]=await pool.query('SELECT MAX(CAST(SUBSTRING(error_id, 5) AS UNSIGNED)) as maxIdNum FROM knowledge_errors WHERE error_id LIKE ?',
      [`${yearPrefix}%`]
    );

  let nextIdNum=1;
  if (maxIdResult[0].maxIdNum) {
    nextIdNum = maxIdResult[0].maxIdNum + 1;
  }
  const paddedNum=nextIdNum.toString().padStart(4, '0');
  const generateErrorId=`${yearPrefix}${paddedNum}`;
    const {
    //  errorId, // ID
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
      generateErrorId,
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
app.get('/api/kebd/archived', async (req, res) => {
  console.log('Fetching archived records');
  try {
    console.log('Fetching archived records');
    // Query database for records with status 'Archived'
    const [rows] = await pool.query(
      'SELECT * FROM knowledge_errors ORDER BY last_updated DESC'
    );
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching archived records:', error);
    res.status(500).json({ message: 'Internal server error' });
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

// API endpoint to upload files for a record
app.post('/api/kebd/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Get current record
    const [records] = await pool.query('SELECT * FROM knowledge_errors WHERE id = ?', [id]);
    
    if (records.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    
    // File metadata
    const fileMetadata = {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    };
    
    // Insert file into attachments table
    const [result] = await pool.execute(
      'INSERT INTO attachments (record_id, file_name, file_type, file_size, file_data) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        fileMetadata.originalName,
        fileMetadata.mimetype,
        fileMetadata.size,
        req.file.buffer // Store the actual file data as BLOB
      ]
    );
    
    // Return success with file metadata
    res.status(201).json({
      message: 'File uploaded successfully',
      attachmentId: result.insertId,
      metadata: {
        ...fileMetadata,
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
});

// API endpoint to get all attachments for a record
app.get('/api/kebd/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get attachments metadata (without the actual blob data)
    const [attachments] = await pool.query(
      'SELECT id, record_id, file_name, file_type, file_size, created_at FROM attachments WHERE record_id = ?',
      [id]
    );
    
    res.status(200).json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ message: 'Failed to fetch attachments', error: error.message });
  }
});

// API endpoint to get a specific attachment (including blob data)
app.get('/api/attachments/:attachmentId', async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    // Get attachment with blob data
    const [attachments] = await pool.query(
      'SELECT * FROM attachments WHERE id = ?',
      [attachmentId]
    );
    
    if (attachments.length === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    const attachment = attachments[0];
    
    // Set appropriate content type header
    res.setHeader('Content-Type', attachment.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
    
    // Send the file data
    res.send(attachment.file_data);
  } catch (error) {
    console.error('Error fetching attachment:', error);
    res.status(500).json({ message: 'Failed to fetch attachment', error: error.message });
  }
});

// API endpoint to delete an attachment
app.delete('/api/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    // Delete the attachment
    const [result] = await pool.execute(
      'DELETE FROM attachments WHERE id = ?',
      [attachmentId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    res.status(200).json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ message: 'Failed to delete attachment', error: error.message });
  }
});

// Add these API endpoints

// Get archived records


// Update record status
app.patch('/api/kebd/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    // Update record status and last_updated timestamp
    await pool.query(
      'UPDATE knowledge_errors SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
    
    res.status(200).json({ message: 'Record status updated successfully' });
  } catch (error) {
    console.error('Error updating record status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update record owner
app.patch('/api/kebd/:id/owner', async (req, res) => {
  try {
    const { id } = req.params;
    const { owner } = req.body;
    
    if (!owner) {
      return res.status(400).json({ message: 'Owner is required' });
    }
    
    // Update record owner and last_updated timestamp
    await pool.query(
      'UPDATE knowledge_errors SET owner = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
      [owner, id]
    );
    
    res.status(200).json({ message: 'Record owner updated successfully' });
  } catch (error) {
    console.error('Error updating record owner:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});