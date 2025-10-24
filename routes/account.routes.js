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
    res.redirect('signin');
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

router.get('/profile', checkAuthenticated, async (req, res) => {
    res.render('vwAccount/profile', {user: req.session.authUser})
});



router.post('/profile', checkAuthenticated, async (req, res) => {
    const id = req.body.id;
    const user = {
        name: req.body.name,
        email: req.body.email,
        dob: req.body.dob
    }

    await userModel.patch(id, user);

    req.session.authUser.name = user.name;
    req.session.authUser.email = user.email;
    res.render('vwAccount/profile', {user: req.session.authUser})
});

router.get('/change-pwd', checkAuthenticated, async (req, res) => {
    res.render('vwAccount/change-pwd', {user: req.session.authUser})
});

router.post('/change-pwd', checkAuthenticated, async (req, res) => {
    const id = req.session.authUser.id;
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
  res.render('vwAccount/complete', { email: pending.email, name: pending.name });
});
router.post('/complete', async (req, res) => {
  try {
    const pending = req.session.pendingSocial;
    if (!pending) return res.redirect('/account/signin');

    const { username, name } = req.body;
    let finalUsername = (username || '').trim();
    if (!finalUsername) finalUsername = pending.email;

    let suffix = 1;
    while (await userModel.findByUsername(finalUsername)) {
      finalUsername = `${(username || 'user')}${suffix++}`;
    }

    const randomPwd = crypto.randomBytes(16).toString('hex');
    const hash_password = bcrypt.hashSync(randomPwd, 10);

    const newUser = {
      username: finalUsername,
      password: hash_password,
      name: (name || pending.name || '').trim(),
      email: pending.email,
      role: 1,
    };

    
    const ids = await userModel.add(newUser);
    const newId = Array.isArray(ids) ? ids[0] : ids;
    const user = { ...newUser, user_id: newId, id: newId };

    req.session.isAuthenticated = true;
    req.session.authUser = user;
    req.session.pendingSocial = null;

    const retUrl = req.session.retUrl || '/';
    delete req.session.retUrl;
    return res.redirect(retUrl);
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