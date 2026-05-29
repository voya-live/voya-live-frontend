import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";

import "./style.css";

import AuthPage from "./components/AuthPage";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import RoomModal from "./components/RoomModal";

const socket = io("https://voya-live-backend.onrender.com");

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("voya_user")) || null);
  const [coins, setCoins] = useState(0);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [liveRooms, setLiveRooms] = useState({});
  const [messages, setMessages] = useState([]);
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", phone: "", password: "" });

  useEffect(() => {
    socket.on("rooms:update", (data) => setLiveRooms(data || {}));
    socket.on("room:chat", (message) => setMessages((prev) => [...prev, message]));

    loadRooms();
    loadWalletBalance();

    return () => {
      socket.off("rooms:update");
      socket.off("room:chat");
    };
  }, []);

  async function loadRooms() {
    try {
      const response = await fetch("https://voya-live-backend.onrender.com/api/rooms");
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch {
      alert("Failed to load rooms");
    }
  }

  async function loadWalletBalance() {
    const token = localStorage.getItem("voya_token");
    if (!token) return;

    try {
      const response = await fetch("https://voya-live-backend.onrender.com/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) setCoins(data.coins || 0);
    } catch {
      console.log("Wallet balance error");
    }
  }

  async function handleAuth() {
    if (!form.phone || !form.password) return alert("Enter phone and password");
    if (authMode === "register" && !form.name) return alert("Enter your name");

    const endpoint =
      authMode === "login"
        ? "https://voya-live-backend.onrender.com/api/auth/login"
        : "https://voya-live-backend.onrender.com/api/auth/register";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) return alert(data.error || "Authentication failed");

      localStorage.setItem("voya_token", data.token);
      localStorage.setItem("voya_user", JSON.stringify(data.user));

      setUser({ ...data.user, level: 1 });
      setCoins(data.user.coins || 0);
      loadWalletBalance();
    } catch {
      alert("Backend connection error");
    }
  }

  async function createRoom(roomName) {
    const token = localStorage.getItem("voya_token");

    try {
      const response = await fetch("https://voya-live-backend.onrender.com/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: roomName, tag: "Live" }),
      });

      const data = await response.json();
      if (!response.ok) return alert(data.error || "Failed to create room");

      setRooms((prev) => [data.room, ...prev]);
      joinRoom(data.room);
    } catch {
      alert("Backend room creation error");
    }
  }

  function joinRoom(room) {
  const roomId = String(room._id || room.id);

  let agoraUid = localStorage.getItem("agoraUid");

  if (!agoraUid) {
    agoraUid = String(
      Math.floor(Math.random() * 1000000)
    );

    localStorage.setItem(
      "agoraUid",
      agoraUid
    );
  }

  setJoinedRoom(room);

  socket.emit("room:join", {
    roomId,
    agoraUid: Number(agoraUid),

    user: {
      id: user.phone,
      name: user.name,
    },
  });
}

  function sendMessage(text) {
  if (!joinedRoom || !user) return;

  const roomId = String(joinedRoom._id || joinedRoom.id);

  socket.emit("room:chat", {
    roomId,
    user: {
      name: user.name,
    },
    message: text,
  });
}

  async function recharge() {
    const token = localStorage.getItem("voya_token");

    try {
      const response = await fetch("https://voya-live-backend.onrender.com/api/wallet/recharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 100 }),
      });

      const data = await response.json();
      if (!response.ok) return alert(data.error || "Recharge failed");

      setCoins(data.coins);
    } catch {
      alert("Recharge backend error");
    }
  }

  async function sendGift() {
    const token = localStorage.getItem("voya_token");

    try {
      const response = await fetch("https://voya-live-backend.onrender.com/api/wallet/gift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 20 }),
      });

      const data = await response.json();
      if (!response.ok) return alert(data.error || "Gift failed");

      setCoins(data.coins);
    } catch {
      alert("Gift backend error");
    }
  }

  function logout() {
    localStorage.removeItem("voya_token");
    localStorage.removeItem("voya_user");
    setUser(null);
  }

  if (!user) {
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        form={form}
        setForm={setForm}
        handleAuth={handleAuth}
      />
    );
  }

  return (
    <main className="app">
      <Sidebar user={user} coins={coins} setUser={logout} />

      <HomePage
        rooms={rooms}
        liveRooms={liveRooms}
        coins={coins}
        recharge={recharge}
        setJoinedRoom={joinRoom}
        createRoom={createRoom}
      />

      <RoomModal
        joinedRoom={joinedRoom}
        setJoinedRoom={() => setJoinedRoom(null)}
        sendGift={sendGift}
        liveRooms={liveRooms}
        messages={messages}
        sendMessage={sendMessage}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);