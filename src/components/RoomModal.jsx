import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

AgoraRTC.setLogLevel(4);

const appId = "0408a7d6547447dda62aec167d720c9b";
const backendUrl = "https://voya-live-backend.onrender.com";

const client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8",
});

const gifts = [
  { name: "Rose", icon: "🌹", amount: 20 },
  { name: "Diamond", icon: "💎", amount: 50 },
  { name: "Crown", icon: "👑", amount: 100 },
];

function getNumericUid() {
  const savedUid = localStorage.getItem("agoraUid");
  if (savedUid) return Number(savedUid);

  const newUid = Math.floor(Math.random() * 1000000);
  localStorage.setItem("agoraUid", String(newUid));
  return newUid;
}

export default function RoomModal(props) {
  const {
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
    hostMuteUser,
    roomSpeakers,
    giftFeed,
    giftAnimation,
    levelUpData,
    currentUser,
  } = props;

  const [chatText, setChatText] = useState("");
  const [micTrack, setMicTrack] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [isAgoraJoined, setIsAgoraJoined] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const micRef = useRef(null);
  const joinedRef = useRef(false);

  const roomUsers =
    liveRooms[String(joinedRoom?._id || joinedRoom?.id)]?.users || [];

  const hostUsers = roomUsers.filter((item) => item.isHost);

  const speakerUsers = roomUsers.filter(
    (item) => !item.isHost && isRoomSpeaker(item)
  );

  const audienceUsers = roomUsers.filter(
    (item) => !item.isHost && !isRoomSpeaker(item)
  );

  const currentRoomUser = roomUsers.find(
    (item) => item.id === currentUser?.phone
  );

  const isCurrentUserHost = currentRoomUser?.isHost || false;

  const currentSpeaker = roomSpeakers.find(
    (item) => item.id === currentUser?.phone
  );

  const isHostMuted = currentSpeaker?.muted || false;
  const canSpeak = isCurrentUserHost || Boolean(currentSpeaker);

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
      setSelectedUser(null);
      setProfileData(null);
      setIsFollowing(false);
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

  useEffect(() => {
    async function applyHostMute() {
      if (!micRef.current) return;

      await micRef.current.setEnabled(!isHostMuted);
      setMicOn(!isHostMuted);
    }

    applyHostMute();
  }, [isHostMuted]);

  useEffect(() => {
    if (!selectedUser) return;
    loadUserProfile(selectedUser);
  }, [selectedUser]);

  if (!joinedRoom) return null;

  async function loadUserProfile(userItem) {
    const token = localStorage.getItem("voya_token");
    if (!token || !userItem?.id) return;

    try {
      const response = await fetch(
        `${backendUrl}/api/users/profile/${userItem.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setProfileData(data);
        setIsFollowing(Boolean(data.isFollowing));
      } else {
        setProfileData(null);
      }
    } catch {
      setProfileData(null);
    }
  }

  async function followSelectedUser() {
    if (!selectedUser?.id) return;

    const token = localStorage.getItem("voya_token");

    try {
      const response = await fetch(
        `${backendUrl}/api/users/follow/${selectedUser.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Follow failed");
      }

      setIsFollowing(true);
      loadUserProfile(selectedUser);
    } catch {
      alert("Follow request failed");
    }
  }

  async function unfollowSelectedUser() {
    if (!selectedUser?.id) return;

    const token = localStorage.getItem("voya_token");

    try {
      const response = await fetch(
        `${backendUrl}/api/users/unfollow/${selectedUser.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Unfollow failed");
      }

      setIsFollowing(false);
      loadUserProfile(selectedUser);
    } catch {
      alert("Unfollow request failed");
    }
  }

  async function toggleMic() {
    const track = micRef.current || micTrack;

    if (!canSpeak) {
      alert("You need host approval to speak.");
      return;
    }

    if (isHostMuted) {
      alert("You have been muted by the host.");
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

  function getSpeaker(item) {
    return roomSpeakers.find((speaker) => speaker.id === item.id);
  }

  function isRoomSpeaker(item) {
    return Boolean(getSpeaker(item));
  }

  function getUserRole(item) {
    if (item.isHost) return "Host";
    if (isRoomSpeaker(item)) return "Speaker";
    return "Audience";
  }

  function getUserStatus(item) {
    const speaker = getSpeaker(item);

    if (speaker?.muted) return "Muted by host";
    if (isUserSpeaking(item)) return "Speaking now";
    if (isRoomSpeaker(item)) return "Can speak";
    return "Listening";
  }

  function getGiftAnimationClass(gift) {
    if (!gift) return "";

    if (gift.giftName === "Rose") return "giftOverlay roseAnimation";
    if (gift.giftName === "Diamond") return "giftOverlay diamondAnimation";
    if (gift.giftName === "Crown") return "giftOverlay crownAnimation";

    return "giftOverlay";
  }

  function openProfile(item) {
    setSelectedUser(item);
    setProfileData(null);
    setIsFollowing(false);
  }

  function renderVipBadge(vipLevel) {
    if (!vipLevel || vipLevel <= 0) return null;

    return (
      <div className={`vipBadge vip${vipLevel}`}>
        VIP {vipLevel}
      </div>
    );
  }

  function renderMiniVip(vipLevel) {
    if (!vipLevel || vipLevel <= 0) return null;

    return (
      <span className={`miniVipBadge vip${vipLevel}`}>
        VIP {vipLevel}
      </span>
    );
  }

  function renderLevelBadge(level) {
    return (
      <span className="levelBadge">
        Lv.{level || 1}
      </span>
    );
  }

  function getExpProgress() {
    const exp = profileData?.experience || 0;
    return exp % 100;
  }

  function renderUserCard(item) {
    const speaker = getSpeaker(item);
    const muted = speaker?.muted || false;

    return (
      <div
        className={
          isUserSpeaking(item)
            ? "micSeat activeSpeaker"
            : "micSeat"
        }
        key={item.id}
        onClick={() => openProfile(item)}
      >
        <div className="micAvatar">
          {item.name?.[0] || "U"}
        </div>

        <div className="seatName">
          {item.name}
        </div>

        <div className="seatBadges">
          {renderLevelBadge(item.level)}
          {renderMiniVip(item.vipLevel)}
        </div>

        {item.isHost && (
          <div className="hostBadge">👑 Host</div>
        )}

        {isRoomSpeaker(item) && !item.isHost && (
          <div className="speakerBadge">🎤 Speaker</div>
        )}

        {muted && (
          <div className="mutedBadge">🔇 Muted</div>
        )}

        {isCurrentUserHost && !item.isHost && isRoomSpeaker(item) && (
          <div
            className="hostControls"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="smallControlBtn"
              onClick={() => hostMuteUser(item.id, !muted)}
            >
              {muted ? "Unmute" : "Mute"}
            </button>

            <button
              className="smallControlBtn"
              onClick={() => removeSpeaker(item.id)}
            >
              Remove Mic
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="roomPanel">
        {levelUpData && (
          <div className="levelUpOverlay">
            <div className="levelUpCard">
              <div className="levelUpTitle">LEVEL UP!</div>
              <div className="levelUpLevel">
                Level {levelUpData.level}
              </div>
              <div className="levelUpText">
                {levelUpData.text}
              </div>
            </div>
          </div>
        )}

        {giftAnimation && (
          <div className={getGiftAnimationClass(giftAnimation)}>
            <div className="giftBigIcon">
              {giftAnimation.giftIcon}
            </div>
            <div className="giftBigText">
              {giftAnimation.text}
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="profilePopup">
            <div className="profileCard">
              <button
                className="profileClose"
                onClick={() => setSelectedUser(null)}
              >
                ×
              </button>

              <div className="profileAvatar">
                {selectedUser.name?.[0] || "U"}
              </div>

              <h3>{selectedUser.name}</h3>

              {renderVipBadge(profileData?.vipLevel)}

              <p>Role: {getUserRole(selectedUser)}</p>
              <p>Status: {getUserStatus(selectedUser)}</p>

              <p>Level: {profileData?.level ?? "-"}</p>

              <div className="expBox">
                <div className="expInfo">
                  <span>EXP</span>
                  <span>{getExpProgress()}/100</span>
                </div>

                <div className="expBar">
                  <div
                    className="expFill"
                    style={{
                      width: `${getExpProgress()}%`,
                    }}
                  />
                </div>
              </div>

              <p>VIP: {profileData?.vipLevel ?? 0}</p>
              <p>Total Spent: {profileData?.totalSpent ?? 0}</p>
              <p>Followers: {profileData?.followers ?? "-"}</p>
              <p>Following: {profileData?.following ?? "-"}</p>

              {selectedUser.id !== currentUser?.phone && (
                <button
                  className="profileActionBtn"
                  onClick={
                    isFollowing
                      ? unfollowSelectedUser
                      : followSelectedUser
                  }
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>
              )}

              <button
                className="profileActionBtn"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        <button className="close" onClick={closeRoom}>
          ×
        </button>

        <h2>{joinedRoom.name}</h2>
        <p>Hosted by {joinedRoom.host}</p>
        <p>{roomUsers.length} users live now</p>

        {giftFeed.length > 0 && (
          <div className="giftFeed">
            {giftFeed.map((gift) => (
              <div className="giftFeedItem" key={gift.id}>
                {gift.text}
              </div>
            ))}
          </div>
        )}

        <div className="stageSection">
          <h4>Host</h4>
          <div className="micGrid">
            {hostUsers.length > 0 ? (
              hostUsers.map((item) => renderUserCard(item))
            ) : (
              <div className="micSeat">
                <div className="micAvatar">?</div>
                <span>No host online</span>
              </div>
            )}
          </div>
        </div>

        <div className="stageSection">
          <h4>Speakers ({speakerUsers.length}/8)</h4>
          <div className="micGrid">
            {speakerUsers.length > 0 ? (
              speakerUsers.map((item) => renderUserCard(item))
            ) : (
              <div className="micSeat">
                <div className="micAvatar">🎤</div>
                <span>No speakers yet</span>
              </div>
            )}
          </div>
        </div>

        <div className="stageSection audienceSection">
          <h4>Audience</h4>
          <div className="audienceGrid">
            {audienceUsers.length > 0 ? (
              audienceUsers.map((item) => (
                <div
                  className="audienceUser"
                  key={item.id}
                  onClick={() => openProfile(item)}
                >
                  <div className="audienceAvatar">
                    {item.name?.[0] || "U"}
                  </div>

                  <span>{item.name}</span>

                  <div className="audienceBadges">
                    {renderLevelBadge(item.level)}
                    {renderMiniVip(item.vipLevel)}
                  </div>
                </div>
              ))
            ) : (
              <p className="emptyHands">No audience yet</p>
            )}
          </div>
        </div>

        <div className="raiseHandArea">
          {!isCurrentUserHost && !canSpeak && (
            <button className="raiseHandBtn" onClick={raiseHand}>
              ✋ Raise Hand
            </button>
          )}

          {!isCurrentUserHost && canSpeak && !isHostMuted && (
            <p className="speakerApproved">
              🎤 You are approved to speak
            </p>
          )}

          {!isCurrentUserHost && canSpeak && isHostMuted && (
            <p className="mutedNotice">
              🔇 You are muted by the host
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
            {!canSpeak
              ? "Listener"
              : isHostMuted
              ? "Muted by Host"
              : micOn
              ? "Mic On"
              : "Mic Off"}
          </button>

          {gifts.map((gift) => (
            <button
              key={gift.name}
              onClick={() => sendGift(gift)}
            >
              {gift.icon} {gift.name} -{gift.amount}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}