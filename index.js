import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

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

let users;

let blogData;
let newData;

app.post("/api/submitBlog", upload.single("image"), (req, res) => {
  const { title, subtitle, category, content, readingTime } = req.body;
  const imageFile = req.file; // uploaded file

  // Read the current blog data
  let data = fs.readFileSync("./blog.json", "utf8");
  let blogData = JSON.parse(data);

  // Find the highest existing ID
  const highestId =
    blogData.length > 0 ? Math.max(...blogData.map((blog) => blog.id)) : 0;

  const newData = {
    id: highestId + 1, // new ID is always higher than the current highest
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

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPashword = await bcrypt.hash(password, 10);

    const data = fs.readFileSync("./users.json", "utf-8");
    users = JSON.parse(data);

    const singleUsername = users.find(
      (singleUser) => singleUser.username === username
    );

    const singleEmail = users.find(
      (singleEmail) => singleEmail.email === email
    );

    if (singleUsername) {
      console.log(`user has been taken`);
      res.status(400).json({ error: "User has been taken" });
      return;
    }

    if (singleEmail) {
      console.log(`email has been taken`);
      res.status(400).json({ error: "Email has been taken" });
      return;
    }

    const newUser = {
      username: username,
      email: email,
      password: hashedPashword,
    };

    users.push(newUser);

    fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
    res.status(201).json({ success: "User Registered Succesfully" });
  } catch (error) {
    console.log(`error putting user`, error);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const data = fs.readFileSync("./users.json", "utf-8");
    users = JSON.parse(data);

    const singleUsername = users.find(
      (singleUser) => singleUser.username === username
    );

    if (!singleUsername) {
      console.log("User not found");
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isValid = await bcrypt.compare(password, singleUsername.password);

    if (!isValid) {
      console.log("Incorrect password");
      res.status(401).json({ error: "Password Incorrect" });
      return;
    }

    console.log("Login successfully");
    res.status(200).json({ message: "Login Succesfully" });
  } catch (error) {
    console.log("Couldn't login ", error);
  }
});

app.listen(port, () => {
  console.log(`The port is running on ${port}`);
});
