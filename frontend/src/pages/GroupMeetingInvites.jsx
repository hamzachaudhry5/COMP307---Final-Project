import { useState } from "react";
import api from "../api/client";

function GroupMeetingInvites({ invites, onVoteSubmitted }) {
    const [votingMeeting, setVotingMeeting] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState([]);

    async function handleVote(meetingId) {
        try {
            await api.groupMeetings.vote(meetingId, { option_ids: selectedOptions });
            alert("Votes submitted successfully!");
            setVotingMeeting(null);
            setSelectedOptions([]);
            if (onVoteSubmitted) onVoteSubmitted();
        } catch (err) {
            alert(err.message);
        }
    }

    if (invites.length === 0) return null;

    return (
        <>
            <section className="dashboard-section">
                <h3 className="form-header">Group Meeting Invitations</h3>
                <div className="slots-list">
                    {invites.map(invite => (
                        <div key={invite.id} className="slot-card">
                            <div className="slot-details">
                                <h4>{invite.title}</h4>
                                <p>{invite.description}</p>
                            </div>
                            <div className="slot-actions">
                                {!invite.is_finalized ? (
                                    <button className="submit-button" onClick={() => setVotingMeeting(invite)}>
                                        Vote Availability
                                    </button>
                                ) : (
                                    <span className="booked-label">Finalized</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {votingMeeting && (
                <section className="dashboard-section">
                    <h3 className="form-header">Voting for: {votingMeeting.title}</h3>
                    <p>Select all times you are available:</p>
                    <div className="weekday-grid">
                        {votingMeeting.availability_options.map(opt => (
                            <label key={opt.id} className="weekday-pill" style={{ width: "auto", padding: "10px" }}>
                                <input
                                    type="checkbox"
                                    checked={selectedOptions.includes(opt.id)}
                                    onChange={() => setSelectedOptions(prev =>
                                        prev.includes(opt.id)
                                            ? prev.filter(id => id !== opt.id)
                                            : [...prev, opt.id]
                                    )}
                                />
                                <span>{new Date(opt.start_time).toLocaleString()}</span>
                            </label>
                        ))}
                    </div>
                    <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
                        <button className="submit-button" onClick={() => handleVote(votingMeeting.id)}>
                            Submit Votes
                        </button>
                        <button className="delete-button" onClick={() => { setVotingMeeting(null); setSelectedOptions([]); }}>
                            Cancel
                        </button>
                    </div>
                </section>
            )}
        </>
    );
}

export default GroupMeetingInvites;