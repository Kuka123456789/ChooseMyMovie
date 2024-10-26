// src/WatchedMovies.js
import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import tmdb from "./tmdb";
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Rating,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Slider,
  TextField,
  OutlinedInput,
  Button,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

// Define provider IDs for streaming services (if needed for filters)
const providerIdMap = {
  Netflix: 8,
  "Amazon Prime": 9,
  Hulu: 15,
  "Disney+": 337,
};

// Create a custom theme with 'Space Grotesk' font
const theme = createTheme({
  typography: {
    fontFamily: "'Space Grotesk', sans-serif",
    h6: {
      fontWeight: 600,
    },
    body2: {
      fontWeight: 400,
    },
  },
  palette: {
    background: {
      default: "#f0f2f5",
    },
  },
});

function WatchedMovies() {
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [sortOrder, setSortOrder] = useState("ratingDesc");
  const user = auth.currentUser;
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchWatchedMovies();
    }
  }, [user]);

  const fetchWatchedMovies = async () => {
    try {
      const watchedSnapshot = await getDocs(
        collection(db, "users", user.uid, "watched")
      );
      const watchedData = watchedSnapshot.docs.map((doc) => ({
        movieId: doc.id,
        ...doc.data(),
      }));

      // Fetch movie details from TMDb
      const moviesWithDetails = await Promise.all(
        watchedData.map(async (watched) => {
          try {
            const [movieResponse, providersResponse] = await Promise.all([
              tmdb.get(`/movie/${watched.movieId}`),
              tmdb.get(`/movie/${watched.movieId}/watch/providers`),
            ]);
            const providersData = providersResponse.data.results.US;
            let streamingProviders = [];
            if (providersData && providersData.flatrate) {
              streamingProviders = providersData.flatrate.map(
                (provider) => provider.provider_name
              );
            }

            return {
              ...movieResponse.data,
              rating: watched.rating || 0,
              timestamp: watched.timestamp,
              streamingProviders,
            };
          } catch (error) {
            console.error(
              `Failed to fetch details for movie ID ${watched.movieId}`,
              error
            );
            return null;
          }
        })
      );

      // Filter out any null responses due to failed fetches
      setWatchedMovies(moviesWithDetails.filter((movie) => movie !== null));
    } catch (error) {
      console.error("Error fetching watched movies:", error);
      setError("Failed to load watched movies.");
    }
  };

  const handleRatingChange = async (movieId, newRating) => {
    try {
      // Update rating in Firestore
      await setDoc(
        doc(db, "users", user.uid, "watched", String(movieId)),
        { rating: newRating },
        { merge: true }
      );

      // Update state
      setWatchedMovies((prevMovies) =>
        prevMovies.map((movie) =>
          movie.id === movieId ? { ...movie, rating: newRating } : movie
        )
      );
      console.log(`Movie ID ${movieId} rating updated to ${newRating}.`);
    } catch (error) {
      console.error("Error updating rating:", error);
      setError("Failed to update rating.");
    }
  };

  const handleUnwatchMovie = async (movieId) => {
    try {
      const user = auth.currentUser;
      if (user && movieId) {
        await deleteDoc(doc(db, "users", user.uid, "watched", String(movieId)));
        setWatchedMovies((prev) => prev.filter((id) => id !== String(movieId)));
        console.log(`Movie ID ${movieId} removed from watched list.`);
        fetchWatchedMovies();
      }
    } catch (error) {
      console.error("Error unwatching movie:", error);
      setError("Failed to unwatch movie.");
    }
  };

  const sortedMovies = [...watchedMovies].sort((a, b) => {
    if (sortOrder === "ratingDesc") {
      return b.rating - a.rating;
    } else if (sortOrder === "ratingAsc") {
      return a.rating - b.rating;
    } else if (sortOrder === "recent") {
      return b.timestamp.toDate() - a.timestamp.toDate();
    } else {
      return 0;
    }
  });

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Your Watched Movies
        </Typography>
        {/* Sorting Controls */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            mb: 2,
          }}
        >
          <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              label="Sort By"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <MenuItem value="ratingDesc">Rating (High to Low)</MenuItem>
              <MenuItem value="ratingAsc">Rating (Low to High)</MenuItem>
              <MenuItem value="recent">Recently Watched</MenuItem>
            </Select>
          </FormControl>
        </Box>
        {/* Movie Grid */}
        <Grid container spacing={4}>
          {sortedMovies.length > 0 ? (
            sortedMovies.map((movie) => (
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
                    boxShadow: 3,
                    borderRadius: 2,
                    backgroundColor: "#ffffff",
                  }}
                >
                  {movie.poster_path && (
                    <CardMedia
                      component="img"
                      height="300"
                      image={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                      alt={movie.title}
                      sx={{ objectFit: "cover" }}
                    />
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {movie.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Release Year: {new Date(movie.release_date).getFullYear()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Your Rating:
                    </Typography>
                    <Rating
                      name={`rating-${movie.id}`}
                      value={movie.rating}
                      onChange={(event, newValue) => {
                        handleRatingChange(movie.id, newValue);
                      }}
                    />
                    {movie.streamingProviders.length > 0 && (
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", mt: 1 }}
                      >
                        Streaming on: {movie.streamingProviders.join(", ")}
                      </Typography>
                    )}
                    <Button
                        variant="text"
                        color="secondary"
                        onClick={() => handleUnwatchMovie(movie.id)}
                        sx={{ ml: 2 }}
                    >
                        Unwatch
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Typography variant="body1" sx={{ mt: 2, textAlign: "center" }}>
                You haven't marked any movies as watched yet.
              </Typography>
            </Grid>
          )}
        </Grid>
        {/* Error Message */}
        {error && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" color="error" align="center">
              {error}
            </Typography>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default WatchedMovies;