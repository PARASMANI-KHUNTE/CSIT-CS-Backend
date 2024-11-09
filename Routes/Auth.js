const express = require('express');
const argon2 = require('argon2'); // Import argon2 for password hashing
const router = express.Router();
const User = require('../Models/User.js');
const features = require('../Controllers/Features.js');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const otpStore = {}; // Temporary in-memory store for OTPs (development only)
const JWT_SECRET = process.env.JWT_SECRET;
// Signup Route: Generates OTP
router.post('/signup', async (req, res) => {
    const { Fname, Lname, Email, Phone, Department, School, GGVID, Type } = req.body;

    try {
        const existingUser = await features.checkExistingUser(Email, Phone, GGVID);
        if (existingUser.exists) {
            return res.status(400).json({ message: `${existingUser.fields} already exists` });
        } else {
            const GenOTP = await features.sendOTP(Email, Phone);
            if (GenOTP) {
                otpStore[Email] = { otp: GenOTP, data: { Fname, Lname, Email, Phone, Department, School, GGVID, Type }, expiresAt: Date.now() + 300000 };
                res.json({ message: "OTP sent successfully", redirectUrl: "/verifyOtp" });
            } else {
                res.status(500).json({ message: "Error sending OTP" });
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
// Login Route
router.post('/login', async (req, res) => {
    const { Email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ Email });
        
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Verify password
        const isPasswordValid = await argon2.verify(user.password, password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid password" });
        }

        // Generate JWT token with user's ID
        const token = jwt.sign(
            { userId: user._id, Email: user.Email },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expiry (1 hour in this example)
        );

        // Send the token as a response
        res.json({ message: "Login successful", token });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
// OTP Verification Route
router.post('/verifyOtp', async (req, res) => {
    const { otp, Email } = req.body;

    try {
        const storedOtpData = otpStore[Email];

        if (storedOtpData && storedOtpData.otp === otp && storedOtpData.expiresAt > Date.now()) {
            // If OTP is valid, prompt the user to create a password
            res.json({ message: "OTP verified. Please create a password.", redirectUrl: "/createPassword" });
        } else {
            res.status(400).json({ message: "Invalid or expired OTP" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// Create Password Route
router.post('/createPassword', async (req, res) => {
    const { Email, password } = req.body;

    try {
        const storedOtpData = otpStore[Email];
        if (storedOtpData) {
            // Hash the password before saving with argon2
            const hashedPassword = await argon2.hash(password);

            // Merge password into user data and save to the database
            const userData = { ...storedOtpData.data, password: hashedPassword };
            const newUser = new User(userData);
            await newUser.save();

            // Clear temporary OTP data
            delete otpStore[Email];

            res.json({ message: "User registered successfully" });
        } else {
            res.status(400).json({ message: "No verified user data found. Please restart the signup process." });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
