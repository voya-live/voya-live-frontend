import React from "react";

export default function Sidebar({
  user,
  coins,
  setUser,
  backendUrl,
  setCurrentUser,
}) {
  async function updateProfileImage(imageData) {
    const token = localStorage.getItem("voya_token");

    try {
      const response = await fetch(`${backendUrl}/api/users/profile-image`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileImage: imageData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return alert(data.error || "Profile image update failed");
      }

      const updatedUser = {
        ...user,
        profileImage: data.user.profileImage || "",
      };

      localStorage.setItem("voya_user", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
    } catch {
      alert("Profile image upload failed");
    }
  }

  function handleProfileImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateProfileImage(reader.result);
      }
    };

    reader.readAsDataURL(file);
  }

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
        <div className="avatar">
          {user.profileImage ? (
            <img
              src={user.profileImage}
              alt="Profile"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            user.name[0]
          )}
        </div>

        <div>
          <h3>{user.name}</h3>
          <p>Level {user.level} • {coins} coins</p>

          <input
            type="file"
            accept="image/*"
            onChange={handleProfileImageChange}
            style={{
              width: "100%",
              marginTop: "8px",
            }}
          />
        </div>
      </div>
    </aside>
  );
}