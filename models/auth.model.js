export function checkAuthenticated(req, res, next){
    if (req.session.isAuthenticated){
        next();
    } else {
        req.session.reUrl = req.originalUrl;
        res.redirect('signin');
    }
}

export function checkAdmin(req, res, next){
    if (req.session.isAuthenticated && req.session.authUser.permission === 1){
        next();
    } else {
        res.render('vwAccount/403')
    }
}