import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  })
);

app.use("/images", express.static("public/images"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Multer setup for blog images ----------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./public/images");
  },
  filename: function (req, file, cb) {
    return cb(null, `${Date.now()}_${file.originalname}`);
  },
});
const upload = multer({ storage });

// ---------- Google OAuth2 setup ----------
const redirectUrl = "http://localhost:3000/auth/google/callback";
const oAuth2Client = new OAuth2Client(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  redirectUrl
);

// ---------- USERS ----------
let users = [];

// // ---------- GOOGLE LOGIN ROUTES ----------

// // Step 1: Generate Google Auth URL (GET instead of POST)
app.get("/auth/google", (req, res) => {
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
    prompt: "consent",
  });
  res.redirect(authorizeUrl); // 👈 Redirect to Google login
});

// // Step 2: Handle Google callback
app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Get user info
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );
    const userInfo = await response.json();

    // Add a default userType
    const userType = "user"; // 👈 default role for Google login users

    // Redirect to React homepage with token + user info
    const queryParams = new URLSearchParams({
      token: tokens.id_token,
      name: userInfo.name,
      email: userInfo.email,
      userType, // 👈 included here
    });

    res.redirect(`${process.env.FRONTEND_URL}/?${queryParams.toString()}`);
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ error: "Failed to login with Google" });
  }
});

// ---------- BLOG ROUTES ----------
app.post("/api/submitBlog", upload.single("image"), (req, res) => {
  const { title, subtitle, category, content, readingTime } = req.body;
  const imageFile = req.file;

  let data = fs.readFileSync("./blog.json", "utf8");
  let blogData = JSON.parse(data);

  const highestId =
    blogData.length > 0 ? Math.max(...blogData.map((blog) => blog.id)) : 0;

  const newData = {
    id: highestId + 1,
    title,
    subtitle,
    category,
    content,
    readingTime,
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
  let blogId = parseInt(req.params.id);
  let data = fs.readFileSync("./blog.json", "utf-8");
  data = JSON.parse(data);

  const index = data.findIndex((blog) => blog.id === blogId);

  if (index !== -1) {
    data.splice(index, 1);
    fs.writeFileSync("./blog.json", JSON.stringify(data, null, 2));
    res.send(`Blog has been successfully deleted`);
  } else {
    res.status(404).send("Not found");
  }
});

// ---------- REGISTER & LOGIN ----------
app.post("/register", async (req, res) => {
  try {
    const { username, email, password, userType } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const data = fs.readFileSync("./users.json", "utf-8");
    users = JSON.parse(data);

    const singleUsername = users.find(
      (singleUser) => singleUser.username === username
    );
    const singleEmail = users.find((singleUser) => singleUser.email === email);

    if (singleUsername) {
      return res.status(400).json({ error: "Username has been taken" });
    }
    if (singleEmail) {
      return res.status(400).json({ error: "Email has been taken" });
    }

    const newUser = {
      id: Date.now(),
      username,
      email,
      password: hashedPassword,
      userType,
    };

    users.push(newUser);
    fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));

    const token = jwt.sign(
      {
        id: newUser.id,
        username: newUser.username,
        userType: newUser.userType,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      success: "User Registered Successfully",
      token,
      user: {
        username: newUser.username,
        email: newUser.email,
        userType: newUser.userType,
      },
    });
  } catch (error) {
    console.log("error putting user", error);
    res.status(500).json({ error: "Server error" });
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
      return res.status(404).json({ error: "User not found" });
    }

    const isValid = await bcrypt.compare(password, singleUsername.password);

    if (!isValid) {
      return res.status(401).json({ error: "Password Incorrect" });
    }

    const token = jwt.sign(
      {
        id: singleUsername.id,
        username: singleUsername.username,
        userType: singleUsername.userType,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login Successfully",
      token,
      user: {
        username: singleUsername.username,
        email: singleUsername.email,
        userType: singleUsername.userType,
      },
    });
  } catch (error) {
    console.log("Couldn't login ", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- SERVER ----------
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
