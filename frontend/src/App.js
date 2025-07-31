import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:5050";

function App() {
  const [backendMessage, setBackendMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [pwMessage, setPwMessage] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API_URL + "/")
      .then((res) => res.text())
      .then(setBackendMessage)
      .catch(() => setBackendMessage("Error connecting to backend"));
    if (token) fetchFiles(token);
    // eslint-disable-next-line
  }, [token]);

  function fetchFiles(token) {
    setLoading(true);
    setError("");
    fetch(API_URL + "/api/files", {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        if (Array.isArray(data)) setFiles(data);
        else setFiles([]);
      })
      .catch(() => {
        setLoading(false);
        setError("Error fetching files");
      });
  }

  function handleFileChange(e) {
    setFile(e.target.files[0]);
  }

  function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("video", file);
    fetch(API_URL + "/api/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        setUploadResult(data.ok ? "Upload successful!" : "Upload failed");
        setFile(null); // Clear file input
        fetchFiles(token);
      })
      .catch(() => {
        setLoading(false);
        setError("Error uploading file");
      });
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthMessage("");
    const endpoint = isLogin ? "/api/login" : "/api/register";
    const res = await fetch(API_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (isLogin) {
      if (data.token) {
        setToken(data.token);
        localStorage.setItem("token", data.token);
        setAuthMessage("Login successful!");
        fetchFiles(data.token);
      } else {
        setAuthMessage(data.error || "Login failed");
      }
    } else {
      setAuthMessage(data.success ? "Registration successful! Please login." : data.error || "Registration failed");
      if (data.success) setIsLogin(true);
    }
  }

  function handleLogout() {
    setToken("");
    localStorage.removeItem("token");
    setFiles([]);
    setAuthMessage("Logged out.");
  }

  function handleDelete(id) {
    setLoading(true);
    setError("");
    fetch(`${API_URL}/api/files/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then(() => {
        setLoading(false);
        fetchFiles(token);
      })
      .catch(() => {
        setLoading(false);
        setError("Error deleting file");
      });
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>BetterClip Frontend</h1>
        <p>Backend says: <b>{backendMessage}</b></p>
        {token && (
          <button onClick={handleLogout} style={{ marginBottom: 20 }}>
            Logout
          </button>
        )}
        {token && (
          <form onSubmit={handleUpload}>
            <input type="file" onChange={handleFileChange} />
            <button type="submit">Upload</button>
          </form>
        )}
        {uploadResult && <div>Upload result: {uploadResult}</div>}
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}
        <h2>Uploaded Files</h2>
        <ul>
          {files.map((f) => (
            <li key={f.id}>
              <div>
                <b>{f.originalname}</b>
                <br />
                <img
                  src={`${API_URL}/uploads/${f.filename}.jpg`}
                  alt="thumbnail"
                  width={160}
                  height={90}
                  style={{ display: "block", margin: "10px 0" }}
                />
                <video
                  width="320"
                  height="180"
                  controls
                  src={`${API_URL}/uploads/${f.filename}`}
                  style={{ margin: "10px 0" }}
                />
                <br />
                <a href={`${API_URL}/uploads/${f.filename}`} download>
                  Download
                </a>
                <br />
                <span>Uploaded: {new Date(f.uploaded_at).toLocaleString()}</span>
                <br />
                <button onClick={() => handleDelete(f.id)} style={{ color: "red" }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {!token && (
          <div style={{ marginBottom: 20 }}>
            <h2>{isLogin ? "Login" : "Register"}</h2>
            <form onSubmit={handleAuth}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit">{isLogin ? "Login" : "Register"}</button>
            </form>
            <button onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "Need an account? Register" : "Have an account? Login"}
            </button>
            {authMessage && <div>{authMessage}</div>}
          </div>
        )}
        {token && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPwMessage("");
              const res = await fetch(API_URL + "/api/change-password", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + token,
                },
                body: JSON.stringify({ password: newPassword }),
              });
              const data = await res.json();
              setPwMessage(data.success ? "Password changed!" : data.error || "Failed");
              setNewPassword("");
            }}
            style={{ marginBottom: 20 }}
          >
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <button type="submit">Change Password</button>
            {pwMessage && <span style={{ marginLeft: 10 }}>{pwMessage}</span>}
          </form>
        )}
      </header>
    </div>
  );
}

export default App;