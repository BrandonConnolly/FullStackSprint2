if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const fs = require("fs");

const express = require("express");
const bcrypt = require("bcrypt");
const passport = require("passport");
const localStrategy = require("passport-local").Strategy;
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const uuid = require("uuid");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const path = require("path");
const pgp = require("pg-promise")();

///////This is for logging userdata
const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "userdata",
  password: "keyin2021",
  port: 5432,
});

////This has to be set up for each user
const dbPostgres = pgp("postgres://postgres:Keyin2021@localhost:5432/Plants");
const mongoClient = new MongoClient("mongodb://localhost:27017", {
  useUnifiedTopology: true,
});
const logins = require("./services/p.logins.dal");

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = true;

// Passport setup
passport.use(
  new localStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      let user = await logins.getLoginByEmail(email);
      if (user == null) {
        return done(null, false, { message: "No user with that email." });
      }
      try {
        if (await bcrypt.compare(password, user.password)) {
          return done(null, user);
        } else {
          return done(null, false, {
            message: "Incorrect password was entered.",
          });
        }
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  let user = await logins.getLoginById(id);
  if (DEBUG) console.log("passport.deserializeUser: " + user);
  done(null, user);
});

// App configuration
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(flash());
console.log("SESSION_SECRET:", process.env.SESSION_SECRET);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get("/", checkAuthenticated, (req, res) => {
  res.render("index.ejs", { name: req.user.username });
});

app.get("/", (req, res) => {
  res.render("searchBar.ejs", { tab: "postgres" });
});
app.get("/searchBar", async (req, res) => {
  const tab = "postgres";

  ///Need to remove part of this
  try {
    let results = [];
    if (tab === "postgres") {
      const searchTerm = req.query.searchTerm; // Assuming you're using query parameters
      results = await dbPostgres.any(
        "SELECT * FROM planttable WHERE plant_common_name ILIKE $1",
        [`%${searchTerm}%`]
      );
    } else if (tab === "mongodb") {
      // Implement your MongoDB search logic here
      // For example:
      await mongoClient.connect();
      const db = mongoClient.db("plantsdb");
      const collection = db.collection("plants_collection");
      const searchTerm = req.query.searchTerm;
      results = await collection.find({}).toArray();
      await mongoClient.close();
    }
    res.render("results", { tab, results });
  } catch (error) {
    console.error("Error executing search:", error);
    res.send("An error occurred while executing the search.");
  }
});

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});

app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});

app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    let result = await logins.addLogin(
      req.body.name,
      req.body.email,
      hashedPassword,
      uuid.v4()
    );
    res.redirect("/login");
  } catch (error) {
    console.log(error);
    res.redirect("/register");
  }
});

app.delete("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.post("/search", async (req, res) => {
  const tab = req.body.tab;
  const searchTerm = req.body.searchTerm;

  try {
    let results;
    let postgresResults = [];
    let mongodbResults = [];

    if (tab === "postgres" || tab === "both") {
      const searchName = searchTerm.trim();
      postgresResults = await dbPostgres.any(
        "SELECT * FROM planttable WHERE plant_common_name ILIKE $1",
        [`%${searchName}%`]
      );
    } else if (tab === "mongodb" || tab === "both") {
      try {
        await mongoClient.connect();
        const db = mongoClient.db("plantsdb");
        const collection = db.collection("plants_collection");

        const searchName = new RegExp(searchTerm, "i");
        mongodbResults = await collection.find({}).toArray();

        await mongoClient.close();
      } catch (error) {
        console.error("Error executing MongoDB query:", error);
        res.send("An error occurred while executing the MongoDB query.");
        return;
      }
    }

    const combinedResults = postgresResults.concat(mongodbResults);

    res.render("results", { tab, results: combinedResults });
  } catch (error) {
    console.error("Error:", error);
    res.send("An error occurred.");
  }
});

///////logData App
// ...

app.post("/searchBar", async (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.user.id; // Retrieve user ID from the authenticated user
    const queryKeywords = req.body.searchName || ""; // Get the search keywords from the form submission

    try {
      // Call the function to add log entry to "userdata" table
      await logins.addUserData(userId, queryKeywords, uuid.v4());

      // PostgreSQL search logic
      const searchTerm = `%${queryKeywords}%`;
      const postgresResults = await pool.query(
        "SELECT * FROM planttable WHERE plant_common_name ILIKE $1",
        [searchTerm]
      );

      res.render("results", { results: postgresResults.rows });
    } catch (error) {
      console.error("Error executing search:", error);
      res.send("An error occurred while executing the search.");
    }
  } else {
    // Handle unauthenticated users
    res.redirect("/login");
  }
});

app.post("/searchBarMongo", async (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.user.id; // Retrieve user ID from the authenticated user
    const queryKeywords = req.body.searchName || ""; // Get the search keywords from the form submission

    try {
      // Call the function to add log entry to "userdata" table
      await logins.addUserData(userId, queryKeywords, uuid.v4());

      // MongoDB search logic
      await mongoClient.connect();
      const db = mongoClient.db("plantsdb");
      const collection = db.collection("plants_collection");

      const searchTerm = new RegExp(queryKeywords, "i");
      const mongodbResults = await collection
        .find({ your_field: searchName })
        .toArray();

      await mongoClient.close();

      res.render("results", { results: mongodbResults });
    } catch (error) {
      console.error("Error executing search:", error);
      res.send("An error occurred while executing the search.");
    }
  } else {
    // Handle unauthenticated users
    res.redirect("/login");
  }
});

// Middleware functions
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  return next();
}

///////Function for logData
async function logQueryToDatabase(userId, keywords) {
  try {
    const timestamp = new Date();
    const insertQuery =
      "INSERT INTO userdata (user_id, keywords, timestamp) VALUES ($1, $2, $3)";
    await pool.query(insertQuery, [userId, keywords, timestamp]);
  } catch (error) {
    console.error("Error inserting query log:", error);
  }
}

// Starting the server
app.listen(PORT, (err) => {
  if (err) console.log(err);
  console.log(`Combined app running on port ${PORT}.`);
});
