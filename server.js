const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const { connectDB, User, Message, ViewStats, Subscription, Portfolio } = require('./database/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Admin check middleware
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Admin access required' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ============= AUTH ROUTES =============
app.post('/api/auth/register', [
  body('name').trim().isLength({ min: 2 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ============= MESSAGE ROUTES =============
app.post('/api/messages', [
  body('firstName').trim().isLength({ min: 2 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('subject').trim().isLength({ min: 3 }).escape(),
  body('message').trim().isLength({ min: 10 }).escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const message = new Message(req.body);
    await message.save();

    // Optional: Send email notification
    // await sendEmailNotification(message);

    res.status(201).json({ 
      message: 'Message sent successfully',
      id: message._id 
    });
  } catch (error) {
    console.error('Message save error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/api/messages', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Message.countDocuments(query);
    
    res.json({
      messages,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ============= VIEW STATS ROUTES =============
app.post('/api/stats/pageview', async (req, res) => {
  try {
    const { page, visitorId, referrer, userAgent, country, device } = req.body;
    
    const viewStat = new ViewStats({
      page,
      visitorId,
      referrer,
      userAgent,
      country,
      device,
      timestamp: new Date()
    });
    
    await viewStat.save();
    
    // Update user profile views if it's a user
    if (visitorId) {
      await User.findOneAndUpdate(
        { _id: visitorId },
        { $inc: { profileViews: 1 } }
      );
    }
    
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Stats save error:', error);
    res.status(500).json({ error: 'Failed to save stats' });
  }
});

app.get('/api/stats/analytics', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const totalViews = await ViewStats.countDocuments(query);
    const uniqueVisitors = await ViewStats.distinct('visitorId', query);
    const pageViews = await ViewStats.aggregate([
      { $match: query },
      { $group: { _id: '$page', count: { $sum: 1 } } }
    ]);
    
    res.json({
      totalViews,
      uniqueVisitors: uniqueVisitors.length,
      pageViews
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============= NEWSLETTER ROUTES =============
app.post('/api/newsletter/subscribe', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    
    // Check if already subscribed
    const existing = await Subscription.findOne({ email });
    if (existing) {
      return res.status(400).json({ 
        error: 'Email already subscribed',
        subscribedAt: existing.subscribedAt
      });
    }
    
    // Generate unsubscribe token
    const unsubscribeToken = jwt.sign(
      { email },
      process.env.JWT_SECRET,
      { expiresIn: '1y' }
    );
    
    const subscription = new Subscription({
      email,
      unsubscribeToken
    });
    
    await subscription.save();
    
    // Send verification email (implement as needed)
    // await sendVerificationEmail(email, unsubscribeToken);
    
    res.status(201).json({ 
      message: 'Successfully subscribed to newsletter',
      email
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

app.post('/api/newsletter/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Remove subscription
    await Subscription.findOneAndDelete({ email: decoded.email });
    
    res.json({ message: 'Successfully unsubscribed' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(400).json({ error: 'Invalid or expired unsubscribe link' });
  }
});

// ============= PORTFOLIO DATA ROUTES =============
app.get('/api/portfolio/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const data = await Portfolio.find({ 
      type, 
      active: true 
    }).sort({ order: 1 });
    
    res.json(data);
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

app.post('/api/portfolio', authenticateToken, isAdmin, [
  body('type').isIn(['experience', 'skill', 'achievement']),
  body('title').trim().isLength({ min: 2 }).escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const portfolioItem = new Portfolio(req.body);
    await portfolioItem.save();
    
    res.status(201).json(portfolioItem);
  } catch (error) {
    console.error('Portfolio save error:', error);
    res.status(500).json({ error: 'Failed to save portfolio item' });
  }
});

// ============= USER PROFILE ROUTES =============
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/user/profile', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2 }).escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = req.body;
    delete updates.password; // Don't allow password update here
    delete updates.email; // Don't allow email update here
    delete updates.role; // Don't allow role update here
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============= HEALTH CHECK =============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
