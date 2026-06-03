import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";

import "./style.css";

import AuthPage from "./components/AuthPage";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import RoomModal from "./components/RoomModal";

const backendUrl = "https://voya-live-backend.onrender.com";
const socket = io(backendUrl);

function App() {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("voya_user")) || null
  );
  const [coins, setCoins] = useState(0);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [liveRooms, setLiveRooms] = useState({});
  const [messages, setMessages] = useState([]);
  const [handRequests, setHandRequests] = useState([]);
  const [roomSpeakers, setRoomSpeakers] = useState([]);
  const [giftFeed, setGiftFeed] = useState([]);
  const [giftAnimation, setGiftAnimation] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    socket.on("rooms:update", (data) => setLiveRooms(data || {}));

    socket.on("room:chat", (message) =>
      setMessages((prev) => [...prev, message])
    );

    socket.on("room:handRequests", (data) => {
      setHandRequests(data || []);
    });

    socket.on("room:speakersUpdate", (data) => {
      setRoomSpeakers(data || []);
    });

    socket.on("room:error", (data) => {
      alert(data?.message || "Room error");
    });

    socket.on("room:gift", (gift) => {
      setGiftFeed((prev) => [gift, ...prev].slice(0, 10));
      setGiftAnimation(gift);

      setTimeout(() => {
        setGiftAnimation(null);
      }, 2500);
    });

    loadRooms();
    loadWalletBalance();

    return () => {
      socket.off("rooms:update");
      socket.off("room:chat");
      socket.off("room:handRequests");
      socket.off("room:speakersUpdate");
      socket.off("room:error");
      socket.off("room:gift");
    };
  }, []);

  async function loadRooms() {
    try {
      const response = await fetch(`${backendUrl}/api/rooms`);
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
      const response = await fetch(`${backendUrl}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        setCoins(data.coins || 0);
      }
    } catch {
      console.log("Wallet balance error");
    }
  }

  async function handleAuth() {
    if (!form.phone || !form.password) {
      return alert("Enter phone and password");
    }

    if (authMode === "register" && !form.name) {
      return alert("Enter your name");
    }

    const endpoint =
      authMode === "login"
        ? `${backendUrl}/api/auth/login`
        : `${backendUrl}/api/auth/register`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Authentication failed");
      }

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
      const response = await fetch(`${backendUrl}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: roomName,
          tag: "Live",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Failed to create room");
      }

      setRooms((prev) => [data.room, ...prev]);
      joinRoom(data.room);
    } catch {
      alert("Backend room creation error");
    }
  }

  function getAgoraUid() {
    let agoraUid = localStorage.getItem("agoraUid");

    if (!agoraUid) {
      agoraUid = String(Math.floor(Math.random() * 1000000));
      localStorage.setItem("agoraUid", agoraUid);
    }

    return Number(agoraUid);
  }

  function joinRoom(room) {
    const roomId = String(room._id || room.id);
    const agoraUid = getAgoraUid();

    setJoinedRoom(room);
    setHandRequests([]);
    setRoomSpeakers([]);
    setGiftFeed([]);
    setGiftAnimation(null);

    socket.emit("room:join", {
      roomId,
      agoraUid,

      user: {
        id: user.phone,
        name: user.name,
        isHost: room.host === user.name,
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

  function hostMuteUser(userId, muted) {
    if (!joinedRoom) return;

    const roomId = String(joinedRoom._id || joinedRoom.id);

    socket.emit("room:hostMuteUser", {
      roomId,
      userId,
      muted,
    });
  }

  function raiseHand() {
    if (!joinedRoom || !user) return;

    const roomId = String(joinedRoom._id || joinedRoom.id);

    socket.emit("room:raiseHand", {
      roomId,
      user: {
        id: user.phone,
        name: user.name,
      },
    });
  }

  function clearHand(userId) {
    if (!joinedRoom) return;

    const roomId = String(joinedRoom._id || joinedRoom.id);

    socket.emit("room:clearHand", {
      roomId,
      userId,
    });
  }

  function approveSpeaker(userId) {
    if (!joinedRoom) return;

    const roomId = String(joinedRoom._id || joinedRoom.id);

    socket.emit("room:approveSpeaker", {
      roomId,
      userId,
    });
  }

  function removeSpeaker(userId) {
    if (!joinedRoom) return;

    const roomId = String(joinedRoom._id || joinedRoom.id);

    socket.emit("room:removeSpeaker", {
      roomId,
      userId,
    });
  }

  async function recharge() {
    const token = localStorage.getItem("voya_token");

    try {
      const response = await fetch(`${backendUrl}/api/wallet/recharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 100 }),
      });

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Recharge failed");
      }

      setCoins(data.coins);
    } catch {
      alert("Recharge backend error");
    }
  }

  async function sendGift(gift) {
    if (!joinedRoom || !user) return;

    const token = localStorage.getItem("voya_token");
    const roomId = String(joinedRoom._id || joinedRoom.id);

    const selectedGift =
      gift || {
        name: "Rose",
        icon: "🌹",
        amount: 20,
      };

    try {
      const response = await fetch(`${backendUrl}/api/wallet/gift`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: selectedGift.amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Gift failed");
      }

      setCoins(data.coins);

      socket.emit("room:gift", {
        roomId,
        user: {
          name: user.name,
        },
        gift: selectedGift,
      });
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
        handRequests={handRequests}
        raiseHand={raiseHand}
        clearHand={clearHand}
        approveSpeaker={approveSpeaker}
        removeSpeaker={removeSpeaker}
        hostMuteUser={hostMuteUser}
        roomSpeakers={roomSpeakers}
        giftFeed={giftFeed}
        giftAnimation={giftAnimation}
        currentUser={user}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);