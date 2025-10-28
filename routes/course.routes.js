import express from "express";
import db from "../utils/db.js";
import { checkAuthenticated } from "../models/auth.model.js";
import userModel from "../models/user.model.js";
import courseModel from "../models/course.model.js";
import categoryModel from '../models/category.model.js';
import instructorModel from '../models/instructor.models.js';

const formatNumber = (num) => {
    if (typeof num === 'number' && num > 0) {
        return num.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
    }
    return 'Miễn phí'; 
};


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
        const instructorId = req.query.id;

        if (!instructorId) {
            return res.redirect('/');
        }

        const [profile, stats, courses] = await Promise.all([
            instructorModel.findProfileById(instructorId), 
            instructorModel.getInstructorStats(instructorId),
            instructorModel.findCoursesByInstructor(instructorId) 
        ]);

        if (!profile || profile.role !== 2) { 
            return res.status(404).send("Không tìm thấy giảng viên hợp lệ này.");
        }

        const context = {
            layout: "main",
            instructor: {
                name: profile.name,
                email: profile.email,
                image_url: profile.image_url || '/static/avt1.png',
                bio: profile.bio || '',
                
                avg_rating: stats.avg_rating,
                total_reviews: stats.total_reviews.toLocaleString('en-US'), 
                total_students: stats.total_students.toLocaleString('en-US'),
                total_courses: stats.total_courses,
            },
            courses: courses.map(course => ({
                ...course,
                discount_price: course.discount_price, 
            }))
        };
        
        console.log("Context Giảng viên cuối cùng:", context.instructor); 
        res.render("vwCourses/instructorProfile", context);

    } catch (error) {
        console.error("Lỗi trang instructorProfile:", error);
        res.status(500).send("Lỗi máy chủ");
    }
});
/*Chi tiết khóa học*/
router.get("/details/:id", async (req, res) => {
 try {
    const course_id = req.params.id;
    const student_id = req.session.isAuthenticated ? req.session.authUser.user_id : null;

    const course = await courseModel.findByID(course_id);

    if (!course) return res.render("vwCourses/not-found", { layout: "main" });

    const details = await db("courses as c")
        .leftJoin('categories as cat', 'c.catid', 'cat.cat_id')
        .leftJoin('users as u', 'c.instructor_id', 'u.user_id')
        .leftJoin('ratings as r', 'c.course_id', 'r.course_id')
        .select(
            "cat.cat_name as category_name",
            "u.name as instructor_name", "u.user_id as instructor_id", 
            db.raw("COALESCE(AVG(r.value), 0) as rating"),
            db.raw("COUNT(DISTINCT r.rating_id) as total_reviews")
         )
        .where("c.course_id", course_id)
        .groupBy("cat.cat_name", "u.name", "u.user_id")
        .first();

    Object.assign(course, details); 

    const instructorPromise = instructorModel.findProfileById(course.instructor_id);
    const instructorStatsPromise = instructorModel.getInstructorStats(course.instructor_id);
    const chaptersPromise = db("chapters").where({ course_id }).orderBy("order_index");

    const ratingsPromise = db("ratings")
        .join("users", "ratings.student_id", "users.user_id")
        .where("course_id", course_id)
        .select("users.name", "ratings.value", "ratings.comment", "ratings.create_time")
        .orderBy("ratings.create_time", "desc");

    const relatedCoursesPromise = courseModel.findRelatedCourses(course.catid, course_id, 4, student_id);

    // --- Kiểm tra enrollment ---
    let isEnrolled = false;
    if (student_id) {
        const enrollment = await db("enrollments")
            .where({ student_id: student_id, course_id })
            .first();
        isEnrolled = !!enrollment;
    }

    const [instructorProfile, instructorStats, chapters, ratings, relatedCourses] = await Promise.all([
        instructorPromise,
        instructorStatsPromise,
        chaptersPromise,
        ratingsPromise,
        relatedCoursesPromise
    ]);

    for (const chapter of chapters) {
        chapter.lessons = await db("lessons")
            .where({ chapter_id: chapter.chapter_id })
            .orderBy("order_index");
    }

    const instructor = {
        ...instructorProfile, 
        avg_rating: instructorStats.avg_rating, 
        total_reviews: instructorStats.total_reviews,
        total_students: instructorStats.total_students,
        total_courses: instructorStats.total_courses,
    };


    res.render("vwCourses/course_detail", {
        layout: "main",
        course,
        isEnrolled,
        ratings,
        chapters,
        instructor,
        relatedCourses
    });
  } catch (error) {
     console.error("Error fetching course details:", error);
     res.status(500).send("Error loading course details.");
  }
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
/* Mở khóa học → tự động mở bài gần nhất */
router.get("/learn/:course_id", checkAuthenticated, async (req, res) => {
  try {
    const { course_id } = req.params;
    const student_id = req.session.authUser.user_id;

    // Kiểm tra học viên có ghi danh không
    const enrolled = await db("enrollments")
      .where({ student_id, course_id, status: "enrolled" })
      .first();

    if (!enrolled) return res.redirect(`/course/details/${course_id}`);

    // Nếu đã xem dở thì vào bài đó, ngược lại vào bài đầu tiên
    const lastLesson = enrolled.last_watched_lesson;
    if (lastLesson) {
      return res.redirect(`/course/learn/${course_id}/${lastLesson}`);
    }

    // Lấy bài đầu tiên
    const firstChapter = await db("chapters")
      .where({ course_id })
      .orderBy("order_index")
      .first();

    const firstLesson = await db("lessons")
      .where({ chapter_id: firstChapter.chapter_id })
      .orderBy("order_index")
      .first();

    if (firstLesson) {
      return res.redirect(`/course/learn/${course_id}/${firstLesson.lesson_id}`);
    }

    res.status(404).send("Không tìm thấy bài học nào trong khóa học này.");
  } catch (err) {
    console.error("Lỗi khi mở khóa học:", err);
    res.status(500).send("Lỗi máy chủ khi mở khóa học.");
  }
});


/* Học bài cụ thể */
router.get("/learn/:course_id/:lesson_id", checkAuthenticated, async (req, res) => {
  try {
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

    const currentLesson = await db("lessons").where({ lesson_id }).first();

    // --- Lấy đánh giá ---
    const ratings = await db("ratings")
      .join("users", "ratings.student_id", "users.user_id")
      .where("ratings.course_id", course_id)
      .select("users.name", "ratings.value", "ratings.comment", "ratings.create_time");

    const avgRatingResult = await db("ratings")
      .where({ course_id })
      .avg("value as avgRating")
      .count("value as totalRatings")
      .first();

    const avgRating = parseFloat(avgRatingResult.avgRating || 0).toFixed(1);
    const totalRatings = avgRatingResult.totalRatings || 0;

    const userRatingData = await db("ratings")
      .where({ course_id, student_id })
      .first();

    const userRating = userRatingData ? userRatingData.value : 0;
    const userComment = userRatingData ? userRatingData.comment : "";

    res.render("vwCourses/learn", {
      layout: "main",
      course,
      chapters,
      currentLesson,
      course_id,
      avgRating,
      totalRatings,
      ratings,
      isStudent: true,
      userRating,
      userComment,
    });
  } catch (err) {
    console.error("Lỗi khi load bài học:", err);
    res.status(500).send("Lỗi máy chủ khi tải bài học.");
  }
});



/* Cập nhật last_watched_lesson */
router.post("/update-last-watch", checkAuthenticated, async (req, res) => {
  try {
    const { course_id, lesson_id } = req.body;
    const student_id = req.session.authUser.user_id;

    if (!course_id || !lesson_id) {
        return res.status(400).json({ success: false, error: "Thiếu course_id hoặc lesson_id." });
    }
    const totalLessonsResult = await db("lessons as l")
      .join("chapters as ch", "l.chapter_id", "ch.chapter_id")
      .where("ch.course_id", course_id)
      .count("l.lesson_id as total");

    const totalLessons = parseInt(totalLessonsResult[0].total, 10);

    if (totalLessons === 0) {
       await db("enrollments")
         .where({ course_id, student_id })
         .update({ last_watched_lesson: lesson_id, progress: 0 }); 
       return res.json({ success: true, progress: 0 });
    }

    const orderedLessonResult = await db.raw(`
        WITH OrderedLessons AS (
            SELECT
                l.lesson_id,
                ROW_NUMBER() OVER (ORDER BY ch.order_index ASC, l.order_index ASC) as overall_index
            FROM lessons l
            JOIN chapters ch ON l.chapter_id = ch.chapter_id
            WHERE ch.course_id = ?
        )
        SELECT overall_index
        FROM OrderedLessons
        WHERE lesson_id = ?
    `, [course_id, lesson_id]);

    const watchedLessonIndex = orderedLessonResult.rows[0]?.overall_index;

    if (!watchedLessonIndex) {
         console.error(`Không tìm thấy index cho lesson_id ${lesson_id} trong course_id ${course_id}`);
         await db("enrollments")
            .where({ course_id, student_id })
            .update({ last_watched_lesson: lesson_id });
         return res.json({ success: true, progress: null }); 
    }
    let progress = Math.min(100, Math.round((watchedLessonIndex / totalLessons) * 100));

    await db("enrollments")
      .where({ course_id, student_id })
      .update({
        last_watched_lesson: lesson_id,
        progress: progress, 
      });

    console.log(`Updated progress for student ${student_id}, course ${course_id}: ${progress}% after watching lesson ${lesson_id}`);
    res.json({ success: true, progress: progress });

  } catch (err) {
    console.error("Lỗi cập nhật last_watched_lesson và progress:", err);
    res.status(500).json({ success: false, error: "Không thể cập nhật tiến độ học." });
  }
});


/*Đánh giá khóa học*/
router.post("/rate/:id", checkAuthenticated, async (req, res) => {
  const course_id = req.params.id;
  const student_id = req.session.authUser.user_id;
  const { value, comment } = req.body;

  try {
    const enrolled = await db("enrollments").where({ course_id, student_id }).first();
    if (!enrolled) return res.status(403).json({ error: "Bạn chưa ghi danh khóa học này." });

    const existing = await db("ratings").where({ course_id, student_id }).first();

    if (existing) {
      await db("ratings")
        .where({ course_id, student_id })
        .update({
          value,
          comment,
          create_time: new Date(),
        });
    } else {
      await db("ratings").insert({
        course_id,
        student_id,
        value,
        comment,
        create_time: new Date(),
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi khi đánh giá khóa học:", err);
    res.status(500).json({ error: "Không thể lưu đánh giá." });
  }
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
