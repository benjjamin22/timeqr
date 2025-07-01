const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
//const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const { customAlphabet } = require('nanoid');
const path = require('path');

const User = require('./models/user');
const Attendance = require('./models/Attendance');
const QRToken = require('./models/QRToken');

const app = express();
//mongoose.connect('mongodb://localhost:27017/qr_attendance', { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.set('strictQuery', false);
const connectDB = async() => {
    try {
        const conn = await mongoose.connect('mongodb+srv://Mydatabase:prototype22@database.tswsylv.mongodb.net/database?retryWrites=true&w=majority');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'secretKey', resave: false, saveUninitialized: false }));

const nanoid = customAlphabet('1234567890abcdef', 10);

// Middleware
function auth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
function adminAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

//Routes

// Signup
app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    await User.create({ username, password });
    res.redirect('/login');
  } catch {
    res.send('Username already exists');
  }
});

// Login
app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user ) {
    return res.send('Invalid credentials');
  }
  req.session.userId = user._id;
  res.redirect('/dashboard');
});

// Dashboard - generate user-bound QR
app.get('/dashboard', auth, async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findById(userId);

  // Clean expired tokens for this user
  await QRToken.deleteMany({ user: userId, expiresAt: { $lt: new Date() } });

  // Generate new token valid 60s
  const token = nanoid();
  const expiresAt = new Date(Date.now() + 60 * 1000);
  await QRToken.create({ token, user: userId, expiresAt });

  const qrUrl = `https://timeqr.onrender.com/scan/${token}`;
  const qrImage = await QRCode.toDataURL(qrUrl);

  res.render('dashboard', { qrImage, username: user.username,usernamet:qrUrl });
});

// Scan & mark attendance
app.get('/scan/:token', auth, async (req, res) => {
  const { token } = req.params;
  const userId = req.session.userId;

  const qr = await QRToken.findOne({ token });
  //if (!qr) return res.send('Invalid or expired QR code');
  if (qr.used) return res.send('QR code already used');
  if (qr.expiresAt < new Date()) return res.send('QR code expired');
  if (qr.user.toString() !== userId.toString()) return res.send('This QR code is not for you');

  // Check if attendance exists today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await Attendance.findOne({ user: userId, date: today });
  if (existing) return res.send('Attendance already marked for today');

  await Attendance.create({ user: userId, date: today, timeIn: new Date() });

  qr.used = true;
  await qr.save();

  res.send('Attendance marked successfully!');
});

// Logout
app.get('/logout', auth, (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ----- Admin -----

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

app.get('/admin/login', (req, res) => res.render('admin_login'));
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.send('Invalid admin credentials');
  }
});

app.get('/admin', adminAuth, async (req, res) => {
  const logs = await Attendance.find().populate('user').sort({ date: -1 });
  res.render('admin_dashboard', { logs });
});

app.get('/admin/export', adminAuth, async (req, res) => {
  const logs = await Attendance.find().populate('user');

  let csv = 'Username,Date,TimeIn\n';
  logs.forEach(log => {
    const username = log.user?.username || 'Unknown';
    const date = new Date(log.date).toLocaleDateString();
    const timeIn = log.timeIn ? new Date(log.timeIn).toLocaleTimeString() : '';
    csv += `"${username}","${date}","${timeIn}"\n`;
  });

  res.header('Content-Type', 'text/csv');
  res.attachment('attendance.csv');
  res.send(csv);
});

app.get('/admin/logout', adminAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Start server
//app.listen(3000, () => console.log('Server running on http://localhost:3000'));
const PORT = process.env.PORT || 8000
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log('Server running on http://localhost:3000');
    })
});
