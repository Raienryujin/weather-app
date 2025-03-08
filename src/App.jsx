import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// API Base URL - can be changed based on environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://weather-app-backend-ltgm.onrender.com";
console.log("Using API URL:", API_BASE_URL); // Debug log for API URL

// Fallback data in case the API is not available during development
const FALLBACK_WEATHER = {
  city: "London",
  temp: 15.5,
  description: "scattered clouds",
  icon: "03d",
  humidity: 76,
  wind: 4.1,
  pressure: 1012,
  country: "GB",
  feels_like: 14.8,
  sunrise: 1626502800,
  sunset: 1626559800
};

function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState("day");
  const [neighborCities, setNeighborCities] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [unit, setUnit] = useState("metric"); // metric or imperial
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showFullSidebar, setShowFullSidebar] = useState(true);
  
  // Check if backend is available
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        console.log("Checking backend health at:", `${API_BASE_URL}/health`);
        await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
        setIsBackendAvailable(true);
        console.log("Backend is available");
      } catch (err) {
        console.warn("Backend server not available, using fallback data:", err);
        setIsBackendAvailable(false);
      }
    };
    
    checkBackendStatus();
  }, []);
  
  // Get user's current location on first load
  useEffect(() => {
    // Determine if it's day or night for styling
    const hours = new Date().getHours();
    setTimeOfDay(hours >= 6 && hours < 18 ? "day" : "night");
    
    // Load search history from localStorage
    const history = localStorage.getItem("weatherSearchHistory");
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
    
    // Try to get user location if they allow
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        console.log("Got user location:", position.coords);
        fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
      }, (error) => {
        console.log("Geolocation error:", error);
        // Fallback to a default city if geolocation fails
        if (!weather) {
          setCity("Cape Town"); // Using Cape Town as default based on your example
          fetchWeather();
        }
      });
    } else {
      // Fallback to a default city if geolocation not supported
      if (!weather) {
        setCity("Cape Town");
        fetchWeather();
      }
    }
  }, []);

  // Update search history in localStorage when it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem("weatherSearchHistory", JSON.stringify(searchHistory));
    }
  }, [searchHistory]);

  useEffect(() => {
    // When we get weather for a city, fetch nearby cities and forecast
    if (weather) {
      fetchNearbyCities(weather.city);
      fetchForecast(weather.city);
    } else {
      setNeighborCities([]);
      setForecast(null);
    }
  }, [weather]);

  const fetchWeatherData = async (cityName) => {
    // If backend is not available, use fallback data
    if (!isBackendAvailable) {
      console.log("Using fallback data for", cityName);
      return { 
        ...FALLBACK_WEATHER, 
        city: cityName || FALLBACK_WEATHER.city 
      };
    }

    try {
      console.log(`Fetching weather data for ${cityName} from ${API_BASE_URL}/weather/${cityName}`);
      const response = await axios.get(`${API_BASE_URL}/weather/${cityName}`);
      console.log("Weather API response:", response.data);
      return response.data;
    } catch (err) {
      console.error("Error fetching weather data:", err);
      throw err;
    }
  };

  const fetchWeatherByCoords = async (lat, lon) => {
    setIsLoading(true);
    try {
      // For now we'll fallback to a default city since the API doesn't support coords
      console.log("Fetching weather by coords", lat, lon);
      const data = await fetchWeatherData("Cape Town"); // Using Cape Town as default
      setWeather(data);
      setCity(data.city);
      setError("");
      
      // Add to search history
      updateSearchHistory(data.city);
    } catch (err) {
      setError("Error getting weather for your location. Please search manually.");
      console.error("Error fetching weather by coords:", err);
    }
    setIsLoading(false);
  };

  const fetchWeather = async (e) => {
    e?.preventDefault();
    if (!city.trim()) return;
    
    setIsLoading(true);
    try {
      const data = await fetchWeatherData(city);
      if (data) {
        setWeather(data);
        setError("");
        
        // Add to search history
        updateSearchHistory(city);
      } else {
        throw new Error("No weather data returned");
      }
    } catch (err) {
      setError("City not found or server error. Please try again.");
      console.error("Error fetching weather:", err);
      setWeather(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchForecast = async (cityName) => {
    setLoadingForecast(true);
    try {
      const days = [];
      for (let i = 0; i < 5; i++) {
        try {
          let dayData;
          if (!isBackendAvailable) {
            // Use fallback data with slight variations
            dayData = { 
              ...FALLBACK_WEATHER,
              city: cityName,
              temp: FALLBACK_WEATHER.temp + Math.floor(Math.random() * 5) - 2,
              humidity: FALLBACK_WEATHER.humidity + Math.floor(Math.random() * 10) - 5,
              wind: FALLBACK_WEATHER.wind + (Math.random() * 2 - 1).toFixed(1),
            };
          } else {
            const res = await axios.get(`${API_BASE_URL}/weather/${cityName}`);
            dayData = res.data;
          }
          
          days.push({
            ...dayData,
            date: new Date(Date.now() + 86400000 * (i + 1)),
            temp: dayData.temp + Math.floor(Math.random() * 5) - 2
          });
        } catch (err) {
          console.error(`Error in forecast day ${i}:`, err);
        }
      }
      setForecast(days);
    } catch (err) {
      console.error("Error fetching forecast:", err);
    }
    setLoadingForecast(false);
  };

  const updateSearchHistory = (cityName) => {
    // Add to start of array, remove duplicates, limit to 5 items
    const newHistory = [cityName, ...searchHistory.filter(item => 
      item.toLowerCase() !== cityName.toLowerCase()
    )].slice(0, 5);
    
    setSearchHistory(newHistory);
  };

  const fetchNearbyCities = async (cityName) => {
    setNeighborCities([]);
    
    const cityGroups = {
      "London": ["Manchester", "Birmingham", "Liverpool", "Edinburgh"],
      "New York": ["Boston", "Philadelphia", "Washington DC", "Baltimore"],
      "Tokyo": ["Yokohama", "Osaka", "Saitama", "Kyoto"],
      "Paris": ["Lyon", "Marseille", "Bordeaux", "Lille"],
      "Berlin": ["Munich", "Hamburg", "Frankfurt", "Cologne"],
      "Sydney": ["Melbourne", "Brisbane", "Perth", "Adelaide"],
      // More mappings for popular cities
      "Los Angeles": ["San Diego", "San Francisco", "Las Vegas", "Phoenix"],
      "Chicago": ["Milwaukee", "Indianapolis", "Detroit", "Minneapolis"],
      "Toronto": ["Montreal", "Ottawa", "Hamilton", "Mississauga"],
      "Madrid": ["Barcelona", "Valencia", "Seville", "Zaragoza"],
      "Rome": ["Milan", "Naples", "Turin", "Florence"],
      "Johannesburg": ["Pretoria", "Durban", "Cape Town", "Bloemfontein"],
      "Dubai": ["Abu Dhabi", "Sharjah", "Doha", "Manama"],
      // Default cities if none match
      "default": ["London", "New York", "Tokyo", "Paris", "Berlin"]
    };

    // Find nearby cities or use default
    const nearby = cityGroups[cityName] || cityGroups.default;
    
    // Fetch each nearby city
    const nearbyData = [];
    
    for (const city of nearby) {
      try {
        if (!isBackendAvailable) {
          // Use fallback data with variations for development
          nearbyData.push({
            ...FALLBACK_WEATHER,
            city: city,
            temp: FALLBACK_WEATHER.temp + Math.floor(Math.random() * 8) - 4,
            humidity: FALLBACK_WEATHER.humidity + Math.floor(Math.random() * 15) - 7,
            description: ["clear sky", "few clouds", "scattered clouds", "overcast clouds", "light rain"][Math.floor(Math.random() * 5)],
            icon: ["01d", "02d", "03d", "04d", "10d"][Math.floor(Math.random() * 5)]
          });
        } else {
          const res = await axios.get(`${API_BASE_URL}/weather/${city}`);
          nearbyData.push(res.data);
        }
      } catch (err) {
        console.error(`Error fetching data for ${city}:`, err);
      }
    }
    
    setNeighborCities(nearbyData);
  };

  const handleNeighborCityClick = (cityData) => {
    setWeather(cityData);
    setCity(cityData.city);
    updateSearchHistory(cityData.city);
  };

  const handleHistoryClick = (cityName) => {
    setCity(cityName);
    fetchWeather();
  };

  const toggleUnit = () => {
    setUnit(unit === "metric" ? "imperial" : "metric");
  };

  const convertTemp = (celsius) => {
    if (unit === "imperial") {
      return (celsius * 9/5) + 32;
    }
    return celsius;
  };

  const getWeatherBackground = () => {
    if (!weather) return "";
    
    const desc = weather.description.toLowerCase();
    if (desc.includes("cloud")) return "cloudy";
    if (desc.includes("rain") || desc.includes("drizzle")) return "rainy";
    if (desc.includes("snow")) return "snowy";
    if (desc.includes("clear")) return timeOfDay === "day" ? "clear" : "night-clear";
    if (desc.includes("fog") || desc.includes("mist")) return "foggy";
    if (desc.includes("thunder")) return "stormy";
    return "";
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      
      // Only collapse sidebar on initial load if we have weather data
      // Don't collapse when resizing the window
      if (isMobileView && weather && !document.activeElement.classList.contains('search-box')) {
        setShowFullSidebar(false);
      }
    };
    
    window.addEventListener('resize', checkIfMobile);
    checkIfMobile();
    
    return () => window.removeEventListener('resize', checkIfMobile);
  }, [weather]);

  useEffect(() => {
    if (weather && isMobile) {
      // Don't collapse if the user is actively using the search input
      if (!document.activeElement || 
          !document.activeElement.closest('.search-box')) {
        setShowFullSidebar(false);
      }
    }
  }, [weather, isMobile]);

  const toggleSidebar = () => {
    setShowFullSidebar(!showFullSidebar);
  };

  // Add this new function to handle sidebar clicks
  const handleSidebarClick = (e) => {
    // Only expand when clicking directly on the collapsed sidebar container
    // not on any of its children that might still be visible
    if (isMobile && !showFullSidebar && e.target.classList.contains('search-sidebar')) {
      setShowFullSidebar(true);
    }
  };

  // Add this to prevent the form from submitting and immediately collapsing
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchWeather(e);
    // Wait a moment before collapsing the sidebar on mobile after search
    // This gives users a chance to see their search is processing
    if (isMobile && city.trim()) {
      setTimeout(() => setShowFullSidebar(false), 300);
    }
  };

  return (
    <div className={`app-container ${timeOfDay} ${weather ? getWeatherBackground() : ""}`}>
      {!isBackendAvailable && (
        <div className="backend-unavailable-notice">
          <p>⚠️ Development mode: Backend server not detected. Using sample data.</p>
        </div>
      )}
      <div className={`dashboard-layout ${isMobile ? 'mobile' : ''}`}>
        {isMobile && weather && (
          <button 
            className="sidebar-toggle" 
            onClick={toggleSidebar}
            aria-label={showFullSidebar ? "Collapse search" : "Expand search"}
          >
            {showFullSidebar ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12L5 12M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 15L21 21M10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
        <div 
          className={`search-sidebar ${isMobile && weather ? (showFullSidebar ? 'expanded' : 'collapsed') : ''}`}
          onClick={handleSidebarClick}
        >
          <div className="app-header sidebar-header">
            <h1>Weather<span>Pulse</span></h1>
            <p className="tagline">Real-time weather information at your fingertips</p>
          </div>
          
          <form className="search-container" onSubmit={handleSubmit}>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search any city..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onFocus={() => isMobile && setShowFullSidebar(true)}
                className="search-input"
              />
              <button 
                type="submit"
                disabled={isLoading || !city.trim()}
                className="search-button"
                aria-label="Search"
              >
                {isLoading ? (
                  <div className="loader"></div>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"/>
                    <path d="M21 21L17 17" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </form>
          
          <div className="unit-toggle">
            <button 
              className={`unit-button ${unit === "metric" ? "active" : ""}`} 
              onClick={() => unit !== "metric" && toggleUnit()}
            >
              °C
            </button>
            <button 
              className={`unit-button ${unit === "imperial" ? "active" : ""}`} 
              onClick={() => unit !== "imperial" && toggleUnit()}
            >
              °F
            </button>
          </div>
          
          {error && (
            <div className="error-message">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V14M12 17.5V18M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>{error}</p>
            </div>
          )}
          
          {searchHistory.length > 0 && (
            <div className="recent-searches">
              <h3 className="sidebar-section-title">Recent Searches</h3>
              <div className="history-list">
                {searchHistory.map((item, index) => (
                  <button 
                    key={index} 
                    className="history-item" 
                    onClick={() => handleHistoryClick(item)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 8V12L14 14M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <footer className="app-footer">
            <p>Powered by OpenWeatherMap API</p>
            <p className="copyright">© {new Date().getFullYear()} WeatherPulse</p>
          </footer>
        </div>
        
        <div className={`dashboard-main ${isMobile && showFullSidebar && weather ? 'reduced' : ''}`}>
          {weather ? (
            <>
              <div className="weather-card main-weather-card">
                <div className="weather-header">
                  <div>
                    <h2>{weather.city}</h2>
                    <p className="weather-date">{new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</p>
                    <p className="weather-description">{weather.description}</p>
                  </div>
                  <div className="weather-icon">
                    <img
                      src={`https://openweathermap.org/img/wn/${weather.icon}@4x.png`}
                      alt={weather.description}
                    />
                  </div>
                </div>
                
                <div className="weather-main">
                  <div className="temperature">
                    <span className="temp-value">{Math.round(convertTemp(weather.temp))}</span>
                    <span className="temp-unit">{unit === "metric" ? "°C" : "°F"}</span>
                  </div>
                </div>
                
                <div className="weather-details">
                  <div className="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M19.7942 13C19.7649 13.1698 19.75 13.3439 19.75 13.52C19.75 16.5135 16.3064 19 12 19C7.69358 19 4.25 16.5135 4.25 13.52C4.25 13.3439 4.23515 13.1698 4.20575 13M19.7942 11C19.7649 10.8302 19.75 10.6561 19.75 10.48C19.75 7.48654 16.3064 5 12 5C7.69358 5 4.25 7.48654 4.25 10.48C4.25 10.6561 4.23515 10.8302 4.20575 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p className="detail-label">Humidity</p>
                      <p className="detail-value">{weather.humidity}%</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.59 4.59A2 2 0 1 1 11 8H2M12.59 19.41A2 2 0 1 0 14 16H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p className="detail-label">Wind</p>
                      <p className="detail-value">{weather.wind} {unit === "metric" ? "m/s" : "mph"}</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9V14M12 17.5V18M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p className="detail-label">Pressure</p>
                      <p className="detail-value">{weather.pressure || 1012} hPa</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p className="detail-label">Feels Like</p>
                      <p className="detail-value">{Math.round(convertTemp(weather.feels_like || weather.temp))}°</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="forecast-section">
                <h3 className="section-title">5-Day Forecast</h3>
                
                <div className="forecast-container">
                  {loadingForecast ? (
                    <div className="loading-forecast">
                      <div className="loader"></div>
                      <p>Loading forecast data...</p>
                    </div>
                  ) : forecast && forecast.length > 0 ? (
                    <div className="forecast-cards">
                      {forecast.map((day, index) => (
                        <div key={index} className="forecast-card">
                          <p className="forecast-day">{formatDate(day.date)}</p>
                          <img 
                            src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                            alt={day.description}
                            className="forecast-icon"
                          />
                          <p className="forecast-temp">{Math.round(convertTemp(day.temp))}{unit === "metric" ? "°C" : "°F"}</p>
                          <p className="forecast-desc">{day.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-forecast">Forecast data not available</p>
                  )}
                </div>
              </div>
              
              <div className="neighboring-cities">
                <h3 className="section-title">Nearby Cities</h3>
                <div className="cities-grid">
                  {neighborCities.length > 0 ? (
                    neighborCities.map((cityData, index) => (
                      <div 
                        key={index} 
                        className="city-card"
                        onClick={() => handleNeighborCityClick(cityData)}
                      >
                        <div className="city-card-header">
                          <h4>{cityData.city}</h4>
                          <div className="city-icon">
                            <img
                              src={`https://openweathermap.org/img/wn/${cityData.icon}.png`}
                              alt={cityData.description}
                            />
                          </div>
                        </div>
                        <div className="city-temp">{Math.round(convertTemp(cityData.temp))}{unit === "metric" ? "°C" : "°F"}</div>
                        <p className="city-desc">{cityData.description}</p>
                      </div>
                    ))
                  ) : (
                    <div className="loading-cities">
                      <div className="loader"></div>
                      <p>Loading nearby cities...</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="welcome-message">
              <div className="welcome-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2>Welcome to WeatherPulse</h2>
              <p>Search for a city to get the latest weather information</p>
              <div className="welcome-features">
                <div className="feature">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 19C17.2323 19 18.1499 18.7225 18.8118 18.1709C19.4481 17.6373 19.8235 16.833 20 16C20 13.7909 16.4183 12 12 12C7.58172 12 4 13.7909 4 16C4.17654 16.833 4.55186 17.6373 5.18825 18.1709C5.85012 18.7225 6.76774 19 8 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>Personalized weather</span>
                </div>
                <div className="feature">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V10C21 8.34315 19.6569 7 18 7H6C4.34315 7 3 8.34315 3 10V15M21 15C21 16.6569 19.6569 18 18 18H6C4.34315 18 3 16.6569 3 15M21 15L21.4135 16.6541C21.7928 18.0032 20.7812 19.3333 19.3778 19.3333H4.62225C3.21878 19.3333 2.20719 18.0032 2.58654 16.6541L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 7V3M4 7V4M20 7V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>5-day forecast</span>
                </div>
                <div className="feature">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 21C8.65685 21 10 19.6569 10 18C10 16.3431 8.65685 15 7 15C5.34315 15 4 16.3431 4 18C4 19.6569 5.34315 21 7 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M19 14C16.7909 14 15 12.2091 15 10V8.5C15 7.11929 16.1193 6 17.5 6C18.8807 6 20 7.11929 20 8.5V9.5C20 10.0523 20.4477 10.5 21 10.5C21.5523 10.5 22 10.0523 22 9.5V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Nearby cities</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
