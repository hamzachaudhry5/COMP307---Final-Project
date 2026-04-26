import { useState } from "react";
import api from "../api/client";

const INITIAL = { date: "", startTime: "", endTime: "", message: "" };

function MeetingRequestForm({ owners, selectedOwnerId }) {
    const [requestData, setRequestData] = useState(INITIAL);

    const selectedOwner = owners.find(o => String(o.user_id) === String(selectedOwnerId));

    async function handleSubmit(e) {
        e.preventDefault();
        const { date, startTime, endTime, message } = requestData;

        if (!date || !startTime || !endTime) { alert("Please fill in all fields."); return; }
        if (startTime >= endTime) { alert("Start time must be before end time."); return; }
        if (!selectedOwnerId) { alert("Please choose an owner first."); return; }

        try {
            await api.meetingRequests.send({
                owner_id: Number(selectedOwnerId),
                start_time: `${date}T${startTime}:00`,
                end_time: `${date}T${endTime}:00`,
                message: message || ""
            });
            alert("Meeting request sent!");
            setRequestData(INITIAL);
        } catch (err) {
            console.error(err);
            alert("Failed to send meeting request");
        }
    }

    return (
        <section className="dashboard-section">
            <h3 className="form-header">
                Request a meeting with{" "}
                <span className="owner-name">
                    {selectedOwner ? `${selectedOwner.first_name} ${selectedOwner.last_name}` : ""}:
                </span>
            </h3>
            <form className="slot-form" onSubmit={handleSubmit}>
                <label>Date:
                    <input type="date" value={requestData.date}
                        onChange={e => setRequestData(p => ({ ...p, date: e.target.value }))} required />
                </label>
                <label>Start Time:
                    <input type="time" value={requestData.startTime}
                        onChange={e => setRequestData(p => ({ ...p, startTime: e.target.value }))} required />
                </label>
                <label>End Time:
                    <input type="time" value={requestData.endTime}
                        onChange={e => setRequestData(p => ({ ...p, endTime: e.target.value }))} required />
                </label>
                <label>Description
                    <textarea className="description-textarea" rows={3}
                        value={requestData.message}
                        onChange={e => setRequestData(p => ({ ...p, message: e.target.value }))}
                        placeholder="Details about this meeting..."
                    />
                </label>
                <button className="submit-button" type="submit">Submit Meeting Request</button>
            </form>
        </section>
    );
}

export default MeetingRequestForm;