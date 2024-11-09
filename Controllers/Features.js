const User = require('../Models/User.js');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const twilio = require('twilio');
// Configure Gmail OAuth2 Client
const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
   
);

oauth2Client.setCredentials({
    refresh_token: process.env.refresh_token
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Configure Twilio Client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);



const checkExistingUser = async (Email, Phone, GGVID) => {
    const query = {
        $or: [
            { Email: Email },
            { Phone: Phone },
            { GGVID: GGVID }
        ]
    };

    const user = await User.findOne(query);  // Find one user that matches any of the fields

    if (user) {
        const existingFields = {
            Email: user.Email === Email,
            Phone: user.Phone === Phone,
            GGVID: user.GGVID === GGVID
        };

        // Filter out the fields that don't match
        const result = Object.keys(existingFields).filter(field => existingFields[field]);
        
        return { exists: true, fields: result };
    } else {
        return { exists: false, fields: [] };
    }
};

const sendOTP = async (Email, Phone) => {
    // Generate a random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        // Send OTP via Gmail
        const emailResponse = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: Buffer.from(
                    `To: ${Email}\r\n` +
                    `Subject: Your OTP Code\r\n\r\n` +
                    `Your OTP code is ${otp}`
                ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
            }
        });
        console.log('Email sent:', emailResponse.data);

        // Send OTP via SMS (Twilio)
        // const smsResponse = await twilioClient.messages.create({
        //     body: `Your OTP code is ${otp}`,
        //      from: '+13182399993',
        //      to: Phone
        // });
        // console.log('SMS sent:', smsResponse.sid);

        return otp; // Return the OTP so it can be stored for verification

    } catch (error) {
        console.error('Error sending OTP:', error);
        throw new Error('Failed to send OTP');
    }
};


module.exports = {checkExistingUser , sendOTP};
