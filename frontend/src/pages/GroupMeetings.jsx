import { useState, useEffect } from "react";
import api from "../api/client";

function GroupMeetings({ isOwner, userId }) {
    const [meetings, setMeetings] = useState([]);
    const [invites, setInvites] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    
    const [newMeeting, setNewMeeting] = useState({
        title: "",
        description: "",
        options: [{ start_time: "", end_time: "", date: "" }],
        invited_user_ids: []
    });

    const [heatmap, setHeatmap] = useState(null);
    const [selectedMeetingId, setSelectedMeetingId] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            if (isOwner) {
                const mine = await api.groupMeetings.getMine();
                setMeetings(mine);
                
                const users = await api.auth.getUsers();
                setAllUsers(users);
            }
            const myInvites = await api.groupMeetings.getInvites();
            setInvites(myInvites);
        } catch (err) {
            console.error("Failed to load group meetings", err);
        }
    }

    const handleAddOption = () => {
        setNewMeeting({
            ...newMeeting,
            options: [...newMeeting.options, { start_time: "", end_time: "", date: "" }]
        });
    };

    const handleOptionChange = (index, field, value) => {
        const updatedOptions = newMeeting.options.map((opt, i) => 
            i === index ? { ...opt, [field]: value } : opt
        );
        setNewMeeting({ ...newMeeting, options: updatedOptions });
    };

    const handleInviteToggle = (uId) => {
        setNewMeeting(prev => ({
            ...prev,
            invited_user_ids: prev.invited_user_ids.includes(uId)
                ? prev.invited_user_ids.filter(id => id !== uId)
                : [...prev.invited_user_ids, uId]
        }));
    };

    const createMeeting = async (e) => {
        e.preventDefault();
        if (newMeeting.invited_user_ids.length === 0) {
            alert("Please invite at least one user.");
            return;
        }
        try {
            const payload = {
                title: newMeeting.title,
                description: newMeeting.description,
                invited_user_ids: newMeeting.invited_user_ids,
                options: newMeeting.options.map(opt => ({
                    start_time: `${opt.date}T${opt.start_time}:00`,
                    end_time: `${opt.date}T${opt.end_time}:00`
                }))
            };
            await api.groupMeetings.create(payload);
            alert("Group meeting created!");
            setNewMeeting({
                title: "",
                description: "",
                options: [{ start_time: "", end_time: "", date: "" }],
                invited_user_ids: []
            });
            loadData();
        } catch (err) {
            alert(err.message);
        }
    };

    const deleteMeeting = async (id) => {
        if (!window.confirm("Are you sure you want to delete this group meeting? All votes and invites will be lost.")) return;
        try {
            await api.groupMeetings.delete(id);
            alert("Meeting deleted.");
            loadData();
        } catch (err) {
            alert(err.message);
        }
    };

    const viewHeatmap = async (meetingId) => {
        try {
            const data = await api.groupMeetings.getHeatmap(meetingId);
            setHeatmap(data);
            setSelectedMeetingId(meetingId);
        } catch (err) {
            alert(err.message);
        }
    };

    const finalizeMeeting = async (optionId) => {
        const weeks = prompt("How many weeks should this repeat?", "1");
        if (weeks === null) return;
        
        try {
            const res = await api.groupMeetings.finalize(selectedMeetingId, optionId, parseInt(weeks));
            alert("Meeting finalized and participants notified!");
            setHeatmap(null);
            setSelectedMeetingId(null);
            loadData();
            if (res.mailto) {
                const mailtoURL = `mailto:${res.mailto.to}?subject=${encodeURIComponent(res.mailto.subject)}&body=${encodeURIComponent(res.mailto.body)}`;
                window.location.href = mailtoURL;
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const getHeatmapColor = (voteCount, maxVotes) => {
        if (maxVotes === 0) return "rgba(0, 123, 255, 0.1)";
        const opacity = Math.max(0.1, voteCount / maxVotes);
        return `rgba(0, 123, 255, ${opacity})`;
    };

    return (
        <div className="group-meetings-container">
            {isOwner && (
                <section className="dashboard-section">
                    <h3 className="form-header">Create Group Meeting (Type 2)</h3>
                    <form onSubmit={createMeeting} className="slot-form">
                        <label>Title:
                            <input type="text" value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} required />
                        </label>
                        <label>Description:
                            <textarea className="description-textarea" value={newMeeting.description} onChange={e => setNewMeeting({...newMeeting, description: e.target.value})} />
                        </label>
                        
                        <div className="options-section" style={{ marginTop: '15px' }}>
                            <h4 style={{ marginBottom: '10px' }}>Time Options</h4>
                            {newMeeting.options.map((opt, i) => (
                                <div key={i} className="option-row" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    <input type="date" value={opt.date} onChange={e => handleOptionChange(i, "date", e.target.value)} required />
                                    <input type="time" value={opt.start_time} onChange={e => handleOptionChange(i, "start_time", e.target.value)} required />
                                    <input type="time" value={opt.end_time} onChange={e => handleOptionChange(i, "end_time", e.target.value)} required />
                                </div>
                            ))}
                            <button type="button" onClick={handleAddOption} className="secondary-button" style={{ marginBottom: '15px' }}>Add Option</button>
                        </div>

                        <div className="invite-section" style={{ marginTop: '15px' }}>
                            <h4 style={{ marginBottom: '10px' }}>Invite Users</h4>
                            <div className="user-grid">
                                {allUsers.map(u => (
                                    <label key={u.user_id} className="user-pill">
                                        <input type="checkbox" checked={newMeeting.invited_user_ids.includes(u.user_id)} onChange={() => handleInviteToggle(u.user_id)} />
                                        {u.first_name} {u.last_name} ({u.email})
                                    </label>
                                ))}
                                {allUsers.length === 0 && <p style={{ fontSize: '0.9rem', color: '#666' }}>No other users registered yet.</p>}
                            </div>
                        </div>
                        <button type="submit" className="submit-button" style={{ marginTop: '20px' }}>Create Group Meeting</button>
                    </form>
                </section>
            )}

            {isOwner && meetings.length > 0 && (
                <section className="slots-section" style={{ marginTop: '24px' }}>
                    <h3 className="form-header">Your Group Meetings</h3>
                    <div className="slots-list">
                        {meetings.map(m => (
                            <div key={m.id} className="slot-card">
                                <div className="slot-details">
                                    <h4>{m.title}</h4>
                                    <p>{m.is_finalized ? "Finalized" : "Ongoing Voting"}</p>
                                </div>
                                <div className="slot-actions">
                                    {!m.is_finalized && (
                                        <button onClick={() => viewHeatmap(m.id)} className="invite-button">View Heatmap</button>
                                    )}
                                    <button onClick={() => deleteMeeting(m.id)} className="delete-button">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {heatmap && (
                <section className="dashboard-section heatmap-container">
                    <h3 className="form-header">Heatmap Visualization</h3>
                    <p>Click on an option to finalize the meeting for that time.</p>
                    <div className="heatmap-grid">
                        {heatmap.map(opt => (
                            <div 
                                key={opt.id} 
                                className="heatmap-cell"
                                style={{ backgroundColor: getHeatmapColor(opt.vote_count, Math.max(...heatmap.map(o => o.vote_count))) }}
                                onClick={() => finalizeMeeting(opt.id)}
                            >
                                <strong>{new Date(opt.start_time).toLocaleString()}</strong>
                                <span>{opt.vote_count} votes</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setHeatmap(null)} className="delete-button">Close Heatmap</button>
                </section>
            )}
        </div>
    );
}

export default GroupMeetings;
