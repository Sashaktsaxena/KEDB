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
const nodemailer = require('nodemailer');
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
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-based (0 = January, 3 = April)
    const currentYear = currentDate.getFullYear();
    
    // Determine fiscal year - if we're in April or later, use current year and next year
    // Otherwise use previous year and current year
    let startYear, endYear;
    
    if (currentMonth >= 3) { // April (month 3) or later
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    
    // Convert to last two digits format
    const startYearShort = startYear.toString().slice(-2);
    const endYearShort = endYear.toString().slice(-2);
    
    // Create the year prefix (e.g., "2324" for Apr 2023-Mar 2024)
    const yearPrefix = `${startYearShort}${endYearShort}`;
    
    // Get the highest ID number for this fiscal year pattern
    const [maxIdResult] = await pool.query(
      'SELECT MAX(CAST(SUBSTRING(error_id, 5) AS UNSIGNED)) as maxIdNum FROM knowledge_errors WHERE error_id LIKE ?',
      [`${yearPrefix}%`]
    );

    let nextIdNum = 1;
    if (maxIdResult[0].maxIdNum) {
      nextIdNum = maxIdResult[0].maxIdNum + 1;
    }
    
    const paddedNum = nextIdNum.toString().padStart(4, '0');
    const generateErrorId = `${yearPrefix}${paddedNum}`;
    
    const {
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

    // Get owner_id from users table based on the owner name
    let ownerId = null;
    if (owner) {
      const [ownerResult] = await pool.query(
        'SELECT id FROM users WHERE full_name = ?',
        [owner]
      );
      
      if (ownerResult.length > 0) {
        ownerId = ownerResult[0].id;
      }
    }

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
        owner_id,
        priority,
        environment,
        attachments,
        last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
      ownerId,
      priority,
      environment,
      attachments || null
    ]);

    // If this is the first assignment, also add it to record_assignments table
    if (ownerId) {
      try {
        await pool.query(
          'INSERT INTO record_assignments (record_id, assigned_to_user_id, assigned_by_user_id, status) VALUES (?, ?, ?, "active")',
          [result.insertId, ownerId, ownerId] // Assuming self-assignment for creation
        );
        
        // Also add to assignment_history
        await pool.query(
          'INSERT INTO assignment_history (record_id, previous_owner_id, new_owner_id, changed_by_user_id) VALUES (?, NULL, ?, ?)',
          [result.insertId, ownerId, ownerId]
        );
      } catch (assignError) {
        console.error('Error adding initial assignment:', assignError);
        // Continue anyway since the record was created successfully
      }
    }

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
app.post('/api/drafts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const formData = req.body;
    
    // Generate a draft error ID for display purposes
    const year = new Date().getFullYear();
    const currentYearShort = year.toString().slice(-2);
    const nextyearshort = (year+1).toString().slice(-2);
    const yearPrefix = `DRAFT-${currentYearShort}${nextyearshort}`;
    
    const [lastDraftId] = await pool.query(
      'SELECT MAX(CAST(SUBSTRING_INDEX(error_id, "-", -1) AS UNSIGNED)) as maxIdNum FROM draft_records WHERE error_id LIKE ?',
      [`DRAFT-%`]
    );
    
    let nextIdNum = 1;
    if (lastDraftId[0].maxIdNum) {
      nextIdNum = lastDraftId[0].maxIdNum + 1;
    }
    
    const paddedNum = nextIdNum.toString().padStart(4, '0');
    const draftErrorId = `${yearPrefix}-${paddedNum}`;
    
    // Check if this is updating an existing draft
    if (formData.draftId) {
      await pool.query(
        'UPDATE draft_records SET form_data = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [JSON.stringify(formData), formData.draftId, userId]
      );
      
      res.status(200).json({
        message: 'Draft updated successfully',
        draftId: formData.draftId,
        errorId: formData.draftErrorId || draftErrorId
      });
    } else {
      // Create new draft
      const [result] = await pool.query(
        'INSERT INTO draft_records (user_id, error_id, form_data, created_at, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [userId, draftErrorId, JSON.stringify(formData)]
      );
      
      res.status(201).json({
        message: 'Draft saved successfully',
        draftId: result.insertId,
        errorId: draftErrorId
      });
    }
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ message: 'Failed to save draft', error: error.message });
  }
});

// Get all drafts for the current user
// Get all drafts for the current user
app.get('/api/drafts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [drafts] = await pool.query(
      'SELECT id, error_id, form_data, created_at, last_updated FROM draft_records WHERE user_id = ? ORDER BY last_updated DESC',
      [userId]
    );
    
    // Parse the JSON stored in form_data
    const parsedDrafts = drafts.map(draft => {
      let formData;
      
      try {
        // Check if form_data is already an object
        if (typeof draft.form_data === 'object' && draft.form_data !== null) {
          formData = draft.form_data;
        } else {
          // If it's a string, try to parse it
          formData = JSON.parse(draft.form_data);
        }
      } catch (err) {
        console.error('Error parsing form_data:', err);
        formData = {}; // Fallback to empty object if parsing fails
      }
      
      return {
        id: draft.id,
        errorId: draft.error_id,
        title: formData.title || 'Untitled Draft',
        createdAt: draft.created_at,
        lastUpdated: draft.last_updated,
        category: formData.category || 'Uncategorized',
        status: 'Draft',
        dateIdentified: formData.dateIdentified || null,
        description: formData.description || null,
        completionPercentage: calculateCompletionPercentage(formData)
      };
    });
    
    res.status(200).json(parsedDrafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ message: 'Failed to fetch drafts', error: error.message });
  }
});
// Helper function to calculate completion percentage
// Helper function to calculate completion percentage
function calculateCompletionPercentage(formData) {
  // Handle case where formData might be a string
  if (typeof formData === 'string') {
    try {
      formData = JSON.parse(formData);
    } catch (err) {
      console.error('Error parsing form_data in calculateCompletionPercentage:', err);
      return 0; // Return 0% if we can't parse the data
    }
  }
  
  // Define required fields for a complete record
  const requiredFields = [
    'title', 'description', 'rootCause', 'impact', 'category',
    'subcategory', 'workaround', 'status', 'dateIdentified',
    'owner', 'priority', 'environment'
  ];
  
  let filledCount = 0;
  for (const field of requiredFields) {
    if (formData[field] && formData[field].trim && formData[field].trim() !== '') {
      filledCount++;
    } else if (formData[field] && !formData[field].trim && formData[field] !== '') {
      filledCount++;
    }
  }
  
  return Math.round((filledCount / requiredFields.length) * 100);
}
// Get a specific draft by ID
// Get a specific draft by ID
app.get('/api/drafts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = req.params.id;
    
    const [drafts] = await pool.query(
      'SELECT id, error_id, form_data, created_at, last_updated FROM draft_records WHERE id = ? AND user_id = ?',
      [draftId, userId]
    );
    
    if (drafts.length === 0) {
      return res.status(404).json({ message: 'Draft not found' });
    }
    
    const draft = drafts[0];
    let formData;
    
    try {
      // Check if form_data is already an object
      if (typeof draft.form_data === 'object' && draft.form_data !== null) {
        formData = draft.form_data;
      } else {
        // If it's a string, try to parse it
        formData = JSON.parse(draft.form_data);
      }
    } catch (err) {
      console.error('Error parsing form_data:', err);
      formData = {}; // Fallback to empty object if parsing fails
    }
    
    res.status(200).json({
      id: draft.id,
      errorId: draft.error_id,
      formData: formData,
      createdAt: draft.created_at,
      lastUpdated: draft.last_updated
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    res.status(500).json({ message: 'Failed to fetch draft', error: error.message });
  }
});

// Delete a draft
app.delete('/api/drafts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = req.params.id;
    
    const [result] = await pool.query(
      'DELETE FROM draft_records WHERE id = ? AND user_id = ?',
      [draftId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Draft not found' });
    }
    
    res.status(200).json({ message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({ message: 'Failed to delete draft', error: error.message });
  }
});

// Submit a draft as a complete record
app.post('/api/drafts/:id/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = req.params.id;
    const formData = req.body;
    
    // Get the draft to verify ownership
    const [drafts] = await pool.query(
      'SELECT id, error_id, form_data FROM draft_records WHERE id = ? AND user_id = ?',
      [draftId, userId]
    );
    
    if (drafts.length === 0) {
      return res.status(404).json({ message: 'Draft not found' });
    }
    
    // Generate a new error ID for the actual record
    const year = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    let startYear, endYear;
    
    if (currentMonth >= 3) { // April (month 3) or later
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    
    // Convert to last two digits format
    const startYearShort = startYear.toString().slice(-2);
    const endYearShort = endYear.toString().slice(-2);
    
    // Create the year prefix (e.g., "2324" for Apr 2023-Mar 2024)
    const yearPrefix = `${startYearShort}${endYearShort}`;
    
    // Get the highest ID number for this fiscal year pattern
    const [maxIdResult] = await pool.query(
      'SELECT MAX(CAST(SUBSTRING(error_id, 5) AS UNSIGNED)) as maxIdNum FROM knowledge_errors WHERE error_id LIKE ?',
      [`${yearPrefix}%`]
    );

    let nextIdNum = 1;
    if (maxIdResult[0].maxIdNum) {
      nextIdNum = maxIdResult[0].maxIdNum + 1;
    }
    
    const paddedNum = nextIdNum.toString().padStart(4, '0');
    const generateErrorId = `${yearPrefix}${paddedNum}`;
    
    // Extract fields from form data
    const {
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
    } = formData;

    // Get owner_id from users table based on the owner name
    let ownerId = null;
    if (owner) {
      const [ownerResult] = await pool.query(
        'SELECT id FROM users WHERE full_name = ?',
        [owner]
      );
      
      if (ownerResult.length > 0) {
        ownerId = ownerResult[0].id;
      }
    }

    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Insert the new record
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
          owner_id,
          priority,
          environment,
          attachments,
          last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const [result] = await connection.execute(query, [
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
        ownerId,
        priority,
        environment,
        attachments || null
      ]);

      // If this is the first assignment, also add it to record_assignments table
      if (ownerId) {
        await connection.query(
          'INSERT INTO record_assignments (record_id, assigned_to_user_id, assigned_by_user_id, status) VALUES (?, ?, ?, "active")',
          [result.insertId, ownerId, userId]
        );
        
        // Also add to assignment_history
        await connection.query(
          'INSERT INTO assignment_history (record_id, previous_owner_id, new_owner_id, changed_by_user_id) VALUES (?, NULL, ?, ?)',
          [result.insertId, ownerId, userId]
        );
      }
      
      // Delete the draft
      await connection.query(
        'DELETE FROM draft_records WHERE id = ? AND user_id = ?',
        [draftId, userId]
      );
      
      await connection.commit();
      
      res.status(201).json({
        message: 'Draft submitted successfully as a record',
        id: result.insertId,
        errorId: generateErrorId
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Error submitting draft:', error);
    res.status(500).json({ message: 'Failed to submit draft', error: error.message });
  }
});
// Add this endpoint to index.js
app.post('/api/kebd/:id/revert', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    // Get the current record details
    const [currentRecord] = await pool.query(
      'SELECT error_id, title FROM knowledge_errors WHERE id = ?',
      [id]
    );

    if (currentRecord.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    
    const recordId = currentRecord[0].error_id;
    const recordTitle = currentRecord[0].title;
    
    // Get the current assignment
    const [currentAssignment] = await pool.query(
      'SELECT assigned_to_user_id FROM record_assignments WHERE record_id = ? AND status = "active"',
      [id]
    );
    
    if (currentAssignment.length === 0) {
      return res.status(404).json({ message: 'No active assignment found for this record' });
    }
    
    const currentAssigneeId = currentAssignment[0].assigned_to_user_id;
    
    // Get the previous assignment (most recent "reassigned" status)
    const [previousAssignment] = await pool.query(
      `SELECT ra.assigned_to_user_id, ra.due_date, u.full_name, u.email
       FROM record_assignments ra 
       JOIN users u ON ra.assigned_to_user_id = u.id
       WHERE ra.record_id = ? AND ra.status = "reassigned" AND ra.assigned_to_user_id != ?
       ORDER BY ra.assignment_date DESC LIMIT 1`,
      [id, currentAssigneeId]
    );
    
    if (previousAssignment.length === 0) {
      return res.status(404).json({ message: 'No previous assignment found for this record' });
    }
    
    const previousAssigneeId = previousAssignment[0].assigned_to_user_id;
    const previousAssigneeName = previousAssignment[0].full_name;
    const previousAssigneeEmail = previousAssignment[0].email;
    const previousDueDate = previousAssignment[0].due_date;
    
    // Get the name of the user who's reverting the assignment
    const [reverterUser] = await pool.query(
      'SELECT full_name FROM users WHERE id = ?',
      [req.user.id]
    );
    
    const reverterName = reverterUser.length > 0 ? reverterUser[0].full_name : 'System Administrator';
    
    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Mark the current assignment as reverted
      await connection.query(
        'UPDATE record_assignments SET status = "reverted" WHERE record_id = ? AND status = "active"',
        [id]
      );
      
      // Calculate duration of current assignment
      let durationDays = null;
      const [currentAssignmentDetails] = await connection.query(
        'SELECT assignment_date FROM record_assignments WHERE record_id = ? AND assigned_to_user_id = ? AND status = "reverted"',
        [id, currentAssigneeId]
      );
      
      if (currentAssignmentDetails.length > 0) {
        const prevDate = new Date(currentAssignmentDetails[0].assignment_date);
        const now = new Date();
        const diffTime = Math.abs(now - prevDate);
        durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      // Add new assignment entry for the previous assignee
      await connection.query(
        'INSERT INTO record_assignments (record_id, assigned_to_user_id, assigned_by_user_id, due_date, notes,status) VALUES (?, ?, ?, ?, ?, "active")',
        [id, previousAssigneeId, req.user.id, previousDueDate || null, notes || null]
      );
      
      // Add entry to assignment_history
      await connection.query(
        'INSERT INTO assignment_history (record_id, previous_owner_id, new_owner_id, changed_by_user_id, notes, duration_days) VALUES (?, ?, ?, ?, ?, ?)',
        [id, currentAssigneeId, previousAssigneeId, req.user.id, `Reverted assignment: ${notes || 'No reason provided'}`, durationDays]
      );
      
      // Update the last_updated timestamp of the record
      await connection.query(
        'UPDATE knowledge_errors SET last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      
      await connection.commit();
      
      // Send notification email to the previous assignee
      let emailSent = false;
      if (previousAssigneeEmail) {
        emailSent = await sendAssignmentNotification(
          recordId,
          recordTitle,
          previousAssigneeEmail,
          previousAssigneeName,
          `${reverterName} (Reversion)`,
          notes,
          previousDueDate
        );
      }
      
      res.status(200).json({ 
        message: 'Record assignment reverted successfully',
        assignedTo: previousAssigneeName,
        emailSent: emailSent
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Error reverting record assignment:', error);
    res.status(500).json({ message: 'Failed to revert record assignment', error: error.message });
  }
});
// Update the /api/kebd/archived endpoint in index.js
app.get('/api/kebd/archived', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get records that are either owned by the user or assigned to the user
    const [rows] = await pool.query(
      `SELECT ke.*, 
              ra.due_date, 
              ra.assignment_date,
              ra.id as assignment_id,
              ra.assigned_to_user_id as current_assignee_id,
              u.full_name as current_assignee_name,
              DATEDIFF(ra.due_date, CURDATE()) as days_remaining
       FROM knowledge_errors ke
       LEFT JOIN (
         SELECT * FROM record_assignments 
         WHERE status = 'active' 
       ) ra ON ke.id = ra.record_id
       LEFT JOIN users u ON ra.assigned_to_user_id = u.id
       WHERE ke.owner_id = ? OR ra.assigned_to_user_id = ?
       ORDER BY ke.last_updated DESC`,
      [userId, userId]
    );
    
    // Convert the data for the frontend
    const records = rows.map(row => ({
      id: row.id,
      error_id: row.error_id,
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
      ownerId: row.owner_id,
      // Add these fields to distinguish between owner and current assignee
      isOwner: row.owner_id === userId,
      isAssignee: row.current_assignee_id === userId,
      currentAssignee: row.current_assignee_name,
      currentAssigneeId: row.current_assignee_id,
      priority: row.priority,
      environment: row.environment,
      dueDate: row.due_date,
      assignmentDate: row.assignment_date,
      assignmentId: row.assignment_id,
      daysRemaining: row.days_remaining
    }));
    console.log(records)
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching archived records:', error);
    res.status(500).json({ message: 'Failed to fetch archived records', error: error.message });
  }
});

// Update the /api/kebd/:id/assign endpoint in index.js
app.post('/api/kebd/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, dueDate, notes } = req.body;
    
    if (!assignedTo) {
      return res.status(400).json({ message: 'Assigned user is required' });
    }

    // Get the current record details
    const [currentRecord] = await pool.query(
      'SELECT owner, owner_id,error_id , title FROM knowledge_errors WHERE id = ?',
      [id]
    );

    if (currentRecord.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    const recordId=currentRecord[0].error_id;
    const recordTitle=currentRecord[0].title;
    console.log ("here -----> ",recordId,recordTitle)
    // Get user ID from the username
    const [assignedToUser] = await pool.query(
      'SELECT id, full_name,email FROM users WHERE full_name = ?',
      [assignedTo]
    );

    if (assignedToUser.length === 0) {
      return res.status(404).json({ message: 'Assigned user not found' });
    }
    
    const assignedToUserId = assignedToUser[0].id;
    const assigneeEmail= assignedToUser[0].email;
    console.log (assigneeEmail)
    const assigneeName = assignedToUser[0].full_name;
    const [assignerUser] = await pool.query(
      'SELECT full_name FROM users WHERE id = ?',
      [req.user.id]
    );
    
    const assignerName = assignerUser.length > 0 ? assignerUser[0].full_name : 'System Administrator';
    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Important change: Don't update the owner
      // Just use record_assignments to track who it's currently assigned to
      
      // Find the currently assigned user, if any
      const [currentAssignment] = await connection.query(
        'SELECT assigned_to_user_id FROM record_assignments WHERE record_id = ? AND status = "active"',
        [id]
      );
      
      const previousAssigneeId = currentAssignment.length > 0 ? currentAssignment[0].assigned_to_user_id : null;
      
      // Calculate duration if there was a previous assignee
      let durationDays = null;
      if (previousAssigneeId) {
        const [prevAssignment] = await connection.query(
          'SELECT assignment_date FROM record_assignments WHERE record_id = ? AND assigned_to_user_id = ? AND status = "active"',
          [id, previousAssigneeId]
        );
        
        if (prevAssignment.length > 0) {
          const prevDate = new Date(prevAssignment[0].assignment_date);
          const now = new Date();
          const diffTime = Math.abs(now - prevDate);
          durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }
      
      // Mark all previous assignments as reassigned
      await connection.query(
        'UPDATE record_assignments SET status = "reassigned" WHERE record_id = ? AND status = "active"',
        [id]
      );
      
      // Add new assignment entry
      await connection.query(
        'INSERT INTO record_assignments (record_id, assigned_to_user_id, assigned_by_user_id, due_date, notes,status) VALUES (?, ?, ?, ?, ?,"active")',
        [id, assignedToUserId, req.user.id, dueDate || null, notes || null]
      );
      
      // Add entry to assignment_history
      await connection.query(
        'INSERT INTO assignment_history (record_id, previous_owner_id, new_owner_id, changed_by_user_id, notes, duration_days) VALUES (?, ?, ?, ?, ?, ?)',
        [id, previousAssigneeId, assignedToUserId, req.user.id, notes || null, durationDays]
      );
      
      // Update the last_updated timestamp of the record
      await connection.query(
        'UPDATE knowledge_errors SET last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      
      await connection.commit();
      letemailSent =false;
      if (assigneeEmail) {
        emailSent = await sendAssignmentNotification(
          recordId,
          recordTitle,
          assigneeEmail,
          assigneeName,
          assignerName,
          notes,
          dueDate
        );
      }
      res.status(200).json({ 
        message: 'Record assigned successfully',
        assignedTo: assignedTo,
        emailSent :emailSent
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Error assigning record:', error);
    res.status(500).json({ message: 'Failed to assign record', error: error.message });
  }
});

// Get assignment history for a record
// Update the /api/kebd/:id/history endpoint in index.js
app.get('/api/kebd/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the original owner
    const [owner] = await pool.query(
      `SELECT owner, owner_id, full_name as owner_name
       FROM knowledge_errors ke
       JOIN users u ON ke.owner_id = u.id
       WHERE ke.id = ?`,
      [id]
    );
    
    // Then get the assignment history
    const [rows] = await pool.query(
      `SELECT ah.*, 
              pu.full_name as previous_assignee, 
              nu.full_name as new_assignee, 
              cu.full_name as changed_by
       FROM assignment_history ah
       LEFT JOIN users pu ON ah.previous_owner_id = pu.id
       JOIN users nu ON ah.new_owner_id = nu.id
       JOIN users cu ON ah.changed_by_user_id = cu.id
       WHERE ah.record_id = ?
       ORDER BY ah.change_date DESC`,
      [id]
    );
    
    const history = rows.map(row => ({
      id: row.id,
      recordId: row.record_id,
      previousAssignee: row.previous_assignee,
      newAssignee: row.new_assignee,
      changedBy: row.changed_by,
      changeDate: row.change_date,
      notes: row.notes,
      durationDays: row.duration_days
    }));
    
    // Get the current assignee
    const [currentAssignment] = await pool.query(
      `SELECT ra.*, u.full_name as assignee_name
       FROM record_assignments ra
       JOIN users u ON ra.assigned_to_user_id = u.id
       WHERE ra.record_id = ? AND ra.status = 'active'
       ORDER BY ra.assignment_date DESC LIMIT 1`,
      [id]
    );
    
    const currentAssignee = currentAssignment.length > 0 ? {
      id: currentAssignment[0].assigned_to_user_id,
      name: currentAssignment[0].assignee_name,
      assignmentDate: currentAssignment[0].assignment_date,
      dueDate: currentAssignment[0].due_date
    } : null;
    
    res.status(200).json({
      owner: owner.length > 0 ? {
        id: owner[0].owner_id,
        name: owner[0].owner_name
      } : null,
      currentAssignee,
      history
    });
  } catch (error) {
    console.error('Error fetching assignment history:', error);
    res.status(500).json({ message: 'Failed to fetch assignment history', error: error.message });
  }
});
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

    // Get owner_id from users table based on the owner name
    let ownerId = null;
    if (owner) {
      const [ownerResult] = await pool.query(
        'SELECT id FROM users WHERE full_name = ?',
        [owner]
      );
      
      if (ownerResult.length > 0) {
        ownerId = ownerResult[0].id;
      }
    }

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
        owner_id = ?,
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
      ownerId,
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
// API endpoint to upload files for a record
app.post('/api/kebd/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body; // Get the comment from request body
    console.log('Received file upload request:');
    console.log('- Record ID:', id);
    console.log('- File name:', req.file?.originalname);
    console.log('- Comment:', comment);
    
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
    
    // Insert file into attachments table - now including comment
    const [result] = await pool.execute(
      'INSERT INTO attachments (record_id, file_name, file_type, file_size, comment, file_data) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        fileMetadata.originalName,
        fileMetadata.mimetype,
        fileMetadata.size,
        comment || null, // Store comment, or null if not provided
        req.file.buffer // Store the actual file data as BLOB
      ]
    );
    
    // Return success with file metadata
    res.status(201).json({
      message: 'File uploaded successfully',
      attachmentId: result.insertId,
      metadata: {
        ...fileMetadata,
        id: result.insertId,
        comment: comment || null
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
});
// API endpoint to get all attachments for a record
// API endpoint to get all attachments for a record
app.get('/api/kebd/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get attachments metadata (without the actual blob data) - now including comment
    const [attachments] = await pool.query(
      'SELECT id, record_id, file_name, file_type, file_size, comment, created_at FROM attachments WHERE record_id = ?',
      [id]
    );
    console.log(attachments)
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
    const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    }
    });

    async function sendAssignmentNotification(recordId,recordTitle, assigneeEmail ,assigneeName, assignerName,assignerName,notes , dueDate) {
    try {
    // Format the due date for display if it exists
    const formattedDueDate = dueDate 
      ? new Date(dueDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'No due date specified';
    
    // Create the email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://www.tatapower.com/images/logo.png" alt="Tata Power Logo" style="max-height: 60px;">
        </div>
        
        <div style="background-color: #5fa0dB; color: white; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px;">KEDB Record Assignment Notification</h2>
        </div>
        
        <p>Hello ${assigneeName},</p>
        
        <p>A Knowledge Error Database record has been assigned to you.</p>
        
        <div style="background-color: #f5f5f5; border-left: 4px solid #5fa0dB; padding: 15px; margin: 20px 0;">
          <p style="margin-top: 0;"><strong>Record ID:</strong> ${recordId}</p>
          <p><strong>Title:</strong> ${recordTitle}</p>
          <p><strong>Assigned by:</strong> ${assignerName}</p>
          <p><strong>Due Date:</strong> ${formattedDueDate}</p>
          
          ${notes ? `
          <div style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px;">
            <p style="margin-top: 0;"><strong>Assignment Notes:</strong></p>
            <p style="margin-bottom: 0;">${notes}</p>
          </div>
          ` : ''}
        </div>
        
        <p>Please log in to the KEDB system to view and manage this record.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/records/${recordId}" 
             style="background-color: #5fa0dB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Record
          </a>
        </div>
        
        <p style="color: #777; font-size: 12px; margin-top: 30px; text-align: center;">
          This is an automated message from the Tata Power KEDB System. Please do not reply to this email.
        </p>
        
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px;">
          © ${new Date().getFullYear()} Tata Power Ltd. All rights reserved.
        </div>
      </div>
    `;
    
    // Send the email
    const info = await transporter.sendMail({
      from: `"KEDB System" <${process.env.EMAIL_USER || 'kedb@tatapower.com'}>`,
      to: assigneeEmail,
      subject: `KEDB Record Assignment: ${recordTitle}`,
      html: emailHtml
    });
    
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
    }
 

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});