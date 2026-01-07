import 'dotenv/config';

import express from 'express';
import { engine } from 'express-handlebars';
import hbs_sections from 'express-handlebars-sections';
import cookieParser from 'cookie-parser';
import moment from 'moment';
import Handlebars from 'handlebars';

import categoryModel from './models/category.model.js';
import courseModel from './models/course.model.js';
import { checkAdmin, authenticateJWT, optionalAuth, checkInstructor } from './models/auth.model.js';
import { verifyAccessToken } from './utils/jwt.util.js';
import ratingModel from './models/rating.model.js';


import courseRouter from './routes/course.routes.js';
import accountRouter from './routes/account.routes.js';
import categoryRouter from './routes/category.routes.js';
import instructorRouter from './routes/instructor.routes.js';
import adminCourseRouter from './routes/admin-course.routes.js';
import adminUserRouter from './routes/admin-user.routes.js';
import adminRouter from './routes/admin.routes.js';



const __dirname = import.meta.dirname;
const app = express();

// Cấu hình cookie parser (JWT authentication)
app.use(cookieParser());

// Thiết lập handlebars
app.engine('handlebars', engine({
  helpers: {
    section: hbs_sections(),
    fill_section: hbs_sections(),

    extractYouTubeId(url) {
      if (!url) return '';
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&]+)/);
      return match ? match[1] : '';
    },
    isYouTubeUrl(url) {
      if (typeof url !== 'string' || url.trim() === '') {
        return false;
      }
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
      return youtubeRegex.test(url);
    },
    // Định dạng tiền tệ VND
    formatNumber(num) {
      if (typeof num !== 'number') num = parseFloat(num);
      if (isNaN(num)) return '₫0';
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    },

    eq(a, b) {
      return a === b;
    },
    ne(a, b) {
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
    range(start, end) {
      const s = Number(start), e = Number(end);
      const out = [];
      for (let i = s; i <= e; i++) out.push(i);
      return out;
    },
    lteq(a, b) {
      return a >= b;
    },
    lt(a, b) {
      return a < b;
    },
    gt(a, b) {
      return a > b;
    },
    add(a, b) {
      return Number(a) + Number(b);
    },
    subtract(a, b) {
      return Number(a) - Number(b);
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
    },

    lte(a, b) {
      return a <= b;
    },
    array(...args) {
      return args.slice(0, -1);
    },
    minus(a, b) {
      return a - b;
    },
  },
  allowProtoPropertiesByDefault: true,
  allowProtoMethodsByDefault: true
}));

// Middleware gán JWT user vào res.locals (cho Handlebars templates)
app.use((req, res, next) => {
  const token = req.cookies.accessToken;
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      res.locals.isAuthenticated = true;
      res.locals.authUser = decoded;
    } catch (err) {
      // Token invalid hoặc expired - tiếp tục như guest
      res.locals.isAuthenticated = false;
      res.locals.authUser = null;
    }
  } else {
    res.locals.isAuthenticated = false;
    res.locals.authUser = null;
  }
  res.locals.currentUrl = req.originalUrl;
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
app.get('/', optionalAuth, async (req, res) => {
  if (req.user) {
    console.log('User is authenticated');
    console.log(req.user)
  }
  const student_id = req.user ? req.user.user_id : null;
  const newestCourses = chunkArray(await courseModel.findNewestCourses(12, student_id), 4);
  const mostViewsCourses = chunkArray(await courseModel.findMostViewsCourses(12, student_id), 4);
  const impressiveCourses = await courseModel.findImpressiveCoursesLastWeek(4, student_id);
  const parents = await categoryModel.findParents();
  const rating = await ratingModel.findTop3RecentFiveStarCourses();
  const topCate = await categoryModel.findTopCategoriesOfWeek(5);
  // Thêm mảng stars để Handlebars each
  rating.forEach(r => {
    r.stars = Array.from({ length: r.value });
  });

  // Lấy children cho mỗi parent
  for (const parent of parents) {
    parent.children = await categoryModel.findChildren(parent.cat_id);
  }

  res.render('home', {
    newestCourses,
    mostViewsCourses,
    parents,
    rating,
    impressiveCourses,
    topCate,
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


// Gắn các router
app.use('/account', accountRouter);
app.use('/admin/categories', authenticateJWT, checkAdmin, categoryRouter);
app.use('/instructor', authenticateJWT, checkInstructor, instructorRouter);
app.use('/course', courseRouter);
app.use('/admin/courses', authenticateJWT, checkAdmin, adminCourseRouter);
app.use('/admin/users', authenticateJWT, checkAdmin, adminUserRouter);
app.use('/admin', authenticateJWT, checkAdmin, adminRouter);

// Khởi động server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server is listening on ${HOST}:${PORT}`);
});
