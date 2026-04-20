import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RegisterPage(){
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    function passwordsMatch(){
        return password === confirmPassword;
    }

    function handleSubmit(e) {
        e.preventDefault();

        // Emails are not generally case sensitive
        const normalizedEmail = email.toLowerCase();

        if (!passwordsMatch()){
            alert("Passwords do not match.");
            return;
        }
        let role;

        if (normalizedEmail.endsWith("@mcgill.ca")) {
            role = "owner";
        }
        else if (normalizedEmail.endsWith("@mail.mcgill.ca")) {
            role = "user";
        }
        else {
            alert("Only McGill emails are allowed to register.");
            return;
        }

        //Backend response

        navigate("/");
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