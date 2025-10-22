//console.log("Hello, World! This is my first Node.js app.");
import express from 'express';
import { engine } from 'express-handlebars';
import hbs_sections from 'express-handlebars-sections';
import categoryModel from './models/category.model.js';
import session from 'express-session';
import { checkAdmin, checkAuthenticated } from './models/auth.model.js';

const __dirname = import.meta.dirname;
const app = express();

app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'skibidiahjdwadlwadluiasigma',
  resave: false,
  saveUninitialized: true,  
  cookie: { secure: false }
}))


app.engine('handlebars', engine({
    helpers: {
        fill_section: hbs_sections(),
        formatNumber(num) {
            return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
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
        isGreater (a, b, options) { 
            if (a > b) {
                return options.fn(this); 
            }
            return options.inverse(this); 
        },
        calculateDiscount (original, current) {
            if (original <= current) return 0;
            const discount = ((original - current) / original) * 100;
            return Math.round(discount);
        },
        truncate (str, len) {
            if (str.length > len && str.length > 0) {
                let new_str = str.substr(0, len);
                new_str = str.substr(0, new_str.lastIndexOf(" "));
                new_str = (new_str.length > 0) ? new_str : str.substr(0, len);
                return new_str + '...';
            }
            return str;
        },
        renderStars: function(rating) {
            rating = parseFloat(rating);
            if (isNaN(rating) || rating < 0) return '';
            let stars = '';
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
            for (let i = 0; i < fullStars; i++) {
                stars += '<i class="fas fa-star"></i>'; // Font Awesome full star
            }
            if (halfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>'; // Font Awesome half star
            }
            for (let i = 0; i < emptyStars; i++) {
                stars += '<i class="far fa-star"></i>'; // Font Awesome empty star (regular style)
            }
            return stars;
        },
        selectOption (selectedValue, optionValue) {
            return String(selectedValue) === String(optionValue) ? 'selected' : '';
        }
    }
}));

//lấy danh mục bỏ vào chỗ dùng chung để mọi file đều dùng được

app.use(function(req, res, next) {
    if (req.session.isAuthenticated){
        res.locals.isAuthenticated = true;
        res.locals.authUser = req.session.authUser;
    }
    next();
});

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'handlebars');
app.set('views', './views');

app.get('/home', (req, res) => {
    res.render('home');
});

app.use("/static", express.static('static'));
//note / tunng tab
app.get('/', (req, res) => {
    if (req.session.isAuthenticated){
        console.log('User is authenticated');
        console.log(req.session.authUser)
    }
    res.render('home');
});

app.get('/about-my-team', (req, res) => {
    //2 ways to send file
    res.sendFile(__dirname + '/about-my-team.html');
    //res.sendFile('about.html', { root: '.' });
});
app.get('/about-lvk', (req, res) => {
    res.sendFile(__dirname + '/about-lvk.html');
});
app.get('/about-vhn', (req, res) => {
    res.sendFile(__dirname + '/about-vhn.html');
});
app.get('/about-tpd', (req, res) => {
    res.sendFile(__dirname + '/about-tpd.html');
});
app.get('/about-nngn', (req, res) => {
    res.sendFile(__dirname + '/about-nngn.html');
});
app.get('/about-ntc', (req, res) => {
    res.sendFile(__dirname + '/about-ntc.html');
});
app.get('/about-nhhl', (req, res) => {
    res.sendFile(__dirname + '/about-nhhl.html');
});

//signup

import accountRouter from './routes/account.routes.js';
app.use('/account', accountRouter);


import categoryRouter from './routes/category.routes.js';
app.use('/admin/categories', checkAuthenticated, checkAdmin, categoryRouter);

import productRouter from './routes/product.routes.js';
app.use('/products', productRouter);

import instructorRouter from './routes/instructor.routes.js'
app.use('/instructor', instructorRouter)

//lenh cuoi cung
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

