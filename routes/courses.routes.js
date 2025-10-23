import express from "express";
import db from "../utils/db.js";
import { checkAuthenticated } from "../models/auth.model.js";

const router = express.Router();

/** 🏠 0️⃣ Trang danh sách tất cả khóa học */
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 8;
  const offset = (page - 1) * limit;

  const courses = await db("courses").limit(limit).offset(offset);
  const total = await db("courses").count("* as amount").first();
  const nPages = Math.ceil(total.amount / limit);

  const page_numbers = [];
  for (let i = 1; i <= nPages; i++) {
    page_numbers.push({
      value: i,
      isCurrent: i === page,
    });
  }

  res.render("vwCourses/byCat", {
    layout: "main",
    courses,
    catname: "Tất cả khóa học",
    page_numbers,
  });
});

/** 🏫 1️⃣ Danh sách khóa học theo danh mục */
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
    page_numbers.push({
      value: i,
      catid,
      isCurrent: i === page,
    });
  }

  res.render("vwCourses/byCat", {
    layout: "main",
    courses,
    catname,
    page_numbers,
  });
});

/** 📘 2️⃣ Chi tiết khóa học */
router.get("/details/:id", async (req, res) => {
  const course_id = req.params.id;
  const course = await db("courses").where("course_id", course_id).first();

  if (!course) return res.render("vwCourses/not-found", { layout: "main" });

  const lessons = await db("lessons")
    .where("course_id", course_id)
    .orderBy("order_index");

  let isEnrolled = false;
  if (req.session.isAuthenticated) {
    const enrollment = await db("enrollments")
      .where({
        student_id: req.session.authUser.user_id,
        course_id,
      })
      .first();
    isEnrolled = !!enrollment;
  }

  // Lấy đánh giá
  const ratings = await db("ratings")
    .join("users", "ratings.student_id", "users.user_id")
    .where("course_id", course_id)
    .select("users.name", "ratings.value", "ratings.comment");

  res.render("vwCourses/details", {
    layout: "main",
    course,
    lessons,
    isEnrolled,
    ratings,
  });
});

/** 🧾 3️⃣ Ghi danh khóa học */
router.get("/enroll/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;

  // Check if already enrolled
  const exists = await db("enrollments")
    .where({ course_id, student_id })
    .first();

  if (!exists) {
    await db("enrollments").insert({
      student_id,
      course_id,
      erm_date: new Date(),
      progress: 0,
      status: "enrolled"
    });
  }

  res.redirect(`/courses/learn/${course_id}`);
});


/** 🎥 4️⃣ Học bài (video) */
router.get("/learn/:course_id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.course_id;
  const student_id = req.session.authUser.user_id;

  // Check enrollment
  const enrolled = await db("enrollments")
    .where({ 
      student_id,
      course_id,
      status: 'enrolled'
    })
    .first();

  if (!enrolled) return res.redirect(`/courses/details/${course_id}`);

  // Get course info
  const course = await db("courses")
    .where({ course_id })
    .first();

  // Get all lessons
  const lessons = await db("lessons")
    .where({ course_id })
    .orderBy("order_index");

  // Get current lesson (last watched or first)
  const currentLesson = enrolled.last_watched_lesson 
    ? await db("lessons")
        .where({ lesson_id: enrolled.last_watched_lesson })
        .first()
    : lessons[0];

  res.render("vwCourses/learn", {
    layout: "main",
    course,
    currentLesson,
    lessons,
    course_id
  });
});

/** 📊 Track lesson progress */
router.post("/progress", checkAuthenticated, async (req, res) => {
  const { course_id, lesson_id, progress } = req.body;
  const student_id = req.session.authUser.user_id;

  // Update enrollment progress and last watched lesson
  await db("enrollments")
    .where({ 
      student_id,
      course_id 
    })
    .update({
      progress: progress,
      last_watched_lesson: lesson_id
    });

  res.json({ success: true });
});

/** ⭐ 5️⃣ Đánh giá khóa học */
router.post("/rate/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;
  const { value, comment } = req.body;

  const enrolled = await db("enrollments")
    .where({ course_id, student_id })
    .first();

  if (!enrolled) {
    return res.redirect(`/courses/details/${course_id}`);
  }

  // Thêm đánh giá mới, không update đánh giá cũ
  await db("ratings").insert({ 
    course_id, 
    student_id, 
    value, 
    comment,
    create_time: new Date() 
  });

  res.redirect(`/courses/details/${course_id}`);
});


export default router;
