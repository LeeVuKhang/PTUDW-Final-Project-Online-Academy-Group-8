import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import userModel from '../models/user.model.js';
import { authenticateJWT } from '../models/auth.model.js';
import { sendOtpEmail } from '../utils/mailer.js';
import { generateAccessToken, generateRefreshToken, setTokenCookies, clearTokenCookies } from '../utils/jwt.util.js';
import tempDataModel from '../models/temp-data.model.js';

import watchlistModel from '../models/watchlist.model.js'
import multer from 'multer';
import path from 'path';
import fs from 'fs';
const __dirname = import.meta.dirname;
const avatarDir = path.join(__dirname, '..', 'static', 'avatar');

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.user_id; // Changed from req.user
    const ext = path.extname(file.originalname);
    const newFilename = `${userId}${ext}`;

    try {
      const filesInDir = fs.readdirSync(avatarDir);

      const oldFile = filesInDir.find(f => f.startsWith(`${userId}.`));

      if (oldFile) {
        fs.unlinkSync(path.join(avatarDir, oldFile));
      }
    } catch (err) {
      console.error("[Avatar Upload] Lỗi khi xóa file cũ:", err);
    }
    cb(null, newFilename);
  }
});
const upload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb("Error: Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif, webp)!");
  }
});
const router = express.Router();



router.get('/signup', (req, res) => {
  res.render('vwAccount/signup');
});

router.post('/signup', async (req, res) => {
  try {
    const raw = req.body || {};
    const payload = {
      username: String(raw.username || '').trim(),
      password: String(raw.password || ''),
      confirm: String(raw.confirm || ''),
      name: String(raw.name || '').trim(),
      email: String(raw.email || '').trim().toLowerCase(),
      dob: String(raw.dob || ''),
    };
    const rerender = (fieldErrors) =>
      res.status(400).render('vwAccount/signup', {
        fieldErrors,
        last: {
          username: payload.username,
          name: payload.name,
          email: payload.email,
          dob: payload.dob,
        }
      });

    const errs = {};
    if (payload.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (payload.password !== payload.confirm) {
      errs.confirm = 'Passwords do not match.';
    }
    if (Object.keys(errs).length > 0) {
      return rerender(errs);
    }
    const existedUser = await userModel.findByUsername(payload.username);
    if (existedUser) {
      errs.username = 'Username is already taken.';
    }
    const existedEmail = await userModel.findByEmail(payload.email);
    if (existedEmail) {
      errs.email = 'Email is already taken.';
    }

    if (Object.keys(errs).length > 0) {
      return rerender(errs);
    }
    const hash = bcrypt.hashSync(payload.password, 10);

    // Generate unique session ID for anonymous temp data storage
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Store pending signup in database instead of session
    await tempDataModel.saveSessionData(sessionId, 'pendingSignup', {
      username: payload.username,
      password: hash,
      name: payload.name,
      email: payload.email,
      dob: payload.dob,
      role: 1,
      self_introduction: null,
      image_url: null,
    }, new Date(Date.now() + 30 * 60 * 1000)); // 30 minutes expiry

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await tempDataModel.saveSessionData(sessionId, 'signupOtp', {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000
    }, new Date(Date.now() + 10 * 60 * 1000));

    // Store sessionId in cookie
    res.cookie('signupSessionId', sessionId, {
      maxAge: 30 * 60 * 1000,
      httpOnly: true,
      sameSite: 'strict',
    });

    const { sendOtpEmail } = await import('../utils/mailer.js');
    await sendOtpEmail(payload.email, otp, 'Complete your registration');

    return res.render('vwAccount/signup-verify', { email: payload.email });

  } catch (e) {
    if (e?.code === '23505') {
      const fieldErrors = {};
      if (/users_username_key/i.test(e.constraint || '')) fieldErrors.username = 'Username is already taken.';
      if (/users_email_key/i.test(e.constraint || '')) fieldErrors.email = 'Email is already taken.';
      if (Object.keys(fieldErrors).length > 0) {
        return res.status(400).render('vwAccount/signup', { fieldErrors });
      }
    }
    console.error('[signup] error:', e);
    return res.status(500).render('vwAccount/403');
  }
});

router.get('/signin', (req, res) => {
  res.render('vwAccount/signin', {
    retUrl: req.query.retUrl || ''
  });
});
router.post('/signin', async (req, res) => {
  try {
    const { username, password } = req.body;
    const u = String(username || '').trim();
    const p = String(password || '');
    const user = await userModel.findByUsername(u);
    const invalid = () =>
      res.status(401).render('vwAccount/signin', {
        err: 'Invalid username or password.',
        lastUsername: u
      });
    if (!user) return invalid();
    if (!bcrypt.compareSync(p, user.password)) return invalid();

    // Generate JWT tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set tokens as HTTPOnly cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Handle redirect URL priority: retUrl cookie > body retUrl > role-based
    const cookieRetUrl = req.cookies.retUrl;
    const bodyRetUrl = req.body.retUrl;

    // Clear retUrl cookie
    if (cookieRetUrl) {
      res.clearCookie('retUrl');
    }

    // If có retUrl cụ thể từ cookie hoặc form thì dùng
    if (cookieRetUrl && cookieRetUrl !== '/') {
      return res.redirect(cookieRetUrl);
    }
    if (bodyRetUrl && bodyRetUrl !== '/') {
      return res.redirect(bodyRetUrl);
    }

    // Không có retUrl cụ thể -> redirect theo role
    let redirectUrl;
    if (user.role === 0) {
      // Admin - chuyển đến trang chủ
      redirectUrl = '/';
    } else if (user.role === 1) {
      // Student - chuyển đến trang chủ
      redirectUrl = '/';
    } else if (user.role === 2) {
      // Instructor - chuyển đến trang instructor
      redirectUrl = '/instructor';
    } else {
      // Default - trang chủ
      redirectUrl = '/';
    }

    return res.redirect(redirectUrl);
  } catch (e) {
    console.error('[signin] error:', e);
    return res.status(500).render('vwAccount/signin', { err: 'Server error. Please try again.' });
  }
});

router.get('/signup/verify', (req, res) => {
  const sessionId = req.cookies.signupSessionId;
  if (!sessionId) return res.redirect('/account/signup');

  tempDataModel.getSessionData(sessionId, 'pendingSignup')
    .then(pending => {
      if (!pending) return res.redirect('/account/signup');
      res.render('vwAccount/signup-verify', { email: pending.email });
    })
    .catch(err => {
      console.error('[signup/verify GET] error:', err);
      res.redirect('/account/signup');
    });
});
router.post('/signup/verify', async (req, res) => {
  try {
    const sessionId = req.cookies.signupSessionId;
    if (!sessionId) return res.redirect('/account/signup');

    const pending = await tempDataModel.getSessionData(sessionId, 'pendingSignup');
    const hold = await tempDataModel.getSessionData(sessionId, 'signupOtp');

    if (!pending || !hold) return res.redirect('/account/signup');

    const code = (req.body.code || '').trim();
    if (!code) {
      return res.render('vwAccount/signup-verify', { email: pending.email, err: 'Please enter the code.' });
    }
    if (Date.now() > hold.expiresAt) {
      await tempDataModel.deleteSessionData(sessionId, 'pendingSignup');
      await tempDataModel.deleteSessionData(sessionId, 'signupOtp');
      res.clearCookie('signupSessionId');
      return res.render('vwAccount/signup', { err: 'Code expired. Please sign up again.' });
    }
    if (code !== hold.code) {
      return res.render('vwAccount/signup-verify', { email: pending.email, err: 'Invalid code. Try again.' });
    }

    const newId = await userModel.add({
      username: pending.username,
      password: pending.password,
      name: pending.name,
      email: pending.email,
      dob: pending.dob,
      role: pending.role,
      self_introduction: pending.self_introduction,
      image_url: pending.image_url,
    });

    // Clean up temp data
    await tempDataModel.deleteSessionData(sessionId, 'pendingSignup');
    await tempDataModel.deleteSessionData(sessionId, 'signupOtp');
    res.clearCookie('signupSessionId');

    const user = await userModel.findByUsername(pending.username);

    // Auto-login with JWT
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setTokenCookies(res, accessToken, refreshToken);

    return res.redirect('/account/profile');
  } catch (e) {
    console.error('[signup/verify] error:', e);
    return res.status(500).render('vwAccount/403');
  }
});





router.post('/signout', async (req, res) => {
  // Clear JWT cookies
  clearTokenCookies(res);
  const redirectUrl = req.headers.referer || '/';
  return res.redirect(redirectUrl);
});

router.get('/is-available', async (req, res) => {
  const username = req.query.username;
  const user = await userModel.findByUsername(username);
  if (!user) {
    return res.json(true);
  }
  return res.json(false);
});

router.get('/profile', authenticateJWT, async (req, res) => {
  const tab = req.query.tab || 'info';
  // Check for pending email change in temp data
  const pending = await tempDataModel.getTempData(req.user.user_id, 'pendingEmailChange');
  res.render('vwAccount/profile', {
    user: req.user,
    tab,
    pendingEmail: pending ? pending.newEmail : null,
    pendingStage: pending ? pending.stage : null,
  });
});

router.post('/upload-avatar', authenticateJWT, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file nào được tải lên hoặc file không phải là ảnh.' });
    }

    const newImageUrl = `/static/avatar/${req.file.filename}`;
    const userId = req.user.user_id;

    await userModel.patch(userId, { image_url: newImageUrl });

    // Note: JWT payload is immutable, but next request will have updated data from database
    return res.json({ success: true, newImageUrl: newImageUrl });

  } catch (error) {
    console.error("Lỗi upload avatar:", error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tải ảnh lên.' });
  }
});



router.post('/profile', authenticateJWT, async (req, res) => {
  const id = req.user.user_id;
  const user = {
    name: req.body.name,
    dob: req.body.dob,
    self_introduction: req.body.self_introduction || null,
    image_url: req.body.image_url || null,
  };
  await userModel.patch(id, user);

  // Fetch updated user for fresh data
  const updatedUser = await userModel.findById(id);

  // Check for pending email change
  const pending = await tempDataModel.getTempData(id, 'pendingEmailChange');

  res.render('vwAccount/profile', {
    user: updatedUser,
    tab: 'info',
    saved: true,
    pendingEmail: pending ? pending.newEmail : null,
  });
});
router.get('/change-pwd', authenticateJWT, async (req, res) => {
  res.render('vwAccount/change-pwd', { user: req.user })
});
router.post('/change-pwd', authenticateJWT, async (req, res) => {
  const user = req.user;
  const id = user.user_id;
  const currentPassword = req.body.currentPassword || '';

  // Fetch fresh user data with password
  const dbUser = await userModel.findById(id);
  const ok = bcrypt.compareSync(currentPassword, dbUser.password);

  if (!ok) {
    return res.render('vwAccount/profile', {
      user,
      pwdError: 'Current password is incorrect.',
      tab: 'pwd',
    });
  }
  const newPwd = req.body.newPassword || '';
  if (newPwd.length < 6) {
    return res.render('vwAccount/profile', {
      user,
      pwdError: 'New password must be at least 6 characters long.',
      tab: 'pwd',
    });
  }
  const hash_password = bcrypt.hashSync(newPwd, 10);
  await userModel.patch(id, { password: hash_password });

  return res.redirect('/account/profile');
});
router.post('/sync', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res
        .status(400)
        .json({ ok: false, needSignup: true, redirect: '/account/complete', message: 'Missing JSON body' });
    }

    const { email, name, supabase_uid } = req.body || {};
    if (!email) {
      return res
        .status(400)
        .json({ ok: false, needSignup: true, redirect: '/account/complete', message: 'Missing email' });
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      // User exists - issue JWT tokens
      const accessToken = generateAccessToken(existing);
      const refreshToken = generateRefreshToken(existing);
      setTokenCookies(res, accessToken, refreshToken);

      const retUrl = req.cookies.retUrl || '/';
      res.clearCookie('retUrl');
      return res.json({ ok: true, redirect: retUrl });
    }

    // New user - store pending social data with temporary session
    const sessionId = crypto.randomBytes(16).toString('hex');
    await tempDataModel.saveSessionData(sessionId, 'pendingSocial',
      { email, name: name || '', supabase_uid },
      new Date(Date.now() + 30 * 60 * 1000) // 30 min expiry
    );

    res.cookie('socialSessionId', sessionId, {
      maxAge: 30 * 60 * 1000,
      httpOnly: true,
      sameSite: 'strict',
    });

    return res.json({ ok: false, needSignup: true, redirect: '/account/complete' });
  } catch (err) {
    console.error('[sync] error:', err);
    return res
      .status(500)
      .json({ ok: false, needSignup: true, redirect: '/account/complete', message: 'Server error' });
  }
});

router.get('/oauth-done', (req, res) => {
  res.render('vwAccount/oauth-done');
});
router.get('/complete', async (req, res) => {
  const sessionId = req.cookies.socialSessionId;
  if (!sessionId) return res.redirect('/account/signin');

  const pending = await tempDataModel.getSessionData(sessionId, 'pendingSocial');
  if (!pending) return res.redirect('/account/signin');

  res.render('vwAccount/complete', { email: pending.email, name: pending.name, dob: pending.dob });
});
router.post('/complete', async (req, res) => {
  try {
    const sessionId = req.cookies.socialSessionId;
    if (!sessionId) return res.redirect('/account/signin');

    const pending = await tempDataModel.getSessionData(sessionId, 'pendingSocial');
    if (!pending) return res.redirect('/account/signin');

    const randomPwd = crypto.randomBytes(16).toString('hex');
    const hash_password = bcrypt.hashSync(randomPwd, 10);
    let finalUsername = (req.body.username || '').trim();
    if (!finalUsername) {
      finalUsername = pending.email;
    }
    let suffix = 1;
    while (await userModel.findByUsername(finalUsername)) {
      finalUsername = `${(req.body.username || 'user')}${suffix++}`;
    }

    const user = {
      username: finalUsername,
      password: hash_password,
      name: req.body.name,
      email: pending.email,
      dob: req.body.dob,
      role: 1,
      self_introduction: req.body.self_introduction || null,
      image_url: req.body.image_url || null,
    };

    const newId = await userModel.add(user);
    const fullUser = { ...user, user_id: newId };

    // Clean up temp data
    await tempDataModel.deleteSessionData(sessionId, 'pendingSocial');
    res.clearCookie('socialSessionId');

    // Issue JWT tokens
    const accessToken = generateAccessToken(fullUser);
    const refreshToken = generateRefreshToken(fullUser);
    setTokenCookies(res, accessToken, refreshToken);

    const retUrl = req.cookies.retUrl || '/';
    res.clearCookie('retUrl');
    return res.redirect(retUrl);
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
// --- edit email/password stuff ---
router.post('/change-email', authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    const newEmail = (req.body.newEmail || '').trim();
    if (!newEmail) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'Enter a valid new email.' });
    }

    const existed = await userModel.findByEmail(newEmail);
    if (existed) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'This email is already in use.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiration = new Date(Date.now() + 10 * 60 * 1000);
    const db = (await import('../utils/db.js')).default;
    await db('otps').insert({
      user_id: user.user_id,
      otp_code: otp,
      expiration,
      is_verified: false,
    });

    await sendOtpEmail(user.email, otp, 'Confirm email change (current email code)');

    // Store in temp_data instead of session
    await tempDataModel.saveTempData(user.user_id, 'pendingEmailChange', {
      user_id: user.user_id,
      newEmail,
      stage: 'old',
    }, new Date(Date.now() + 30 * 60 * 1000));

    return res.render('vwAccount/profile', {
      user,
      tab: 'email-verify-old',
      pendingEmail: newEmail,
      pendingStage: 'old',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});

router.post('/change-email', authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    const newEmail = (req.body.newEmail || '').trim();
    if (!newEmail) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'Enter a valid new email.' });
    }

    // unique check
    const existed = await userModel.findByEmail(newEmail);
    if (existed) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'This email is already in use.' });
    }

    // gen OTP 
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiration = new Date(Date.now() + 10 * 60 * 1000);
    const db = (await import('../utils/db.js')).default;
    await db('otps').insert({
      user_id: user.user_id,
      otp_code: otp,
      expiration,
      is_verified: false,
    });

    // send to current email
    await sendOtpEmail(user.email, otp, 'Confirm email change (current email code)');

    // store pending change in temp_data
    await tempDataModel.saveTempData(user.user_id, 'pendingEmailChange', {
      user_id: user.user_id,
      newEmail,
      stage: 'old',
    }, new Date(Date.now() + 30 * 60 * 1000));

    return res.render('vwAccount/profile', {
      user,
      tab: 'email-verify-old',
      pendingEmail: newEmail,
      pendingStage: 'old',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.get('/change-email/verify', authenticateJWT, async (req, res) => {
  const pending = await tempDataModel.getTempData(req.user.user_id, 'pendingEmailChange');
  if (!pending) {
    return res.redirect('/account/change-email');
  }
  res.render('vwAccount/change-email-verify', {
    user: req.user,
    newEmail: pending.newEmail
  });
});
router.post('/change-email/verify', authenticateJWT, async (req, res) => {
  try {
    const pending = await tempDataModel.getTempData(req.user.user_id, 'pendingEmailChange');
    if (!pending) return res.redirect('/account/profile?tab=email');

    const { code } = req.body;
    if (!code) {
      return res.render('vwAccount/profile', {
        user: req.user,
        tab: 'email-verify',
        pendingEmail: pending.newEmail,
        errEmailVerify: 'Please enter the verification code.',
      });
    }

    const db = (await import('../utils/db.js')).default;
    const otpRow = await db('otps')
      .where({
        user_id: pending.user_id,
        otp_code: code.trim(),
        is_verified: false,
      })
      .andWhere('expiration', '>', new Date())
      .first();

    if (!otpRow) {
      return res.render('vwAccount/profile', {
        user: req.user,
        tab: 'email-verify',
        pendingEmail: pending.newEmail,
        errEmailVerify: 'Invalid or expired code.',
      });
    }

    await db('otps').where({ otp_id: otpRow.otp_id }).update({ is_verified: true });
    await userModel.patch(pending.user_id, { email: pending.newEmail });

    // Clean up temp data
    await tempDataModel.deleteTempData(req.user.user_id, 'pendingEmailChange');

    return res.redirect('/account/profile?tab=info');
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.post('/change-pwd-social/send', authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    if (!user.isSocial) {
      return res.render('vwAccount/profile', { user, tab: 'pwd' });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiration = new Date(Date.now() + 10 * 60 * 1000);

    const db = (await import('../utils/db.js')).default;
    await db('otps').insert({
      user_id: user.user_id,
      otp_code: otp,
      expiration,
      is_verified: false,
    });

    await sendOtpEmail(user.email, otp, 'Password change verification code');

    return res.render('vwAccount/profile', { user, tab: 'pwd', pwdSent: true });
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.post('/change-pwd-social', authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    if (!user.isSocial) {
      return res.render('vwAccount/profile', { user, tab: 'pwd' });
    }
    const { code, newPassword } = req.body;
    if (!code || !newPassword || newPassword.length < 6) {
      return res.render('vwAccount/profile', { user, tab: 'pwd', pwdSent: true, errPwd: 'Enter code and a valid new password (min 6 chars).' });
    }

    const db = (await import('../utils/db.js')).default;
    const otpRow = await db('otps')
      .where({ user_id: user.user_id, otp_code: code.trim(), is_verified: false })
      .andWhere('expiration', '>', new Date())
      .first();

    if (!otpRow) {
      return res.render('vwAccount/profile', { user, tab: 'pwd', pwdSent: true, errPwd: 'Invalid or expired code.' });
    }

    await db('otps').where({ otp_id: otpRow.otp_id }).update({ is_verified: true });

    const hash_password = bcrypt.hashSync(newPassword, 10);
    await userModel.patch(user.user_id, { password: hash_password });
    req.user.password = hash_password;
    return res.redirect('/account/profile?tab=pwd');
  } catch (e) {
    console.error(e);
    return res.status(500).render('403');
  }
});
router.post('/change-email/verify-old', authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    const pending = req.session.pendingEmailChange;
    if (!pending || pending.user_id !== user.user_id) {
      return res.redirect('/account/profile');
    }

    const code = (req.body.code || '').trim();
    if (!code) {
      return res.render('vwAccount/profile', {
        user,
        tab: 'email-verify-old',
        pendingEmail: pending.newEmail,
        pendingStage: 'old',
        errEmailVerifyOld: 'Please enter the verification code.',
      });
    }

    const db = (await import('../utils/db.js')).default;
    const otpRow = await db('otps')
      .where({ user_id: user.user_id, otp_code: code, is_verified: false })
      .andWhere('expiration', '>', new Date())
      .first();

    if (!otpRow) {
      return res.render('vwAccount/profile', {
        user,
        tab: 'email-verify-old',
        pendingEmail: pending.newEmail,
        pendingStage: 'old',
        errEmailVerifyOld: 'Invalid or expired code.',
      });
    }

    await db('otps').where({ otp_id: otpRow.otp_id }).update({ is_verified: true });

    const otpNew = String(Math.floor(100000 + Math.random() * 900000));
    const expiration = new Date(Date.now() + 10 * 60 * 1000);
    await db('otps').insert({
      user_id: user.user_id,
      otp_code: otpNew,
      expiration,
      is_verified: false,
    });

    await sendOtpEmail(pending.newEmail, otpNew, 'Confirm your new email');

    req.session.pendingEmailChange.stage = 'new';

    return res.render('vwAccount/profile', {
      user,
      tab: 'email-verify-new',
      pendingEmail: pending.newEmail,
      pendingStage: 'new',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.post('/change-email/verify-new', authenticateJWT, async (req, res) => {
  try {
    const user = req.user;
    const pending = req.session.pendingEmailChange;
    if (!pending || pending.user_id !== user.user_id || pending.stage !== 'new') {
      return res.redirect('/account/profile');
    }

    const code = (req.body.code || '').trim();
    if (!code) {
      return res.render('vwAccount/profile', {
        user,
        tab: 'email-verify-new',
        pendingEmail: pending.newEmail,
        pendingStage: 'new',
        errEmailVerifyNew: 'Please enter the verification code.',
      });
    }

    const db = (await import('../utils/db.js')).default;
    const otpRow = await db('otps')
      .where({ user_id: user.user_id, otp_code: code, is_verified: false })
      .andWhere('expiration', '>', new Date())
      .first();

    if (!otpRow) {
      return res.render('vwAccount/profile', {
        user,
        tab: 'email-verify-new',
        pendingEmail: pending.newEmail,
        pendingStage: 'new',
        errEmailVerifyNew: 'Invalid or expired code.',
      });
    }

    await db('otps').where({ otp_id: otpRow.otp_id }).update({ is_verified: true });
    await userModel.patch(user.user_id, { email: pending.newEmail });


    try {
      await sendOtpEmail(user.email, 'Your email was changed');
    } catch (e) {
      console.warn('failed action :', e.message);
    }

    req.user.email = pending.newEmail;
    req.session.pendingEmailChange = null;

    return res.redirect('/account/profile');
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});


router.get('/forgot', async (req, res) => {
  try {
    if (req.session?.isAuthenticated && req.session?.authUser) {
      const user = req.user;
      const db = (await import('../utils/db.js')).default;
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiration = new Date(Date.now() + 10 * 60 * 1000);

      await db('otps').insert({
        user_id: user.user_id,
        otp_code: otp,
        expiration,
        is_verified: false,
      });

      try {
        await sendOtpEmail(user.email, otp, 'Password reset code');
      } catch (e) {
        console.warn('[forgot][authed] send mail failed:', e.message);
      }

      // set session
      req.session.pendingReset = { user_id: user.user_id, email: user.email, verified: false };

      return res.render('vwAccount/forgot-verify', { email: user.email });
    }

    return res.render('vwAccount/forgot');
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.post('/forgot', async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    if (!email) {
      return res.render('vwAccount/forgot', { err: 'Please enter your email.' });
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      const db = (await import('../utils/db.js')).default;
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiration = new Date(Date.now() + 10 * 60 * 1000);

      await db('otps').insert({
        user_id: existing.user_id,
        otp_code: otp,
        expiration,
        is_verified: false,
      });

      try {
        await sendOtpEmail(email, otp, 'Password reset code');
      } catch (e) {
        console.warn('[forgot][unauth] send mail failed:', e.message);
      }

      req.session.pendingReset = { user_id: existing.user_id, email, verified: false };
    }
    return res.render('vwAccount/forgot-verify', { email });
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.get('/forgot/verify', (req, res) => {
  const pending = req.session.pendingReset;
  if (!pending) return res.redirect('/account/forgot');
  res.render('vwAccount/forgot-verify', { email: pending.email });
});
router.post('/forgot/verify', async (req, res) => {
  try {
    const pending = req.session.pendingReset;
    if (!pending) return res.redirect('/account/forgot');

    const code = (req.body.code || '').trim();
    if (!code) {
      return res.render('vwAccount/forgot-verify', {
        email: pending.email,
        err: 'Please enter the verification code.',
      });
    }

    const db = (await import('../utils/db.js')).default;
    const otpRow = await db('otps')
      .where({ user_id: pending.user_id, otp_code: code, is_verified: false })
      .andWhere('expiration', '>', new Date())
      .first();

    if (!otpRow) {
      return res.render('vwAccount/forgot-verify', {
        email: pending.email,
        err: 'Invalid or expired code.',
      });
    }

    await db('otps').where({ otp_id: otpRow.otp_id }).update({ is_verified: true });
    req.session.pendingReset.verified = true;

    return res.render('vwAccount/forgot-reset');
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.post('/forgot/reset', async (req, res) => {
  try {
    const pending = req.session.pendingReset;
    if (!pending || !pending.verified) {
      return res.redirect('/account/forgot');
    }

    const newPassword = req.body.newPassword || '';
    if (newPassword.length < 6) {
      return res.render('vwAccount/forgot-reset', {
        err: 'Password must be at least 6 characters.',
      });
    }

    const hash_password = bcrypt.hashSync(newPassword, 10);
    await userModel.patch(pending.user_id, { password: hash_password });

    if (req.session?.authUser && req.user.user_id === pending.user_id) {
      req.user.password = hash_password;
      req.session.pendingReset = null;
      return res.redirect('/account/profile');
    }

    req.session.pendingReset = null;
    return res.redirect('/account/signin');
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});





router.get('/watchlist', authenticateJWT, async (req, res) => {
  try {
    const student_id = req.user.user_id;
    const items = await watchlistModel.findCoursesByStudentID(student_id);

    res.render('vwAccount/watchlist', {
      watchlistItems: items,
    });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).send('Error loading your watchlist.');
  }
});
router.post('/watchlist/add', authenticateJWT, async (req, res) => {
  try {
    const student_id = req.user.user_id;
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).send('Course ID is missing.');
    }

    await watchlistModel.add(student_id, course_id);

    res.redirect(req.headers.referer || '/');
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).send('Error updating your watchlist.');
  }
});

router.post('/watchlist/remove', authenticateJWT, async (req, res) => {
  try {
    const student_id = req.user.user_id;
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).send('Course ID is missing.');
    }

    await watchlistModel.remove(student_id, course_id);

    res.redirect(req.headers.referer || '/');
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).send('Error updating your watchlist.');
  }
});

export default router;
