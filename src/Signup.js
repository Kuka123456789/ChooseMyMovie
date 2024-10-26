// src/Signup.js
import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  TextField,
  Button,
  Container,
  Typography,
  Link,
  Box,
} from "@mui/material";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  let navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (auth.currentUser) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      // Save user data to Firestore
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          services: [],
        },
        { merge: true }
      );
      navigate("/dashboard");
    } catch (error) {
      console.error("Signup Error", error);
      setError(error.message);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom>
          Signup
        </Typography>
        {error && (
          <Typography color="error" variant="body1">
            {error}
          </Typography>
        )}
        <TextField
          label="Email"
          type="email"
          fullWidth
          margin="normal"
          variant="outlined"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          InputLabelProps={{
            style: { color: "text.primary" },
          }}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          variant="outlined"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputLabelProps={{
            style: { color: "text.primary" },
          }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSignup}
          fullWidth
          sx={{ mt: 2 }}
        >
          Signup
        </Button>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Already have an account?{" "}
          <Link component={RouterLink} to="/login">
            Log in here
          </Link>
          .
        </Typography>
      </Box>
    </Container>
  );
}

export default Signup;