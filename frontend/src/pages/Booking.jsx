import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function Booking() {
    const navigate = useNavigate();
    const { user, logout, isLoading } = useAuth();

    const [owners, setOwners] = useState([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState("");
    const [slots, setSlots] = useState([]);
    const [pageLoading, setPageLoading] = useState(false);
    const [bookingSlotId, setBookingSlotId] = useState(null);
    const [error, setError] = useState("");

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

    const location = useLocation();
    // const queryParams = new URLSearchParams(location.search);
    // const ownerIdFromURL = queryParams.get("ownerId"); 
    const { token } = useParams();


    useEffect(() => {
        if (isLoading || !user) return;

        async function loadOwners() {
            try {
                setPageLoading(true);

                const ownerList = await api.slots.getOwners();
                setOwners(ownerList);

                const myReservations = await api.reservations.getMy();
                setAppointments(myReservations);
            } catch (err) {
                console.error(err);
                setError(err.message || "Failed to load owners");
            } finally {
                setPageLoading(false);
            }
        }

        loadOwners();
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
            await api.meetingRequests.create({
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
            await api.reservations.create(slotId);

            setSlots(prev => prev.filter(slot => slot.id !== slotId));
            
            const myReservations = await api.reservations.getMy();
            setAppointments(myReservations);

            alert("Appointment booked!");
        } catch (err) {
            console.error(err);
            alert("Failed to book appointment");
        } finally {
            setBookingSlotId(null);
        }
    }

    function handleLogout() {
        logout();
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
                </section>

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
                                        {owner.first_name} {owner.last_name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {error && <p className="error-message">{error}</p>}

                        {pageLoading && <p>Loading...</p>}

                        {!pageLoading && selectedOwnerId && slots.length === 0 && (
                            <p>No public slots available for this owner.</p>
                        )}
                        
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