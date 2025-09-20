import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  })
);

app.use("/images", express.static("public/images"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./public/images");
  },
  filename: function (req, file, cb) {
    return cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage });

let blogData;

let newData;

app.post("/api/submitBlog", upload.single("image"), (req, res) => {
  const { title, subtitle, category, content, readingTime } = req.body;
  const imageFile = req.file; // uploaded file

  let data = fs.readFileSync("./blog.json", "utf8");
  blogData = JSON.parse(data);

  newData = {
    id: blogData.length + 1,
    title: title,
    subtitle: subtitle,
    category: category,
    content: content,
    readingTime: readingTime,
    imagePath: imageFile.filename,
  };

  blogData.push(newData);

  fs.writeFileSync("./blog.json", JSON.stringify(blogData, null, 2));
  res.status(201).json({
    message: "Blog post created successfully",
    blog: newData,
  });
});

app.get("/api/blogs", (req, res) => {
  let data = fs.readFileSync("./blog.json", "utf-8");
  data = JSON.parse(data);
  res.json(data);
});

app.get("/blogs/:id", (req, res) => {
  try {
    const blogId = parseInt(req.params.id);
    let data = fs.readFileSync("./blog.json", "utf-8");
    data = JSON.parse(data);

    let newBlogData = data.find((data) => data.id === blogId);

    if (newBlogData) {
      res.json(newBlogData);
    } else {
      res.status(404).send("No blog is found");
    }
  } catch (error) {
    console.log(error);
  }
});

app.delete("/blogs/:id", (req, res) => {
  let userid = parseInt(req.params.id);
  let data = fs.readFileSync("./blog.json", "utf-8");
  data = JSON.parse(data);

  const index = data.findIndex((blogId) => blogId.id === userid);

  if (index !== -1) {
    data.splice(index, 1);
    fs.writeFileSync("./blog.json", JSON.stringify(data, null, 2));
    res.send(`Blog has been successfully deleted`);
  } else {
    console.log(`Not found`);
  }
});

app.listen(port, () => {
  console.log(`The port is running on ${port}`);
});
