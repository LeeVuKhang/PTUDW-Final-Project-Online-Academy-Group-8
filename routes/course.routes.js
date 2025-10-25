import express from "express";
import db from "../utils/db.js";
import { checkAuthenticated } from "../models/auth.model.js";

const router = express.Router();

/*Trang danh sách tất cả khóa học*/
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 8;
  const offset = (page - 1) * limit;

  const courses = await db("courses").limit(limit).offset(offset);
  const total = await db("courses").count("* as amount").first();
  const nPages = Math.ceil(total.amount / limit);

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
});

/*Danh sách khóa học theo danh mục*/
router.get("/byCat", async (req, res) => {
  const catid = req.query.id || 0;
  const category = await db("categories").where("cat_id", catid).first();
  const catname = category ? category.cat_name : "Danh mục không tồn tại";

  const page = parseInt(req.query.page) || 1;
  const limit = 8;
  const offset = (page - 1) * limit;

  const courses = await db("courses").where("catid", catid).limit(limit).offset(offset);
  const total = await db("courses").where("catid", catid).count("* as amount").first();
  const nPages = Math.ceil(total.amount / limit);

  const page_numbers = [];
  for (let i = 1; i <= nPages; i++) {
    page_numbers.push({ value: i, catid, isCurrent: i === page });
  }

  res.render("vwCourses/byCat", { layout: "main", courses, catname, page_numbers });
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

  res.render("vwCourses/course_detail", {
    layout: "main",
    course,
    lessons,
    isEnrolled,
    ratings,
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
router.get("/learn/:course_id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.course_id;
  const student_id = req.session.authUser.user_id;

  const enrolled = await db("enrollments")
    .where({ student_id, course_id, status: "enrolled" })
    .first();
  if (!enrolled) return res.redirect(`/course/details/${course_id}`);

  const course = await db("courses").where({ course_id }).first();
  const lessons = await db("lessons")
    .join("chapters", "lessons.chapter_id", "chapters.chapter_id")
    .where("chapters.course_id", course_id)
    .select("lessons.*")
    .orderBy("lessons.order_index");

  const currentLesson = enrolled.last_watched_lesson
    ? await db("lessons").where({ lesson_id: enrolled.last_watched_lesson }).first()
    : lessons[0];

  res.render("vwCourses/learn", { layout: "main", course, currentLesson, lessons, course_id });
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
router.get("/add-to-cart/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;

  try {
    const exists = await db("cart_items").where({ student_id, course_id }).first();
    if (!exists) {
      await db("cart_items").insert({
        student_id,
        course_id,
        quantity: 1,
        added_at: new Date(),
      });
    }

    return res.redirect("/course/cart");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Lỗi thêm vào giỏ hàng!");
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

    res.redirect("/course/my-courses");
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

  res.redirect("/course/my-courses");
});

export default router;
