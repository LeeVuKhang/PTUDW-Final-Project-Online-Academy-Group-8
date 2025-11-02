export function checkAuthenticated(req, res, next) {
  if (req.session.isAuthenticated) {
    next();
  } else {
    const url = req.originalUrl || req.url || '/';
    const isAuthRoute = /^\/account(\/|$)/i.test(url);
    if (!isAuthRoute) {
    req.session.retUrl = url;
  }
    return res.redirect('/account/signin'); 
  }
}


export function checkAdmin(req, res, next){
    if (req.session.isAuthenticated && req.session.authUser.role === 0){
        next();
    } else {
        res.render('vwAccount/403')
    }
}
export function checkInstructor(req, res, next){
    if (req.session.isAuthenticated && req.session.authUser.role === 2 || req.session.authUser.role === 0){
        next();
    } else {
        res.render('vwAccount/403') 
    }
}
export function checkUser(req, res, next){
    if (req.session.isAuthenticated && req.session.authUser.role === 1 || eq.session.authUser.role === 2){
        next();
    } else {
        res.render('vwAccount/403') 
    }
}