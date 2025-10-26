import nodemailer from 'nodemailer';

// .env vars
const {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM,
} = process.env;

function requireEnv(name, val) {
  if (!val) {
    throw new Error(`[Missing ${name}. Check .env or something`);
  }
  return val;
}


const host = requireEnv('MAIL_HOST', MAIL_HOST);
const port = Number(MAIL_PORT || 2525);
const secure = String(MAIL_SECURE || 'false') === 'true';
const user = requireEnv('MAIL_USER', MAIL_USER);
const pass = requireEnv('MAIL_PASS', MAIL_PASS);
const from = MAIL_FROM || 'CourseCademy <no-reply@example.com>';

// hoi ahzy de bit them chi tiet
const transporter = nodemailer.createTransport({
  host,
  port,
  secure, 
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
});


console.log('[mailer] Using SMTP:', { host, port, secure, from });

export async function sendOtpEmail(to, code, purpose = 'Local web email notification') {
  const info = await transporter.sendMail({
    from,
    to,
    subject: purpose,
    text: `${code}`,
  });
  console.log('[mailer] sent messageId:', info.messageId, 'to:', to);
}
