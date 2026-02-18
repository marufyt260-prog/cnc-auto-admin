const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'flutter-ai-playground-e054b'
});

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Key validation
const API_KEY = 'cnc_auto_design_2025_online';

function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// Admin authentication
async function authenticateAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No admin token provided' });
    }

    const decoded = admin.auth().verifyIdToken(token);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid admin token' });
  }
}

// Routes

// Admin login
app.post('/api/admin/login', validateApiKey, async (req, res) => {
  try {
    const { email } = req.body;
    const ADMIN_EMAILS = ['mdmarufcon84@gmail.com', 'your-admin@gmail.com'];
    
    if (!ADMIN_EMAILS.includes(email)) {
      return res.json({ success: false });
    }

    // Create custom token for admin
    const token = await admin.auth().createCustomToken(email);
    
    res.json({
      success: true,
      token: token,
      email: email
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get pending requests
app.get('/api/admin/pending-requests', validateApiKey, async (req, res) => {
  try {
    const snapshot = await db.collection('requests')
      .where('status', '==', 'pending')
      .orderBy('created', 'desc')
      .get();
    
    const requests = snapshot.docs.map(doc => ({
      request_id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get active users
app.get('/api/admin/active-users', validateApiKey, async (req, res) => {
  try {
    const snapshot = await db.collection('active_users')
      .orderBy('created', 'desc')
      .get();
    
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        email: data.email,
        name: data.name,
        plan: data.plan,
        expiry_timestamp: data.expiry,
        days_remaining: calculateDaysRemaining(data.expiry),
        created: data.created,
        phone: data.phone
      };
    });
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Approve request
app.post('/api/admin/approve', validateApiKey, async (req, res) => {
  try {
    const { request_id, plan, days_valid } = req.body;
    
    // Get the request
    const requestDoc = await db.collection('requests').doc(request_id).get();
    if (!requestDoc.exists) {
      return res.json({ success: false, error: 'Request not found' });
    }
    
    const requestData = requestDoc.data();
    
    // Calculate expiry date
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days_valid);
    
    // Add to active users
    await db.collection('active_users').doc(requestData.email).set({
      email: requestData.email,
      name: requestData.name,
      phone: requestData.phone || '',
      plan: plan,
      created: requestData.created,
      expiry: expiryDate.toISOString().split('T')[0],
      approved_at: new Date().toISOString(),
      status: 'active'
    });
    
    // Update request status
    await db.collection('requests').doc(request_id).update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      plan: plan,
      days_valid: days_valid
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// Reject request
app.post('/api/admin/reject', validateApiKey, async (req, res) => {
  try {
    const { request_id, reason } = req.body;
    
    await db.collection('requests').doc(request_id).update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      reason: reason
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Extend license
app.post('/api/admin/extend', validateApiKey, async (req, res) => {
  try {
    const { email, days, reason } = req.body;
    
    const userDoc = await db.collection('active_users').doc(email).get();
    if (!userDoc.exists) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const currentExpiry = new Date(userData.expiry);
    currentExpiry.setDate(currentExpiry.getDate() + days);
    
    await db.collection('active_users').doc(email).update({
      expiry: currentExpiry.toISOString().split('T')[0],
      extended_at: new Date().toISOString(),
      extension_reason: reason
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error extending license:', error);
    res.status(500).json({ error: 'Failed to extend license' });
  }
});

// Revoke license
app.post('/api/admin/revoke', validateApiKey, async (req, res) => {
  try {
    const { email, reason } = req.body;
    
    await db.collection('active_users').doc(email).update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revocation_reason: reason
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking license:', error);
    res.status(500).json({ error: 'Failed to revoke license' });
  }
});

// Get system stats
app.get('/api/admin/stats', validateApiKey, async (req, res) => {
  try {
    const requestsSnapshot = await db.collection('requests').get();
    const usersSnapshot = await db.collection('active_users').get();
    
    const stats = {
      total_requests: requestsSnapshot.size,
      pending_requests: requestsSnapshot.docs.filter(doc => doc.data().status === 'pending').length,
      approved_requests: requestsSnapshot.docs.filter(doc => doc.data().status === 'approved').length,
      active_users: usersSnapshot.docs.filter(doc => doc.data().status === 'active').length,
      expired_users: usersSnapshot.docs.filter(doc => {
        const expiry = new Date(doc.data().expiry);
        return expiry < new Date();
      }).length
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// User submit request (from login.html)
app.post('/api/user/request', async (req, res) => {
  try {
    const { name, email, phone, plan, method, trx, device_info } = req.body;
    
    const requestData = {
      name,
      email,
      phone: phone || '',
      plan,
      method,
      trx: trx || '',
      device_info: device_info || {},
      status: 'pending',
      created: new Date().toISOString()
    };
    
    await db.collection('requests').add(requestData);
    
    res.json({ success: true, message: 'Request submitted successfully' });
  } catch (error) {
    console.error('Error submitting request:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// User login verification
app.post('/api/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const userDoc = await db.collection('active_users').doc(email).get();
    if (!userDoc.exists) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    // Check if account is active and not expired
    if (userData.status !== 'active') {
      return res.json({ success: false, error: 'Account not active' });
    }
    
    const expiryDate = new Date(userData.expiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    
    if (expiryDate < today) {
      return res.json({ success: false, error: 'Account expired' });
    }
    
    res.json({
      success: true,
      user: {
        email: userData.email,
        name: userData.name,
        plan: userData.plan,
        expiry: userData.expiry
      }
    });
  } catch (error) {
    console.error('Error verifying login:', error);
    res.status(500).json({ error: 'Login verification failed' });
  }
});

// Helper function
function calculateDaysRemaining(expiry) {
  if (!expiry) return 0;
  
  const expiryDate = new Date(expiry);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Serve static files (optional)
app.use(express.static(path.join(__dirname, 'web')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 CNC Admin Server running on port ${PORT}`);
  console.log(`📊 Admin Panel: http://localhost:${PORT}/login/admin.html`);
});
