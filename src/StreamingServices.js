// src/StreamingServices.js
import React from "react";
import { db, auth } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import {
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
} from "@mui/material";

const availableServices = [
  "Netflix",
  "Amazon Prime",
  "Hulu",
  "Disney+",
];

function StreamingServices({ services, setServices }) {
  const handleServiceToggle = async (service) => {
    let newServices = [];
    if (services.includes(service)) {
      newServices = services.filter((s) => s !== service);
    } else {
      newServices = [...services, service];
    }
    setServices(newServices);

    // Save to Firestore
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { services: newServices },
          { merge: true }
        );
        console.log(`Updated streaming services: ${newServices.join(", ")}`);
      } catch (error) {
        console.error("Error updating streaming services:", error);
      }
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Streaming Services
      </Typography>
      <FormGroup row>
        {availableServices.map((service) => (
          <FormControlLabel
            key={service}
            control={
              <Checkbox
                checked={services.includes(service)}
                onChange={() => handleServiceToggle(service)}
                name={service}
                color="primary"
              />
            }
            label={service}
          />
        ))}
      </FormGroup>
    </Box>
  );
}

export default StreamingServices;