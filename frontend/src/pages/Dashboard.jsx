import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import GroupMeetings from "./GroupMeetings";
import WeekCalendar from "./WeekCalendar";
import PendingRequests from "./PendingRequests";
import CreateSlotForm from "./CreateSlotForm";
import SlotsList from "./SlotsList";

function formatSlotRange(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const dateLabel = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const timeOptions = { hour: "numeric", minute: "2-digit" };
    return `${dateLabel}, ${start.toLocaleTimeString("en-US", timeOptions)} - ${end.toLocaleTimeString("en-US", timeOptions)}`;
}

function Dashboard() {
    const navigate = useNavigate();
    const { user, logout, isLoading } = useAuth();
    const isOwner = user?.role === "owner";

    const [slots, setSlots] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [ownerReservations, setOwnerReservations] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);

    useEffect(() => {
        if (!isLoading && !user) navigate("/login");
    }, [user, isLoading, navigate]);

    useEffect(() => {
        if (isLoading || !user) return;
        async function loadData() {
            try { setAppointments(await api.reservations.getMy()); } catch (err) { console.error(err); }

            if (isOwner) {
                try { setPendingRequests(await api.meetingRequests.getIncoming()); } catch { setPendingRequests([]); }
                try { setSlots(await api.slots.getMine()); } catch (err) { console.error(err); }
                try { setOwnerReservations(await api.reservations.getOwnerAll()); } catch (err) { console.error(err); }
            }
        }
        loadData();
    }, [isLoading, user, isOwner]);

    // Derived calendar items
    const visibleOwnerSlots = isOwner
        ? slots.filter(s => s.status === "active" || s.status === "full")
        : [];
    const appointmentSlots = appointments.map(r => r.slot || r).filter(Boolean);
    const calendarItems = [...appointmentSlots, ...visibleOwnerSlots];

    // --- Handlers ---

    async function handleDeleteSlot(slotId) {
        if (!window.confirm("Delete this slot?")) return;
        try {
            const slotToDelete = slots.find(s => s.id === slotId);
            const response = await api.slots.delete(slotId);
            setSlots(prev => prev.filter(s => s.id !== slotId));
            setAppointments(prev => prev.filter(r => Number(r.slot?.id) !== slotId && Number(r.slot_id) !== slotId));
            if (response?.mailto) openMailClient(response.mailto);
            if (slotToDelete?.slot_type === "group meeting" || slotToDelete?.group_meeting_id) window.location.reload();
        } catch (err) { alert("Failed to delete slot"); }
    }

    async function handleDeleteBatch(batchId) {
        if (!window.confirm("Delete all slots in this batch?")) return;
        try {
            const response = await api.slots.deleteBatch(batchId);
            setSlots(prev => prev.filter(s => s.batch_id !== batchId));
            if (response?.mailto) openMailClient(response.mailto);
        } catch (err) { alert(err.message || "Failed to delete batch"); }
    }

    async function handleDeleteAll() {
        if (!window.confirm("Delete ALL your slots? This cannot be undone.")) return;
        try {
            for (const slot of slots) await api.slots.delete(slot.id);
            setSlots([]);
        } catch (err) { alert("Failed to delete all slots"); }
    }

    async function handleToggleVisibility(slotId) {
        const slot = slots.find(s => Number(s.id) === Number(slotId));
        if (!slot) return;
        const targetStatus = slot.status === "active" ? "private" : "active";
        setSlots(prev => prev.map(s => Number(s.id) === Number(slotId) ? { ...s, status: targetStatus } : s));
        try {
            const updated = targetStatus === "private"
                ? await api.slots.deactivate(slotId)
                : await api.slots.activate(slotId);
            setSlots(prev => prev.map(s => Number(s.id) === Number(slotId) ? updated : s));
        } catch (err) {
            setSlots(prev => prev.map(s => Number(s.id) === Number(slotId) ? slot : s));
            alert(err.message || "Failed to update visibility");
        }
    }

    async function handleToggleBatchVisibility(batchId, targetStatus) {
        try {
            const updated = targetStatus === "private"
                ? await api.slots.deactivateBatch(batchId)
                : await api.slots.activateBatch(batchId);
            setSlots(prev => prev.map(s => updated.find(u => u.id === s.id) || s));
        } catch (err) { alert(err.message || "Failed to update batch visibility"); }
    }

    async function handleGenerateInvite() {
        try {
            const res = await api.slots.createInviteLink();
            let url = res.invite_url;
            if (url.startsWith("/")) url = `${import.meta.env.VITE_FRONTEND_URL || window.location.origin}${url}`;
            await navigator.clipboard.writeText(url);
            alert("Invite URL copied:\n" + url);
        } catch (err) { alert("Failed to generate invite link"); }
    }

    async function handleAcceptRequest(requestId) {
        try {
            const response = await api.meetingRequests.accept(requestId);
            setPendingRequests(prev => prev.filter(r => r.id !== requestId));
            setAppointments(await api.reservations.getMy());
            if (isOwner) {
                setSlots(await api.slots.getMine());
                setOwnerReservations(await api.reservations.getOwnerAll()); 
            }
            if (response?.mailto) openMailClient(response.mailto);
        } catch (err) { alert("Failed to accept request"); }
    }

    async function handleDeclineRequest(requestId) {
        try {
            await api.meetingRequests.decline(requestId);
            setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) { alert("Failed to decline request"); }
    }

    async function handleExportCalendar() {
        try {
            const blob = await api.calendar.exportIcs();
            const url = window.URL.createObjectURL(blob);
            const a = Object.assign(document.createElement("a"), { href: url, download: "appointments.ics" });
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) { alert("Failed to export calendar: " + err.message); }
    }

    function emailUser(email) {
        if (email) window.location.href = `mailto:${email}`;
    }

    function openMailClient(response) {
        if (typeof response === "string") { window.location.href = response; return; }
        if (response?.to) {
            window.location.href = `mailto:${response.to}?subject=${encodeURIComponent(response.subject || "")}&body=${encodeURIComponent(response.body || "")}`;
        }
    }

    if (isLoading) return <div className="loading-screen"><h2>Loading...</h2></div>;

    return (
        <div>
            <header className="navbar">
                <div className="container nav-content">
                    <h1 className="title">BookSOCS</h1>
                    <nav>
                        <Link to="/">Home</Link>
                        {!isOwner && <Link to="/booking">Booking</Link>}
                        <button className="logout-button" onClick={async () => { await logout(); navigate("/login"); }}>
                            Logout
                        </button>
                    </nav>
                </div>
            </header>

            <main className="dashboard-page">
                <div className="container">
                    <h2 className="dash-header">Welcome, {user?.first_name}</h2>

                    <WeekCalendar
                        calendarItems={calendarItems}
                        ownerReservations={ownerReservations}
                        isOwner={isOwner}
                        onExport={handleExportCalendar}
                        onBook={() => navigate("/booking")}
                    />

                    {/* User appointments list */}
                    {!isOwner && appointments.length > 0 && (
                        <section className="slots-section">
                            <h3 className="form-header">Your Appointments</h3>
                            <div className="slots-list">
                                {[...appointments]
                                    .sort((a, b) => new Date(a.slot?.start_time) - new Date(b.slot?.start_time))
                                    .map(reservation => {
                                        const slot = reservation.slot;
                                        if (!slot) return null;
                                        return (
                                            <div key={reservation.id} className="slot-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div className="slot-details">
                                                        <h4>{slot.title}</h4>
                                                        <p>{formatSlotRange(slot.start_time, slot.end_time)}</p>
                                                        <p>Type: {slot.slot_type}</p>
                                                        {slot.description && <p>{slot.description}</p>}
                                                    </div>
                                                    <div className="slot-actions">
                                                        <button className="delete-button" onClick={async () => {
                                                            if (!window.confirm("Cancel this reservation?")) return;
                                                            try {
                                                                const response = await api.reservations.cancel(reservation.id);
                                                                setAppointments(prev => prev.filter(r => r.id !== reservation.id));
                                                                if (response?.mailto) openMailClient(response.mailto);
                                                            } catch { alert("Failed to cancel reservation"); }
                                                        }}>Cancel</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </section>
                    )}

                    {isOwner && (
                        <>
                            <PendingRequests
                                requests={pendingRequests}
                                onAccept={handleAcceptRequest}
                                onDecline={handleDeclineRequest}
                                onEmail={emailUser}
                                formatSlotRange={formatSlotRange}
                            />

                            <SlotsList
                                slots={slots}
                                ownerReservations={ownerReservations}
                                onDelete={handleDeleteSlot}
                                onDeleteBatch={handleDeleteBatch}
                                onDeleteAll={handleDeleteAll}
                                onToggleVisibility={handleToggleVisibility}
                                onToggleBatchVisibility={handleToggleBatchVisibility}
                                onGenerateInvite={handleGenerateInvite}
                                onEmail={emailUser}
                            />

                            <GroupMeetings isOwner={isOwner} userId={user?.user_id} />

                            <CreateSlotForm onSlotsCreated={newSlots => setSlots(prev => [...prev, ...newSlots])} />
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Dashboard;