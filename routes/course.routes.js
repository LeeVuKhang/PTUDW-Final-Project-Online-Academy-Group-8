import express from "express";
import db from "../utils/db.js";
import { checkAuthenticated } from "../models/auth.model.js";
import userModel from "../models/user.model.js";
import * as courseModel from "../models/course.model.js";
import categoryModel from '../models/category.model.js';

const router = express.Router();
const pageLimit = 8;

/*Trang danh sách tất cả khóa học*/
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * pageLimit;
    const student_id = req.session.isAuthenticated ? req.session.authUser.user_id : null;

    const [courses, totalResult] = await Promise.all([
      courseModel.findCoursesByFilter('all', student_id, pageLimit, offset),
      courseModel.countCoursesByFilter('all')
    ]);

    const total = totalResult.amount;
    const nPages = Math.ceil(total / pageLimit);

    const page_numbers = [];
    for (let i = 1; i <= nPages; i++) {
      page_numbers.push({ value: i, isCurrent: i === page });
    }

    res.render("vwCourses/byCat", {
      layout: "main",
      courses,
      catname: "Tất cả khóa học",
      page_numbers,
    });
  } catch (error) {
    console.error("Lỗi trang /course:", error);
    res.status(500).send("Lỗi máy chủ");
  }
});

/*Danh sách khóa học theo danh mục*/
router.get("/byCat", async (req, res) => {
  try {
    const catid = parseInt(req.query.id) || 0; // Ép kiểu rõ ràng
    const page = parseInt(req.query.page) || 1;
    const sort = req.query.sort || 'newest';
    const offset = (page - 1) * pageLimit;
    const student_id = req.session.isAuthenticated ? req.session.authUser.user_id : null;

    // Kiểm tra danh mục
    const category = catid ? await categoryModel.findById(catid) : null;
    const catname = category ? category.cat_name : "Tất cả khóa học";

    const childCategories = category ? await categoryModel.findChildren(catid) : [];

    const [courses, totalResult] = await Promise.all([
      courseModel.findCoursesByFilter(catid, student_id, pageLimit, offset, sort),
      courseModel.countCoursesByFilter(catid)
    ]);

    const total = totalResult.amount || 0;
    const nPages = Math.ceil(total / pageLimit);

    const page_numbers = [];
    for (let i = 1; i <= nPages; i++) {
      page_numbers.push({
        value: i,
        catid,
        sort,
        isCurrent: i === page
      });
    }

    res.render("vwCourses/byCat", {
      layout: "main",
      courses,
      catname,
      page_numbers,
      childCategories,
      sort,
      catid,
    });
  } catch (error) {
    console.error("Lỗi trang byCat:", error);
    res.status(500).send("Lỗi máy chủ");
  }
});


router.get("/instructorProfile", async (req, res) => {
  try {
    const instructor_id = req.query.id;
    if (!instructor_id) {
      return res.redirect('/');
    }

    const instructor = await userModel.findById(instructor_id);

    if (!instructor || instructor.role !== 2) {
      return res.status(404).send("Không tìm thấy giảng viên này.");
    }

    const courses = await db("courses").where("instructor_id", instructor_id);

    res.render("vwCourses/instructorProfile", {
      layout: "main",
      instructor,
      courses
    });

  } catch (error) {
    console.error("Lỗi trang instructorProfile:", error);
    res.status(500).send("Lỗi máy chủ");
  }
});
/*Chi tiết khóa học*/
router.get("/details/:id", async (req, res) => {
  const course_id = req.params.id;
  const course = await db("courses").where("course_id", course_id).first();
  if (!course) return res.render("vwCourses/not-found", { layout: "main" });

  const lessons = await db("lessons")
    .join("chapters", "lessons.chapter_id", "chapters.chapter_id")
    .where("chapters.course_id", course_id)
    .select("lessons.*")
    .orderBy("lessons.order_index");

  let isEnrolled = false;
  if (req.session.isAuthenticated) {
    const enrollment = await db("enrollments")
      .where({ student_id: req.session.authUser.user_id, course_id })
      .first();
    isEnrolled = !!enrollment;
  }

  const ratings = await db("ratings")
    .join("users", "ratings.student_id", "users.user_id")
    .where("course_id", course_id)
    .select("users.name", "ratings.value", "ratings.comment");

    const chapters = await db("chapters")
        .where({ course_id })
        .orderBy("order_index");

    for (const chapter of chapters) {
        chapter.lessons = await db("lessons")
            .where({ chapter_id: chapter.chapter_id })
            .orderBy("order_index");
    }


  res.render("vwCourses/course_detail", {
    layout: "main",
    course,
    lessons,
    isEnrolled,
    ratings,
    chapters
  });
});

/*Ghi danh khóa học*/
router.get("/enroll/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;

  const exists = await db("enrollments").where({ course_id, student_id }).first();
  if (!exists) {
    await db("enrollments").insert({
      student_id,
      course_id,
      erm_date: new Date(),
      progress: 0,
      status: "enrolled",
    });
  }

  res.redirect(`/course/learn/${course_id}`);
});

/*Trang học khóa học*/
// 1️⃣ Khi không có lesson_id (xem bài đầu tiên)
router.get("/learn/:course_id", checkAuthenticated, async (req, res) => {
  const { course_id } = req.params;
  res.redirect(`/course/learn/${course_id}/first`);
});

// 2️⃣ Khi có lesson cụ thể
router.get("/learn/:course_id/:lesson_id", checkAuthenticated, async (req, res) => {
  const { course_id, lesson_id } = req.params;
  const student_id = req.session.authUser.user_id;

  const enrolled = await db("enrollments")
    .where({ student_id, course_id, status: "enrolled" })
    .first();
  if (!enrolled) return res.redirect(`/course/details/${course_id}`);

  const course = await db("courses").where({ course_id }).first();
  const chapters = await db("chapters")
  .where({ course_id })
  .orderBy("order_index", "asc");


  for (const chapter of chapters) {
    chapter.lessons = await db("lessons")
      .where({ chapter_id: chapter.chapter_id })
      .orderBy("order_index");
  }

  let currentLesson;
  if (lesson_id === "first") {
    currentLesson = chapters[0]?.lessons?.[0];
  } else {
    currentLesson = await db("lessons").where({ lesson_id }).first();
  }

  res.render("vwCourses/learn", {
    layout: "main",
    course,
    chapters,
    currentLesson,
    course_id,
  });
});

/*Đánh giá khóa học*/
router.post("/rate/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;
  const { value, comment } = req.body;

  const enrolled = await db("enrollments").where({ course_id, student_id }).first();
  if (!enrolled) return res.redirect(`/course/details/${course_id}`);

  await db("ratings").insert({ course_id, student_id, value, comment, create_time: new Date() });
  res.redirect(`/course/details/${course_id}`);
});

/*Mua ngay → chuyển đến checkout*/
router.get("/buy-now/:id", checkAuthenticated, (req, res) => {
  const course_id = req.params.id;
  res.redirect(`/course/checkout/${course_id}`);
});

/*Trang thanh toán*/
router.get("/checkout/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const course = await db("courses").where("course_id", course_id).first();
  if (!course) return res.render("vwCourses/not-found", { layout: "main" });
  res.render("vwCourses/checkout", { layout: "main", course });
});

/*Xử lý thanh toán*/
router.post("/checkout/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;

  const exists = await db("enrollments").where({ course_id, student_id }).first();
  if (!exists) {
    await db("enrollments").insert({
      student_id,
      course_id,
      erm_date: new Date(),
      progress: 0,
      status: "enrolled",
    });
  }
  await db("cart_items").where({ course_id, student_id }).delete();
  res.redirect(`/course/my-courses`);
});

/*Thêm vào giỏ hàng*/
router.post("/add-to-cart/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;

  try {
    const exists = await db("cart_items").where({ student_id, course_id }).first();

    if (exists) {
      return res.json({
        status: 'exists',
        message: 'Khóa học này đã có trong giỏ hàng của bạn.'
      });
    }

    await db("cart_items").insert({
      student_id,
      course_id,
      quantity: 1,
      added_at: new Date(),
    });

    return res.json({
      status: 'added',
      message: 'Đã thêm vào giỏ hàng thành công!'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi thêm vào giỏ hàng!'
    });
  }
});


/*Xem giỏ hàng*/
router.get("/cart", checkAuthenticated, async (req, res) => {
  const student_id = req.session.authUser.user_id;

  const items = await db("cart_items")
    .join("courses", "cart_items.course_id", "courses.course_id")
    .where("cart_items.student_id", student_id)
    .select("cart_items.*", "courses.title", "courses.discount_price", "courses.image_url");

  res.render("vwCourses/cart", { layout: "main", items });
});

/*Xóa khóa học khỏi giỏ hàng*/
router.post("/cart/remove/:id", checkAuthenticated, async (req, res) => {
  const cart_item_id = req.params.id;
  const student_id = req.session.authUser.user_id;
  await db("cart_items").where({ cart_item_id, student_id }).delete();
  res.redirect("/course/cart");
});

/*Thanh toán tất cả khóa học trong giỏ*/
router.post("/cart/checkout", checkAuthenticated, async (req, res) => {
  const student_id = req.session.authUser.user_id;
  const items = await db("cart_items").where({ student_id });

  for (const item of items) {
    const exists = await db("enrollments").where({ student_id, course_id: item.course_id }).first();
    if (!exists) {
      await db("enrollments").insert({ student_id, course_id: item.course_id, erm_date: new Date(), progress: 0, status: "enrolled" });
    }
    await db("cart_items").where({ cart_item_id: item.cart_item_id }).delete();
  }

  res.redirect("/course/my-courses");
});

/*Thanh toán riêng một khóa học trong giỏ hàng*/
router.post("/cart/checkout/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;

  try {
    // Kiểm tra xem đã mua chưa
    const exists = await db("enrollments")
      .where({ course_id, student_id })
      .first();

    if (!exists) {
      await db("enrollments").insert({
        student_id,
        course_id,
        erm_date: new Date(),
        progress: 0,
        status: "enrolled",
      });
    }

    // Xóa khỏi giỏ hàng sau khi thanh toán
    await db("cart_items").where({ course_id, student_id }).delete();

    res.redirect("/my-courses");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi thanh toán khóa học!");
  }
});


/*Trang liệt kê tất cả khóa học đã mua*/
router.get("/my-courses", checkAuthenticated, async (req, res) => {
  const student_id = req.session.authUser.user_id;

  const courses = await db("enrollments")
    .join("courses", "enrollments.course_id", "courses.course_id")
    .where("enrollments.student_id", student_id)
    .select("courses.course_id", "courses.title", "courses.discount_price", "courses.image_url", "enrollments.progress");

  res.render("vwCourses/myCourses", { layout: "main", courses });
});
/*Xóa khóa học đã ghi danh*/
router.post("/my-courses/remove/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;

  await db("enrollments")
    .where({ course_id, student_id })
    .delete();

  return res.redirect(req.headers.referer);
});

router.get("/instructorProfile", async (req, res) => {
  try {
    const instructor_id = req.query.id;
    if (!instructor_id) {
      return res.redirect('/');
    }

    const instructor = await userModel.findById(instructor_id);

    if (!instructor || instructor.role !== 2) {
      return res.status(404).send("Không tìm thấy giảng viên này.");
    }

    const courses = await db("courses").where("instructor_id", instructor_id);

    res.render("vwCourses/instructorProfile", {
      layout: "main",
      instructor,
      courses
    });

  } catch (error) {
    console.error("Lỗi trang instructorProfile:", error);
    res.status(500).send("Lỗi máy chủ");
  }
});

router.get('/search', async function (req, res) {
  try {
    const q = req.query.q || '';
    if (q.trim().length === 0) {
      return res.render('vwCourses/search', {
        q,
        empty: true,
      });
    }

    const keywords = q.replace(/ /g, ' & ');

    // Lấy trang hiện tại
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * pageLimit;

    // Gọi DB song song (dữ liệu + tổng số dòng)
    const [courses, totalResult] = await Promise.all([
      courseModel.search(keywords, pageLimit, offset),
      courseModel.countSearch(keywords)
    ]);

    const total = totalResult.amount;
    const nPages = Math.ceil(total / pageLimit);

    const page_numbers = [];
    for (let i = 1; i <= nPages; i++) {
      page_numbers.push({
        value: i,
        isCurrent: i === page,
        q
      });
    }

    res.render('vwCourses/search', {
      layout: 'main',
      q,
      courses,
      empty: courses.length === 0,
      page_numbers,
    });

  } catch (error) {
    console.error('Lỗi trang search:', error);
    res.status(500).send('Lỗi máy chủ');
  }
});

export default router;
