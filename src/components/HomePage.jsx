import React, { useState, useEffect } from "react";
import WalletBox from "./WalletBox";

export default function HomePage({
  rooms,
  coins,
  recharge,
  setJoinedRoom,
  liveRooms,
  createRoom,
  deleteRoom,
}) {
  const [roomName, setRoomName] = useState("");
  const [roomCategory, setRoomCategory] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [topGifters, setTopGifters] = useState([]);

  useEffect(() => {
  loadLeaderboard();

  const interval = setInterval(() => {
    loadLeaderboard();
  }, 2000);

  return () => clearInterval(interval);
}, []);

  async function loadLeaderboard() {
    try {
      const response = await fetch(
        "https://voya-live-backend.onrender.com/api/leaderboard/gifters"
      );

      const data = await response.json();

      setTopGifters(data || []);
    } catch {
      console.log("Leaderboard load failed");
    }
  }

  function handleCreateRoom() {
    if (!roomName.trim()) {
      return alert("Enter room name");
    }

    createRoom(roomName, roomCategory);
    setRoomName("");
  }
  const filteredRooms = rooms.filter((room) => {
  const keyword = searchText.toLowerCase();

const matchesSearch =
  room.name
    ?.toLowerCase()
    .includes(keyword) ||
  room.host
    ?.toLowerCase()
    .includes(keyword) ||
  room.category
    ?.toLowerCase()
    .includes(keyword);

  const matchesCategory =
    roomCategory === "All" ||
    room.category === roomCategory;

  return matchesSearch && matchesCategory;
});

  return (
    <section className="content">
      <div className="topbar">
        <input
  placeholder="Search rooms or hosts..."
  value={searchText}
  onChange={(e) => setSearchText(e.target.value)}
/>
        <button className="loginBtn">VIP Upgrade</button>
      </div>

      <div className="hero">
        <h2>Feel the Voice</h2>
        <p>Create or join live voice rooms in real time.</p>

        <div className="createRoomBox">
  <input
    placeholder="Enter new room name..."
    value={roomName}
    onChange={(e) => setRoomName(e.target.value)}
  />

  <select
    value={roomCategory}
    onChange={(e) => setRoomCategory(e.target.value)}
  >
    <option value="All">🌐 All Rooms</option> 
    <option value="Chat">💬 Chat</option>
    <option value="Music">🎵 Music</option>
    <option value="Gaming">🎮 Gaming</option>
    <option value="VIP">💎 VIP</option>
    <option value="Sports">⚽ Sports</option>
    <option value="Saudi">🇸🇦 Saudi</option>
  </select>

  <button onClick={handleCreateRoom}>
    Start Room
  </button>
</div>
      </div>

      <WalletBox coins={coins} recharge={recharge} />

      <h2 className="sectionTitle">🏆 Top Gifters</h2>

      <div className="leaderboardBox">
        {topGifters.length > 0 ? (
          topGifters.slice(0, 10).map((user, index) => (
            <div
              className="leaderboardItem"
              key={user._id || index}
            >
              <span>
                #{index + 1} {user.name}
              </span>

              <span>
                Lv.{user.level || 1}
              </span>

              <span>
                💰 {user.totalSpent || 0}
              </span>
            </div>
          ))
        ) : (
          <p className="emptyHands">No leaderboard data yet</p>
        )}
      </div>

      <h2 className="sectionTitle">Live Rooms</h2>

      <div className="roomGrid">
        {filteredRooms.map((room) => {
          const liveCount =
            liveRooms[String(room.id)]?.users?.length || 0;

          return (
            <div className="roomCard" key={room.id}>
              <div className="liveBadge">LIVE</div>
              <span className="tag">
  {room.category || "Chat"}
</span>
              <h3>{room.name}</h3>
              <p>Host: {room.host}</p>

              <div className="roomFooter">
  <span>{liveCount} live now</span>

  <button onClick={() => setJoinedRoom(room)}>
    Join
  </button>

  <button
    onClick={() =>
      deleteRoom(room._id || room.id)
    }
  >
    Delete
  </button>
</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}