import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const appId = "0408a7d6547447dda62aec167d720c9b";

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

  const micTrackRef = useRef(null);

  useEffect(() => {
    if (!joinedRoom) return;

    const channelName = String(
      joinedRoom._id || joinedRoom.id || joinedRoom.name
    );

    async function joinVoice() {
      try {
        client.removeAllListeners();

        client.on("user-published", async (remoteUser, mediaType) => {
          console.log("Remote user published:", remoteUser, mediaType);

          await client.subscribe(remoteUser, mediaType);

          if (mediaType === "audio" && remoteUser.audioTrack) {
            remoteUser.audioTrack.play();
            console.log("Remote audio playing");
          }
        });

        await client.join(appId, channelName, null, null);
        console.log("AGORA JOINED CHANNEL:", channelName);

        console.log("Creating microphone...");

        const localMicTrack =
          await AgoraRTC.createMicrophoneAudioTrack();

        console.log("Microphone created:", localMicTrack);

        micTrackRef.current = localMicTrack;
        setMicTrack(localMicTrack);
        setMicOn(true);

        await client.publish([localMicTrack]);
        console.log("AGORA MIC PUBLISHED");
      } catch (error) {
        console.error("AGORA ERROR:", error);
        alert("Agora voice error. Check Console.");
      }
    }

    joinVoice();

    return () => {
      if (micTrackRef.current) {
        micTrackRef.current.stop();
        micTrackRef.current.close();
        micTrackRef.current = null;
      }

      client.removeAllListeners();
      client.leave().catch(() => {});
    };
  }, [joinedRoom]);

  if (!joinedRoom) return null;

  const roomUsers =
    liveRooms[String(joinedRoom._id || joinedRoom.id)]?.users || [];

  async function toggleMic() {
    const track = micTrackRef.current || micTrack;

    console.log("Toggle clicked. micTrack =", track, "micOn =", micOn);

    if (!track) {
      alert("Mic track not ready yet");
      return;
    }

    await track.setEnabled(!micOn);
    setMicOn(!micOn);

    console.log("Mic changed to:", !micOn);
  }

  function handleSend() {
    if (!chatText.trim()) return;

    sendMessage(chatText);
    setChatText("");
  }

  function handleClose() {
    setJoinedRoom(null);
  }

  return (
    <div className="modal">
      <div className="roomPanel">
        <button className="close" onClick={handleClose}>
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
                  {item.name?.[0] || "?"}
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