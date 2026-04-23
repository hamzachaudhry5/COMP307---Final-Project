import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function Dashboard() {
    const navigate = useNavigate();
    const { user, logout, isLoading } = useAuth();
    const isOwner = user?.role === "owner"; // Role check placeholder

    const [slots, setSlots] = useState([]);
    const [formData, setFormData] = useState({
        slotTitle: "",
        description: "",
        slotType: "",
        date: "",
        startTime: "",
        endTime: "",
        isRecurring: false,
        recurrenceWeeks: 1,
        maxParticipants: 1
    });
    const [appointments, setAppointments] = useState([])    
    const [requests, pendingRequests] = useState([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDays = getWeekDays(weekOffset);
    const weekLabel = getWeekRange(weekDays);

    /* Private slots */
    const visibleOwnerSlots = isOwner ? slots.filter(slot => slot.isPublic) : [];
    const calendarItems = [...appointments, ...visibleOwnerSlots];

    useEffect(() => {
        if (isLoading || !user) return;

        async function loadData() {
            try {
                const myReservations = await api.reservations.getMy();
                setAppointments(myReservations);
            } catch (err) {
                console.error("Failed to load reservations:", err);
            }

            if (isOwner) {
                try {
                    const myRequests = await api.reservations.getIncoming();
                    pendingRequests(myRequests);
                } catch (err) {
                    console.error("Failed to load incoming requests:", err);
                    pendingRequests([]);
                }

                try {
                    const mySlots = await api.slots.getMine();
                    setSlots(
                        mySlots.map(slot => ({
                            ...slot,
                            isPublic: slot.status === "active"
                        }))
                    );
                } catch (err) {
                    console.error("Failed to load slots:", err);
                }
            }
        }
        
        loadData();
    }, [isLoading, user, isOwner]);

    function handleInputChange(e) {
        const { name, value, type, checked } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: type === "checkbox" ? checked : value
        }));
    }

    async function createSlot(e) {
        e.preventDefault();

        const { 
            slotTitle, 
            description, 
            slotType,
            date, 
            startTime, 
            endTime,
            isRecurring,
            recurrenceWeeks,
            maxParticipants
        } = formData;
        if (!slotTitle || !date || !startTime || !endTime) {
            alert("Please fill in all fields.");
            return;
        }
        if (startTime >= endTime) {
            alert("Start time must be before end time.");
            return;
        }

        try {
            const newSlot = await api.slots.create({
                title: slotTitle,
                description: description || "",
                slot_type: slotType || "request",
                start_time: `${date}T${startTime}:00`,
                end_time: `${date}T${endTime}:00`,
                is_recurring: isRecurring,
                recurrence_weeks: isRecurring ? Number(recurrenceWeeks) : 1,
                max_participants: Number(maxParticipants)
            });

            console.log("New slot: ", newSlot);
            setSlots(prev => [...prev, ...newSlot]);

            // Resets form
            setFormData({
                slotTitle: "",
                description: "",
                date: "",
                startTime: "",
                endTime: "",
                isRecurring: false,
                recurrenceWeeks: 1,
                maxParticipants: 1
            });

        } catch (err) {
            console.error(err);
            alert("Failed to create slot");
        }
    }

    async function deleteSlot(slotId) {
        const confirmed = window.confirm("Delete this slot?");
        if (!confirmed) return;

        try {
            await api.slots.delete(slotId);
            setSlots(prev => prev.filter(slot => slot.id !== slotId));

        } catch (err) {
            console.error(err);
            alert("Failed to delete slot");
        }
    }

    async function generateInviteURL(slot) {
        try {
            const inviteLink = await api.slots.createInviteLink();
            const inviteURL = `${window.location.origin}/invite/${inviteLink.token}`;
            navigator.clipboard.writeText(inviteURL);
            alert("Invite URL copied to clipboard!");
        }
        catch (err) {
            console.error(err);
            alert("Failed to generate invite link");
        }
    }

    async function toggleVisibility(slotId) {
        const slot = slots.find(s => s.id === slotId);
        if (!slot) return;

        const newIsPublic = slot.isPublic ? "private" : "active";

        try {
            const updatedSlot = await api.slots.update(slotId, {
                is_public: newIsPublic
            });

            setSlots(prevSlots =>
                prevSlots.map(s =>
                    s.id === slotId
                        ? {
                            ...s,
                            ...updatedSlot,
                            isPublic: (updatedSlot?.is_public ?? newIsPublic) === "active"
                        }
                        : s
                )
            );
        } catch (err) {
            console.error(err);
            alert(err.message || "Failed to update visibility");
        }
    }

    async function handleAcceptRequest(requestId) {
        try {
            await api.meeting.accept(requestId);
            pendingRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) {
            console.error(err);
            alert("Failed to accept request");
        }
    }

    async function handleDeclineRequest(requestId) {
        try {
            await api.meeting.decline(requestId);
            pendingRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) {
            console.error(err);
            alert("Failed to decline request");
        }
    }

    function handleLogout(){
        logout();
        navigate("/login");
    }

    function emailOwner(email) {
        window.location.href = `mailto:${email}`;
    }

    function getWeekDays(offset = 0) {
        const today = new Date();
        // const sundayOffset = -today.getDay();

        const sunday = new Date(today);
        sunday.setDate(today.getDate() - today.getDay() + offset * 7);

        return Array.from({ length: 7 }, (_, i) =>{
            const d = new Date(sunday);
            d.setDate(sunday.getDate() + i);
            return d;
        });
    }
    function getWeekRange(weekDays) {
        const start = weekDays[0];
        const end = weekDays[6];

        const options = { month: "short", day: "numeric" };

        const startStr = start.toLocaleDateString("en-US", options);
        const endStr = end.toLocaleDateString("en-US", options);

        return `${startStr} - ${endStr}`;
    }

    function isSameDay(dateStr, day) {
        const d = new Date(dateStr);
        return (
            d.getFullYear() === day.getFullYear() &&
            d.getMonth() === day.getMonth() &&
            d.getDate() === day.getDate()
        );
    }

    function formatSlotRange(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);

        const dateLabel = start.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });

        const timeOptions = {
            hour: "numeric",
            minute: "2-digit",
        };

        return `${dateLabel}, ${start.toLocaleTimeString("en-US", timeOptions)} - ${end.toLocaleTimeString("en-US", timeOptions)}`;
    }

    if (isLoading) {
        return (
            <div className="loading-screen">
                <h2>Loading...</h2>
            </div>
        );
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
                    <h3 className="form-header">Your Bookings:</h3>
                    
                    <div className="week-nav">
                        <button onClick={() => setWeekOffset(prev => prev -1)}>
                            &lt;
                        </button>
                        <h3 className="week-title">{weekLabel}</h3>
                        <button onClick={() => setWeekOffset(prev => prev +1)}>
                            &gt;
                        </button>
                    </div>
                    

                    <div className="week-grid">
                        {weekDays.map((day, i) => (
                            <div key={i} className="week-day">
                                <div className="week-day-header">
                                    <div className="week-day-initial">
                                        {day.toLocaleDateString("en-US", {weekday: "short"})[0]}
                                    </div>
                                    <div className="week-day-number">
                                        {day.getDate()}
                                    </div>
                                </div>

                                <div className="week-day-slots">
                                    {calendarItems
                                        .filter(item => isSameDay(item.start_time, day))
                                        .map(item => (
                                            <div key={item.id} className="calendar-slot">
                                                <div className="slot-time">
                                                    {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {" - "}
                                                    {new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="slot-title">
                                                    {item.title}
                                                </div>
                                            </div>
                                        ))}

                                    {calendarItems
                                        .filter(item => isSameDay(item.start_time, day)).length === 0 && (
                                            <div className="week-day-empty">No Events</div>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="submit-button" onClick={() => navigate("/booking")}>
                        Book Appointment
                    </button>
                </section>

                {/* OWNER FEATURES */}
                {isOwner && (
                    <>  
                        {/* PENDING REQUESTS */}
                        <section>
                            <h3 className="slots-section">Pending Requests</h3>
                            {requests.length === 0 ? (
                                <p>No pending requests.</p>
                            ) : (
                                <div className="requests-list">
                                    {requests.map(req => (
                                        <div key={req.id} className="request-card">
                                            <div>
                                                <strong>{req.reserver.first_name} {req.reserver.last_name}</strong> wants to book <em>{req.slot.title}</em>
                                            </div>
                                            <div className="request-actions">
                                                <button onClick={() => handleAcceptRequest(req.id)}>Accept</button>
                                                <button onClick={() => handleDeclineRequest(req.id)}>Decline</button>
                                                <button onClick={() => emailOwner(req.reserver.email)}>Email</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

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

                                <label>Slot Type:
                                    <select name="slotType" value={formData.slotType} onChange={handleInputChange} required>
                                        <option value="request">Request</option>
                                        <option value="group">Group</option>
                                        <option value="office_hours">Office Hours</option>
                                    </select>
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

                                <label>Max Participants:
                                    <input
                                        type="number"
                                        name="maxParticipants"
                                        value={formData.maxParticipants}
                                        min="1"
                                        onChange={handleInputChange}
                                    />
                                </label>

                                <label>Recurring
                                    <input
                                        type="checkbox"
                                        name="isRecurring"
                                        checked={formData.isRecurring}
                                        onChange={(e) =>
                                            setFormData(prev => ({
                                                ...prev,
                                                isRecurring: e.target.checked
                                            }))
                                        }    
                                    />
                                </label>

                                {formData.isRecurring && (
                                    <label>Repeat (weeks):
                                        <input
                                            type="number"
                                            name="recurrenceWeeks"
                                            value={formData.recurrenceWeeks}
                                            min="1"
                                            onChange={handleInputChange}
                                        />
                                    </label>
                                )}

                                <label>Description
                                    <textarea className="description-textarea"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        placeholder="Details about this slot..."
                                        rows={3}
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
                                                <h4>{slot.title}</h4>
                                                <p>{formatSlotRange(slot.start_time, slot.end_time)}</p>
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
