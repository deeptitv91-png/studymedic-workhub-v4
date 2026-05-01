// src/pages/LoginPage.js
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { login, loginError, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    await login(username, password);
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-mark">SM</div>
          <div>
            <div className="login-brand-name">Work Hub</div>
            <div className="login-brand-sub">StudyMEDIC</div>
          </div>
        </div>
        <div className="login-hero">
          <h1>Creative workflow,<br />simplified.</h1>
          <p>Retail & Corporate task management for the entire StudyMEDIC creative team.</p>
        </div>
        <div className="login-dots">{[...Array(15)].map((_, i) => <div key={i} className="dot" />)}</div>
      </div>
      <div className="login-right">
        <div className="login-form-wrap">
          <h2 className="login-title">Sign in</h2>
          <p className="login-hint">Use your personal credentials to access Work Hub</p>
          {loginError && <div className="login-error">{loginError}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">Username</label>
              <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" required autoFocus />
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
              {loading ? <span className="spinner" /> : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
