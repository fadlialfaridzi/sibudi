exports.requireLogin = (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    next();
  };
  
  exports.requireRole = (role) => {
    return (req, res, next) => {
      if (!req.session.user || req.session.user.role !== role) {
        return res.status(403).render('error', {
          message: 'Anda tidak memiliki akses ke halaman ini.',
        });
      }
      next();
    };
  };
  