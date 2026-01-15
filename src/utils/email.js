const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'OmniHub <onboarding@resend.dev>',
            to: [options.email],
            subject: options.subject,
            html: options.message,
        });

        if (error) {
            console.error('Resend API Error:', error);
            throw new Error(error.message);
        }

        console.log('Email sent successfully:', data);
    } catch (err) {
        console.error('Email send failed:', err);
        throw err;
    }
};

module.exports = sendEmail;
