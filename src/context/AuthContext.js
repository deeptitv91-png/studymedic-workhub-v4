// src/context/AuthContext.js
// Individual logins: each member has their own username + password stored in Firestore
// Special accounts: admin and super admin hardcoded

import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { SUPER_ADMIN, ADMIN_ACCOUNT } from "../utils/constants";

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("sm_v4_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(username, password) {
    setLoading(true);
    setLoginError("");

    // Super admin check
    if (username === SUPER_ADMIN.username && password === SUPER_ADMIN.password) {
      const user = { id: "superadmin", name: "Super Admin", role: "superadmin", isSuperAdmin: true };
      setCurrentUser(user);
      localStorage.setItem("sm_v4_user", JSON.stringify(user));
      setLoading(false);
      return true;
    }

    // Admin check
    if (username === ADMIN_ACCOUNT.username && password === ADMIN_ACCOUNT.password) {
      const user = { id: "admin", name: "Admin", role: "admin", isAdmin: true };
      setCurrentUser(user);
      localStorage.setItem("sm_v4_user", JSON.stringify(user));
      setLoading(false);
      return true;
    }

    // Member login — check Firestore
    try {
      const q = query(
        collection(db, "members"),
        where("username", "==", username.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const memberData = snap.docs[0].data();
        if (memberData.password === password) {
          if (memberData.active === false) {
            setLoginError("Your account has been deactivated. Contact admin.");
            setLoading(false);
            return false;
          }
          const user = { ...memberData, id: snap.docs[0].id };
          setCurrentUser(user);
          localStorage.setItem("sm_v4_user", JSON.stringify(user));
          setLoading(false);
          return true;
        }
      }
      setLoginError("Incorrect username or password.");
    } catch (err) {
      setLoginError("Login failed. Please try again.");
      console.error(err);
    }

    setLoading(false);
    return false;
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem("sm_v4_user");
  }

  // Refresh user data from Firestore (in case role/name changed)
  useEffect(() => {
    if (!currentUser?.id || currentUser.isSuperAdmin || currentUser.isAdmin) return;
    const refresh = async () => {
      try {
        const q = query(collection(db, "members"), where("username", "==", currentUser.username));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const updated = { ...snap.docs[0].data(), id: snap.docs[0].id };
          setCurrentUser(updated);
          localStorage.setItem("sm_v4_user", JSON.stringify(updated));
        }
      } catch (err) { console.error(err); }
    };
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, loginError, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
