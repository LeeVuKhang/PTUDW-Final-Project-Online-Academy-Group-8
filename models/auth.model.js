export function checkAuthenticated(req, res, next) {
  if (req.session.isAuthenticated) {
    next();
  } else {
    req.session.reUrl = req.originalUrl;
    return res.redirect('/account/signin'); // ✅ redirect đúng đến trang đăng nhập
  }
}


export function checkAdmin(req, res, next){
    if (req.session.isAuthenticated && req.session.authUser.role === 0){
        next();
    } else {
        res.render('vwAccount/403')
    }
}