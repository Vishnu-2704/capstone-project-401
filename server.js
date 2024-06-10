const express = require("express");
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const saltRounds = 10;

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const serviceAccount = require('./key.json');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/signupSubmit", (req, res) => {
  const { email, password } = req.body;
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).send("Error: Unable to sign up. Please try again later.");
    }
    db.collection("users")
      .add({ email, password: hash })
      .then(() => {
        res.send("Sign up is successful. Go to <a href='/login'>login</a>.");
      })
      .catch((error) => {
        console.error("Error adding document:", error);
        res.status(500).send("Error: Unable to sign up. Please try again later.");
      });
  });
});

app.post("/loginSubmit", (req, res) => {
  const { email, password } = req.body;
  db.collection("users")
    .where("email", "==", email)
    .get()
    .then((docs) => {
      if (docs.size === 0) {
        return res.send("User not found.");
      }
      const user = docs.docs[0].data();
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
          console.error("Error comparing passwords:", err);
          return res.status(500).send("Error: Unable to login. Please try again later.");
        }
        if (result) {
          req.session.user = user;
          res.redirect("/dashboard");
        } else {
          res.send("Incorrect password.");
        }
      });
    })
    .catch((error) => {
      console.error("Error getting documents:", error);
      res.status(500).send("Error: Unable to login. Please try again later.");
    });
});

app.get("/dashboard", (req, res) => {
  if (req.session.user) {
    res.render("dashboard");
  } else {
    res.redirect("/login");
  }
});

app.post("/convert", async (req, res) => {
  const { fromCurrency, toCurrency, amount } = req.body;
  const apiKey = 'ceff264f7d4a96c596117d786fa0040f'; // Your API key
  const url = `https://currencyconversionapi.com/api/v1/convert?q=${fromCurrency}_${toCurrency}&compact=ultra&apiKey=${apiKey}`;

  try {
    const fetch = await import('node-fetch');
    const response = await fetch.default(url);
    
    console.log("Response status:", response.status);
    console.log("Response status text:", response.statusText);
    
    const data = await response.json();
    
    console.log("Data received:", data);
    
    if (response.ok) {
      const rate = data[`${fromCurrency}_${toCurrency}`];
      const conversionResult = (amount * rate).toFixed(2);
      const result = `${amount} ${fromCurrency} = ${conversionResult} ${toCurrency}`;
      res.render("dashboard", { fromCurrency, toCurrency, amount, result });
    } else {
      console.error("Failed to fetch:", response.statusText);
      res.render("dashboard", { fromCurrency, toCurrency, amount, error: "Failed to fetch data. Please try again later." });
    }
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.render("dashboard", { fromCurrency, toCurrency, amount, error: "Failed to fetch data. Please try again later." });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error: Unable to log out. Please try again later.");
    }
    res.redirect("/login");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
