const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create transporter using Gmail SMTP with STARTTLS (Port 587)
    // Port 587 is generally more reliable on cloud hosting (like Render) than 465
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
        tls: {
            // Do not fail on invalid certs
            rejectUnauthorized: false
        },
        // connectionTimeout: 10000, // 10 seconds
        // greetingTimeout: 10000 // 10 seconds
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    console.log(`Attempting to send email to: ${options.email} via ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 587}`);

    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

module.exports = sendEmail;
