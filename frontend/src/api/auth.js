const BASE_URL = "http://localhost:8000/auth";

export async function registerUser(data) {
    const res = await fetch(`${BASE_URL}/register`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(data)
    });

    if (!res.ok) {
        throw new Error("Registration failed");
    }
    return res.json();
}

export async function loginUser(email, password) {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);

    const res = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form
    });

    if (!res.ok) {
        throw new Error("Login failed");
    }
    return res.json();
}

export async function getMe(token) {
    const res = await fetch(`${BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
        throw new Error("Failed to fetch user");
    }

    return res.json();
    
}