import React from "react";

export default function AuthPage({
  authMode,
  setAuthMode,
  form,
  setForm,
  handleAuth,
}) {
  return (
    <main className="authPage">
      <div className="authCard">
        <h1>VOYA LIVE</h1>
        <p>Feel the Voice</p>

        <div className="authTabs">
          <button
            onClick={() => setAuthMode("login")}
            className={authMode === "login" ? "active" : ""}
          >
            Login
          </button>

          <button
            onClick={() => setAuthMode("register")}
            className={authMode === "register" ? "active" : ""}
          >
            Register
          </button>
        </div>

        {authMode === "register" && (
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />
        )}

        <input
          placeholder="Phone number"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <button className="authBtn" onClick={handleAuth}>
          {authMode === "login" ? "Login" : "Create Account"}
        </button>

        <span className="note">
          Connected to backend API
        </span>
      </div>
    </main>
  );
}