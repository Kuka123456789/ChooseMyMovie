// src/App.js
import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./NavBar";
import Signup from "./Signup";
import Login from "./Login";
import Dashboard from "./Dashboard";
import CompareUsers from "./CompareUsers";
import WatchedMovies from "./WatchedMovies";
import MovieList from "./MovieList";
import Home from "./Home";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { lightTheme, darkTheme } from "./Theme";

function App() {
  const [mode, setMode] = useState("light");

  const theme = useMemo(() => (mode === "light" ? lightTheme : darkTheme), [mode]);

  const toggleTheme = () => {
    const newMode = mode === "light" ? "dark" : "light";
    setMode(newMode);
    localStorage.setItem("preferredTheme", newMode);
  };

  // Load preferred theme from localStorage on initial render
  useEffect(() => {
    const savedMode = localStorage.getItem("preferredTheme") || "light";
    setMode(savedMode);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Router>
        <NavBar mode={mode} toggleTheme={toggleTheme} />
        <CssBaseline />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/compare" element={<CompareUsers />} />
          <Route path="/watched" element={<WatchedMovies />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;