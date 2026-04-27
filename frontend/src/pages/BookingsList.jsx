import api from "../api/client";

function formatSlotRange(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const dateLabel = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const timeOptions = { hour: "numeric", minute: "2-digit" };
    return `${dateLabel}, ${start.toLocaleTimeString("en-US", timeOptions)} - ${end.toLocaleTimeString("en-US", timeOptions)}`;
}

function BookingsList({ appointments = [], owners = [], onCancel }) {
    if (!appointments || appointments.length === 0) return (
        <section className="slots-section">
            <h3 className="form-header">Your Bookings</h3>
            <p>You have no bookings.</p>
        </section>
    );

    return (
        <section className="slots-section">
            <h3 className="form-header">Your Bookings</h3>
            <div className="slots-list">
                {[...appointments]
                    .sort((a, b) => new Date(a.slot?.start_time) - new Date(b.slot?.start_time))
                    .map(reservation => {
                        const slot = reservation.slot;
                        if (!slot) return null;
                        const owner = owners?.find(o => o.user_id === slot.owner_id);
                        
                        return (
                            <div key={reservation.id} className="slot-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div className="slot-details">
                                        <h4>{slot.title}</h4>
                                        <p>{formatSlotRange(slot.start_time, slot.end_time)}</p>
                                        <p>Type: {slot.slot_type}</p>
                                        {slot.description && <p>{slot.description}</p>}
                                        {owner && (
                                            <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                                                With {owner.first_name} {owner.last_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="slot-actions">
                                        {owner?.email && (
                                            <button
                                                className="secondary-button"
                                                onClick={() => window.location.href = `mailto:${owner.email}`}
                                            >
                                                Email Owner
                                            </button>
                                        )}
                                        <button className="delete-button" onClick={() => onCancel(reservation.id)}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </section>
    );
}

export default BookingsList;