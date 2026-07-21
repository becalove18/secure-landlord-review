const express = require("express");
const path = require("path");
const helmet = require("helmet");
const session = require("express-session");

require("dotenv").config();

const pool = require("./db");
const pgSession = require("connect-pg-simple")(session);

const authRoutes = require("./routes/authRoutes");
const pageRoutes = require("./routes/pageRoutes");
const profileRoutes = require("./routes/profileRoutes");
const reviewRoutes = require("./routes/reviewRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use(pageRoutes);
app.use(authRoutes);
app.use(profileRoutes);
app.use(reviewRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});