import express from 'express';
import { engine } from 'express-handlebars';
import hbs_sections from 'express-handlebars-sections';
import session from 'express-session';
import moment from 'moment';
import Handlebars from 'handlebars';

import categoryModel from './models/category.model.js';
import * as courseModel from './models/course.model.js';
import { checkAdmin, checkAuthenticated } from './models/auth.model.js';

import courseRouter from './routes/course.routes.js';
import accountRouter from './routes/account.routes.js';
import categoryRouter from './routes/category.routes.js';
import productRouter from './routes/product.routes.js';
import instructorRouter from './routes/instructor.routes.js';
import adminCourseRouter from './routes/admin-course.routes.js';
import adminUserRouter from './routes/admin-user.routes.js';
import adminRouter from './routes/admin.routes.js';

const __dirname = import.meta.dirname;
const app = express();

// Cấu hình session
app.set('trust proxy', 1);
app.use(session({
  secret: 'skibidiahjdwadlwadluiasigma',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Thiết lập handlebars
app.engine('handlebars', engine({
  helpers: {
    section: hbs_sections(),
    fill_section: hbs_sections(),

    // Định dạng tiền tệ VND
    formatNumber(num) {
      if (typeof num !== 'number') num = parseFloat(num);
      if (isNaN(num)) return '₫0';
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    },

    eq(a, b) {
      return a === b;
    },
    ne(a,b ){
      return a !== b;
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

    // Hiển thị sao (rating)
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

      return new Handlebars.SafeString(stars);
    },

    // Hàm bổ sung từ bản GitHub
    substr(str, start, len) {
      if (!str) return '';
      return str.substring(start, start + len).toUpperCase();
    },

    // Định dạng rating (số thập phân)
    formatRating(rating) {
      const num = parseFloat(rating);
      if (isNaN(num)) return '0.0';
      return num.toFixed(1);
    },

    // Chuyển đổi object thành JSON string
    json(obj) {
      return JSON.stringify(obj);
    },

    moment(date, format) {
      if (!date) return '';
      if (format === 'fromNow') return moment(date).fromNow();
      return moment(date).format(format);
    },

    // Giúp chọn option trong select
    selectOption(selectedValue, optionValue) {
      return String(selectedValue) === String(optionValue) ? 'selected' : '';
    },

    // Tạo link phân trang
    createPaginationLink(page, queryParams) {
      const params = new URLSearchParams(queryParams);
      params.set('page', page);
      return '?' + params.toString();
    }
  },
  allowProtoPropertiesByDefault: true,
  allowProtoMethodsByDefault: true
}));

// Middleware gán session vào res.locals
app.use((req, res, next) => {
  if (req.session.isAuthenticated) {
    res.locals.isAuthenticated = true;
    res.locals.authUser = req.session.authUser;
  }
  next();
});

// Cấu hình Express
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'handlebars');
app.set('views', './views');
app.use('/static', express.static('static'));

// Chia mảng thành nhóm (cho giao diện home)
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// Trang chủ – hiển thị dữ liệu thật từ courseModel
app.get('/', async (req, res) => {
    if (req.session.isAuthenticated) {
        console.log('User is authenticated');
        console.log(req.session.authUser)
    }
    const newestCourses = chunkArray(await courseModel.findNewestCourses(), 4)
    const mostViewsCourses = chunkArray(await courseModel.findMostViewsCourses(), 4)
    const parents = await categoryModel.findParents();

    // Lấy children cho mỗi parent
    for (const parent of parents) {
      parent.children = await categoryModel.findChildren(parent.cat_id);
    }

    res.render('home', {
        newestCourses,
        mostViewsCourses,
        parents,
    });
});

app.use(async (req, res, next) => {
  const parents = await categoryModel.findParents();

    // Lấy children cho mỗi parent
    for (const parent of parents) {
      parent.children = await categoryModel.findChildren(parent.cat_id);
    }
  res.locals.parents = parents;
  next();
});

import accountRouter from './routes/account.routes.js';
app.use('/account', accountRouter);


// Gắn các router
app.use('/account', accountRouter);
app.use('/admin/categories', checkAuthenticated, checkAdmin, categoryRouter);
app.use('/product', productRouter);
app.use('/instructor', instructorRouter);
app.use('/course', courseRouter);
app.use('/admin/courses', checkAuthenticated, checkAdmin, adminCourseRouter);
app.use('/admin/users', checkAuthenticated, checkAdmin, adminUserRouter);
app.use('/admin', checkAuthenticated, checkAdmin, adminRouter);

// Khởi động server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
