import { useState } from "react";

function WeekCalendar({ calendarItems, ownerReservations, isOwner, onExport, onBook }) {
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDays = getWeekDays(weekOffset);
    const weekLabel = getWeekRange(weekDays);

    function getWeekDays(offset = 0) {
        const today = new Date();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - today.getDay() + offset * 7);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(sunday);
            d.setDate(sunday.getDate() + i);
            return d;
        });
    }

    function getWeekRange(days) {
        const opts = { month: "short", day: "numeric" };
        return `${days[0].toLocaleDateString("en-US", opts)} - ${days[6].toLocaleDateString("en-US", opts)}`;
    }

    function isSameDay(dateStr, day) {
        const d = new Date(dateStr);
        return d.getFullYear() === day.getFullYear()
            && d.getMonth() === day.getMonth()
            && d.getDate() === day.getDate();
    }

    return (
        <section className="dashboard-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 className="form-header" style={{ marginBottom: 0 }}>Your Appointments:</h3>
                <button className="secondary-button" onClick={onExport}>
                    Export Calendar (.ics)
                </button>
            </div>

            <div className="week-nav">
                <button onClick={() => setWeekOffset(prev => prev - 1)}>&lt;</button>
                <h3 className="week-title">{weekLabel}</h3>
                <button onClick={() => setWeekOffset(prev => prev + 1)}>&gt;</button>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "8px", fontSize: "0.8rem", color: "#6b7280", flexWrap: "wrap" }}>
                {isOwner ? (
                    <>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#e5e7eb", border: "1px solid #d1d5db", display: "inline-block" }} />
                            Your slot (Empty)
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#1d4ed8", display: "inline-block" }} />
                            Your slot (Booked)
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#a6192e", display: "inline-block" }} />
                            Booking
                        </span>
                    </>
                ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#a6192e", display: "inline-block" }} />
                        Booked appointment
                    </span>
                )}
            </div>

            <div className="week-grid">
                {weekDays.map((day, i) => {
                    const dayItems = calendarItems.filter(item => isSameDay(item.start_time, day));
                    return (
                        <div key={i} className="week-day">
                            <div className="week-day-header">
                                <div className="week-day-initial">
                                    {day.toLocaleDateString("en-US", { weekday: "short" })[0]}
                                </div>
                                <div className="week-day-number">{day.getDate()}</div>
                            </div>
                            <div className="week-day-slots">
                                {dayItems.map(item => {
                                    const hasReservations = ownerReservations.some(r => Number(r.slot_id) === Number(item.id));
                                    const bookerCount = ownerReservations.filter(r => Number(r.slot_id) === Number(item.id)).length;

                                    let slotClass = "calendar-slot";
                                    if (item._isOwnSlot) {
                                        if (hasReservations) slotClass += " calendar-slot--own-slot-booked";
                                    } else {
                                        slotClass += " calendar-slot-booking";
                                    }

                                    return (
                                        <div key={item.id} className={slotClass}>
                                            <div className="slot-time">
                                                {new Date(item.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                {" - "}
                                                {new Date(item.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                            <div className="slot-title">{item.title}</div>
                                            <div className="slot-owner"><strong>Owner:</strong><br />{item.ownerName}</div>
                                            {/* Capacity only for own slots (types 1 & 2) */}
                                            {item._isOwnSlot && (
                                                <div className="slot-capacity">
                                                    {bookerCount} / {item.max_participants || 1} booked
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {dayItems.length === 0 && (
                                    <div className="week-day-empty">No Events</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button className="book-button" onClick={onBook}>Book Appointment</button>
        </section>
    );
}

export default WeekCalendar;