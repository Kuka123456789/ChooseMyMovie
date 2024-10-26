// src/CompareUsers.js
import React, { useState, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import tmdb from "./tmdb";
import { providerIdMap } from "./constants";
import {
  Container,
  Button,
  Typography,
  Box,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Checkbox,
  FormControlLabel,
  FormGroup,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Rating,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MovieIcon from "@mui/icons-material/Movie";
import LocalMoviesIcon from "@mui/icons-material/LocalMovies";
import CompareIcon from "@mui/icons-material/Compare";

function CompareUsers() {
  // State Variables
  const [commonMovies, setCommonMovies] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sharedServices, setSharedServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // Array of selected user IDs
  const [userWatchedMovies, setUserWatchedMovies] = useState({});
  const [compareRatingDialogOpen, setCompareRatingDialogOpen] = useState(false);
  const [compareCurrentMovieId, setCompareCurrentMovieId] = useState(null);
  const [compareCurrentRating, setCompareCurrentRating] = useState(3);
  const [isCompareInitiated, setIsCompareInitiated] = useState(false); // To hide watched movies upon comparison

  const user = auth.currentUser;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Fetch all users except current user on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        const usersData = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((userData) => userData.id !== user?.uid); // Exclude current user
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
        setError("Failed to fetch users list");
      }
    };
    fetchUsers();
  }, [user?.uid]);

  // Handle selecting/deselecting users
  const handleUserSelection = (event) => {
    const userId = event.target.name;
    if (event.target.checked) {
      setSelectedUsers((prev) => [...prev, userId]);
    } else {
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
    }
  };

  // Fetch watched movies for a user
  const fetchUserWatchedMovies = useCallback(
    async (userId) => {
      if (userWatchedMovies[userId]) return; // Don't fetch if we already have the data

      try {
        // Get the watched movies collection
        const watchedRef = collection(db, "users", userId, "watched");
        const watchedSnapshot = await getDocs(watchedRef);
        const watchedMovies = [];

        // Fetch movie details for each watched movie
        for (const docSnap of watchedSnapshot.docs) {
          try {
            const movieData = docSnap.data();
            // Fetch movie details from TMDB if we have the movie ID
            const movieId = docSnap.id;
            const movieResponse = await tmdb.get(`/movie/${movieId}`);
            const movieDetails = movieResponse.data;

            watchedMovies.push({
              id: movieId,
              title: movieDetails.title,
              rating: movieData.rating || 0,
              posterPath: movieDetails.poster_path,
              overview: movieDetails.overview,
            });
          } catch (error) {
            console.error(`Error fetching movie details for ${docSnap.id}:`, error);
          }
        }

        setUserWatchedMovies((prev) => ({
          ...prev,
          [userId]: watchedMovies,
        }));
      } catch (error) {
        console.error("Error fetching watched movies:", error);
      }
    },
    [userWatchedMovies]
  );

  // Handle Compare Movies button click
  const handleCompare = async () => {
    if (selectedUsers.length === 0) {
      setError("Please select at least one user to compare with.");
      return;
    }

    try {
      setError("");
      setLoading(true);
      setCommonMovies([]);
      setIsCompareInitiated(true); // Hide watched movies

      // Fetch current user's services
      const currentUserDoc = await getDoc(doc(db, "users", user.uid));
      if (!currentUserDoc.exists()) {
        setError("Your user data not found.");
        setLoading(false);
        return;
      }
      const currentUserData = currentUserDoc.data();
      const currentUserServices = currentUserData.services || [];

      // Fetch selected users' services and watched movies
      const selectedUsersData = [];
      for (const userId of selectedUsers) {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          selectedUsersData.push(userData);
          // Fetch watched movies for each selected user
          await fetchUserWatchedMovies(userId);
        } else {
          console.warn(`User with ID ${userId} not found.`);
        }
      }

      // Compute shared streaming services (intersection)
      const computeSharedServices = () => {
        if (selectedUsersData.length === 0) return [];
        return selectedUsersData.reduce((acc, userData) => {
          if (!userData.services) return acc;
          return acc.filter((service) => userData.services.includes(service));
        }, currentUserServices);
      };

      const shared = computeSharedServices();
      setSharedServices(shared);

      if (shared.length === 0) {
        setError("No common streaming services found among selected users.");
        setLoading(false);
        return;
      }

      // Fetch commonly not-yet-watched movies
      await fetchCommonUnwatchedMovies(currentUserServices, selectedUsersData, shared);
      setLoading(false);
    } catch (error) {
      console.error("Error during comparison:", error);
      setError("An error occurred while comparing movies.");
      setLoading(false);
    }
  };

  // Fetch commonly not-yet-watched movies
  const fetchCommonUnwatchedMovies = async (currentUserServices, selectedUsersData, shared) => {
    try {
      // Fetch watched movies for current user
      const currentUserWatchedSnapshot = await getDocs(collection(db, "users", user.uid, "watched"));
      const currentUserWatched = currentUserWatchedSnapshot.docs.map((doc) => doc.id);

      // Fetch watched movies for all selected users
      let allWatched = new Set(currentUserWatched);
      for (const userData of selectedUsersData) {
        if (userWatchedMovies[userData.id]) {
          userWatchedMovies[userData.id].forEach((movie) => allWatched.add(movie.id));
        }
      }

      // Get shared provider IDs
      const sharedProviderIds = shared
        .map((service) => providerIdMap[service])
        .filter((id) => id !== undefined); // Ensure valid IDs

      if (sharedProviderIds.length === 0) {
        setError("No valid shared streaming services found.");
        return;
      }

      const sharedProviderIdsString = sharedProviderIds.join("|");

      // Fetch movies available on shared providers
      let allMovies = [];
      const totalPages = 20; // Increased to fetch more movies

      for (let page = 1; page <= totalPages; page++) {
        try {
          const response = await tmdb.get("/discover/movie", {
            params: {
              with_watch_providers: sharedProviderIdsString,
              watch_region: "US",
              page,
            },
          });
          allMovies = allMovies.concat(response.data.results);
        } catch (error) {
          console.error(`Error fetching movies from TMDb page ${page}:`, error);
        }
      }

      // Filter out movies that have been watched by any selected user
      const unwatchedByAll = allMovies.filter((movie) => !allWatched.has(String(movie.id)));

      // Remove duplicates based on movie ID
      const uniqueUnwatched = unwatchedByAll.filter(
        (movie, index, self) => index === self.findIndex((m) => m.id === movie.id)
      );

      // Limit to top 100 movies for performance (adjust as needed)
      const topMovies = uniqueUnwatched.slice(0, 100);

      setCommonMovies(topMovies);
    } catch (error) {
      console.error("Error fetching common unwatched movies:", error);
      setError("Failed to fetch common unwatched movies.");
    }
  };

  // Handle opening the rating dialog for comparison movies
  const handleCompareMarkAsWatched = (movieId) => {
    setCompareCurrentMovieId(movieId);
    setCompareCurrentRating(3); // Reset to default rating
    setCompareRatingDialogOpen(true);
  };

  // Handle submitting the rating for comparison movies
  const handleCompareRatingSubmit = async () => {
    if (!compareCurrentMovieId) {
      setError("No movie selected to mark as watched.");
      setCompareRatingDialogOpen(false);
      return;
    }

    try {
      // Add the movie to the user's watched list in Firestore
      await setDoc(
        doc(db, "users", user.uid, "watched", String(compareCurrentMovieId)),
        {
          timestamp: Timestamp.now(),
          rating: compareCurrentRating,
        },
        { merge: true }
      );

      // Remove the movie from the commonMovies list
      setCommonMovies((prevMovies) =>
        prevMovies.filter((movie) => movie.id !== compareCurrentMovieId)
      );

      // Optionally, show a success message or notification here

      setCompareRatingDialogOpen(false);
      setCompareCurrentMovieId(null);
      setCompareCurrentRating(3);
    } catch (error) {
      console.error("Error marking movie as watched:", error);
      setError("Failed to mark movie as watched.");
    }
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        padding: { xs: 2, md: 4 },
        background: "linear-gradient(to bottom, #f5f5f5, #ffffff)",
        minHeight: "100vh",
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          textAlign: "center",
          mb: 6,
          mt: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <LocalMoviesIcon sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              background: "linear-gradient(45deg, #1976d2, #42a5f5)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              textShadow: "2px 2px 4px rgba(0,0,0,0.1)",
              letterSpacing: -0.5,
            }}
          >
            Movie Watchers Community
          </Typography>
        </Box>
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{
            maxWidth: 600,
            mx: "auto",
            fontWeight: 300,
            lineHeight: 1.6,
          }}
        >
          Discover and compare movies with other cinephiles in your community
        </Typography>
      </Box>

      {/* Users Selection and List Section */}
      <Paper
        elevation={3}
        sx={{
          mb: 4,
          borderRadius: 2,
          overflow: "hidden",
          background: "rgba(255,255,255,0.9)",
        }}
      >
        {/* Users Selection Header */}
        <Box
          sx={{
            p: 3,
            background: "linear-gradient(45deg, #1976d2, #42a5f5)",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <MovieIcon sx={{ color: "white" }} />
          <Typography
            variant="h5"
            component="h2"
            sx={{
              color: "white",
              fontWeight: 600,
              textShadow: "1px 1px 2px rgba(0,0,0,0.2)",
            }}
          >
            Active Users
          </Typography>
        </Box>

        {/* Users Selection with Checkboxes */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Select Users to Compare:
          </Typography>
          <FormGroup>
            <Grid container spacing={1}>
              {users.map((userData) => (
                <Grid item xs={12} sm={6} md={4} key={userData.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedUsers.includes(userData.id)}
                        onChange={handleUserSelection}
                        name={userData.id}
                        color="primary"
                      />
                    }
                    label={userData.email}
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
          {/* Compare Movies Button */}
          <Box sx={{ mt: 2, textAlign: "right" }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CompareIcon />}
              onClick={handleCompare}
              disabled={selectedUsers.length === 0 || loading}
              sx={{
                borderRadius: 8,
                px: 4,
                backgroundColor: "#1976d2",
                boxShadow: 2,
                "&:hover": {
                  backgroundColor: "#1565c0",
                  transform: "translateY(-1px)",
                  boxShadow: 3,
                },
                transition: "all 0.2s",
              }}
            >
              Compare Movies
            </Button>
          </Box>
        </Box>

        {/* Users Watched Movies (Accordion) */}
        <Divider />
        <Box sx={{ p: 2 }}>
          {users.map((userData) => (
            <Accordion
              key={userData.id}
              sx={{
                mb: 1,
                "&.MuiAccordion-root": {
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  "&:before": {
                    display: "none",
                  },
                  "&.Mui-expanded": {
                    margin: "8px 0",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  },
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  pr: 2,
                  "&.Mui-expanded": {
                    backgroundColor: alpha("#1976d2", 0.03),
                  },
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: "1.1rem",
                    color: "text.primary",
                  }}
                >
                  {userData.email}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography
                    variant="subtitle1"
                    gutterBottom
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      mb: 2,
                    }}
                  >
                    Streaming Services:
                  </Typography>
                  <Box
                    sx={{
                      mb: 3,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    {userData.services && userData.services.length > 0 ? (
                      userData.services.map((service) => (
                        <Button
                          key={service}
                          variant="outlined"
                          size="small"
                          sx={{
                            borderRadius: 4,
                            textTransform: "none",
                            px: 2,
                            py: 0.5,
                            color: "primary.main",
                            borderColor: "primary.main",
                            "&:hover": {
                              backgroundColor: alpha("#1976d2", 0.04),
                              borderColor: "primary.dark",
                            },
                          }}
                        >
                          {service}
                        </Button>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No services added
                      </Typography>
                    )}
                  </Box>

                  {/* Watched Movies Section (Hidden After Comparison) */}
                  {!isCompareInitiated && (
                    <>
                      <Typography
                        variant="subtitle1"
                        gutterBottom
                        sx={{
                          fontWeight: 600,
                          color: "text.primary",
                          mb: 2,
                        }}
                      >
                        Watched Movies:
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        {userWatchedMovies[userData.id] ? (
                          userWatchedMovies[userData.id].length > 0 ? (
                            <Grid container spacing={2}>
                              {userWatchedMovies[userData.id].map((movie) => (
                                <Grid item xs={12} sm={6} md={4} key={movie.id}>
                                  <Card
                                    sx={{
                                      height: "100%",
                                      display: "flex",
                                      flexDirection: "column",
                                      transition: "transform 0.2s",
                                      "&:hover": {
                                        transform: "scale(1.02)",
                                      },
                                    }}
                                  >
                                    {movie.posterPath ? (
                                      <CardMedia
                                        component="img"
                                        sx={{ height: 300 }}
                                        image={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
                                        alt={movie.title}
                                      />
                                    ) : (
                                      <Box
                                        sx={{
                                          height: 300,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          backgroundColor: "grey.200",
                                        }}
                                      >
                                        <Typography variant="subtitle1" color="text.secondary">
                                          No Image
                                        </Typography>
                                      </Box>
                                    )}
                                    <CardContent sx={{ flexGrow: 1 }}>
                                      <Typography variant="h6" component="div" gutterBottom>
                                        {movie.title}
                                      </Typography>
                                      <Box sx={{ display: "flex", alignItems: "center" }}>
                                        <Rating
                                          value={movie.rating}
                                          readOnly
                                          precision={0.5}
                                        />
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                          sx={{ ml: 1 }}
                                        >
                                          ({movie.rating}/5)
                                        </Typography>
                                      </Box>
                                    </CardContent>
                                  </Card>
                                </Grid>
                              ))}
                            </Grid>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No watched movies.
                            </Typography>
                          )
                        ) : (
                          <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              Loading watched movies...
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* Movie Comparison Results */}
      {error && (
        <Typography color="error" variant="body1" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
      {sharedServices.length > 0 && !isCompareInitiated && (
        <Typography variant="body1" sx={{ mt: 2 }}>
          Shared Streaming Services: {sharedServices.join(", ")}
        </Typography>
      )}
      {loading && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mt: 4,
            color: "text.primary",
          }}
        >
          <CircularProgress />
        </Box>
      )}
      {commonMovies.length > 0 && !loading && (
        <Box mt={4}>
          <Typography variant="h5" component="h2" gutterBottom>
            Movies You Both Haven't Watched
          </Typography>
          <Grid container spacing={2}>
            {commonMovies.map((movie) => (
              <Grid item xs={12} sm={6} md={4} key={movie.id}>
                <Card
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    transition: "transform 0.2s",
                    "&:hover": {
                      transform: "scale(1.02)",
                    },
                    backgroundColor: "background.paper",
                  }}
                >
                  {movie.poster_path ? (
                    <CardMedia
                      component="img"
                      sx={{ height: 300 }}
                      image={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                      alt={movie.title}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "grey.200",
                      }}
                    >
                      <Typography variant="subtitle1" color="text.secondary">
                        No Image
                      </Typography>
                    </Box>
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3">
                      {movie.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Release Year: {movie.release_date ? new Date(movie.release_date).getFullYear() : "N/A"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      IMDb Rating: {movie.vote_average} | Popularity: {Math.round(movie.popularity)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Available on: {sharedServices.join(", ")}
                    </Typography>
                    <Box sx={{ mt: 2, textAlign: "center" }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleCompareMarkAsWatched(movie.id)}
                        sx={{
                          borderRadius: 8,
                          px: 3,
                          backgroundColor: "#1976d2",
                          boxShadow: 2,
                          "&:hover": {
                            backgroundColor: "#1565c0",
                            transform: "translateY(-1px)",
                            boxShadow: 3,
                          },
                          transition: "all 0.2s",
                        }}
                      >
                        Mark as Watched
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      {!loading && commonMovies.length === 0 && isCompareInitiated && !error && (
        <Typography variant="body1" sx={{ mt: 2 }}>
          No common unwatched movies found.
        </Typography>
      )}

      {/* Rating Dialog for Comparison Movies */}
      <Dialog
        open={compareRatingDialogOpen}
        onClose={() => setCompareRatingDialogOpen(false)}
      >
        <DialogTitle>Rate the Movie</DialogTitle>
        <DialogContent>
          <Rating
            name="compare-movie-rating"
            value={compareCurrentRating}
            onChange={(event, newValue) => {
              setCompareCurrentRating(newValue);
            }}
            size="large"
            sx={{ display: "flex", justifyContent: "center", mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareRatingDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCompareRatingSubmit} variant="contained">
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CompareUsers;