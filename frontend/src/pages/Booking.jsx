import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import WeekCalendar from "./WeekCalendar";
import GroupMeetingInvites from "./GroupMeetingInvites";
import MeetingRequestForm from "./MeetingRequestForm";
import { buildOwnerMap, resolveOwnerName } from "../utils/owners";

function Booking() {
    const navigate = useNavigate();
    const { user, logout, isLoading } = useAuth();
    const location = useLocation();
    const { token } = useParams();
    const isOwner = user?.role === "owner"; 

    const [owners, setOwners] = useState([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState("");
    const [slots, setSlots] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [groupInvites, setGroupInvites] = useState([]);
    const [bookingSlotId, setBookingSlotId] = useState(null);
    const [pageLoading, setPageLoading] = useState(false);
    const [error, setError] = useState("");

    const calendarItems = appointments.map(r => r.slot).filter(Boolean);

    useEffect(() => {
        if (!isLoading && !user) navigate("/login");
    }, [user, isLoading, navigate]);

    // Initial data load
    useEffect(() => {
        if (isLoading || !user) return;
        async function loadData() {
            try {
                setPageLoading(true);
                const [ownerList, myReservations, myGroupInvites] = await Promise.all([
                    api.slots.getOwners(),
                    api.reservations.getMy(),
                    api.groupMeetings.getInvites(),
                ]);
                setOwners(ownerList);
                setAppointments(myReservations);
                setGroupInvites(myGroupInvites);
            } catch (err) {
                setError(err.message || "Failed to load data");
            } finally {
                setPageLoading(false);
            }
        }
        loadData();
    }, [isLoading, user]);

    // Invite token load
    useEffect(() => {
        if (!token || isLoading) return;
        if (!user) { navigate("/login", { state: { from: location.pathname } }); return; }

        async function loadInviteSlots() {
            try {
                setPageLoading(true);
                setError("");
                const ownerSlots = await api.slots.getByInvite(token);
                setSlots(ownerSlots);
                if (ownerSlots.length > 0) setSelectedOwnerId(ownerSlots[0].owner_id);
            } catch (err) {
                setError("Invalid or expired invite link");
            } finally {
                setPageLoading(false);
            }
        }
        loadInviteSlots();
    }, [token, user, isLoading, navigate, location.pathname]);

    const ownerMap = buildOwnerMap(owners, user, isOwner);
    const calendarItemsWithOwners = calendarItems.map(item => ({
        ...item,
        ownerName: resolveOwnerName(ownerMap, item.owner_id)
    }));

    async function handleOwnerChange(e) {
        const ownerId = e.target.value;
        setSelectedOwnerId(ownerId);
        setSlots([]);
        setError("");
        if (!ownerId) return;
        try {
            setPageLoading(true);
            setSlots(await api.slots.getByOwner(ownerId));
        } catch (err) {
            setError(err.message || "Failed to load slots");
        } finally {
            setPageLoading(false);
        }
    }

    async function bookSlot(slotId) {
        if (!window.confirm("Book this appointment?")) return;
        try {
            setBookingSlotId(slotId);
            const response = await api.reservations.create(slotId);
            setSlots(prev => prev.filter(s => s.id !== slotId));
            setAppointments(await api.reservations.getMy());
            alert("Appointment booked!");
            if (response?.mailto) {
                window.location.href = `mailto:${response.mailto.to}?subject=${encodeURIComponent(response.mailto.subject || "")}&body=${encodeURIComponent(response.mailto.body || "")}`;
            }
        } catch (err) {
            alert("Failed to book appointment");
        } finally {
            setBookingSlotId(null);
        }
    }

    function formatDateTime(dateStr) {
        return new Date(dateStr).toLocaleString([], {
            weekday: "short", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    }

    if (isLoading) return <div className="loading-screen"><h2>Loading...</h2></div>;

    return (
        <div>
            <header className="navbar">
                <div className="container nav-content">
                    <h1 className="title">BookSOCS</h1>
                    <nav>
                        <Link to="/">Home</Link>
                        <Link to="/dashboard">Dashboard</Link>
                        <button className="logout-button" onClick={async () => { await logout(); navigate("/login"); }}>
                            Logout
                        </button>
                    </nav>
                </div>
            </header>

            <main className="dashboard-page">
                <WeekCalendar
                    calendarItems={calendarItemsWithOwners}
                    ownerReservations={[]}
                    isOwner={false}
                    onExport={null}
                    onBook={null}
                />

                <GroupMeetingInvites invites={groupInvites} />

                <div className="container">
                    <section className="dashboard-section">
                        <h2 className="dash-header">Book an Appointment</h2>

                        <label>
                            Choose an owner:
                            <select value={selectedOwnerId} onChange={handleOwnerChange} className="owner-select">
                                <option value="">Select an owner</option>
                                {owners.map(owner => (
                                    <option key={owner.user_id} value={owner.user_id}>
                                        {owner.first_name} {owner.last_name} ({owner.email})
                                    </option>
                                ))}
                            </select>
                        </label>

                        {selectedOwnerId && (
                            <button className="secondary-button" style={{ marginLeft: "10px" }}
                                onClick={() => {
                                    const owner = owners.find(o => String(o.user_id) === String(selectedOwnerId));
                                    if (owner) window.location.href = `mailto:${owner.email}`;
                                }}>
                                Email Owner
                            </button>
                        )}

                        {error && <p className="error-message">{error}</p>}
                        {pageLoading && <p>Loading...</p>}
                        {!pageLoading && selectedOwnerId && slots.length === 0 && (
                            <p><br />No public slots available for this owner.</p>
                        )}

                        <MeetingRequestForm owners={owners} selectedOwnerId={selectedOwnerId} />

                        <div className="slots-list">
                            {slots.map(slot => (
                                <div key={slot.id} className="slot-card">
                                    <div className="slot-details">
                                        <h4>{slot.title}</h4>
                                        <p>
                                            {formatDateTime(slot.start_time)}
                                            {" - "}
                                            {new Date(slot.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                        {slot.description && <p>{slot.description}</p>}
                                        <p>Type: {slot.slot_type}</p>
                                        <p>Max participants: {slot.max_participants}</p>
                                    </div>
                                    <div className="slot-actions">
                                        <button className="submit-button" type="button"
                                            disabled={bookingSlotId === slot.id}
                                            onClick={() => bookSlot(slot.id)}>
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