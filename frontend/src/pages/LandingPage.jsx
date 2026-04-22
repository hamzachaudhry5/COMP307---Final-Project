import { BsCalendar2CheckFill } from 'react-icons/bs';
import { BsFillPeopleFill } from "react-icons/bs";
import { BsCalendar2RangeFill } from "react-icons/bs";
import { FaClock } from 'react-icons/fa';

import { Link } from "react-router-dom";

function LandingPage() {
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

      <main className="hero">
        <div className="container hero-content">
          <div className="hero-text">
            <p className="tag">McGill Scheduling Platform</p>
            <h2>Here to help you book office hours and meetings.</h2>
            <p>
              A simple and professional booking system for students,
              professors, and teaching assistants.
            </p>

            <div>
              <Link className="submit-button hero-cta" to="/register">
                Get Started
              </Link>
            </div>
          </div>
          <div className="hero-cards" aria-label="Platform features">
            <div className="hero-card">
              <h3 className="feature-title">
                <span>Easy Booking</span>
                <BsCalendar2CheckFill className="card-icon" aria-hidden="true" />
              </h3>
              <p>
                Book office hours and meetings instantly.
              </p>
            </div>
            <div className="hero-card">
              <h3 className="feature-title">
                <span>Office Hours</span>
                <FaClock className="card-icon" aria-hidden="true" />
              </h3>
              <p>
                Professors and TAs can set and manage their office hours schedules.
              </p>
            </div>
            <div className="hero-card">
              <h3 className="feature-title">
                <span>Group Meetings</span>
                <BsFillPeopleFill className="card-icon" aria-hidden="true" />
              </h3>
              <p>
                Find optimal meeting times with heatmap visualization.
              </p>
            </div>
            <div className="hero-card">
              <h3 className="feature-title">
                <span>Calendar Integration</span>
                <BsCalendar2RangeFill className="card-icon" aria-hidden="true" />
              </h3>
              <p>
                Export appointments to your preferred calendar application.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
