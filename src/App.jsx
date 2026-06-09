import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";

import "./style.css";

import AuthPage from "./components/AuthPage";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import RoomPage from "./components/RoomPage";

const backendUrl = "https://voya-live-backend.onrender.com";
const socket = io(backendUrl);

function App() {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("voya_user")) || null
  );
  const [coins, setCoins] = useState(0);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [isRoomMinimized, setIsRoomMinimized] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [liveRooms, setLiveRooms] = useState({});
  const [messages, setMessages] = useState([]);
  const [handRequests, setHandRequests] = useState([]);
  const [roomSpeakers, setRoomSpeakers] = useState([]);
  const [giftFeed, setGiftFeed] = useState([]);
  const [roomSupporters, setRoomSupporters] = useState([]);
  const [giftAnimation, setGiftAnimation] = useState(null);
  const [levelUpData, setLevelUpData] = useState(null);
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

    socket.on("room:handRequests", (data) => setHandRequests(data || []));

    socket.on("room:speakersUpdate", (data) => setRoomSpeakers(data || []));

    socket.on("room:error", (data) => {
      alert(data?.message || "Room error");
    });

    socket.on("room:gift", (gift) => {
      setGiftFeed((prev) => [gift, ...prev].slice(0, 3));

      setRoomSupporters((prev) => {
        const existing = prev.find((item) => item.name === gift.user);

        if (existing) {
          return prev
            .map((item) =>
              item.name === gift.user
                ? {
                    ...item,
                    total: item.total + Number(gift.amount || 0),
                  }
                : item
            )
            .sort((a, b) => b.total - a.total)
            .slice(0, 3);
        }

        return [
          ...prev,
          {
            name: gift.user,
            total: Number(gift.amount || 0),
          },
        ]
          .sort((a, b) => b.total - a.total)
          .slice(0, 3);
      });

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

        if (user) {
          setUser((prev) => ({
            ...prev,
            level: data.level || prev.level || 1,
            experience: data.experience || 0,
            totalSpent: data.totalSpent || 0,
            vipLevel: data.vipLevel || 0,
          }));
        }
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

      const normalizedUser = {
        ...data.user,
        level: data.user.level || 1,
        experience: data.user.experience || 0,
        totalSpent: data.user.totalSpent || 0,
        vipLevel: data.user.vipLevel || 0,
      };

      localStorage.setItem("voya_token", data.token);
      localStorage.setItem("voya_user", JSON.stringify(normalizedUser));

      setUser(normalizedUser);
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

    const isHost = room.host === user.name;

    if (room.locked && !isHost) {
      alert("Room is locked by host");
      return;
    }

    setJoinedRoom(room);
    setIsRoomMinimized(false);
    setMessages([]);
    setHandRequests([]);
    setRoomSpeakers([]);
    setGiftFeed([]);
    setRoomSupporters([]);
    setGiftAnimation(null);
    setLevelUpData(null);

    socket.emit("room:join", {
      roomId,
      agoraUid,
      user: {
        id: user.phone,
        name: user.name,
        isHost,
        level: user.level || 1,
        experience: user.experience || 0,
        vipLevel: user.vipLevel || 0,
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

  function hostMuteAll(muted) {
    if (!joinedRoom) return;

    const roomId = String(joinedRoom._id || joinedRoom.id);

    socket.emit("room:hostMuteAll", {
      roomId,
      muted,
    });
  }

  async function lockRoom() {
    if (!joinedRoom) return;

    const token = localStorage.getItem("voya_token");
    const roomId = String(joinedRoom._id || joinedRoom.id);

    try {
      const response = await fetch(`${backendUrl}/api/rooms/${roomId}/lock`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Failed to lock room");
      }

      setJoinedRoom(data.room);

      setRooms((prev) =>
        prev.map((room) =>
          String(room._id || room.id) === roomId ? data.room : room
        )
      );
    } catch {
      alert("Lock room request failed");
    }
  }

  async function unlockRoom() {
    if (!joinedRoom) return;

    const token = localStorage.getItem("voya_token");
    const roomId = String(joinedRoom._id || joinedRoom.id);

    try {
      const response = await fetch(`${backendUrl}/api/rooms/${roomId}/unlock`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Failed to unlock room");
      }

      setJoinedRoom(data.room);

      setRooms((prev) =>
        prev.map((room) =>
          String(room._id || room.id) === roomId ? data.room : room
        )
      );
    } catch {
      alert("Unlock room request failed");
    }
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
      const previousLevel = user.level || 1;

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

      const updatedUser = {
        ...user,
        level: data.level || user.level || 1,
        experience: data.experience || 0,
        totalSpent: data.totalSpent || 0,
        vipLevel: data.vipLevel || 0,
      };

      setUser(updatedUser);
      localStorage.setItem("voya_user", JSON.stringify(updatedUser));

      if (data.level && data.level > previousLevel) {
        const newLevelUp = {
          id: Date.now(),
          level: data.level,
          text: `LEVEL UP! You reached Level ${data.level}`,
        };

        setLevelUpData(newLevelUp);

        setTimeout(() => {
          setLevelUpData(null);
        }, 3000);
      }

      socket.emit("room:gift", {
        roomId,
        user: {
          name: user.name,
        },
        gift: selectedGift,
      });

      socket.emit("room:join", {
        roomId,
        agoraUid: getAgoraUid(),
        user: {
          id: updatedUser.phone,
          name: updatedUser.name,
          isHost: joinedRoom.host === updatedUser.name,
          level: updatedUser.level || 1,
          experience: updatedUser.experience || 0,
          vipLevel: updatedUser.vipLevel || 0,
        },
      });
    } catch {
      alert("Gift backend error");
    }
  }

  function leaveRoom() {
    if (joinedRoom && user) {
      const roomId = String(joinedRoom._id || joinedRoom.id);

      socket.emit("room:leave", {
        roomId,
        user: {
          id: user.phone,
          name: user.name,
        },
      });
    }

    setJoinedRoom(null);
    setIsRoomMinimized(false);
    setMessages([]);
    setHandRequests([]);
    setRoomSpeakers([]);
    setGiftFeed([]);
    setRoomSupporters([]);
    setGiftAnimation(null);
    setLevelUpData(null);
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
    <main className={joinedRoom && !isRoomMinimized ? "app roomMode" : "app"}>
      {(!joinedRoom || isRoomMinimized) && (
        <>
          <Sidebar user={user} coins={coins} setUser={logout} />

          <HomePage
            rooms={rooms}
            liveRooms={liveRooms}
            coins={coins}
            recharge={recharge}
            setJoinedRoom={joinRoom}
            createRoom={createRoom}
          />
        </>
      )}

      {joinedRoom && !isRoomMinimized && (
        <RoomPage
          joinedRoom={joinedRoom}
          setJoinedRoom={setJoinedRoom}
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
          hostMuteAll={hostMuteAll}
          lockRoom={lockRoom}
          unlockRoom={unlockRoom}
          roomSpeakers={roomSpeakers}
          giftFeed={giftFeed}
          roomSupporters={roomSupporters}
          giftAnimation={giftAnimation}
          levelUpData={levelUpData}
          currentUser={user}
          isRoomMinimized={isRoomMinimized}
          setIsRoomMinimized={setIsRoomMinimized}
          leaveRoom={leaveRoom}
        />
      )}

      {joinedRoom && isRoomMinimized && (
        <div className="miniRoomPlayer">
          <div>
            <strong>{joinedRoom.name}</strong>
            <span>
              {liveRooms[String(joinedRoom._id || joinedRoom.id)]?.users?.length || 0} live
            </span>
          </div>

          <button onClick={() => setIsRoomMinimized(false)}>
            Return
          </button>

          <button className="miniLeaveBtn" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);