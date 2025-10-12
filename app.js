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
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
        },
        eq(a, b) {return a === b;},
        formatDate(date) {
            if (!date) return '';
            const d = new Date(date);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); 
            return d.toISOString().split('T')[0];
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

