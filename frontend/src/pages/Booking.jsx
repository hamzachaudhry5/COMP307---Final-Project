import { Link, useNavigate } from "react-router-dom";
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

    useEffect(() => {
        if (isLoading || !user) return;

        async function loadOwners() {
            try {
                setPageLoading(true);
                const ownerList = await api.slots.getOwners();
                setOwners(ownerList);
            } catch (err) {
                console.error(err);
                setError(err.message || "Failed to load owners");
            } finally {
                setPageLoading(false);
            }
        }

        loadOwners();
    }, [isLoading, user]);

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

    async function bookSlot(slotId) {
        const confirmed = window.confirm("Book this appointment?");
        if (!confirmed) return;

        try {
            setBookingSlotId(slotId);
            await api.reservations.create(slotId);

            setSlots(prev => prev.filter(slot => slot.id !== slotId));
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