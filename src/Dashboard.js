// src/Dashboard.js
import React, { useState, useEffect } from "react";
import { Container, Typography, Box } from "@mui/material";
import StreamingServices from "./StreamingServices";
import MovieList from "./MovieList";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

function Dashboard() {
  const [services, setServices] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const fetchUserServices = async () => {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setServices(userData.services || []);
        }
      };
      fetchUserServices();
    }
  }, [user]);

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <StreamingServices services={services} setServices={setServices} />
      <MovieList services={services} /> {/* Ensure services are passed here */}
    </Container>
  );
}

export default Dashboard;