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
        maxParticipants: 1,

        mode: "single",
        selectedDays: []
    });
    const [appointments, setAppointments] = useState([])    
    const [pendingRequests, setPendingRequests] = useState([]);
    const [requestData, setRequestData] = useState({
        date: "",
        startTime: "",
        endTime: "",
        message: ""
    });
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
                    const myRequests = await api.meetingRequests.getIncoming();
                    setPendingRequests(myRequests);
                } catch (err) {
                    console.error("Failed to load incoming requests:", err);
                    setPendingRequests([]);
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

        setFormData(prev => ({
            ...prev,
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
            maxParticipants,
            mode,
            selectedDays // +++++
        } = formData;
        if (!slotTitle || !date || !startTime || !endTime || !slotType) {
            alert("Please fill in all fields.");
            return;
        }
        if (startTime >= endTime) {
            alert("Start time must be before end time.");
            return;
        }

        try {

            const baseDate = new Date(date);

            let daysToUse = [];

            if (mode === "single"){
                daysToUse = [baseDate.getDay()];
            } else {
                if (selectedDays.length === 0){
                    alert("Select at least one day.");
                    return;
                }
                daysToUse = selectedDays //
            }
            const slotsPayload = daysToUse.map(day => {
                const d = getNextWeekdayDate(baseDate, day)

                const dateStr = d.toISOString().split("T")[0];

                return{
                    title: slotTitle,
                    description: description || "",
                    slot_type: slotType,
                    start_time: `${dateStr}T${startTime}:00`,
                    end_time: `${dateStr}T${endTime}:00`,
                    is_recurring: isRecurring,
                    recurrence_weeks: isRecurring ? Number(recurrenceWeeks) : 1,
                    max_participants: Number(maxParticipants)
                };
            });

            const newSlots = await api.slots.createBulk({
                slots: slotsPayload
            });

            // const newSlot = await api.slots.create({
            //     title: slotTitle,
            //     description: description || "",
            //     slot_type: slotType,
            //     start_time: `${date}T${startTime}:00`,
            //     end_time: `${date}T${endTime}:00`,
            //     is_recurring: isRecurring,
            //     recurrence_weeks: isRecurring ? Number(recurrenceWeeks) : 1,
            //     max_participants: Number(maxParticipants)
            // });

            console.log("New slot: ", newSlots);
            setSlots(prev => [...prev, ...newSlots]);

            // Resets form
            setFormData({
                slotTitle: "",
                description: "",
                slotType: "",
                date: "",
                startTime: "",
                endTime: "",
                isRecurring: false,
                recurrenceWeeks: 1,
                maxParticipants: 1,
                mode: "single",
                selectedDays: []
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
            const res = await api.slots.createInviteLink();

            let inviteURL = res.invite_url;

            // ensure full frontend URL
            if (inviteURL.startsWith("/")) {
                inviteURL = `http://localhost:3000${inviteURL}`;
            }

            await navigator.clipboard.writeText(inviteURL);
            alert("Invite URL copied:\n" + inviteURL);

        } catch (err) {
            console.error(err);
            alert("Failed to generate invite link");
        }
    }

    async function toggleVisibility(slotId) {
        const slot = slots.find(s => s.id === slotId);
        if (!slot) return;

        const newStatus = slot.isPublic ? "private" : "active";

        try {
            const updatedSlot = await api.slots.update(slotId, {
                status: newStatus
            });

            setSlots(prevSlots =>
                prevSlots.map(s =>
                    s.id === slotId
                        ? {
                            ...s,
                            ...updatedSlot,
                            isPublic: (updatedSlot?.status ?? newStatus) === "active"
                        }
                        : s
                )
            );
        } catch (err) {
            console.error(err);
            alert("Failed to update visibility");
        }
    }

    async function handleAcceptRequest(requestId) {
        try {
            await api.meetingRequests.accept(requestId);
            pendingRequests(prev => prev.filter(r => r.id !== requestId));

            const myReservations = await api.reservations.getMy();
            setAppointments(myReservations);

            if (isOwner) {
                const mySlots = await api.slots.getMine();
                setSlots(
                    mySlots.map(slot => ({
                        ...slot,
                        isPublic: slot.status === "active"
                    }))
                );
            }
        } catch (err) {
            console.error(err);
            alert("Failed to accept request");
        }
    }

    async function handleDeclineRequest(requestId) {
        try {
            await api.meetingRequests.decline(requestId);
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

    function getNextWeekdayDate(baseDate, targetDay) {
        const date = new Date(baseDate);
        const currentDay = date.getDay();

        let diff = targetDay - currentDay;

        if (diff < 0) {
            diff += 7; // push to NEXT week if before today
        }

        date.setDate(date.getDate() + diff);
        return date;
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
                    <Link to ="/booking">Booking</Link>
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
                            {pendingRequests.length === 0 ? (
                                <p>No pending requests.</p>
                            ) : (
                        <div key={req.id} className="request-card">
                            <div>
                                <strong>
                                    {req.requester?.first_name} {req.requester?.last_name}
                                </strong>
                                {" "}requested a meeting
                                <br />
                                <em>{formatSlotRange(req.start_time, req.end_time)}</em>

                                {req.message && <p>{req.message}</p>}
                            </div>

                            <div className="request-actions">
                                <button onClick={() => handleAcceptRequest(req.id)}>Accept</button>
                                <button onClick={() => handleDeclineRequest(req.id)}>Decline</button>
                                {req.requester?.email && (
                                    <button onClick={() => emailOwner(req.requester.email)}>
                                        Email
                                    </button>
                                )}
                            </div>
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
                                        <option value="" disabled>Select slot type</option>
                                        <option value="request">Request</option>
                                        <option value="group">Group</option>
                                        <option value="office_hours">Office Hours</option>
                                    </select>
                                </label>

                                <label>Start Date:
                                    <input 
                                        id="date" 
                                        type="date" 
                                        name="date" 
                                        value={formData.date} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                </label>

                                {/* +++++ */}
                                <label>Single Day / Multiple Days 
                                    <select
                                        name="mode"
                                        value={formData.mode}
                                        onChange={handleInputChange}
                                    >
                                        <option value="single">Single Day</option>
                                        <option value="multiple">Multiple Days</option>
                                    </select>
                                </label>

                                {formData.mode === "multiple" && (
                                    <div className="weekday-section">
                                        <label className="weekday-title">Select Days:</label>
                                        <div className="weekday-grid">
                                            {[
                                                { label: "Sun", idx: 0},
                                                { label: "Mon", idx: 1 },
                                                { label: "Tue", idx: 2 },
                                                { label: "Wed", idx: 3 },
                                                { label: "Thu", idx: 4 },
                                                { label: "Fri", idx: 5 },
                                                { label: "Sat", idx: 6 }
                                            ].map(day => (
                                                <label key={day.idx} className="weekday-pill">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.selectedDays.includes(day.idx)}
                                                        onChange={() => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                selectedDays: prev.selectedDays.includes(day.idx)
                                                                    ? prev.selectedDays.filter(d => d !== day.idx)
                                                                    : [...prev.selectedDays, day.idx]
                                                            }));
                                                        }}
                                                    />
                                                    <span>{day.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
