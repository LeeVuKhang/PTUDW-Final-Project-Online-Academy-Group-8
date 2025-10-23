// console.log("Hello, World! This is my first Node.js app.");
import express from 'express';
import { engine } from 'express-handlebars';
import hbs_sections from 'express-handlebars-sections';
import session from 'express-session';
import moment from 'moment';
import Handlebars from 'handlebars'; // ✅ THÊM DÒNG NÀY

import categoryModel from './models/category.model.js';
import { checkAdmin, checkAuthenticated } from './models/auth.model.js';

import courseRouter from './routes/courses.routes.js';
import accountRouter from './routes/account.routes.js';
import categoryRouter from './routes/category.routes.js';
import productRouter from './routes/product.routes.js';
import instructorRouter from './routes/instructor.routes.js';

const __dirname = import.meta.dirname;
const app = express();

app.set('trust proxy', 1);
app.use(session({
  secret: 'skibidiahjdwadlwadluiasigma',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.engine('handlebars', engine({
  helpers: {
    section: hbs_sections(),
    fill_section: hbs_sections(),
    formatNumber(num) {
      if (typeof num !== 'number') num = parseFloat(num);
      if (isNaN(num)) return '$0.00';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    },
    eq(a, b) {
      return a === b;
    },
    formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().split('T')[0];
    },
    isGreater(a, b) {
      return a > b;
    },
    calculateDiscount(original, current) {
      if (original <= current) return 0;
      const discount = ((original - current) / original) * 100;
      return Math.round(discount);
    },
    truncate(str, len) {
      if (!str) return '';
      if (str.length > len && str.length > 0) {
        let new_str = str.substr(0, len);
        new_str = str.substr(0, new_str.lastIndexOf(" "));
        new_str = (new_str.length > 0) ? new_str : str.substr(0, len);
        return new_str + '...';
      }
      return str;
    },
    renderStars(rating) {
      rating = parseFloat(rating);
      if (isNaN(rating) || rating < 0) return '';
      let stars = '';
      const fullStars = Math.floor(rating);
      const halfStar = rating % 1 >= 0.5;
      const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

      for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-warning"></i>';
      if (halfStar) stars += '<i class="fas fa-star-half-alt text-warning"></i>';
      for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star text-warning"></i>';

      // ✅ SỬA Ở ĐÂY: Handlebars.SafeString để render HTML an toàn
      return new Handlebars.SafeString(stars);
    },
    substr(str, start, len) {
      if (!str) return '';
      return str.substring(start, start + len).toUpperCase();
    },
    moment(date, format) {
      if (!date) return '';
      if (format === 'fromNow') {
        return moment(date).fromNow();
      }
      return moment(date).format(format);
    }
  },
  allowProtoPropertiesByDefault: true,
  allowProtoMethodsByDefault: true
}));

app.use(function (req, res, next) {
  if (req.session.isAuthenticated) {
    res.locals.isAuthenticated = true;
    res.locals.authUser = req.session.authUser;
  }
  next();
});

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'handlebars');
app.set('views', './views');
app.use("/static", express.static('static'));

app.get('/', (req, res) => {
  if (req.session.isAuthenticated) {
    console.log('User is authenticated');
    console.log(req.session.authUser);
  }
  res.render('home');
});

app.get('/home', (req, res) => res.render('home'));

app.get('/about-my-team', (req, res) => res.sendFile(__dirname + '/about-my-team.html'));
app.get('/about-lvk', (req, res) => res.sendFile(__dirname + '/about-lvk.html'));
app.get('/about-vhn', (req, res) => res.sendFile(__dirname + '/about-vhn.html'));
app.get('/about-tpd', (req, res) => res.sendFile(__dirname + '/about-tpd.html'));
app.get('/about-nngn', (req, res) => res.sendFile(__dirname + '/about-nngn.html'));
app.get('/about-ntc', (req, res) => res.sendFile(__dirname + '/about-ntc.html'));
app.get('/about-nhhl', (req, res) => res.sendFile(__dirname + '/about-nhhl.html'));

app.use('/account', accountRouter);
app.use('/admin/categories', checkAuthenticated, checkAdmin, categoryRouter);
app.use('/products', productRouter);
app.use('/instructor', instructorRouter);
app.use('/courses', courseRouter);

app.listen(3000, () => {
  console.log('✅ Server is running on http://localhost:3000');
});
