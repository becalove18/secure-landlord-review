# RentReview

A secure landlord review website developed as a cybersecurity senior capstone project. Users can securely create accounts, log in, submit landlord reviews, and browse reviews while demonstrating secure web application development practices.

## 🌐 Live Website

[Open the live RentReview website](https://secure-landlord-review.onrender.com)

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

The application follows a modular Express.js architecture that separates server configuration, route handling, reusable middleware, database access, static assets, and EJS templates.

Major components include:

Major components include:

- Express.js server
- Modular Express route files
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

Run the application normally:

```bash
npm start
```

Run the application in development mode (automatically restarts the server when you save changes):

```bash
npm run dev
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
├── routes/
│   ├── authRoutes.js
│   ├── pageRoutes.js
│   ├── profileRoutes.js
│   └── reviewRoutes.js
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
│   ├── edit-review.ejs
│   ├── index.ejs
│   ├── login.ejs
│   ├── profile.ejs
│   ├── register.ejs
│   ├── reviews.ejs
│   └── submit-review.ejs
│
├── .gitignore
├── db.js
├── package-lock.json
├── package.json
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
- `routes/` contains the Express route modules for page, authentication, profile, and review requests.
  - `pageRoutes.js` handles the home page.
  - `authRoutes.js` handles registration, login, logout, and authentication-status requests.
  - `profileRoutes.js` handles the protected user profile page.
  - `reviewRoutes.js` handles viewing, submitting, editing, and deleting reviews.
- `views/` contains EJS page templates.
- `views/partials/` contains reusable page sections such as the document head, navigation bar, and footer.
- `db.js` configures the PostgreSQL database connection.
- `server.js` configures Express, security middleware, sessions, static files, route modules, and application startup.
- `.env` stores private environment variables and is excluded from Git.

---

## 🧪 Security Testing Plan

The application will be tested against common web application attacks and security risks, including:

- SQL Injection (SQLi)
- Cross-Site Scripting (XSS)
- Unauthorized page access
- Authentication bypass attempts
- Review ownership enforcement
- Invalid form input validation
- Session management

Testing will include crafted SQL injection and XSS payloads, protected-route access attempts, invalid form submissions, and attempts to edit or delete reviews belonging to another user.

---

### Testing Tools and Methods

- Manual browser testing
- Chrome DevTools
- Crafted SQL injection and XSS payloads
- PostgreSQL database verification
- Multiple test user accounts for authorization testing

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