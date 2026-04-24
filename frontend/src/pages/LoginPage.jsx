import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const location = useLocation();

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        // UX Check
        if(!email.endsWith("@mcgill.ca") && !email.endsWith("@mail.mcgill.ca")) {
            setError("Please use a valid Mcgill email.")
            return;
        }

        //backend response
        try {
            await login(email, password);
            const redirectTo = location.state?.from || "/dashboard";
            navigate(redirectTo);

        } catch (err) {
            setError(err.message);
        }
       
    }

    return (
        <div>
            <header className="navbar">
                <div className="container nav-content">
                    <h1 className="title">BookSOCS</h1>

                    <nav>
                        <Link to="/">Home</Link>
                        <Link to="/login">Login</Link>
                        <Link to="/register">Register</Link>
                    </nav>
                </div>
            </header>

            <main className="login-page">
                <section className="login-panel">
                    <h1 className="login-title">Login</h1>
                    <p className="login-message">Please use your McGill email to log in.</p>
                    <form className="login-form" onSubmit={handleSubmit}>
                        <label htmlFor="username">McGill Email:</label>
                        <input 
                            type="email" 
                            id="username" 
                            name="username" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required />

                        <label htmlFor="password">Password:</label>
                        <input 
                            type="password" 
                            id="password" 
                            name="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required />

                        {error && (
                            <p style={{ color: "red" }}>{error}</p>
                        )}
                        
                        <button className="submit-button" type="submit">Login</button>
                    </form>
                </section>
            </main>
        </div>
    );
}

export default LoginPage;
