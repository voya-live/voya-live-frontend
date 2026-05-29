import React, { useState, useEffect } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const appId = "YOUR_AGORA_APP_ID_HERE";

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

  useEffect(() => {
    if (!joinedRoom) return;

    const channelName = String(
      joinedRoom._id || joinedRoom.id || joinedRoom.name
    );

    async function joinVoice() {
      try {
        client.on("user-published", async (remoteUser, mediaType) => {
  await client.subscribe(remoteUser, mediaType);

  if (mediaType === "audio" && remoteUser.audioTrack) {
    remoteUser.audioTrack.play();
  }
});

        await client.join(appId, channelName, null, null);
        console.log("AGORA JOINED CHANNEL:", channelName);

        const localMicTrack =
          await AgoraRTC.createMicrophoneAudioTrack();

        setMicTrack(localMicTrack);

        await client.publish([localMicTrack]);
        console.log("AGORA MIC PUBLISHED");
      } catch (error) {
        console.error("Agora voice error:", error);
      }
    }

    joinVoice();

    return () => {
      if (micTrack) {
        micTrack.stop();
        micTrack.close();
      }

      client.removeAllListeners();
      client.leave();
    };
  }, [joinedRoom]);

  if (!joinedRoom) return null;

  const roomUsers =
    liveRooms[String(joinedRoom._id || joinedRoom.id)]?.users || [];

  async function toggleMic() {
    if (!micTrack) return;

    await micTrack.setEnabled(!micOn);
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
        <button className="close" onClick={setJoinedRoom}>
          ×
        </button>

        <h2>{joinedRoom.name}</h2>

        <p>Hosted by {joinedRoom.host}</p>

        <p>{roomUsers.length} users live now</p>

        <div className="micGrid">
          {roomUsers.length > 0 ? (
            roomUsers.map((item) => (
              <div className="micSeat" key={item.id}>
                <div className="micAvatar">
                  {item.name[0]}
                </div>

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
            onKeyDown={(e) =>
              e.key === "Enter" && handleSend()
            }
          />

          <button onClick={handleSend}>Send</button>
        </div>

        <div className="giftBar">
          <button onClick={toggleMic}>
            {micOn ? "Mute Mic" : "Unmute Mic"}
          </button>

          <button onClick={sendGift}>🌹 Rose -20</button>
          <button onClick={sendGift}>💎 Diamond -20</button>
          <button onClick={sendGift}>👑 Crown -20</button>
        </div>
      </div>
    </div>
  );
}