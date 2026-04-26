function PendingRequests({ requests, onAccept, onDecline, onEmail, formatSlotRange }) {
    return (
        <section className="slots-section">
            <h3 className="form-header">Pending Requests</h3>
            {requests.length === 0 ? (
                <p>No pending requests.</p>
            ) : (
                <div className="slots-list">
                    {requests.map(req => (
                        <div key={req.id} className="request-card">
                            <div>
                                <strong>{req.requester?.first_name} {req.requester?.last_name}</strong>
                                {req.requester?.email && <span> ({req.requester.email})</span>}
                                <p>requested a meeting</p>
                                <em>{formatSlotRange(req.start_time, req.end_time)}</em>
                                <p>Message: {req.message}</p>
                            </div>
                            <div className="request-actions">
                                <button onClick={() => onAccept(req.id)}>Accept</button>
                                <button onClick={() => onDecline(req.id)}>Decline</button>
                                {req.requester?.email && (
                                    <button onClick={() => onEmail(req.requester.email)}>Email</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default PendingRequests;