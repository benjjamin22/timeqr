const mongoose = require('mongoose');
const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) },
  timeIn: { type: Date },
});
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('Attendance', attendanceSchema);
