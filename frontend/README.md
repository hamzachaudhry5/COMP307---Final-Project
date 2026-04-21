# Front End
## Project Structure (so far)
src/
│
├── App.jsx
├── main.jsx
├── index.css
├── App.css
│
├── context/
│   └── AuthContext.jsx
│
├── pages/
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
│   └── Dashboard.jsx

## State Management
Uses a global AuthContext to keep track of the currentn user

Available functions
login(userData) -> sets current user
logout() -> clears session
useAuth() -> access the auth state anywhere

## Current limitations
No backend integration on registration and login yet