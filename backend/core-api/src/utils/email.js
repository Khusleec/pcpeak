const nodemailer = require('nodemailer');
const config = require('../config');

// Create a transporter. For now, it logs to console if no SMTP config is provided.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"Mongol PC" <${process.env.SMTP_FROM || 'noreply@mongolpc.mn'}>`,
    to: email,
    subject: 'Нууц үг сэргээх',
    text: `Сайн байна уу? Та доорх линкээр орж нууц үгээ сэргээнэ үү:\n\n${resetUrl}\n\nХэрэв та энэ хүсэлтийг гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #333;">Нууц үг сэргээх</h2>
        <p>Сайн байна уу?</p>
        <p>Та доорх товчлуур дээр дарж нууц үгээ сэргээнэ үү:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Нууц үг сэргээх</a>
        </div>
        <p>Эсвэл доорх линкийг хуулж хөтөч дээрээ нээнэ үү:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #999;">Хэрэв та энэ хүсэлтийг гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу.</p>
      </div>
    `,
  };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('--- Mock Email Sending ---');
    console.log(`To: ${email}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('---------------------------');
    return;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Имэйл илгээхэд алдаа гарлаа');
  }
};

module.exports = { sendPasswordResetEmail };
