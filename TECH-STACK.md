# Smart Attendance App — Frontend aur Backend Technologies

Yeh document project ke `package.json` aur source files me maujood technologies
ka overview deta hai.

## Frontend

- **React** — user interface aur reusable components banane ke liye.
- **React DOM** — React UI ko browser page par render karne ke liye.
- **React Router** — login, teacher portal, reports, settings aur student scan
  pages ke beech navigation ke liye.
- **JavaScript (ES6+)** — frontend application ki programming language.
- **CSS** — pages aur components ki styling ke liye.
- **Create React App (`react-scripts`)** — frontend ko start, build aur test
  karne ke liye.
- **Fetch API** — frontend se backend REST API requests bhejne ke liye.
- **`qrcode` package** — attendance session ka QR code banane ke liye.
- **Browser `sessionStorage`** — teacher login token ko browser session ke
  dauran rakhne ke liye.

## Backend

- **Node.js** — JavaScript server runtime.
- **Express** — REST API routes aur HTTP request/response handle karne ke liye.
- **JavaScript (CommonJS)** — backend source code ka format.
- **CORS (`cors`)** — configured frontend origins se API access allow karne ke
  liye.
- **dotenv** — `.env` file se configuration load karne ke liye.
- **Node.js `crypto`** — password hashing, signed teacher tokens aur QR session
  token signatures ke liye. Password hashing me `scrypt` use hota hai.

## Data storage ke do modes

Project me do alag backend commands hain; ek waqt me jis mode ko chalate hain,
data usi mode me store hota hai:

1. **JSON backend** — `server/server.js` Node.js ke `fs` aur `path` modules se
   `server/data.json` (ya `DATA_FILE` se configure ki gayi file) me data
   read/write karta hai. Local development ke liye MySQL ki zarurat nahi hoti.
   Start command: `npm run server`
2. **MySQL backend** — `server/mysqlServer.js` me `mysql2/promise` connection
   pool ke zariye MySQL database use hota hai. Database schema
   `server/schema.sql` me hai. Start command: `npm run server:mysql`.
   Is mode ke liye `.env` me MySQL connection settings honi chahiye.

**Abhi JSON mode use karne ke liye** `npm run server` chalayein aur alag
terminal me `npm start` chalakar frontend start karein. Frontend local
development me API ko `http://localhost:4000` par proxy karta hai.

## Authentication aur API

- `server/auth.js` teacher credentials validate karta hai, salted `scrypt`
  password hashes banata/verify karta hai, signed teacher tokens verify karta
  hai aur login attempts limit karta hai.
- Express API teacher login/registration, students, attendance records,
  sessions, settings aur student QR check-in handle karti hai.
- Frontend API helper `src/services/apiService.js` me hai.

## Mukhya files

- Frontend entry aur routes: `src/App.js`
- Frontend API helper: `src/services/apiService.js`
- JSON backend: `server/server.js`
- MySQL backend: `server/mysqlServer.js`
- Authentication: `server/auth.js`
- MySQL schema: `server/schema.sql`
