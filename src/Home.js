// src/Home.js
import React from "react";
import { Container, Typography, Box, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { auth } from "./firebase";

function Home() {
  const user = auth.currentUser;

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box textAlign="center">
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome to ChooseMyMovie
        </Typography>
        <Typography variant="h6" component="p" gutterBottom>
          Discover movies you haven't watched yet and share the experience with friends!
        </Typography>
        {user ? (
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/dashboard"
            sx={{ mt: 2 }}
          >
            Go to Dashboard
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/signup"
            sx={{ mt: 2 }}
          >
            Get Started
          </Button>
        )}
      </Box>
    </Container>
  );
}

export default Home;