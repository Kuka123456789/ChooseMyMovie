// src/tmdb.js
import axios from "axios";

const API_KEY = "a2bd79960e115a0a694bfb6e3e66b9a7";
const BASE_URL = "https://api.themoviedb.org/3";

const tmdb = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
  },
});

export default tmdb;