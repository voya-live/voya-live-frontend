import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
AgoraRTC.setLogLevel(4);
const appId = "0408a7d6547447dda62aec167d720c9b";
const backendUrl = "https://voya-live-backend.onrender.com";

const client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8",
});

export default function RoomModal({
  joinedRoom,
  setJoinedRoom,
  sendGift,
  liveRooms,
  messages,
  sendMessage,
}) {
  const [chatText, setChatText] = useState("");
  const [micTrack, setMicTrack] = useState(null);
  const [micOn, setMicOn] = useState(true);

  const micRef = useRef(null);

  useEffect(() => {
    if (!joinedRoom) return;

    const channelName = String(joinedRoom.name);

    async function joinVoice() {
      try {
        client.removeAllListeners();

        client.on("user-published", async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType);

          if (mediaType === "audio" && remoteUser.audioTrack) {
            remoteUser.audioTrack.play();
          }
        });

        const uid = Math.floor(Math.random() * 1000000);

        const tokenRes = await fetch(
          `${backendUrl}/api/agora/token?channelName=${encodeURIComponent(
            channelName
          )}&uid=${uid}`
        );

        const tokenData = await tokenRes.json();

        if (!tokenData.token) {
          throw new Error("Agora token not received");
        }

        await client.join(appId, channelName, tokenData.token, uid);

        const localMicTrack =
          await AgoraRTC.createMicrophoneAudioTrack();

        micRef.current = localMicTrack;
        setMicTrack(localMicTrack);
        setMicOn(true);

        await client.publish([localMicTrack]);
      } catch (error) {
        alert("Voice connection error. Please try again.");
      }
    }

    joinVoice();

    return () => {
      if (micRef.current) {
        micRef.current.stop();
        micRef.current.close();
        micRef.current = null;
      }

      client.removeAllListeners();
      client.leave().catch(() => {});
    };
  }, [joinedRoom]);

  if (!joinedRoom) return null;

  const roomUsers =
    liveRooms[String(joinedRoom._id || joinedRoom.id)]?.users || [];

  async function toggleMic() {
    const track = micRef.current || micTrack;

    if (!track) {
      alert("Mic is still preparing. Please try again.");
      return;
    }

    await track.setEnabled(!micOn);
    setMicOn(!micOn);
  }

  function handleSend() {
    if (!chatText.trim()) return;
    sendMessage(chatText);
    setChatText("");
  }

  return (
    <div className="modal">
      <div className="roomPanel">
        <button className="close" onClick={() => setJoinedRoom(null)}>
          ×
        </button>

        <h2>{joinedRoom.name}</h2>
        <p>Hosted by {joinedRoom.host}</p>
        <p>{roomUsers.length} users live now</p>

        <div className="micGrid">
          {roomUsers.length > 0 ? (
            roomUsers.map((item) => (
              <div className="micSeat activeSpeaker" key={item.id}>
                <div className="micAvatar">{item.name?.[0] || "U"}</div>
                <span>{item.name}</span>
                </div>
            ))
          ) : (
            <div className="micSeat">
              <div className="micAvatar">?</div>
              <span>No users yet</span>
            </div>
          )}
        </div>

        <div className="chatBox">
          {messages.map((msg) => (
            <div className="chatMsg" key={msg.id}>
              <strong>{msg.user}:</strong> {msg.text}
            </div>
          ))}
        </div>

        <div className="chatInput">
          <input
            placeholder="Type message..."
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend}>Send</button>
        </div>

        <div className="giftBar">
          <button
  onClick={toggleMic}
  className={micOn ? "micBtn active" : "micBtn muted"}
>
  {micOn ? "Mic On" : "Mic Off"}
</button>

          <button onClick={sendGift}>🌹 Rose -20</button>
          <button onClick={sendGift}>💎 Diamond -20</button>
          <button onClick={sendGift}>👑 Crown -20</button>
        </div>
      </div>
    </div>
  );
}