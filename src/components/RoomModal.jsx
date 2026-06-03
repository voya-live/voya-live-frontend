import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

AgoraRTC.setLogLevel(4);

const appId = "0408a7d6547447dda62aec167d720c9b";
const backendUrl = "https://voya-live-backend.onrender.com";

const client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8",
});

function getNumericUid() {
  const savedUid = localStorage.getItem("agoraUid");

  if (savedUid) return Number(savedUid);

  const newUid = Math.floor(Math.random() * 1000000);
  localStorage.setItem("agoraUid", String(newUid));

  return newUid;
}

export default function RoomModal({
  joinedRoom,
  setJoinedRoom,
  sendGift,
  liveRooms,
  messages,
  sendMessage,
  handRequests,
  raiseHand,
  clearHand,
  approveSpeaker,
  removeSpeaker,
  roomSpeakers,
  currentUser,
}) {
  const [chatText, setChatText] = useState("");
  const [micTrack, setMicTrack] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [isAgoraJoined, setIsAgoraJoined] = useState(false);

  const micRef = useRef(null);
  const joinedRef = useRef(false);

  const roomUsers =
    liveRooms[String(joinedRoom?._id || joinedRoom?.id)]?.users || [];

  const currentRoomUser = roomUsers.find(
    (item) => item.id === currentUser?.phone
  );

  const isCurrentUserHost = currentRoomUser?.isHost || false;

  const currentSpeaker = roomSpeakers.find(
    (item) => item.id === currentUser?.phone
  );

  const canSpeak = Boolean(currentSpeaker);

  useEffect(() => {
    if (!joinedRoom) return;

    const channelName = String(joinedRoom.name);

    async function joinVoice() {
      try {
        client.removeAllListeners();
        client.enableAudioVolumeIndicator();

        client.on("volume-indicator", (volumes) => {
          const speakingUsers = volumes
            .filter((v) => v.level > 5)
            .map((v) => String(v.uid));

          setActiveSpeakers(speakingUsers);
        });

        client.on("user-published", async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType);

          if (mediaType === "audio" && remoteUser.audioTrack) {
            remoteUser.audioTrack.play();
          }
        });

        const uid = getNumericUid();

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

        joinedRef.current = true;
        setIsAgoraJoined(true);
      } catch {
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

      setMicTrack(null);
      setMicOn(false);
      setIsAgoraJoined(false);
      joinedRef.current = false;

      client.removeAllListeners();
      client.leave().catch(() => {});
    };
  }, [joinedRoom]);

  useEffect(() => {
    async function updatePublishing() {
      if (!joinedRef.current || !isAgoraJoined) return;

      try {
        if (canSpeak && !micRef.current) {
          const localMicTrack =
            await AgoraRTC.createMicrophoneAudioTrack();

          micRef.current = localMicTrack;
          setMicTrack(localMicTrack);
          setMicOn(true);

          await client.publish([localMicTrack]);
        }

        if (!canSpeak && micRef.current) {
          await client.unpublish([micRef.current]);

          micRef.current.stop();
          micRef.current.close();
          micRef.current = null;

          setMicTrack(null);
          setMicOn(false);
        }
      } catch {
        alert("Mic permission error. Please try again.");
      }
    }

    updatePublishing();
  }, [canSpeak, isAgoraJoined]);

  if (!joinedRoom) return null;

  async function toggleMic() {
    const track = micRef.current || micTrack;

    if (!canSpeak) {
      alert("You need host approval to speak.");
      return;
    }

    if (!track) {
      alert("Mic is still preparing. Please try again.");
      return;
    }

    await track.setEnabled(!micOn);
    setMicOn(!micOn);
  }

  async function closeRoom() {
    try {
      if (micRef.current) {
        await client.unpublish([micRef.current]);
        micRef.current.stop();
        micRef.current.close();
        micRef.current = null;
      }

      await client.leave();
    } catch {
      // ignore
    }

    setJoinedRoom(null);
  }

  function handleSend() {
    if (!chatText.trim()) return;

    sendMessage(chatText);
    setChatText("");
  }

  function isUserSpeaking(item) {
    if (!item.agoraUid) return false;

    return activeSpeakers.includes(String(item.agoraUid));
  }

  function isRoomSpeaker(item) {
    return roomSpeakers.some((speaker) => speaker.id === item.id);
  }

  return (
    <div className="modal">
      <div className="roomPanel">
        <button className="close" onClick={closeRoom}>
          ×
        </button>

        <h2>{joinedRoom.name}</h2>
        <p>Hosted by {joinedRoom.host}</p>
        <p>{roomUsers.length} users live now</p>

        <div className="micGrid">
          {roomUsers.length > 0 ? (
            roomUsers.map((item) => (
              <div
                className={
                  isUserSpeaking(item)
                    ? "micSeat activeSpeaker"
                    : "micSeat"
                }
                key={item.id}
              >
                <div className="micAvatar">
                  {item.name?.[0] || "U"}
                </div>

                <span>
                  {item.name}

                  {item.isHost && (
                    <div className="hostBadge">
                      👑 Host
                    </div>
                  )}

                  {isRoomSpeaker(item) && !item.isHost && (
                    <div className="speakerBadge">
                      🎤 Speaker
                    </div>
                  )}
                </span>

                {isCurrentUserHost && !item.isHost && isRoomSpeaker(item) && (
                  <button
                    className="smallControlBtn"
                    onClick={() => removeSpeaker(item.id)}
                  >
                    Remove Mic
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="micSeat">
              <div className="micAvatar">?</div>
              <span>No users yet</span>
            </div>
          )}
        </div>

        <div className="raiseHandArea">
          {!isCurrentUserHost && !canSpeak && (
            <button className="raiseHandBtn" onClick={raiseHand}>
              ✋ Raise Hand
            </button>
          )}

          {!isCurrentUserHost && canSpeak && (
            <p className="speakerApproved">
              🎤 You are approved to speak
            </p>
          )}

          {isCurrentUserHost && (
            <div className="handPanel">
              <h4>Hand Requests</h4>

              {handRequests.length === 0 ? (
                <p className="emptyHands">No requests</p>
              ) : (
                handRequests.map((item) => (
                  <div className="handRequest" key={item.id}>
                    <span>✋ {item.name}</span>

                    <div className="handActions">
                      <button onClick={() => approveSpeaker(item.id)}>
                        Approve
                      </button>

                      <button onClick={() => clearHand(item.id)}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
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
            {canSpeak
              ? micOn
                ? "Mic On"
                : "Mic Off"
              : "Listener"}
          </button>

          <button onClick={sendGift}>🌹 Rose -20</button>
          <button onClick={sendGift}>💎 Diamond -20</button>
          <button onClick={sendGift}>👑 Crown -20</button>
        </div>
      </div>
    </div>
  );
}