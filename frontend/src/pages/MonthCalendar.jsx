import { useState } from "react";
import { isSameDay, getMonthMatrix } from "../utils/calendar";

function MonthCalendar({ calendarItems, ownerReservations, isOwner }) {
    const [date, setDate] = useState(new Date());
    const weeks = getMonthMatrix(date);

    function getDayItems(day) {
        return calendarItems.filter(item => isSameDay(item.start_time, day));
    }

    function changeMonth(delta) {
        const newDate = new Date(date);
        newDate.setMonth(date.getMonth() + delta);
        setDate(newDate);
    }

    const monthLabel = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });
    
    const weekDaysHeader = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    const isCurrentMonth = (day) => day.getMonth() === date.getMonth();

    return(
        <section className="month-calendar">
            <h2 className="dash-header">Your Bookings: </h2>
            
            <div className="week-nav">
                <button onClick={() => changeMonth(-1)}>&lt;</button>
                <h3 className="week-title">{monthLabel}</h3>
                <button onClick={() => changeMonth(1)}>&gt;</button>
            </div>

            <div className="week-grid month-header">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                    <div key={d} className="week-day-header week-day-initial">
                        {d}
                    </div>
                ))}
            </div>

            {/* MONTH GRID */}
            <div className="week-grid month-grid">

                {weeks.flat().map((day, i) => {
                    const dayItems = getDayItems(day);

                    return (
                        <div key={i} className={`week-day month-day ${!isCurrentMonth(day) ? "muted-day" : ""}`}>
                            <div className="week-day-header">
                                <div className="week-day-number">
                                    {day.getDate()}
                                </div>
                            </div>

                            <div className="week-day-slots">
                                {dayItems.map(item => {
                                    const hasReservations = isOwner && ownerReservations.some(r => Number(r.slot_id) === Number(item.id));
                                    const isRed = !isOwner || hasReservations;
                                    const bookerCount = isOwner
                                        ? ownerReservations.filter(r => Number(r.slot_id) === Number(item.id)).length
                                        : 0;
                                    return (
                                        <div key={item.id} className={`calendar-slot${isRed ? " calendar-slot--has-bookings" : ""}`}>
                                            <div className="slot-time">
                                                {new Date(item.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                {" - "}
                                                {new Date(item.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                            <div className="slot-title">{item.title}</div>
                                            <div className="slot-owner"><strong>Owner:</strong><br></br> {item.ownerName}</div>
                                            {isOwner && (
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
        </section>
    );

}
export default MonthCalendar;