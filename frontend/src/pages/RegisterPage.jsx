import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";

function RegisterPage(){
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    function passwordsMatch(){
        return password === confirmPassword;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        // Emails are not generally case sensitive
        const normalizedEmail = email.toLowerCase();

        setError("");

        // UX validation
        if (!passwordsMatch()){
            setError("Passwords do not match.");
            return;
        }

        try {
            await registerUser({
                email: normalizedEmail,
                password,
                first_name: firstName,
                last_name: lastName
            });

            navigate("/login");
        } catch (err) {
            setError("Registration failed. Please try again.");
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
                    <h1 className="login-title">Register</h1>
                    <p className="login-message">
                        Use your McGill email to create an account.
                    </p>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <label>First Name:</label>
                        <input 
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />

                        <label>Last Name:</label>
                        <input 
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />

                        <label htmlFor="email">McGill Email:</label>
                        <input
                            type="email"
                            id="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <label htmlFor="password">Password:</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <label htmlFor="password">Confirm Password:</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />

                        {/* PASSWORD CHECKING */}
                        {confirmPassword.length > 0 && !passwordsMatch() && (
                            <p style={{ color: "red"}}>Passwords do not match.</p>
                        )}
                        {error && (
                            <p style={{ color: "red" }}>{error}</p>
                        )}

                        <button className="submit-button" type="submit">
                            Register
                        </button>
                    </form>
                </section>
            </main>
        </div>
    )
}

export default RegisterPage;