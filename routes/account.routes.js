import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import userModel from '../models/user.model.js';
import { checkAuthenticated } from '../models/auth.model.js';
import { sendOtpEmail } from '../utils/mailer.js';

import watchlistModel from '../models/watchlist.model.js'
const router = express.Router();



router.get('/signup', (req, res) => {
    res.render('vwAccount/signup');
}); 
router.post('/signup', async (req, res) => {
  try {
    const { username, password, confirm, name, email, dob } = req.body;
    if (!username || !password || !confirm || !name || !email) {
      return res.render('vwAccount/signup', { err: 'Please fill all required fields.' });
    }
    if (password !== confirm) {
      return res.render('vwAccount/signup', { err: 'Passwords do not match.' });
    }
    const existedUser = await userModel.findByUsername(username.trim());
    if (existedUser) {
      return res.render('vwAccount/signup', { err: 'Username is already taken.' });
    }
    const existedEmail = await userModel.findByEmail(email.trim());
    if (existedEmail) {
      return res.render('vwAccount/signup', { err: 'Email is already registered.' });
    }
    const hash = bcrypt.hashSync(password, 10);

    req.session.pendingSignup = {
      username: username.trim(),
      password: hash,
      name: name.trim(),
      email: email.trim(),
      dob: dob,
      role: 1,
    };
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    req.session.signupOtp = {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    const { sendOtpEmail } = await import('../utils/mailer.js');
    await sendOtpEmail(email.trim(), otp, 'Complete your registration');
    return res.render('vwAccount/signup-verify', { email: email.trim() });
  } catch (e) {
    console.error('[signup] error:', e);
    return res.status(500).render('vwAccount/403');
  }
});
router.get('/signin', (req, res) => {
    res.render('vwAccount/signin');
});
router.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    const user = await userModel.findByUsername(username);
    const invalid = () =>
      res.status(401).render('vwAccount/signin', {
        err: 'Invalid username or password.',
        lastUsername: username || '',
      });
    if (!user) return invalid();
    const matchPassword = bcrypt.compareSync(password, user.password)
    if (!matchPassword) return invalid();
    req.session.isAuthenticated = true;
    req.session.authUser = user;

    const retUrl = req.session.retUrl || '/';
    delete req.session.retUrl;
    return res.redirect(retUrl);
});
router.get('/signup/verify', (req, res) => {
  const pending = req.session.pendingSignup;
  if (!pending) return res.redirect('/account/signup');
  res.render('vwAccount/signup-verify', { email: pending.email });
});
router.post('/signup/verify', async (req, res) => {
  try {
    const pending = req.session.pendingSignup;
    const hold = req.session.signupOtp;

    if (!pending || !hold) return res.redirect('/account/signup');

    const code = (req.body.code || '').trim();
    if (!code) {
      return res.render('vwAccount/signup-verify', { email: pending.email, err: 'Please enter the code.' });
    }
    if (Date.now() > hold.expiresAt) {
      req.session.pendingSignup = null;
      req.session.signupOtp = null;
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
    });
    req.session.pendingSignup = null;
    req.session.signupOtp = null;
    const user = await userModel.findByUsername(pending.username);
    req.session.isAuthenticated = true;
    req.session.authUser = user;
    return res.redirect('/account/profile');
  } catch (e) {
    console.error('[signup/verify] error:', e);
    return res.status(500).render('vwAccount/403');
  }
});





router.post('/signout', async (req, res) => {
    req.session.isAuthenticated = false;
    req.session.authUser = null;
    return res.redirect(req.headers.referer);
});

router.get('/is-available',async (req, res) => {
    const username = req.query.username;
    const user = await userModel.findByUsername(username);
    if (!user){
        return res.json(true);
    }
    return res.json(false);
});

router.get('/profile', checkAuthenticated, (req, res) => {
  const tab = req.query.tab || 'info';
  const pending = req.session.pendingEmailChange;
  res.render('vwAccount/profile', {
    user: req.session.authUser,
    tab,
    pendingEmail: pending ? pending.newEmail : null,
    pendingStage: pending ? pending.stage : null,
  });
});





router.post('/profile', checkAuthenticated, async (req, res) => {
  const id = req.session.authUser.user_id;
  const user = {
    name: req.body.name,
    dob: req.body.dob,
  };
  await userModel.patch(id, user);
  req.session.authUser = { ...req.session.authUser, ...user };
  res.render('vwAccount/profile', {
    user: req.session.authUser,
    tab: 'info',
    saved: true,
    pendingEmail: req.session.pendingEmailChange ? req.session.pendingEmailChange.newEmail : null,
  });
});
router.get('/change-pwd', checkAuthenticated, async (req, res) => {
    res.render('vwAccount/change-pwd', {user: req.session.authUser})
});
router.post('/change-pwd', checkAuthenticated, async (req, res) => {
  const user = req.session.authUser;
  const id = user.user_id;
  const currentPassword = req.body.currentPassword || '';
  const ok = bcrypt.compareSync(currentPassword, user.password);
  if (!ok) {
    return res.render('vwAccount/profile', {
      user,
      error: true,
      tab: 'pwd',
    });
  }
  const newPwd = req.body.newPassword || '';
  if (newPwd.length < 6) {
    return res.render('vwAccount/profile', {
      user,
      error: true,
      tab: 'pwd',
    });
  }
  const hash_password = bcrypt.hashSync(newPwd, 10);
  await userModel.patch(id, { password: hash_password });
  req.session.authUser.password = hash_password;

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
      req.session.isAuthenticated = true;
      req.session.authUser = existing;
      req.session.authUser.isSocial = true;

      const retUrl = req.session.retUrl || '/';
      delete req.session.retUrl;
      return res.json({ ok: true, redirect: retUrl });
    }
    req.session.pendingSocial = { email, name: name || '', supabase_uid };
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
router.get('/complete', (req, res) => {
  const pending = req.session.pendingSocial;
  if (!pending) return res.redirect('/account/signin');
  res.render('vwAccount/complete', { email: pending.email, name: pending.name, dob: pending.dob });
});
router.post('/complete', async (req, res) => {
  try {
    const pending = req.session.pendingSocial;
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
    };

    const newId = await userModel.add(user);
    req.session.isAuthenticated = true;
    req.session.authUser = { ...user, user_id: newId };
    req.session.authUser.isSocial = true;

    
    req.session.pendingSocial = null;
    const retUrl = req.session.retUrl || '/';
    delete req.session.retUrl;
    return res.redirect(retUrl);
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
// --- edit email/password stuff ---
router.post('/change-email', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
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

    req.session.pendingEmailChange = {
      user_id: user.user_id,
      newEmail,
      stage: 'old',
    };

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

router.post('/change-email', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
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

    // store pending change in session
    req.session.pendingEmailChange = {
      user_id: user.user_id,
      newEmail,
      stage: 'old',
    };

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
router.get('/change-email/verify', checkAuthenticated, (req, res) => {
  if (!req.session.pendingEmailChange) {
    return res.redirect('/account/change-email');
  }
  res.render('vwAccount/change-email-verify', {
    user: req.session.authUser,
    newEmail: req.session.pendingEmailChange.newEmail
  });
});
router.post('/change-email/verify', checkAuthenticated, async (req, res) => {
  try {
    const pending = req.session.pendingEmailChange;
    if (!pending) return res.redirect('/account/profile?tab=email');

    const { code } = req.body;
    if (!code) {
      return res.render('vwAccount/profile', {
        user: req.session.authUser,
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
        user: req.session.authUser,
        tab: 'email-verify',
        pendingEmail: pending.newEmail,
        errEmailVerify: 'Invalid or expired code.',
      });
    }

    await db('otps').where({ otp_id: otpRow.otp_id }).update({ is_verified: true });


    await userModel.patch(pending.user_id, { email: pending.newEmail });



    req.session.authUser.email = pending.newEmail;
    req.session.pendingEmailChange = null;
    return res.redirect('/account/profile?tab=info');
  } catch (e) {
    console.error(e);
    return res.status(500).render('vwAccount/403');
  }
});
router.post('/change-pwd-social/send', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
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
router.post('/change-pwd-social', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
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
    req.session.authUser.password = hash_password;
    return res.redirect('/account/profile?tab=pwd');
  } catch (e) {
    console.error(e);
    return res.status(500).render('403');
  }
});
router.post('/change-email/verify-old', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
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
router.post('/change-email/verify-new', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
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

    req.session.authUser.email = pending.newEmail;
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
      const user = req.session.authUser;
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

    if (req.session?.authUser && req.session.authUser.user_id === pending.user_id) {
      req.session.authUser.password = hash_password;
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





router.get('/watchlist', checkAuthenticated, async (req, res) => {
  try {
    const student_id = req.session.authUser.user_id;
    const items = await watchlistModel.findCoursesByStudentID(student_id);
    
    res.render('vwAccount/watchlist', { 
      watchlistItems: items,
    });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).send('Error loading your watchlist.');
  }
});
router.post('/watchlist/add', checkAuthenticated, async (req, res) => {
  try {
    const student_id = req.session.authUser.user_id;
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

router.post('/watchlist/remove', checkAuthenticated, async (req, res) => {
  try {
    const student_id = req.session.authUser.user_id;
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