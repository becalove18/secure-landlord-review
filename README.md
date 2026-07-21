# RentReview

A secure landlord review website developed as a cybersecurity senior capstone project. Users can securely create accounts, log in, submit landlord reviews, and browse reviews while demonstrating secure web application development practices.

## 🌐 Live Website

**https://secure-landlord-review.onrender.com**

---

## 📌 Project Overview

RentReview is a secure web application that allows tenants to share and browse landlord reviews. The project focuses on implementing cybersecurity best practices while creating a functional full-stack web application.

### Features

- Secure user registration
- Secure login authentication
- Password hashing with bcrypt
- Session management
- Submit landlord reviews
- Browse landlord reviews
- Search reviews
- Filter reviews by rating
- Responsive user interface

---

## 🔒 Security Features

- Passwords hashed using bcrypt
- Parameterized SQL queries to prevent SQL injection
- Server-side input validation
- Cross-Site Scripting (XSS) protection through HTML escaping
- Session-based authentication
- Protected review submission
- Secure HTTP headers using Helmet

---

## 🛠 Technologies Used

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL

### Security Libraries
- bcrypt
- Helmet
- express-session
- connect-pg-simple
- express-validator

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
├── public/
│   ├── script.js
│   └── style.css
│
├── views/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   └── submit-review.html
│
├── db.js
├── server.js
├── package.json
├── README.md
└── .env
```

---

## 🧪 Security Testing

The application was tested against common web application attacks, including:

- SQL Injection
- Cross-Site Scripting (XSS)
- Unauthorized page access
- Authentication bypass attempts

These protections are implemented using secure coding techniques and server-side validation.

---

## 🔮 Future Improvements

- Edit and delete reviews
- User profile pages
- Password reset
- Email verification
- Review moderation
- Pagination
- Review voting

---

## 👩‍💻 Author

Rebecca Rogers

Bachelor of Applied Technology in Cybersecurity

Senior Capstone Project

2026