# MCPANEL Database API Guide (Backend Documentation)

Yeh guide MCPANEL Database API ke backend structure, authentication, aur integration ke baare mein hai. Isme bataya gaya hai ki aap backend endpoints ko apne applications mein kaise use kar sakte hain.

## 1. Authentication (Security)

API do tareeqon se secure ki gayi hai:

### A. Session Authentication (Web Panel)
Web panel **HttpOnly Cookies** ka use karta hai. Jab aap `/auth/login` karte hain, server ek `mcpanel_session` cookie set karta hai. 
*   **Kaise kaam karta hai:** Browser har request ke saath automatically cookie bhejta hai.
*   **Frontend implementation:** Frontend ko token store karne ki zaroorat nahi hai. Bas `credentials: include` fetch request mein hona chahiye.

### B. Bearer Token (API Keys)
External microservices aur scripts ke liye **API Keys** ka use hota hai.
*   **Header Format:** `Authorization: Bearer YOUR_API_KEY`
*   **Key Format:** `mc_live_...`
*   **Scopes:** Har key ke apne permissions hote hain (e.g., `servers:read`, `users:write`).

---

## 2. API Endpoints Reference

Base URL: `http://localhost:3000/api/v1`

### Authentication (`/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/auth/register` | New user register karein (First user admin banta hai). |
| POST | `/auth/login` | Login aur session cookie prapt karein. |
| POST | `/auth/logout` | Session revoke aur cookie clear karein. |
| GET | `/auth/me` | Current logged-in user ki details. |
| GET | `/auth/sessions` | Active browser sessions ki list. |
| DELETE | `/auth/sessions/:id` | Specific device/session ko logout karein. |

### Server Registry (`/servers`)
Iska use game servers ko track karne ke liye hota hai.
| Method | Endpoint | Scope Required | Description |
| :--- | :--- | :--- | :--- |
| GET | `/servers` | `servers:read` | Saare registered servers ki list. |
| POST | `/servers` | `servers:write` | Naya server database mein add karein. |
| GET | `/servers/:id` | `servers:read` | Specific server details. |
| PATCH | `/servers/:id` | `servers:write` | Server metadata (RAM, CPU, IP) update karein. |
| DELETE | `/servers/:id` | `servers:write` | Server ko registry se delete karein. |

### User Management (`/users`)
*Admin only or self-access*
| Method | Endpoint | Scope Required | Description |
| :--- | :--- | :--- | :--- |
| GET | `/users` | `users:read` | Users ki list (Admin only). |
| GET | `/users/:id` | `users:read` | User profile details. |
| PATCH | `/users/:id` | `users:write` | Profile details update karein. |
| POST | `/users/:id/password`| `users:write` | Password change karein. |

### API Key Management (`/api-keys`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api-keys` | Aapke banaye hue API keys ki list. |
| POST | `/api-keys` | Nayi secure API key generate karein. |
| DELETE | `/api-keys/:id`| Key ko permanently delete karein. |

---

## 3. Database Persistence (PostgreSQL)

Data storage ke liye real PostgreSQL engine use ho raha hai:
*   **Storage Path:** `/data/mcpanel_postgres`
*   **Stability:** PGlite runtime use karke absolute path par data save hota hai, isliye restart par data delete nahi hota.
*   **Migrations:** Schema updates `src/database/migrations` mein store hain aur boot par automatically apply hote hain.

## 4. Integration Example (Node.js/Python)

Agar aap kisi external script se server register karna chahte hain:

```javascript
// Example: Register a Minecraft Server via API
const registerServer = async () => {
  const response = await fetch('http://localhost:3000/api/v1/servers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mc_live_your_secret_key'
    },
    body: JSON.stringify({
      name: "Survival Hub",
      server_identifier: "srv-01",
      ram: 4096,
      cpu: 2,
      minecraft_version: "1.20.1",
      ip: "192.168.1.10"
    })
  });
  
  const result = await response.json();
  console.log(result);
};
```

## 5. Security Best Practices
1.  **API Keys:** Kabhi bhi API keys ko frontend (JavaScript/Browser) mein hardcode na karein. Hamesha backend environment variables mein rakhein.
2.  **HTTPS:** Production mein hamesha HTTPS ka use karein kyunki cookies `Secure` flag ke saath set hoti hain.
3.  **Role-Based Access:** Standard users ko `admin` role na dein unless zaroori ho.
