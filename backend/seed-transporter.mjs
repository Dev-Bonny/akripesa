import mongoose from 'mongoose';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const MONGODB_URI = 'mongodb+srv://akripesa:akripesa2026@cluster0.8xhxvg7.mongodb.net/?appName=Cluster0';'' // adjust if different

await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB.');

const UserSchema = new mongoose.Schema({
  fullName:     String,
  phoneNumber:  String,
  passwordHash: String,
  role:         String,
  kycStatus:    String,
  isActive:     Boolean,
  mpesaWallet:  Object,
  transporterProfile: Object,
  refreshTokenHash: String,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Use the exact phone number you tested with
const phoneNumber = '254792531105';

const existing = await User.findOne({ phoneNumber });
if (existing) {
  console.log('User already exists. Updating role to TRANSPORTER...');
  await User.findByIdAndUpdate(existing._id, {
    role: 'TRANSPORTER',
    isActive: true,
  });
  console.log('Updated.');
} else {
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('Transporter123', salt);

  await User.create({
    fullName:     'Test Driver',
    phoneNumber,
    passwordHash,
    role:         'TRANSPORTER',
    kycStatus:    'VERIFIED',
    isActive:     true,
    mpesaWallet: {
      phoneNumber,
      totalDeposited: 0,
      totalWithdrawn: 0,
      currentBalance: 0,
    },
    transporterProfile: {
      vehicleClass:        'PICKUP',
      vehicleRegistration: 'KCA 001A',
      isAvailable:         true,
      totalDeliveries:     0,
      rating:              5.0,
    },
  });
  console.log('TRANSPORTER user created:', phoneNumber);
}

await mongoose.disconnect();
console.log('Done.');
