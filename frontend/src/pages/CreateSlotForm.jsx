import { useState } from "react";
import api from "../api/client";

const INITIAL_FORM = {
    slotTitle: "",
    description: "",
    slotType: "general slot",
    date: "",
    startTime: "",
    endTime: "",
    isRecurring: false,
    recurrenceWeeks: 1,
    maxParticipants: 1,
    mode: "single",
    selectedDays: []
};

function getNextWeekdayDate(baseDate, targetDay) {
    const date = new Date(baseDate);
    const diff = ((targetDay - date.getDay()) + 7) % 7;
    date.setDate(date.getDate() + diff);
    return date;
}

function CreateSlotForm({ onSlotsCreated }) {
    const [formData, setFormData] = useState(INITIAL_FORM);

    function handleInputChange(e) {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const { slotTitle, description, slotType, date, startTime, endTime,
            isRecurring, recurrenceWeeks, maxParticipants, mode, selectedDays } = formData;

        if (!slotTitle || !date || !startTime || !endTime || !slotType) {
            alert("Please fill in all fields.");
            return;
        }
        if (startTime >= endTime) {
            alert("Start time must be before end time.");
            return;
        }

        const [year, month, day] = date.split("-").map(Number);
        const baseDate = new Date(year, month - 1, day);

        let daysToUse = [];
        if (mode === "single") {
            daysToUse = [baseDate.getDay()];
        } else {
            if (selectedDays.length === 0) { alert("Select at least one day."); return; }
            daysToUse = selectedDays;
        }

        const slotsPayload = daysToUse.map(targetDay => {
            const d = getNextWeekdayDate(baseDate, targetDay);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return {
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

        try {
            const newSlots = await api.slots.createBulk({ slots: slotsPayload });
            onSlotsCreated(newSlots);
            setFormData(INITIAL_FORM);
        } catch (err) {
            console.error(err);
            alert("Failed to create slot: " + err.message);
        }
    }

    return (
        <section className="dashboard-section">
            <h3 className="form-header">Create a slot</h3>
            <form className="slot-form" onSubmit={handleSubmit}>
                <label>Slot Title:
                    <input type="text" name="slotTitle" value={formData.slotTitle} onChange={handleInputChange} required />
                </label>
                <label>Slot Type:
                    <select name="slotType" value={formData.slotType} onChange={handleInputChange} required>
                        <option value="" disabled>Select slot type</option>
                        <option value="general slot">General Slot</option>
                        <option value="group meeting">Group Meeting</option>
                        <option value="office hours">Office Hours</option>
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
                                    <input
                                        type="checkbox"
                                        checked={formData.selectedDays.includes(idx)}
                                        onChange={() => setFormData(prev => ({
                                            ...prev,
                                            selectedDays: prev.selectedDays.includes(idx)
                                                ? prev.selectedDays.filter(d => d !== idx)
                                                : [...prev.selectedDays, idx]
                                        }))}
                                    />
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
                <label>Description
                    <textarea className="description-textarea" name="description" value={formData.description} onChange={handleInputChange} rows={3} />
                </label>
                <button className="submit-button" type="submit">Create Slot</button>
            </form>
        </section>
    );
}

export default CreateSlotForm;