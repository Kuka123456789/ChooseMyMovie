import { createTheme } from "@mui/material/styles";

export const lightTheme = createTheme({
    palette: {
      mode: "light",
      primary: {
        main: "#1976d2", // Customize as needed
      },
      secondary: {
        main: "#dc004e", // Customize as needed
      },
    },
  });

  export const darkTheme = createTheme({
    palette: {
      mode: "dark",
      primary: {
        main: "#90caf9", // Customize as needed
      },
      secondary: {
        main: "#f48fb1", // Customize as needed
      },
    },
  });