import { useState } from "react";

function formatSlotRange(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const dateLabel = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const timeOptions = { hour: "numeric", minute: "2-digit" };
    return `${dateLabel}, ${start.toLocaleTimeString("en-US", timeOptions)} - ${end.toLocaleTimeString("en-US", timeOptions)}`;
}

function getBatchSummary(batchSlots) {
    const start = new Date(batchSlots[0].start_time);
    const end = new Date(batchSlots[0].end_time);
    const timeOptions = { hour: "numeric", minute: "2-digit" };
    const timeRange = `${start.toLocaleTimeString("en-US", timeOptions)} – ${end.toLocaleTimeString("en-US", timeOptions)}`;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const uniqueDays = [...new Set(batchSlots.map(s => new Date(s.start_time).getDay()))];
    const daysLabel = uniqueDays.map(d => dayNames[d]).join(" & ");
    const firstDate = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const lastDate = new Date(batchSlots[batchSlots.length - 1].start_time)
        .toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const spanLabel = firstDate === lastDate ? firstDate : `${firstDate} → ${lastDate}`;
    return { daysLabel, timeRange, spanLabel };
}

// Renders booker list with individual + "Email All" actions
function BookerEmailPanel({ bookers, onEmail }) {
    const [open, setOpen] = useState(false);
    if (!bookers || bookers.length === 0) return null;

    const allEmails = bookers.map(b => b.user?.email).filter(Boolean).join(",");

    return (
        <div style={{ marginTop: "6px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "#374151", fontWeight: 500 }}>
                    {bookers.length === 1
                        ? `Booked by ${bookers[0].user?.first_name} ${bookers[0].user?.last_name}`
                        : `${bookers.length} bookers`}
                </span>
                {bookers.length === 1 ? (
                    <button
                        className="secondary-button"
                        style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                        onClick={() => onEmail(bookers[0].user?.email)}
                    >
                        Email
                    </button>
                ) : (
                    <>
                        <button
                            className="secondary-button"
                            style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                            onClick={() => onEmail(allEmails)}
                        >
                            Email All
                        </button>
                        <button
                            className="secondary-button"
                            style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                            onClick={() => setOpen(o => !o)}
                        >
                            {open ? "Hide ▲" : "Select ▼"}
                        </button>
                    </>
                )}
            </div>

            {/* Dropdown list of individual bookers */}
            {open && bookers.length > 1 && (
                <div style={{
                    marginTop: "6px", background: "#f3f4f6", borderRadius: "8px",
                    padding: "8px", display: "flex", flexDirection: "column", gap: "4px"
                }}>
                    {bookers.map((b, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                            <span style={{ color: "#374151" }}>
                                {b.user?.first_name} {b.user?.last_name}
                                <span style={{ color: "#9ca3af", marginLeft: "6px" }}>({b.user?.email})</span>
                            </span>
                            <button
                                className="secondary-button"
                                style={{ padding: "2px 8px", fontSize: "0.75rem", marginLeft: "8px" }}
                                onClick={() => onEmail(b.user?.email)}
                            >
                                Email
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SlotsList({ slots, ownerReservations, onDelete, onDeleteBatch, onDeleteAll,
    onToggleVisibility, onToggleBatchVisibility, onGenerateInvite, onEmail }) {

    const [expandedBatches, setExpandedBatches] = useState(new Set());

    const groupedSlots = [...slots]
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .reduce((groups, slot) => {
            const key = slot.batch_id || `solo-${slot.id}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(slot);
            return groups;
        }, {});

    function toggleExpand(batchKey) {
        setExpandedBatches(prev => {
            const next = new Set(prev);
            next.has(batchKey) ? next.delete(batchKey) : next.add(batchKey);
            return next;
        });
    }

    // All bookers for a given slot id (fixes find → filter)
    function getBookers(slotId) {
        return ownerReservations.filter(r => Number(r.slot_id) === Number(slotId));
    }

    // All bookers across every slot in a batch (for batch-level summary)
    function getBatchBookers(batchSlots) {
        return batchSlots.flatMap(slot => getBookers(slot.id));
    }

    return (
        <section className="slots-section">
            <div className="slots-header">
                <h3 className="form-header">Your Slots</h3>
                <div className="slot-actions" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
                    <button className="invite-button" onClick={onGenerateInvite}>Invite</button>
                    <button className="delete-all-button" onClick={onDeleteAll}>Delete All Slots</button>
                </div>
            </div>

            {slots.length === 0 ? (
                <p>You have no slots created yet.</p>
            ) : (
                <div className="slots-list">
                    {Object.entries(groupedSlots).map(([batchKey, batchSlots]) => {
                        const isBatch = batchSlots.length > 1;
                        const isExpanded = expandedBatches.has(batchKey);
                        const rep = batchSlots[0];

                        const allFull = batchSlots.every(s => s.status === "full");
                        const hasFull = batchSlots.some(s => s.status === "full");

                        const { daysLabel, timeRange, spanLabel } = isBatch ? getBatchSummary(batchSlots) : {};

                        // --- Solo slot bookers (fixes issue 1 & 2) ---
                        const soloBookers = !isBatch ? getBookers(rep.id) : [];

                        // --- Batch-level bookers for "Email All" across whole batch ---
                        const batchBookers = isBatch ? getBatchBookers(batchSlots) : [];

                        return (
                            <div key={batchKey} className="slot-card" style={{ display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", width: "100%" }}>
                                    {/* Left: details */}
                                    <div className="slot-details" style={{ alignSelf: "flex-start", flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                            <h4>{rep.title}</h4>
                                            {isBatch && (
                                                <span style={{ fontSize: "0.75rem", background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "99px", whiteSpace: "nowrap" }}>
                                                    {batchSlots.length} slots
                                                </span>
                                            )}
                                        </div>
                                        {isBatch ? (
                                            <>
                                                <p style={{ margin: "2px 0" }}>
                                                    <strong>{daysLabel}</strong>
                                                    <span style={{ color: "#6b7280", margin: "0 6px" }}>·</span>
                                                    {timeRange}
                                                </p>
                                                <p style={{ margin: "2px 0", fontSize: "0.85rem", color: "#6b7280" }}>{spanLabel}</p>
                                                {/* Batch-level booker email panel */}
                                                {batchBookers.length > 0 && (
                                                    <BookerEmailPanel bookers={batchBookers} onEmail={onEmail} />
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <p>{formatSlotRange(rep.start_time, rep.end_time)}</p>
                                                {/* Solo slot booker email panel — fixes issue 1 */}
                                                <BookerEmailPanel bookers={soloBookers} onEmail={onEmail} />
                                            </>
                                        )}
                                        <p>Type: {rep.slot_type}</p>
                                    </div>

                                    {/* Right: actions */}
                                    <div className="slot-actions" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
                                        {isBatch ? (
                                            <>
                                                {allFull && <span className="booked-label">All Full</span>}
                                                {!hasFull && (
                                                    <>
                                                        <button className="secondary-button" onClick={() => onToggleBatchVisibility(rep.batch_id, "public")}>
                                                            Make All Public
                                                        </button>
                                                        <button className="secondary-button" onClick={() => onToggleBatchVisibility(rep.batch_id, "private")}>
                                                            Make All Private
                                                        </button>
                                                    </>
                                                )}
                                                <button className="delete-button" onClick={() => onDeleteBatch(rep.batch_id)}>Delete All</button>
                                                <button className="secondary-button" onClick={() => toggleExpand(batchKey)} aria-expanded={isExpanded}>
                                                    {isExpanded ? "Collapse ▲" : "Expand ▼"}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {rep.status === "full" ? (
                                                    <span className="booked-label">Full</span>
                                                ) : (
                                                    <label className="visibility-toggle">
                                                        <span>{rep.status === "active" ? "Public" : "Private"}</span>
                                                        <input type="checkbox" checked={rep.status === "active"} onChange={() => onToggleVisibility(rep.id)} />
                                                        <span className="toggle-slider" />
                                                    </label>
                                                )}
                                                <button className="delete-button" onClick={() => onDelete(rep.id)}>Delete</button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded individual slots in batch */}
                                {isBatch && isExpanded && (
                                    <div style={{ marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {batchSlots.map(slot => {
                                            const slotBookers = getBookers(slot.id); // filter, not find
                                            return (
                                                <div key={slot.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", background: "#f9fafb", borderRadius: "8px", gap: "12px" }}>
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ margin: 0, fontWeight: 500 }}>{formatSlotRange(slot.start_time, slot.end_time)}</p>
                                                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
                                                            Status: <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{slot.status}</span>
                                                        </p>
                                                        {/* Per-slot booker panel inside expanded batch */}
                                                        <BookerEmailPanel bookers={slotBookers} onEmail={onEmail} />
                                                    </div>
                                                    <div className="slot-actions">
                                                        {slot.status === "full" ? (
                                                            <span className="booked-label">Full</span>
                                                        ) : (
                                                            <label className="visibility-toggle">
                                                                <span>{slot.status === "active" ? "Public" : "Private"}</span>
                                                                <input type="checkbox" checked={slot.status === "active"} onChange={() => onToggleVisibility(slot.id)} />
                                                                <span className="toggle-slider" />
                                                            </label>
                                                        )}
                                                        <button className="delete-button" onClick={() => onDelete(slot.id)}>Delete</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default SlotsList;