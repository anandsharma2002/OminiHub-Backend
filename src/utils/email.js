const { MailerSend, EmailParams, Sender, Recipient } = require("mailersend");

const mailerSend = new MailerSend({
    apiKey: process.env.MAILERSEND_API_KEY,
});

const sendEmail = async (options) => {
    try {
        const sentFrom = new Sender(process.env.FROM_EMAIL, process.env.FROM_NAME);
        const recipients = [
            new Recipient(options.email, options.email) // name as email for now if name not passed
        ];

        const emailParams = new EmailParams()
            .setFrom(sentFrom)
            .setTo(recipients)
            .setSubject(options.subject)
            .setHtml(options.message)
            .setText(options.message.replace(/<[^>]*>?/gm, '')); // Basic strip HTML for text fallback

        await mailerSend.email.send(emailParams);

        console.log(`Email sent successfully to ${options.email}`);
    } catch (err) {
        console.error('MailerSend API Error:', err);
        throw err;
    }
};

module.exports = sendEmail;
