const express = require('express');
const argon2 = require('argon2'); // Import argon2 for password hashing
const router = express.Router();
const User = require('../Models/User.js');
const features = require('../Controllers/Features.js');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const otpStore = {}; // Temporary in-memory store for OTPs (development only)
const JWT_SECRET = process.env.JWT_SECRET;
const authenticateToken = require('../Controllers/authMiddleware.js'); 



// Signup Route: Generates OTP
router.post('/signup', async (req, res) => {
    const { Fname, Lname, Email, Phone, Department, School, GGVID, Type } = req.body;

    try {
        const existingUser = await features.checkExistingUser(Email, Phone, GGVID);
        if (existingUser.exists) {
            return res.status(400).json({ message: `${existingUser.fields} already exists` });
        } else {
            const GenOTP = await features.sendOTP(Email);
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

        // Set JWT token in a secure HttpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,  // Prevent client-side access to the cookie
            secure: process.env.NODE_ENV === 'production',  // Only set cookies over HTTPS in production
            maxAge: 3600000, // Cookie expiry time (1 hour in milliseconds)
        });

        res.json({ message: "Login successful" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
router.post('/logout', (req, res) => {
    try {
        // Clear the token cookie
        res.clearCookie('token');

        res.json({ message: "Logout successful" });
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





// 2. Verify OTP
router.post('/verify-reset-otp', async (req, res) => {
    const { Email, otp } = req.body;

    try {
        const storedOTP = otpStore[Email];
        if (!storedOTP) {
            return res.status(400).json({ message: "OTP expired or not found" });
        }

        if (storedOTP.otp !== otp || Date.now() > storedOTP.expireAt) {
            delete otpStore[Email];
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        // Generate the reset token and set it as a cookie
        const resetToken = jwt.sign({ Email }, JWT_SECRET, { expiresIn: '15m' });
        res.cookie('resetToken', resetToken, { httpOnly: true, maxAge: 15 * 60 * 1000 }); // 15 minutes expiry

        delete otpStore[Email];
        res.status(200).json({ message: "OTP verified" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});





// 1. Request Password Reset: Generate and send OTP
router.post('/forgot-password', async (req, res) => {
    const { Email } = req.body;

    try {
        // Check if user exists
        const user = await User.findOne({ Email });
        if (!user) {
            return res.status(400).json({ message: "Email not found" });
        }

        // Generate and send OTP (via email)
        const otp = await features.sendOTP(Email); // Use sendOTP to send email with OTP

        // Store OTP in memory with a 5-minute expiration
        otpStore[Email] = { otp, expireAt: Date.now() + 5 * 60 * 1000 };

        res.json({ message: "OTP sent to email" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
// 3. Reset Password Using Token Stored in Cookie
router.post('/reset-password', async (req, res) => {
    const { newPassword } = req.body;

    try {
        const resetToken = req.cookies.resetToken;

        if (!resetToken) {
            return res.status(400).json({ message: "Reset token is missing or expired" });
        }

        const decoded = jwt.verify(resetToken, JWT_SECRET);
        const { Email } = decoded;

        const user = await User.findOne({ Email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const hashedPassword = await argon2.hash(newPassword);
        user.password = hashedPassword;
        await user.save();

        res.clearCookie('resetToken');
        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error(error);
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ message: "Reset token expired" });
        }
        res.status(500).json({ message: "Server error" });
    }
});


module.exports = router;
