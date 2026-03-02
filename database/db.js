const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  profileViews: { type: Number, default: 0 },
  savedItems: [{ type: String }]
});

// Message Schema
const messageSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: 'unread' },
  createdAt: { type: Date, default: Date.now },
  replied: { type: Boolean, default: false },
  repliedAt: { type: Date },
  repliedBy: { type: String }
});

// View Stats Schema
const viewStatsSchema = new mongoose.Schema({
  page: { type: String, required: true },
  visitorId: { type: String },
  timestamp: { type: Date, default: Date.now },
  referrer: { type: String },
  userAgent: { type: String },
  country: { type: String },
  device: { type: String }
});

// Newsletter Subscription Schema
const subscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  subscribedAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  unsubscribeToken: { type: String }
});

// Portfolio Data Schema
const portfolioSchema = new mongoose.Schema({
  type: { type: String, required: true }, // 'experience', 'skill', 'achievement'
  title: { type: String, required: true },
  description: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const ViewStats = mongoose.model('ViewStats', viewStatsSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

module.exports = {
  connectDB,
  User,
  Message,
  ViewStats,
  Subscription,
  Portfolio
};
