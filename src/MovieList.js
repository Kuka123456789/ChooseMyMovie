// src/MovieList.js
import React, { useEffect, useState, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import tmdb from "./tmdb";
import {
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  Tooltip,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Slider,
  TextField,
  ListItemText,
  Checkbox,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { createTheme, ThemeProvider } from "@mui/material/styles";

// Define provider IDs for streaming services
const providerIdMap = {
  Netflix: 8,
  "Amazon Prime": 9,
  Hulu: 15,
  "Disney+": 337,
};

// Create a custom theme that adapts to light and dark modes
const getCustomTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      background: {
        default: mode === "dark" ? "#121212" : "#f0f2f5",
        paper: mode === "dark" ? "#1e1e1e" : "#ffffff",
      },
      text: {
        primary: mode === "dark" ? "#ffffff" : "#000000",
        secondary: mode === "dark" ? "#b0b0b0" : "#555555",
      },
      primary: {
        main: "#1976d2",
      },
      secondary: {
        main: "#dc004e",
      },
    },
    typography: {
      fontFamily: "'Space Grotesk', sans-serif",
      h6: {
        fontWeight: 600,
      },
      body2: {
        fontWeight: 400,
      },
    },
  });

function MovieList({ services, darkMode }) {
  const [movies, setMovies] = useState([]);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [currentMovieId, setCurrentMovieId] = useState(null);
  const [currentRating, setCurrentRating] = useState(3);
  const [genresList, setGenresList] = useState({});
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [minTmdbRating, setMinTmdbRating] = useState(0);
  const [maxTmdbRating, setMaxTmdbRating] = useState(10);
  const [minImdbRating, setMinImdbRating] = useState(0);
  const [maxImdbRating, setMaxImdbRating] = useState(10);
  const [showMovies, setShowMovies] = useState("all"); // 'all', 'watched', 'unwatched'
  const [sortOrder, setSortOrder] = useState("vote_average.desc"); // Default sort by rating descending
  const [searchQuery, setSearchQuery] = useState("");
  const [releaseYearRange, setReleaseYearRange] = useState([1980, 2024]); // Default release year range
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state

  // Fetch genres list from TMDb on component mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await tmdb.get("/genre/movie/list", {
          params: {
            language: "en-US",
          },
        });
        const genresArray = response.data.genres;
        const genresMap = {};
        genresArray.forEach((genre) => {
          genresMap[genre.id] = genre.name;
        });
        setGenresList(genresMap);
      } catch (error) {
        console.error("Error fetching genres:", error);
        setError("Failed to load genres.");
      }
    };

    fetchGenres();
  }, []);

  // Throttled fetching of detailed movie data including streaming platforms
  const fetchDetailedMovieData = useCallback(async (movies) => {
    const detailedMovies = [];
    const batchSize = 3; // Adjust as needed

    for (let i = 0; i < movies.length; i += batchSize) {
      const batch = movies.slice(i, i + batchSize);
      const batchPromises = batch.map(async (movie) => {
        try {
          // Fetch detailed data from TMDb
          const detailResponse = await tmdb.get(`/movie/${movie.id}`);
          const imdbId = detailResponse.data.imdb_id;

          // Fetch IMDb rating from OMDb
          let imdbRating = "N/A";
          if (imdbId) {
            try {
              const omdbResponse = await fetch(
                `https://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.REACT_APP_OMDB_API_KEY}`
              );
              const omdbData = await omdbResponse.json();
              if (omdbData.Response === "True") {
                imdbRating = parseFloat(omdbData.imdbRating) || 0;
              }
            } catch (omdbError) {
              console.error(
                `Error fetching OMDb data for IMDb ID ${imdbId}:`,
                omdbError
              );
            }
          }

          // Fetch streaming providers from TMDb
          let streamingProviders = [];
          try {
            const providersResponse = await tmdb.get(
              `/movie/${movie.id}/watch/providers`
            );
            const providersData = providersResponse.data.results.US;
            if (providersData && providersData.flatrate) {
              streamingProviders = providersData.flatrate.map(
                (provider) => provider.provider_name
              );
            }
          } catch (providerError) {
            console.error(
              `Error fetching streaming providers for movie ID ${movie.id}:`,
              providerError
            );
          }

          return { ...movie, imdbRating, streamingProviders };
        } catch (error) {
          console.error(`Error fetching details for movie ID ${movie.id}:`, error);
          return { ...movie, imdbRating: "N/A", streamingProviders: [] };
        }
      });

      try {
        const results = await Promise.all(batchPromises);
        detailedMovies.push(...results);
      } catch (batchError) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, batchError);
      }
    }

    return detailedMovies;
  }, []);

  // Fetch movies based on the current filter
  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      setError(null);
      try {
        if (showMovies === "watched") {
          // Fetch and display only watched movies
          const user = auth.currentUser;
          if (user) {
            const watchedSnapshot = await getDocs(
              collection(db, "users", user.uid, "watched")
            );
            const watchedIds = watchedSnapshot.docs.map((doc) => doc.id);

            if (watchedIds.length === 0) {
              setMovies([]);
              setLoading(false);
              return;
            }

            // Fetch detailed data for watched movies
            const detailedMovies = await Promise.all(
              watchedIds.map(async (id) => {
                try {
                  const detailResponse = await tmdb.get(`/movie/${id}`);
                  const imdbId = detailResponse.data.imdb_id;

                  // Fetch IMDb rating from OMDb
                  let imdbRating = "N/A";
                  if (imdbId) {
                    try {
                      const omdbResponse = await fetch(
                        `https://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.REACT_APP_OMDB_API_KEY}`
                      );
                      const omdbData = await omdbResponse.json();
                      if (omdbData.Response === "True") {
                        imdbRating = parseFloat(omdbData.imdbRating) || 0;
                      }
                    } catch (omdbError) {
                      console.error(
                        `Error fetching OMDb data for IMDb ID ${imdbId}:`,
                        omdbError
                      );
                    }
                  }

                  // Fetch streaming providers from TMDb
                  let streamingProviders = [];
                  try {
                    const providersResponse = await tmdb.get(
                      `/movie/${id}/watch/providers`
                    );
                    const providersData = providersResponse.data.results.US;
                    if (providersData && providersData.flatrate) {
                      streamingProviders = providersData.flatrate.map(
                        (provider) => provider.provider_name
                      );
                    }
                  } catch (providerError) {
                    console.error(
                      `Error fetching streaming providers for movie ID ${id}:`,
                      providerError
                    );
                  }

                  return {
                    ...detailResponse.data,
                    imdbRating,
                    streamingProviders,
                  };
                } catch (error) {
                  console.error(`Error fetching details for movie ID ${id}:`, error);
                  return null;
                }
              })
            );

            // Filter out any null responses due to failed fetches
            const filteredMovies = detailedMovies
              .filter((movie) => movie !== null)
              .filter(
                (movie) =>
                  (movie.imdbRating === "N/A" ||
                    (movie.imdbRating >= minImdbRating &&
                      movie.imdbRating <= maxImdbRating)) &&
                  movie.vote_average >= minTmdbRating &&
                  movie.vote_average <= maxTmdbRating
              );

            setMovies(filteredMovies);
          }
        } else {
          // Fetch general movies as per filters
          let fetchedMovies = [];
          for (let page = 1; page <= 2; page++) { // Increased pages to fetch more movies
            const params = {
              page,
              sort_by: sortOrder,
              with_genres: selectedGenres.join(",") || undefined,
              "vote_average.gte": minTmdbRating || undefined,
              "vote_average.lte": maxTmdbRating || undefined,
              "primary_release_date.gte": `${releaseYearRange[0]}-01-01`,
              "primary_release_date.lte": `${releaseYearRange[1]}-12-31`,
              query: searchQuery || undefined,
            };
            if (sortOrder === "vote_average.desc") {
              params["vote_count.gte"] = 1000; // Exclude movies with less than 1000 votes
            }
            if (services.length > 0) {
              const providerIds = services.map((service) => providerIdMap[service]).join("|");
              params["with_watch_providers"] = providerIds;
              params["watch_region"] = "DE"; // Adjust as needed
            }
            const response = await tmdb.get("/discover/movie", {
              params,
            });
            fetchedMovies = fetchedMovies.concat(response.data.results);
          }

          // Fetch detailed data with throttling
          const detailedMovies = await fetchDetailedMovieData(fetchedMovies);

          // Filter based on IMDb ratings
          const filteredMovies = detailedMovies.filter((movie) => {
            if (movie.imdbRating === "N/A") return true; // Include if IMDb rating is not available
            return (
              movie.imdbRating >= minImdbRating && movie.imdbRating <= maxImdbRating
            );
          });

          setMovies(filteredMovies);
        }
      } catch (error) {
        console.error("Error fetching movies:", error);
        setError("Failed to load movies.");
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [
    sortOrder,
    selectedGenres,
    minTmdbRating,
    maxTmdbRating,
    minImdbRating,
    maxImdbRating,
    searchQuery,
    services,
    releaseYearRange,
    showMovies,
    fetchDetailedMovieData,
  ]);

  // Fetch watched movie IDs only when not in 'watched' mode
  useEffect(() => {
    if (showMovies !== "watched") {
      const fetchWatchedMovies = async () => {
        try {
          const user = auth.currentUser;
          if (user) {
            const watchedSnapshot = await getDocs(
              collection(db, "users", user.uid, "watched")
            );
            const watchedIds = watchedSnapshot.docs.map((doc) => doc.id);
            setWatchedMovies(watchedIds);
          }
        } catch (error) {
          console.error("Error fetching watched movies:", error);
          setError("Failed to load watched movies.");
        }
      };

      fetchWatchedMovies();
    }
  }, [showMovies]);

  // Handle marking a movie as watched
  const handleMarkAsWatched = (movieId) => {
    setCurrentMovieId(movieId);
    setRatingDialogOpen(true);
  };

  const handleRatingChange = async (movieId, newRating) => {
    try {
      const user = auth.currentUser;
      if (user && movieId) {
        if (newRating > 0) {
          // Mark as watched with rating
          await setDoc(
            doc(db, "users", user.uid, "watched", String(movieId)),
            {
              timestamp: Timestamp.now(),
              rating: newRating,
            },
            { merge: true }
          );

          setWatchedMovies((prev) => [...prev, String(movieId)]);
          console.log(
            `Movie ID ${movieId} marked as watched with rating ${newRating}.`
          );
        } else {
          // Remove from watched if rating is 0
          await deleteDoc(doc(db, "users", user.uid, "watched", String(movieId)));
          setWatchedMovies((prev) =>
            prev.filter((id) => id !== String(movieId))
          );
          console.log(`Movie ID ${movieId} removed from watched list.`);
        }
      }
    } catch (error) {
      console.error("Error updating movie rating:", error);
      setError("Failed to update movie rating.");
    }
  };

  // Handle submitting the rating
  const handleRatingSubmit = async () => {
    try {
      const user = auth.currentUser;
      if (user && currentMovieId) {
        await setDoc(
          doc(db, "users", user.uid, "watched", String(currentMovieId)),
          {
            timestamp: Timestamp.now(),
            rating: currentRating,
          },
          { merge: true }
        );

        setWatchedMovies([...watchedMovies, String(currentMovieId)]);
        setRatingDialogOpen(false);
        setCurrentMovieId(null);
        setCurrentRating(3);
        console.log(
          `Movie ID ${currentMovieId} marked as watched with rating ${currentRating}.`
        );

        // Optionally, refetch movies to reflect the new watched status
        // Uncomment the following line if needed
        // fetchDetailedMovieData(movies);
      }
    } catch (error) {
      console.error("Error marking movie as watched:", error);
      setError("Failed to mark movie as watched.");
    }
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setSortOrder("vote_average.desc");
    setSelectedGenres([]);
    setMinTmdbRating(0);
    setMaxTmdbRating(10);
    setMinImdbRating(0);
    setMaxImdbRating(10);
    setShowMovies("all");
    setSearchQuery("");
    setReleaseYearRange([1980, 2024]); // Reset to default release year range
  };

  return (
    <ThemeProvider theme={getCustomTheme(darkMode ? "dark" : "light")}>
      <Grid container spacing={2} sx={{ padding: { xs: 1, sm: 2, md: 4 } }}>
        {/* Filters Panel */}
        <Grid item xs={12} md={4}>
          <Box
            sx={{
              padding: 2,
              backgroundColor: "background.paper",
              borderRadius: 2,
              boxShadow: 3,
              mb: { xs: 2, md: 0 },
            }}
          >
            <Typography variant="h6" gutterBottom>
              Filters
            </Typography>

            {/* 1. Search Input at the Top */}
            <TextField
              label="Search Movies"
              variant="outlined"
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 2, mt: 1 }}
            />

            {/* Show Watched Movies Options */}
            <FormControl sx={{ mt: 1, mb: 2, width: "100%" }}>
              <InputLabel id="show-movies-label">Show Movies</InputLabel>
              <Select
                labelId="show-movies-label"
                id="show-movies-select"
                value={showMovies}
                onChange={(e) => setShowMovies(e.target.value)}
                label="Show Movies"
              >
                <MenuItem value="unwatched">Unwatched Only</MenuItem>
                <MenuItem value="watched">Watched Only</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </Select>
            </FormControl>

            {/* Genres Filter */}
            <FormControl sx={{ mt: 1, mb: 2, width: "100%" }}>
              <InputLabel id="genre-select-label">Genres</InputLabel>
              <Select
                labelId="genre-select-label"
                id="genre-select"
                multiple
                value={selectedGenres}
                onChange={(e) => setSelectedGenres(e.target.value)}
                input={<OutlinedInput label="Genres" />}
                renderValue={(selected) =>
                  selected.map((id) => genresList[id]).join(", ")
                }
              >
                {Object.entries(genresList).map(([id, name]) => (
                  <MenuItem key={id} value={id}>
                    <Checkbox checked={selectedGenres.indexOf(id) > -1} />
                    <ListItemText primary={name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* TMDb Rating Filter */}
            <Box sx={{ mt: 1, mb: 2 }}>
              <Typography gutterBottom>TMDb Rating</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <TextField
                  label="Min"
                  type="number"
                  inputProps={{ min: 0, max: 10, step: 0.5 }}
                  value={minTmdbRating}
                  onChange={(e) => setMinTmdbRating(Number(e.target.value))}
                  sx={{ width: "45%" }}
                />
                <TextField
                  label="Max"
                  type="number"
                  inputProps={{ min: 0, max: 10, step: 0.5 }}
                  value={maxTmdbRating}
                  onChange={(e) => setMaxTmdbRating(Number(e.target.value))}
                  sx={{ width: "45%" }}
                />
              </Box>
              <Slider
                value={[minTmdbRating, maxTmdbRating]}
                onChange={(e, newValue) => {
                  setMinTmdbRating(newValue[0]);
                  setMaxTmdbRating(newValue[1]);
                }}
                aria-labelledby="tmdb-rating-slider"
                valueLabelDisplay="auto"
                step={0.5}
                marks
                min={0}
                max={10}
              />
            </Box>

            {/* IMDb Rating Filter */}
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography gutterBottom>IMDb Rating</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <TextField
                  label="Min"
                  type="number"
                  inputProps={{ min: 0, max: 10, step: 0.1 }}
                  value={minImdbRating}
                  onChange={(e) => setMinImdbRating(Number(e.target.value))}
                  sx={{ width: "45%" }}
                />
                <TextField
                  label="Max"
                  type="number"
                  inputProps={{ min: 0, max: 10, step: 0.1 }}
                  value={maxImdbRating}
                  onChange={(e) => setMaxImdbRating(Number(e.target.value))}
                  sx={{ width: "45%" }}
                />
              </Box>
              <Slider
                value={[minImdbRating, maxImdbRating]}
                onChange={(e, newValue) => {
                  setMinImdbRating(newValue[0]);
                  setMaxImdbRating(newValue[1]);
                }}
                aria-labelledby="imdb-rating-slider"
                valueLabelDisplay="auto"
                step={0.1}
                marks={[
                  { value: 0, label: "0" },
                  { value: 10, label: "10" },
                ]}
                min={0}
                max={10}
              />
            </Box>

            {/* Release Year Filter */}
            <Box sx={{ mt: 2, mb: 2, ml: 1, mr: 1 }}>
              <Typography gutterBottom>Release Year</Typography>
              <Slider
                value={releaseYearRange}
                onChange={(e, newValue) => setReleaseYearRange(newValue)}
                onChangeCommitted={(e, newValue) => setReleaseYearRange(newValue)} // Apply filter after dragging
                aria-labelledby="release-year-slider"
                valueLabelDisplay="auto"
                step={1}
                marks={[
                  { value: 1980, label: "1980" },
                  { value: 2024, label: "2024" },
                ]}
                min={1980}
                max={2024}
              />
            </Box>

            {/* Reset Filters Button */}
            <Button
              variant="outlined"
              color="secondary"
              fullWidth
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          </Box>
        </Grid>

        {/* Movie Grid */}
        <Grid item xs={12} md={8}>
          {loading ? (
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
          ) : error ? (
            <Typography variant="h6" color="error" align="center">
              {error}
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {movies.length > 0 ? (
                movies.map((movie) => (
                  <Grid item xs={12} key={movie.id}>
                    <Card
                      sx={{
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        transition: "transform 0.2s",
                        "&:hover": {
                          transform: "scale(1.02)",
                        },
                        padding: 2,
                        boxShadow: 3,
                        borderRadius: 2,
                        backgroundColor: "background.paper",
                        width: "100%",
                      }}
                    >
                      {movie.poster_path && (
                        <CardMedia
                          component="img"
                          sx={{
                            width: { sm: 150 },
                            height: 225,
                            objectFit: "cover",
                            borderRadius: 1,
                          }}
                          image={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                          alt={movie.title}
                        />
                      )}
                      <CardContent
                        sx={{
                          flex: "1 1 auto",
                          ml: { sm: 2 },
                          mt: { xs: 2, sm: 0 },
                          display: "flex",
                          flexDirection: "column",
                          width: "100%",
                          minWidth: 0,
                        }}
                      >
                        <Tooltip title={movie.title}>
                          <Typography variant="h6" gutterBottom>
                            {movie.title}
                          </Typography>
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary">
                          Release Year:{" "}
                          {movie.release_date
                            ? new Date(movie.release_date).getFullYear()
                            : "N/A"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          TMDb Rating: {movie.vote_average} (
                          {movie.vote_count} votes)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          IMDb Rating:{" "}
                          {movie.imdbRating !== "N/A"
                            ? movie.imdbRating
                            : "N/A"}
                        </Typography>
                        {genresList && Object.keys(genresList).length > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Genres:{" "}
                            {Array.isArray(movie.genre_ids) &&
                            movie.genre_ids.length > 0
                              ? movie.genre_ids
                                  .map((genreId) => genresList[genreId])
                                  .join(", ")
                              : Array.isArray(movie.genres) &&
                                movie.genres.length > 0
                              ? movie.genres
                                  .map((genre) => genre.name)
                                  .join(", ")
                              : "N/A"}
                          </Typography>
                        )}
                        {movie.streamingProviders.length > 0 && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              mt: 1,
                            }}
                          >
                            Streaming on: {movie.streamingProviders.join(", ")}
                          </Typography>
                        )}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          {watchedMovies.includes(String(movie.id))
                            ? "Watched"
                            : "Not Watched"}
                        </Typography>
                        <Box
                          sx={{
                            mt: 1,
                            width: "100%",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                          }}
                        >
                          <Accordion
                            sx={{
                              width: "100%",
                              boxSizing: "border-box",
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon />}
                              aria-controls="additional-info-content"
                              id="additional-info-header"
                            >
                              <Typography variant="body2">More Info</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {movie.overview || "No overview available."}
                              </Typography>
                            </AccordionDetails>
                          </Accordion>
                          {!watchedMovies.includes(String(movie.id)) && (
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={() => handleMarkAsWatched(movie.id)}
                              fullWidth
                              sx={{ mt: 2 }}
                            >
                              Mark as Watched
                            </Button>
                          )}
                          {watchedMovies.includes(String(movie.id)) && (
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                mt: 2,
                              }}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                mb={1}
                              >
                                Your Rating:
                              </Typography>
                              <Rating
                                name={`rating-${movie.id}`}
                                value={
                                  watchedMovies.includes(String(movie.id))
                                    ? currentRating
                                    : 0
                                }
                                onChange={(event, newValue) => {
                                  handleRatingChange(movie.id, newValue);
                                }}
                              />
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  )
                )
              
              ) : (
                <Grid item xs={12}>
                  <Typography variant="h6" align="center">
                    No movies found with the selected filters.
                  </Typography>
                </Grid>
              )}
              
            </Grid>
          )}
        </Grid>

        {/* Rating Dialog */}
        <Dialog
          open={ratingDialogOpen}
          onClose={() => setRatingDialogOpen(false)}
        >
          <DialogTitle>Rate the Movie</DialogTitle>
          <DialogContent>
            <Rating
              name="movie-rating"
              value={currentRating}
              onChange={(event, newValue) => {
                setCurrentRating(newValue);
              }}
              size="large"
              sx={{ display: "flex", justifyContent: "center", mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRatingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRatingSubmit} variant="contained">
              Submit
            </Button>
          </DialogActions>
        </Dialog>
      </Grid>
    </ThemeProvider>
  );
}

export default MovieList;