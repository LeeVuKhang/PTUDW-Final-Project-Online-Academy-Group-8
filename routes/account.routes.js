import express from 'express';
import userModel from '../models/user.model.js';
import { checkAuthenticated  } from '../models/auth.model.js';
const router = express.Router();


router.get('/signup', (req, res) => {
    res.render('vwAccount/signup');
}); 
router.get('/signin', (req, res) => {
    res.render('vwAccount/signin');
});

import bcrypt from 'bcryptjs';

router.post('/signup', async (req, res) => {
    const hash_password = bcrypt.hashSync(req.body.password, 10);
    const user = {
        username: req.body.username,
        password: hash_password,
        name: req.body.name,
        email: req.body.email,
        dob: req.body.dob,
        permission: 0
    }

    await userModel.add(user);
    res.render('vwAccount/signup');
});


router.post('/signin', async (req, res) => {
    const user = await userModel.findByUsername(req.body.username);
    const matchPassword = bcrypt.compareSync(req.body.password, user.password)
    if (matchPassword == false){
        return res.redirect('signin');
        
    }

    req.session.isAuthenticated = true;
    req.session.authUser = user;

    const reUrl = req.session.reUrl || '/';
    delete req.session.reUrl;
    return res.redirect(reUrl);
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
    res.render('vwAccount/signup');
})
export default router;