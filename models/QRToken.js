const mongoose = require('mongoose');
const qrTokenSchema = new mongoose.Schema({
  token: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
});
module.exports = mongoose.model('QRToken', qrTokenSchema);
