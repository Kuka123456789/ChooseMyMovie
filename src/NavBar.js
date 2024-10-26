// src/NavBar.js
import React, { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Box,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MovieIcon from "@mui/icons-material/Movie";
import AccountCircle from "@mui/icons-material/AccountCircle";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

function NavBar({ mode, toggleTheme }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();
  const user = auth.currentUser;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    signOut(auth);
    navigate("/login");
    handleClose();
  };

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: "center" }}>
      <Typography variant="h6" sx={{ my: 2 }}>
        ChooseMyMovie
      </Typography>
      <List>
        <ListItem button component={RouterLink} to="/">
          <ListItemText primary="Home" />
        </ListItem>
        {user ? (
          <>
            <ListItem button component={RouterLink} to="/dashboard">
              <ListItemText primary="Dashboard" />
            </ListItem>
            <ListItem button component={RouterLink} to="/watched">
              <ListItemText primary="Watched Movies" />
            </ListItem>
            <ListItem button component={RouterLink} to="/compare">
              <ListItemText primary="Compare Users" />
            </ListItem>
            <ListItem button onClick={handleLogout}>
              <ListItemText primary="Logout" />
            </ListItem>
          </>
        ) : (
          <>
            <ListItem button component={RouterLink} to="/signup">
              <ListItemText primary="Signup" />
            </ListItem>
            <ListItem button component={RouterLink} to="/login">
              <ListItemText primary="Login" />
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );

  const menuItems = user ? (
    <>
      <Button color="inherit" component={RouterLink} to="/dashboard">
        Dashboard
      </Button>
      <Button color="inherit" component={RouterLink} to="/watched">
        Watched Movies
      </Button>
      <Button color="inherit" component={RouterLink} to="/compare">
        Compare Users
      </Button>
      <IconButton
        size="large"
        edge="end"
        aria-label="account of current user"
        aria-controls="menu-appbar"
        aria-haspopup="true"
        onClick={handleMenu}
        color="inherit"
      >
        <AccountCircle />
      </IconButton>
      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={open}
        onClose={handleClose}
      >
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>
    </>
  ) : (
    <>
      <Button color="inherit" component={RouterLink} to="/signup">
        Signup
      </Button>
      <Button color="inherit" component={RouterLink} to="/login">
        Login
      </Button>
    </>
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          {/* Mobile menu button */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          {/* App logo and title */}
          <MovieIcon sx={{ mr: 1 }} />
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: "none",
              color: "inherit",
              flexGrow: 1,
            }}
          >
            ChooseMyMovie
          </Typography>

          {/* Theme Toggle */}
          <Tooltip
            title={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <IconButton
                sx={{ ml: 1 }}
                onClick={toggleTheme}
                color="inherit"
                aria-label="toggle theme"
            >
                {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>

          {/* Desktop menu items */}
          <Box sx={{ display: { xs: "none", sm: "block" } }}>{menuItems}</Box>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: 240,
          },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  );
}

export default NavBar;