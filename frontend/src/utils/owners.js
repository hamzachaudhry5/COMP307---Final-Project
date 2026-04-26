export function buildOwnerMap(owners = [], currentUser = null, isOwner = false) {
    const map = Object.fromEntries(
        owners.map(o => [o.user_id, o])
    );

    // include current user if they are an owner
    if (isOwner) {
        map[currentUser.user_id] = currentUser;
    }

    return map;
}

export function resolveOwnerName(ownerMap, ownerId) {
    const owner = ownerMap?.[ownerId];

    if (!owner) return "Unknown";
    return `${owner.first_name} ${owner.last_name}`;
}
