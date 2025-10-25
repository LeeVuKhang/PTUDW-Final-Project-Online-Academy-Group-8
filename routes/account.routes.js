import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import userModel from '../models/user.model.js';
import watchlistModel from '../models/watchlist.model.js';
import { checkAuthenticated  } from '../models/auth.model.js';
const router = express.Router();



router.get('/signup', (req, res) => {
    res.render('vwAccount/signup');
}); 
router.get('/signin', (req, res) => {
    res.render('vwAccount/signin');
});

router.post('/signup', async (req, res) => {
    const hash_password = bcrypt.hashSync(req.body.password, 10);
    const user = {
        username: req.body.username,
        password: hash_password,
        name: req.body.name,
        email: req.body.email,
        dob: req.body.dob,
        role: 1
    }

    await userModel.add(user);
    res.redirect('/account/signin');
    console.log(user);
});


router.post('/signin', async (req, res) => {
    const user = await userModel.findByUsername(req.body.username);
    if (!user) return res.redirect('signin');
    const matchPassword = bcrypt.compareSync(req.body.password, user.password)
    if (!matchPassword) return res.redirect('signin');

    req.session.isAuthenticated = true;
    req.session.authUser = user;

    const retUrl = req.session.retUrl || '/';
    delete req.session.retUrl;
    return res.redirect(retUrl);
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
  res.render('vwAccount/profile', {
    user: req.session.authUser,
    tab,
    pendingEmail: req.session.pendingEmailChange ? req.session.pendingEmailChange.newEmail : null,
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
    const id = req.session.authUser.user_id;
    const currentPassword = req.body.currentPassword;
    const ret = bcrypt.compareSync(currentPassword, req.session.authUser.password);
    if (ret == false){
        return res.render('vwAccount/change-pwd', {
            user: req.session.authUser,
            error: true //sai mk
        });
    }

    const hash_password = bcrypt.hashSync(req.body.newPassword, 10);
    const user = {
        password: hash_password,
    }

    await userModel.patch(id, user);
    req.session.authUser.password = hash_password;
    return res.redirect('/account/profile');
})
router.post('/sync', async (req, res) => {
    
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ ok: false, message: 'Missing JSON body' });
    }
    const { email, name, supabase_uid } = req.body;
    if (!email) {
      return res.status(400).json({ ok: false, message: 'Missing email' });
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
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Server error' });
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
    return res.status(500).render('403');
  }
});



// --- CHANGE EMAIL FLOW ---
router.get('/change-email', checkAuthenticated, (req, res) => {
  res.render('vwAccount/change-email', {
    user: req.session.authUser
  });
});


router.post('/change-email', checkAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newEmail } = req.body;
    const user = req.session.authUser;

    if (!newEmail) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'Enter a new email.' });
    }

    if (!user.isSocial) {
      const ok = bcrypt.compareSync(currentPassword || '', user.password);
      if (!ok) {
        return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'Current password is incorrect.' });
      }
    } else {
    }

    // unique
    const taken = await userModel.findByEmail(newEmail.trim());
    if (taken) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'This email is already in use.' });
    }

    // make otp
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiration = new Date(Date.now() + 10 * 60 * 1000);

    const db = (await import('../utils/db.js')).default;
    await db('otps').insert({
      user_id: user.user_id,
      otp_code: otp,
      expiration,
      is_verified: false,
    });

    console.log('[change-email] OTP for', user.email, 'is', otp); // dev

    req.session.pendingEmailChange = { user_id: user.user_id, newEmail: newEmail.trim() };

    return res.redirect('/account/profile?tab=email-verify');
  } catch (e) {
    console.error(e);
    return res.status(500).render('403');
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
    return res.status(500).render('403');
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

    console.log('[pwd-social] OTP for', user.email, 'is', otp); 

    return res.render('vwAccount/profile', { user, tab: 'pwd', pwdSent: true });
  } catch (e) {
    console.error(e);
    return res.status(500).render('403');
  }
});


router.post('/change-pwd-social', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
    if (!user.isSocial) {
      return res.render('vwAccount/profile', { user, tab: 'pwd' });
    }
    const { code, newPassword } = req.body;
    if (!code || !newPassword || newPassword.length < 8) {
      return res.render('vwAccount/profile', { user, tab: 'pwd', pwdSent: true, errPwd: 'Enter code and a valid new password (min 8 chars).' });
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






// --- CHANGE EMAIL FLOW ---
router.get('/change-email', checkAuthenticated, (req, res) => {
  res.render('vwAccount/change-email', {
    user: req.session.authUser
  });
});


router.post('/change-email', checkAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newEmail } = req.body;
    const user = req.session.authUser;

    if (!newEmail) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'Enter a new email.' });
    }

    if (!user.isSocial) {
      const ok = bcrypt.compareSync(currentPassword || '', user.password);
      if (!ok) {
        return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'Current password is incorrect.' });
      }
    } else {
    }

    // unique
    const taken = await userModel.findByEmail(newEmail.trim());
    if (taken) {
      return res.render('vwAccount/profile', { user, tab: 'email', errEmail: 'This email is already in use.' });
    }

    // make otp
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiration = new Date(Date.now() + 10 * 60 * 1000);

    const db = (await import('../utils/db.js')).default;
    await db('otps').insert({
      user_id: user.user_id,
      otp_code: otp,
      expiration,
      is_verified: false,
    });

    console.log('[change-email] OTP for', user.email, 'is', otp); // dev

    req.session.pendingEmailChange = { user_id: user.user_id, newEmail: newEmail.trim() };

    return res.redirect('/account/profile?tab=email-verify');
  } catch (e) {
    console.error(e);
    return res.status(500).render('403');
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
    return res.status(500).render('403');
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

    console.log('[pwd-social] OTP for', user.email, 'is', otp); 

    return res.render('vwAccount/profile', { user, tab: 'pwd', pwdSent: true });
  } catch (e) {
    console.error(e);
    return res.status(500).render('403');
  }
});


router.post('/change-pwd-social', checkAuthenticated, async (req, res) => {
  try {
    const user = req.session.authUser;
    if (!user.isSocial) {
      return res.render('vwAccount/profile', { user, tab: 'pwd' });
    }
    const { code, newPassword } = req.body;
    if (!code || !newPassword || newPassword.length < 8) {
      return res.render('vwAccount/profile', { user, tab: 'pwd', pwdSent: true, errPwd: 'Enter code and a valid new password (min 8 chars).' });
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

router.post('remove', checkAuthenticated, async (req, res) => {
  try {
    const student_id = req.session.authUser.user_id;
    const { course_id } = req.body; 

    if (!course_id) {
      return res.status(400).send('Course ID is missing.');
    }

    await watchlistModel.remove(student_id, course_id);
    
    res.redirect('/account/watchlist'); 
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).send('Error updating your watchlist.');
  }
});

export default router;