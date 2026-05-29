import React from "react";

export default function Sidebar({ user, coins, setUser }) {
  return (
    <aside className="sidebar">
      <h1>VOYA LIVE</h1>

      <nav>
        <button>Home</button>
        <button>Live Rooms</button>
        <button>Trending</button>
        <button>VIP</button>
        <button>Wallet</button>
        <button onClick={() => setUser(null)}>Logout</button>
      </nav>

      <div className="profile">
        <div className="avatar">{user.name[0]}</div>

        <div>
          <h3>{user.name}</h3>
          <p>Level {user.level} • {coins} coins</p>
        </div>
      </div>
    </aside>
  );
}