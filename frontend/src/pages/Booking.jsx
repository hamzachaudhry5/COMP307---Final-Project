import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function Booking() {
    const navigate = useNavigate();
    const { user, logout, isLoading } = useAuth();
    const location = useLocation();

    const [owners, setOwners] = useState([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState("");
    const [slots, setSlots] = useState([]);
    const [pageLoading, setPageLoading] = useState(false);
    const [bookingSlotId, setBookingSlotId] = useState(null);
    const [error, setError] = useState("");

    const [sentRequests, setSentRequests] = useState([]);
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
    const [appointments, setAppointments] = useState([])   
    const calendarItems = appointments.map(reservation => reservation.slot);
    const [inviteOwner, setInviteOwner] = useState(null);

    const [groupInvites, setGroupInvites] = useState([]);
    const [votingMeeting, setVotingMeeting] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState([]);

    // const queryParams = new URLSearchParams(location.search);
    // const ownerIdFromURL = queryParams.get("ownerId"); 
    const { token } = useParams();

    useEffect(() => {
        if (!isLoading && !user) {
            navigate("/login");
        }
    }, [user, isLoading, navigate]);


    useEffect(() => {
        if (isLoading || !user) return;

        async function loadData() {
            try {
                setPageLoading(true);

                const ownerList = await api.slots.getOwners();
                setOwners(ownerList);

                const myReservations = await api.reservations.getMy();
                setAppointments(myReservations);

                const myGroupInvites = await api.groupMeetings.getInvites();
                setGroupInvites(myGroupInvites);

            } catch (err) {
                console.error(err);
                setError(err.message || "Failed to load data");
            } finally {
                setPageLoading(false);
            }
        }

        loadData();
    }, [isLoading, user]);

    useEffect(() => {
        if (!token) return;

        if (isLoading) return;

        if (!user) {
            navigate("/login", {
                state: {
                    from: location.pathname
                }
            });
            return;
        }

        async function loadInviteSlots(){
            try {
                setPageLoading(true);
                setError("");

                const ownerSlots = await api.slots.getByInvite(token);
                setSlots(ownerSlots);

                if (ownerSlots.length > 0 && ownerSlots[0].owner_id){
                    setSelectedOwnerId(ownerSlots[0].owner_id);
                }
                // setSelectedOwnerId("");
            } catch (err) {
                console.error(err);
                setError("Invalid or expired invite link");
            } finally {
                setPageLoading(false);
            }
        }
        loadInviteSlots();
    }, [token, user, isLoading, navigate, location.pathname]);

    async function handleOwnerChange(e) {
        const ownerId = e.target.value;
        setSelectedOwnerId(ownerId);
        setSlots([]);
        setError("");

        if (!ownerId) return;

        try {
            setPageLoading(true);
            const ownerSlots = await api.slots.getByOwner(ownerId);
            setSlots(ownerSlots);
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to load slots");
        } finally {
            setPageLoading(false);
        }
    }

    async function requestMeeting(e) {
        e.preventDefault();

        if (!requestData.date || !requestData.startTime || !requestData.endTime) {
            alert("Please fill in all fields.");
            return;
        }
        if (requestData.startTime >= requestData.endTime) {
            alert("Start time must be before end time.");
            return;
        }

        if (!selectedOwnerId) {
            alert("Please choose an owner first.");
            return;
        }

        try {
            await api.meetingRequests.send({
                owner_id: Number(selectedOwnerId),
                start_time: `${requestData.date}T${requestData.startTime}:00`,
                end_time: `${requestData.date}T${requestData.endTime}:00`,
                message: requestData.message || ""
            });
            
            alert("Meeting request sent!");
            setRequestData({
                date: "",
                startTime: "",
                endTime: "",
                message: ""
            });
        } catch (err) {
            console.error(err);
            alert("Failed to send meeting request");
        }
    }

    async function bookSlot(slotId) {
        const confirmed = window.confirm("Book this appointment?");
        if (!confirmed) return;

        try {
            setBookingSlotId(slotId);
            const response = await api.reservations.create(slotId);

            setSlots(prev => prev.filter(slot => slot.id !== slotId));
            
            const myReservations = await api.reservations.getMy();
            setAppointments(myReservations);

            alert("Appointment booked!");
            if (response?.mailto) {
                openMailClient(response.mailto);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to book appointment");
        } finally {
            setBookingSlotId(null);
        }
    }

    async function handleVote(meetingId) {
        try {
            await api.groupMeetings.vote(meetingId, { option_ids: selectedOptions });
            alert("Votes submitted successfully!");
            setVotingMeeting(null);
            setSelectedOptions([]);
        } catch (err) {
            alert(err.message);
        }
    }

    function openMailClient(response) {
        const mailtoURL = `mailto:${response.to}?subject=${encodeURIComponent(response.subject || "")}&body=${encodeURIComponent(response.body || "")}`;
        window.location.href = mailtoURL;
    }

    async function handleLogout() {
        await logout();
        navigate("/login");
    }

    function formatDateTime(dateStr) {
        const date = new Date(dateStr);

        return date.toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
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
            <header className="navbar">
                <div className="container nav-content">
                    <h1 className="title">BookSOCS</h1>
                    <nav>
                        <Link to="/">Home</Link>
                        <Link to="/dashboard">Dashboard</Link>
                        <button className="logout-button" onClick={handleLogout}>
                            Logout
                        </button>
                    </nav>
                </div>
            </header>

            <main className="dashboard-page">
                {/* Calendar */}
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
                                            <div key={item.id} className="calendar-slot calendar-slot--has-bookings">
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
                </section>

                {/* Group Meeting Invitations */}
                {groupInvites.length > 0 && (
                    <section className="dashboard-section">
                        <h3 className="form-header">Group Meeting Invitations</h3>
                        <div className="slots-list">
                            {groupInvites.map(invite => (
                                <div key={invite.id} className="slot-card">
                                    <div className="slot-details">
                                        <h4>{invite.title}</h4>
                                        <p>{invite.description}</p>
                                    </div>
                                    <div className="slot-actions">
                                        {!invite.is_finalized ? (
                                            <button className="submit-button" onClick={() => setVotingMeeting(invite)}>Vote Availability</button>
                                        ) : (
                                            <span className="booked-label">Finalized</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {votingMeeting && (
                    <section className="dashboard-section">
                        <h3 className="form-header">Voting for: {votingMeeting.title}</h3>
                        <p>Select all times you are available:</p>
                        <div className="weekday-grid">
                            {votingMeeting.availability_options.map(opt => (
                                <label key={opt.id} className="weekday-pill" style={{ width: 'auto', padding: '10px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedOptions.includes(opt.id)}
                                        onChange={() => setSelectedOptions(prev => 
                                            prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id]
                                        )}
                                    />
                                    <span>{new Date(opt.start_time).toLocaleString()}</span>
                                </label>
                            ))}
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <button className="submit-button" onClick={() => handleVote(votingMeeting.id)}>Submit Votes</button>
                            <button className="delete-button" onClick={() => {setVotingMeeting(null); setSelectedOptions([]);}}>Cancel</button>
                        </div>
                    </section>
                )}

                {/* Slots List */}       
                <div className="container">
                    <section className="dashboard-section">
                        <h2 className="dash-header">Book an Appointment</h2>

                        <label>
                            Choose an owner:
                            <select
                                value={selectedOwnerId}
                                onChange={handleOwnerChange}
                                className="owner-select"
                            >
                                <option value="">Select an owner</option>

                                {owners.map(owner => (
                                    <option key={owner.user_id} value={owner.user_id}>
                                        {owner.first_name} {owner.last_name} ({owner.email})
                                    </option>
                                ))}
                            </select>
                        </label>

                        {selectedOwnerId && (
                            <button 
                                className="secondary-button" 
                                style={{ marginLeft: '10px' }}
                                onClick={() => {
                                    const owner = owners.find(o => String(o.user_id) === String(selectedOwnerId));
                                    if (owner) window.location.href = `mailto:${owner.email}`;
                                }}
                            >
                                Email Owner
                            </button>
                        )}

                        {error && <p className="error-message">{error}</p>}

                        {pageLoading && <p>Loading...</p>}

                        {!pageLoading && selectedOwnerId && slots.length === 0 && (
                            <p><br></br>No public slots available for this owner.</p>
                        )}

                        <section className="dashboard-section">
                            <h3 className="form-header">Request a meeting with <></>
                            <span className="owner-name">
                                {owners.find(o => String(o.user_id) === String(selectedOwnerId))?.first_name} 
                                <> </>
                                {owners.find(o => String(o.user_id) === String(selectedOwnerId))?.last_name}:</span></h3>
                            
                            <form className="slot-form" onSubmit={requestMeeting}>

                                <label>Date:
                                    <input 
                                        id="date" 
                                        type="date" 
                                        name="date" 
                                        value={requestData.date} 
                                        onChange={e => setRequestData(prev => ({ ...prev, date: e.target.value }))} 
                                        required 
                                    />
                                </label>

                                <label>Start Time:
                                    <input 
                                        id="startTime" 
                                        type="time" 
                                        name="startTime" 
                                        value={requestData.startTime} 
                                        onChange={e => setRequestData(prev => ({ ...prev, startTime: e.target.value }))}
                                        required 
                                    />
                                </label>

                                <label>End Time:
                                    <input 
                                        id="endTime" 
                                        type="time" 
                                        name="endTime" 
                                        value={requestData.endTime} 
                                        onChange={e => setRequestData(prev => ({ ...prev, endTime: e.target.value }))}
                                        required 
                                    />
                                </label>


                                <label>Description
                                    <textarea className="description-textarea"
                                        name="description"
                                        value={requestData.message}
                                        onChange={e => setRequestData(prev => ({ ...prev, message: e.target.value }))}
                                        placeholder="Details about this meeting..."
                                        rows={3}
                                    />
                                </label>

                                <button className="submit-button" type="submit">
                                    Submit Meeting Request
                                </button>
                            </form>
                        </section>
                        
                        <div className="slots-list">
                            {slots.map(slot => (
                                <div key={slot.id} className="slot-card">
                                    <div className="slot-details">
                                        <h4>{slot.title}</h4>

                                        <p>
                                            {formatDateTime(slot.start_time)}
                                            {" - "}
                                            {new Date(slot.end_time).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </p>

                                        {slot.description && (
                                            <p>{slot.description}</p>
                                        )}

                                        <p>Type: {slot.slot_type}</p>
                                        <p>Max participants: {slot.max_participants}</p>
                                    </div>

                                    <div className="slot-actions">
                                        <button
                                            className="submit-button"
                                            type="button"
                                            disabled={bookingSlotId === slot.id}
                                            onClick={() => bookSlot(slot.id)}
                                        >
                                            {bookingSlotId === slot.id ? "Booking..." : "Book"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default Booking;
