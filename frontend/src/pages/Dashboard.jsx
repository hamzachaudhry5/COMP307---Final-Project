import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import GroupMeetings from "./GroupMeetings";

function Dashboard() {
    const navigate = useNavigate();
    const { user, logout, isLoading } = useAuth();
    const isOwner = user?.role === "owner"; 

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
    const [ownerReservations, setOwnerReservations] = useState([]); // Track bookers
    const [pendingRequests, setPendingRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [owners, setOwners] = useState([]);
    const [requestData, setRequestData] = useState({
        date: "",
        startTime: "",
        endTime: "",
        message: ""
    });
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDays = getWeekDays(weekOffset);
    const weekLabel = getWeekRange(weekDays);

    useEffect(() => {
        if (!isLoading && !user) {
            navigate("/login");
        }
    }, [user, isLoading, navigate]);

    /* Private slots */
    const visibleOwnerSlots = isOwner
        ? slots.filter(slot =>
            slot.status === "active" || slot.status === "booked"
        )
        : [];
    
    const appointmentSlots = appointments
        .map(reservation => reservation.slot || reservation)
        .filter(Boolean);

    const calendarItems = [...appointmentSlots, ...visibleOwnerSlots];

    useEffect(() => {
        if (isLoading || !user) return;

        async function loadData() {
            try {
                const myReservations = await api.reservations.getMy();
                setAppointments(myReservations);
            } catch (err) {
                console.error("Failed to load reservations:", err);
            }

            try {
                const allOwners = await api.slots.getOwners();
                setOwners(allOwners);
            } catch (err) {
                console.error("Failed to load owners:", err);
            }

            try {
                const sentRequests = await api.meetingRequests.getSent();
                setSentRequests(sentRequests);
            } catch (err) {
                console.error("Failed to load sent requests:", err);
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
                    setSlots(mySlots);
                } catch (err) {
                    console.error("Failed to load slots:", err);
                }

                try {
                    const oRes = await api.reservations.getOwnerAll();
                    setOwnerReservations(oRes);
                } catch (err) {
                    console.error("Failed to load owner reservations:", err);
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
            selectedDays 
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
                daysToUse = selectedDays;
            }
            const slotsPayload = daysToUse.map(day => {
                const d = getNextWeekdayDate(baseDate, day);
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

            const newSlots = await api.slots.createBulk({ slots: slotsPayload });
            setSlots(prev => [...prev, ...newSlots]);

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
            const response = await api.slots.delete(slotId);
            setSlots(prev => prev.filter(slot => slot.id !== slotId));
            setAppointments(prev =>
                prev.filter(r =>
                    Number(r.slot?.id) !== Number(slotId) &&
                    Number(r.slot_id) !== Number(slotId)
                )
            );

            if (response?.mailto) {
                openMailClient(response.mailto);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to delete slot");
        }
    }

    async function deleteAllSlots() {
        const confirmed = window.confirm("Delete ALL your slots? This cannot be undone.");
        if (!confirmed) return;

        try {
            for (const slot of slots) {
                await api.slots.delete(slot.id);
            }
            setSlots([]);
            setAppointments(prev =>
                prev.filter(r =>
                    !slots.some(slot =>
                        Number(r.slot?.id) === Number(slot.id) ||
                        Number(r.slot_id) === Number(slot.id)
                    )
                )
            );
        } catch (err) {
            console.error(err);
            alert("Failed to delete all slots");
        }
    }
    
    async function cancelReservation(reservationId) {
        const confirmed = window.confirm("Cancel this reservation?");
        if (!confirmed) return;

        try {
            const response = await api.reservations.cancel(reservationId);
            setAppointments(prev => prev.filter(r => r.id !== reservationId));
            if (response?.mailto) {
                openMailClient(response.mailto);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to cancel reservation");
        }
    }
    
    async function generateInviteURL(slot) {
         try {
            const res = await api.slots.createInviteLink();
            let inviteURL = res.invite_url;
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
        const slot = slots.find(s => Number(s.id) === Number(slotId));
        if (!slot) return;

        const targetStatus = slot.status === "active" ? "private" : "active";
        // Optimistic UI
        setSlots(prev => prev.map(s => Number(s.id) === Number(slotId) ? { ...s, status: targetStatus } : s));

        try {
            const updatedSlot = targetStatus === "private"
                ? await api.slots.deactivate(slotId)
                : await api.slots.activate(slotId);

            setSlots(prevSlots =>
                prevSlots.map(s =>
                    Number(s.id) === Number(slotId) ? updatedSlot : s
                )
            );
        } catch (err) {
            console.error(err);
            setSlots(prev => prev.map(s => Number(s.id) === Number(slotId) ? slot : s));
            alert("Failed to update visibility");
        }
    }

    async function handleAcceptRequest(requestId) {
        try {
            const response = await api.meetingRequests.accept(requestId);
            setPendingRequests(prev => prev.filter(r => r.id !== requestId));

            const myReservations = await api.reservations.getMy();
            setAppointments(myReservations);

            if (isOwner) {
                const mySlots = await api.slots.getMine();
                setSlots(mySlots);
            }

            if (response?.mailto) {
                openMailClient(response.mailto);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to accept request");
        }
    }

    async function handleDeclineRequest(requestId) {
        try {
            await api.meetingRequests.decline(requestId);
            setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) {
            console.error(err);
            alert("Failed to decline request");
        }
    }

    async function handleLogout(){
        await logout();
        navigate("/login");
    }

    async function handleExportCalendar() {
        try {
            const blob = await api.calendar.exportIcs();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "appointments.ics";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert("Failed to export calendar: " + err.message);
        }
    }

    function emailOwner(email) {
        window.location.href = `mailto:${email}`;
    }

    function openMailClient(response) {
        if (typeof response === "string") {
            window.location.href = response;
            return;
        }
        if (response?.mailto || response?.url || response?.href) {
            window.location.href = response.mailto || response.url || response.href;
            return;
        }
        if (response?.to) {
            const mailtoURL = `mailto:${response.to}?subject=${encodeURIComponent(response.subject || "")}&body=${encodeURIComponent(response.body || "")}`;
            window.location.href = mailtoURL;
            return;
        }
        alert("No valid mailto or URL found in response");
    }

    function getWeekDays(offset = 0) {
        const today = new Date();
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
        return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}`;
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
        const dateLabel = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const timeOptions = { hour: "numeric", minute: "2-digit" };
        return `${dateLabel}, ${start.toLocaleTimeString("en-US", timeOptions)} - ${end.toLocaleTimeString("en-US", timeOptions)}`;
    }

    function getNextWeekdayDate(baseDate, targetDay) {
        const date = new Date(baseDate);
        const currentDay = date.getDay();
        let diff = targetDay - currentDay;
        if (diff < 0) diff += 7;
        date.setDate(date.getDate() + diff);
        return date;
    }

    if (isLoading) {
        return <div className="loading-screen"><h2>Loading...</h2></div>;
    }

  return (
    <div>
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

        <main className="dashboard-page">
            <div className="container">
                <h2 className="dash-header">Welcome, {user?.first_name}</h2>

                <GroupMeetings isOwner={isOwner} userId={user?.user_id} />

                <section className="dashboard-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 className="form-header" style={{ marginBottom: 0 }}>Your Bookings:</h3>
                        <button className="secondary-button" onClick={handleExportCalendar}>
                            Export Calendar (.ics)
                        </button>
                    </div>

                    <div className="week-nav">
                        <button onClick={() => setWeekOffset(prev => prev -1)}>&lt;</button>
                        <h3 className="week-title">{weekLabel}</h3>
                        <button onClick={() => setWeekOffset(prev => prev +1)}>&gt;</button>
                    </div>
                    <div className="week-grid">
                        {weekDays.map((day, i) => (
                            <div key={i} className="week-day">
                                <div className="week-day-header">
                                    <div className="week-day-initial">{day.toLocaleDateString("en-US", {weekday: "short"})[0]}</div>
                                    <div className="week-day-number">{day.getDate()}</div>
                                </div>
                                <div className="week-day-slots">
                                    {calendarItems.filter(item => isSameDay(item.start_time, day)).map(item => (
                                        <div key={item.id} className="calendar-slot">
                                            <div className="slot-time">
                                                {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {" - "}
                                                {new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="slot-title">{item.title}</div>
                                        </div>
                                    ))}
                                    {calendarItems.filter(item => isSameDay(item.start_time, day)).length === 0 && (
                                        <div className="week-day-empty">No Events</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="submit-button" onClick={() => navigate("/booking")}>Book Appointment</button>
                </section>

                {isOwner && (
                    <>  
                        <section className="slots-section">
                            <h3 className="form-header">Pending Requests</h3>
                            {pendingRequests.length === 0 ? <p>No pending requests.</p> : (
                            <div className="slots-list">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="request-card">
                                        <div>
                                            <strong>{req.requester?.first_name} {req.requester?.last_name}</strong>
                                            {req.requester?.email && <span> ({req.requester.email})</span>}
                                            <p>requested a meeting</p>
                                            <em>{formatSlotRange(req.start_time, req.end_time)}</em>
                                            <p>Message: {req.message}</p>
                                        </div>
                                        <div className="request-actions">
                                            <button onClick={() => handleAcceptRequest(req.id)}>Accept</button>
                                            <button onClick={() => handleDeclineRequest(req.id)}>Decline</button>
                                            {req.requester?.email && <button onClick={() => emailOwner(req.requester.email)}>Email</button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </section>

                        <section className="dashboard-section">
                            <h3 className="form-header">Create a slot</h3>
                            <form className="slot-form" onSubmit={createSlot}>
                                <label>Slot Title:
                                    <input type="text" name="slotTitle" value={formData.slotTitle} onChange={handleInputChange} required />
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
                                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                                </label>
                                <label>Single Day / Multiple Days 
                                    <select name="mode" value={formData.mode} onChange={handleInputChange}>
                                        <option value="single">Single Day</option>
                                        <option value="multiple">Multiple Days</option>
                                    </select>
                                </label>
                                {formData.mode === "multiple" && (
                                    <div className="weekday-section">
                                        <label className="weekday-title">Select Days:</label>
                                        <div className="weekday-grid">
                                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, idx) => (
                                                <label key={idx} className="weekday-pill">
                                                    <input type="checkbox" checked={formData.selectedDays.includes(idx)} onChange={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            selectedDays: prev.selectedDays.includes(idx) ? prev.selectedDays.filter(d => d !== idx) : [...prev.selectedDays, idx]
                                                        }));
                                                    }} />
                                                    <span>{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <label>Start Time: <input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} required /></label>
                                <label>End Time: <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} required /></label>
                                <label>Max Participants: <input type="number" name="maxParticipants" value={formData.maxParticipants} min="1" onChange={handleInputChange} /></label>
                                <label>Recurring <input type="checkbox" name="isRecurring" checked={formData.isRecurring} onChange={handleInputChange} /></label>
                                {formData.isRecurring && (
                                    <label>Repeat (weeks): <input type="number" name="recurrenceWeeks" value={formData.recurrenceWeeks} min="1" onChange={handleInputChange} /></label>
                                )}
                                <label>Description <textarea className="description-textarea" name="description" value={formData.description} onChange={handleInputChange} rows={3} /></label>
                                <button className="submit-button" type="submit">Create Slot</button>
                            </form>
                        </section>

                        <section className="slots-section">
                            <div className="slots-header">
                                <h3 className="form-header">Your Slots</h3>
                                <button className="delete-all-button" onClick={deleteAllSlots}>Delete All Slots</button>
                            </div>
                            {slots.length === 0 ? <p>You have no slots created yet.</p> : (
                                <div className="slots-list">
                                    {[...slots].sort((a,b) => new Date(a.start_time) - new Date(b.start_time)).map((slot) => {
                                        const booker = ownerReservations.find(r => Number(r.slot_id) === Number(slot.id));
                                        return (
                                            <div key={slot.id} className="slot-card">
                                                <div className="slot-details">
                                                    <h4>{slot.title}</h4>
                                                    <p>{formatSlotRange(slot.start_time, slot.end_time)}</p>
                                                    <p>Type: {slot.slot_type}</p>
                                                    {booker && (
                                                        <div style={{ marginTop: '8px', padding: '10px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                                            <strong>Booked by:</strong> {booker.user?.first_name} {booker.user?.last_name} ({booker.user?.email})
                                                            <button className="secondary-button" style={{ padding: '4px 8px', fontSize: '0.8rem', marginLeft: '10px' }} onClick={() => emailOwner(booker.user?.email)}>Email Student</button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="slot-actions">
                                                    {slot.status === "booked" ? <span className="booked-label">Booked</span> : (
                                                        <label className="visibility-toggle">
                                                            <span>{slot.status === "active" ? "Public" : "Private"}</span>
                                                            <input type="checkbox" checked={slot.status === "active"} onChange={() => toggleVisibility(slot.id)} />
                                                            <span className="toggle-slider"></span>
                                                        </label>
                                                    )}
                                                    <button className="invite-button" onClick={() => generateInviteURL(slot)}>Invite</button>
                                                    <button className="delete-button" onClick={() => deleteSlot(slot.id)}>Delete</button>
                                                </div>
                                            </div>
                                        );
                                    })}
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
