import { Link } from "react-router-dom";

function LoginPage() {
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
                    <h1 className="login-title">Login Page</h1>
                    <p className="login-message">Please sign in with your McGill email to log in.</p>
                    <form className="login-form">
                        <label htmlFor="username">McGill Email:</label>
                        <input type="email" id="username" name="username" required />

                        <label htmlFor="password">Password:</label>
                        <input type="password" id="password" name="password" required />
                        
                        <button className="submit-button" type="submit">Login</button>
                    </form>
                </section>
            </main>
        </div>
    );
}

export default LoginPage;
