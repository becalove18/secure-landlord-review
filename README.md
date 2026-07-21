# RentReview

A secure landlord review website developed as a cybersecurity senior capstone project. Users can securely create accounts, log in, submit landlord reviews, and browse reviews while demonstrating secure web application development practices.

## 🌐 Live Website

https://secure-landlord-review.onrender.com

---

## 📌 Project Overview

RentReview is a secure, responsive web application that allows tenants to share and browse landlord reviews. The project focuses on implementing cybersecurity best practices while demonstrating secure full-stack web development.

### Features

- Secure user registration
- Secure login authentication
- Password hashing with bcrypt
- Session-based authentication
- User profile page
- Submit landlord reviews
- Edit your own reviews
- Delete your own reviews
- Browse landlord reviews
- Search reviews
- Filter reviews by rating
- Responsive user interface

---

## 🔒 Security Features

- Passwords hashed using bcrypt
- Parameterized SQL queries to prevent SQL injection
- Server-side input validation using express-validator
- Session-based authentication
- Session regeneration after successful login
- Protected routes requiring authentication
- Ownership verification for editing and deleting reviews
- Automatic HTML escaping with EJS templates to help prevent Cross-Site Scripting (XSS)
- Secure HTTP headers using Helmet

---

## 🛠 Technologies Used

### Frontend
- EJS
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL
- node-postgres (pg)

### Security Libraries
- bcrypt
- Helmet
- express-session
- connect-pg-simple
- express-validator

---

## 🏗 Project Architecture

The application follows a modular Express.js architecture using reusable middleware and EJS templates.

Major components include:

- Express.js server
- PostgreSQL database
- EJS templating engine
- Authentication middleware
- Validation middleware
- Ownership middleware
- Session management
- Client-side search and filtering

---

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/becalove18/secure-landlord-review.git
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```text
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
DATABASE_URL=
SESSION_SECRET=
NODE_ENV=development
```

Run the application:

```bash
npm start
```

Open:

```
http://localhost:3000
```

---

## 📁 Project Structure

```
secure-landlord-review/
│
├── middleware/
│   ├── auth.js
│   ├── ownership.js
│   └── validation.js
│
├── public/
│   ├── script.js
│   └── style.css
│
├── views/
│   ├── partials/
│   │   ├── footer.ejs
│   │   ├── head.ejs
│   │   └── navigation.ejs
│   │
│   ├── edit-review.ejs
│   ├── index.ejs
│   ├── login.ejs
│   ├── profile.ejs
│   ├── register.ejs
│   ├── reviews.ejs
│   └── submit-review.ejs
│
├── .env
├── .gitignore
├── db.js
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

---

### Folder Overview

- `middleware/` contains reusable middleware for authentication, validation, and ownership checks.
  - `auth.js` protects routes that require a logged-in user.
  - `validation.js` contains reusable validation rules for registration, login, and reviews.
  - `ownership.js` ensures users can only edit or delete their own reviews.
- `public/` contains browser-accessible CSS and JavaScript files.
- `views/` contains EJS page templates.
- `views/partials/` contains reusable page sections such as the document head, navigation bar, and footer.
- `db.js` configures the PostgreSQL database connection.
- `server.js` configures the Express application, middleware, and routes.
- `.env` stores private environment variables and is excluded from Git.

---

## 🧪 Security Testing

The application was tested against common web application attacks and security risks, including:

- SQL Injection (SQLi)
- Cross-Site Scripting (XSS)
- Unauthorized page access
- Authentication bypass attempts
- Review ownership enforcement
- Invalid form input validation
- Session management testing

These protections are implemented using secure coding practices, parameterized SQL queries, reusable middleware, server-side validation, and session-based authentication.

---

## 🔮 Future Improvements

- Password reset
- Email verification
- Pagination
- Review moderation
- Review voting
---

## 👩‍💻 Author

Rebecca Rogers

Bachelor of Applied Technology in Cybersecurity

Senior Capstone Project

2026