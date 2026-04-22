import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function Dashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const isOwner = user?.role === "owner"; // Role check placeholder

    const [slots, setSlots] = useState([]);
    const [formData, setFormData] = useState({
        slotTitle: "",
        date: "",
        startTime: "",
        endTime: ""
    });
    const [appointments, setAppointments] = useState([])

    function handleInputChange(e) {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    }

    function createSlot(e) {
        e.preventDefault();

        const { slotTitle, date, startTime, endTime } = formData;
        if (!slotTitle || !date || !startTime || !endTime) {
            alert("Please fill in all fields.");
            return;
        }
        if (startTime >= endTime) {
            alert("Start time must be before end time.");
            return;
        }

        const newSlot = {
            id: Date.now(),
            slotTitle,
            date,
            startTime,
            endTime,
            isPublic: false
        };

        setSlots(prevSlots => [...prevSlots, newSlot]);

        // Resets form
        setFormData({
            slotTitle: "",
            date: "",
            startTime: "",
            endTime: ""
        });
    }

    function deleteSlot(slotId) {
        setSlots(prevSlots => prevSlots.filter(slot => slot.id !== slotId));
    }

    function generateInviteURL(slot) {
        // Placeholder
        alert(`Invite URL generated for ${slot.slotTitle}!`);
    }

    function toggleVisibility(slotId) {
        setSlots(prevSlots =>
            prevSlots.map(slot =>
                slot.id === slotId
                    ? { ...slot, isPublic: !slot.isPublic }
                    : slot
            )
        );
    }

    function handleLogout(){
        logout();
        navigate("/login");
    }

    function emailOwner(email) {
        window.location.href = `mailto:${email}`;
    }

  return (
    <div>
        {/* Navbar */}
        <header className="navbar">
            <div className="container nav-content">
                <h1 className="title">BookSOCS</h1>

                <nav>
                    <Link to="/">Home</Link>
                    <button className="logout-button" onClick={handleLogout}>Logout</button>
                </nav>
            </div>
        </header>

        {/* Main */}
        <main className="dashboard-page">
            <div className="container">
                <h2 className="dash-header">Welcome, {user?.first_name}</h2>

                {/* User features */}
                <section className="dashboard-section">
                    <h3 className="form-header">Your Appointments</h3>

                    {appointments.length === 0 ? (
                        <p>No appointments yet.</p>
                    ) : (
                        appointments.map(appt =>(
                            // NOTE appt fields all placeholders until backend implementation
                            <div key="{appt.id}" className="appointment-card">
                                <p>{appt.title}</p>
                                <p>{appt.date} {appt.time}</p>

                                <button onClick={() => emailOwner(appt.ownerEmail)}>Message Owner</button>
                                <button>Cancel Appointment</button>
                            </div>
                        ))
                    )}

                    <button className="submit-button">
                        Book Appointment
                    </button>
                </section>

                {/* OWNER FEATURES */}
                {isOwner && (
                    <>
                        {/* CREATE SLOT */}
                        <section className="dashboard-section">
                            <h3 className="form-header">Create a slot</h3>
                            
                            <form className="slot-form" onSubmit={createSlot}>
                                <label>Slot Title:
                                <input 
                                    id="slotTitle" 
                                    type="text" 
                                    name="slotTitle" 
                                    value={formData.slotTitle} 
                                    onChange={handleInputChange} 
                                    placeholder="e.g. COMP 307 Office Hours" 
                                    required 
                                />
                                </label>

                                <label>Date:
                                    <input 
                                        id="date" 
                                        type="date" 
                                        name="date" 
                                        value={formData.date} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                </label>

                                <label>Start Time:
                                    <input 
                                        id="startTime" 
                                        type="time" 
                                        name="startTime" 
                                        value={formData.startTime} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                </label>

                                <label>End Time:
                                    <input 
                                        id="endTime" 
                                        type="time" 
                                        name="endTime" 
                                        value={formData.endTime} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                </label>

                                <button className="submit-button" type="submit">
                                    Create Slot
                                </button>
                            </form>
                        </section>

                        {/* SLOT LIST */}
                        <section className="slots-section">
                            <h3 className="form-header">Your Slots</h3>
                    
                            {slots.length === 0 ? (
                                <p>You have no slots created yet.</p>
                            ) : (
                                <div className="slots-list">
                                    {slots.map((slot) => (
                                        <div key={slot.id} className="slot-card">
                                            <div className="slot-details">
                                                <h4>{slot.slotTitle}</h4>
                                                <h3>{slot.date}</h3>
                                                <p>{slot.startTime} to {slot.endTime}</p>
                                            </div>

                                            <div className="slot-actions">
                                                <label className="visibility-toggle">
                                                    <span>{slot.isPublic ? "Public" : "Private"}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={slot.isPublic}
                                                        onChange={() => toggleVisibility(slot.id)}
                                                    />
                                                    <span className="toggle-slider" aria-hidden="true"></span>
                                                </label>

                                                <button className="invite-button" type="button" onClick={() => generateInviteURL(slot)}>
                                                    Invite
                                                </button>

                                                <button className="delete-button" type="button" onClick={() => deleteSlot(slot.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
       
            </div>
        </main>
    </div>
  );
}

export default Dashboard;
