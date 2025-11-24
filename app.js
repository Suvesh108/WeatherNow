// ===== CONFIGURATION =====
const CONFIG = {
    // Using Open-Meteo API (Free, no API key required)
    weatherAPI: 'https://api.open-meteo.com/v1/forecast',
    geocodingAPI: 'https://geocoding-api.open-meteo.com/v1/search',
    defaultCity: 'London',
    defaultCoords: { lat: 51.5074, lon: -0.1278 }
};

// ===== STATE MANAGEMENT =====
let currentUnit = 'celsius';
let currentWeatherData = null;
let weatherAnimationInterval = null;

// ===== DOM ELEMENTS =====
const elements = {
    // Search
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    locationBtn: document.getElementById('location-btn'),
    searchError: document.getElementById('search-error'),
    
    // Loading
    loading: document.getElementById('loading'),
    mainWeather: document.getElementById('main-weather'),
    
    // Current Weather
    cityName: document.getElementById('city-name'),
    currentDate: document.getElementById('current-date'),
    weatherIcon: document.getElementById('weather-icon'),
    temperature: document.getElementById('temperature'),
    weatherDescription: document.getElementById('weather-description'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    pressure: document.getElementById('pressure'),
    visibility: document.getElementById('visibility'),
    sunrise: document.getElementById('sunrise'),
    sunset: document.getElementById('sunset'),
    
    // Forecast
    forecastContainer: document.getElementById('forecast-container'),
    
    // Unit Toggle
    unitToggleBtn: document.getElementById('unit-toggle-btn'),
    
    // Background
    backgroundContainer: document.getElementById('background-container'),
    weatherAnimation: document.getElementById('weather-animation'),
    
    // Modal
    apiModal: document.getElementById('api-modal')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Hide API modal since we're using Open-Meteo (no key needed)
    if (elements.apiModal) {
        elements.apiModal.classList.add('hidden');
    }
    
    // Set initial theme based on time
    updateThemeBasedOnTime();
    
    // Load default location
    loadWeatherByCoords(CONFIG.defaultCoords.lat, CONFIG.defaultCoords.lon, CONFIG.defaultCity);
}

function setupEventListeners() {
    // Search functionality
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Location button
    elements.locationBtn.addEventListener('click', getUserLocation);
    
    // Unit toggle
    elements.unitToggleBtn.addEventListener('click', toggleTemperatureUnit);
}

// ===== WEATHER DATA FETCHING =====
async function handleSearch() {
    const city = elements.searchInput.value.trim();
    
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    
    showLoading();
    clearError();
    
    try {
        const coords = await getCityCoordinates(city);
        if (coords) {
            await loadWeatherByCoords(coords.lat, coords.lon, coords.name);
        } else {
            showError('City not found. Please try again.');
            hideLoading();
        }
    } catch (error) {
        console.error('Search error:', error);
        showError('Failed to fetch weather data. Please try again.');
        hideLoading();
    }
}

async function getCityCoordinates(cityName) {
    try {
        const response = await fetch(
            `${CONFIG.geocodingAPI}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
        );
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                lat: result.latitude,
                lon: result.longitude,
                name: result.name,
                country: result.country
            };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

async function loadWeatherByCoords(lat, lon, cityName = '') {
    showLoading();
    
    try {
        const url = `${CONFIG.weatherAPI}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weathercode,surface_pressure,windspeed_10m,visibility&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=6`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.current) {
            currentWeatherData = {
                ...data,
                cityName: cityName || 'Current Location',
                lat,
                lon
            };
            
            displayWeatherData(currentWeatherData);
            updateWeatherAnimation(data.current.weathercode);
            updateThemeBasedOnSunTimes(data.daily.sunrise[0], data.daily.sunset[0]);
            hideLoading();
        } else {
            throw new Error('Invalid weather data');
        }
    } catch (error) {
        console.error('Weather fetch error:', error);
        showError('Failed to load weather data. Please try again.');
        hideLoading();
    }
}

function getUserLocation() {
    if (navigator.geolocation) {
        showLoading();
        clearError();
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await loadWeatherByCoords(latitude, longitude, 'Your Location');
            },
            (error) => {
                console.error('Geolocation error:', error);
                showError('Unable to get your location. Please search manually.');
                hideLoading();
            }
        );
    } else {
        showError('Geolocation is not supported by your browser.');
    }
}

// ===== DISPLAY WEATHER DATA =====
function displayWeatherData(data) {
    const { current, daily, cityName } = data;
    
    // Location and date
    elements.cityName.querySelector('span').textContent = cityName;
    elements.currentDate.textContent = formatDate(new Date());
    
    // Weather icon and description
    const weatherInfo = getWeatherInfo(current.weathercode);
    elements.weatherIcon.className = `weather-icon ${weatherInfo.icon}`;
    elements.weatherDescription.textContent = weatherInfo.description;
    
    // Temperature
    const temp = currentUnit === 'celsius' ? current.temperature_2m : celsiusToFahrenheit(current.temperature_2m);
    elements.temperature.textContent = `${Math.round(temp)}°`;
    
    // Weather details
    elements.humidity.textContent = `${current.relative_humidity_2m}%`;
    elements.windSpeed.textContent = `${Math.round(current.windspeed_10m)} km/h`;
    elements.pressure.textContent = `${current.surface_pressure} hPa`;
    elements.visibility.textContent = `${(current.visibility / 1000).toFixed(1)} km`;
    
    // Sun times
    elements.sunrise.textContent = formatTime(daily.sunrise[0]);
    elements.sunset.textContent = formatTime(daily.sunset[0]);
    
    // Display forecast
    displayForecast(daily);
}

function displayForecast(daily) {
    elements.forecastContainer.innerHTML = '';
    
    // Skip today (index 0), show next 5 days
    for (let i = 1; i <= 5; i++) {
        const forecastCard = createForecastCard(daily, i);
        elements.forecastContainer.appendChild(forecastCard);
    }
}

function createForecastCard(daily, index) {
    const card = document.createElement('div');
    card.className = 'forecast-card';
    
    const date = new Date(daily.time[index]);
    const weatherInfo = getWeatherInfo(daily.weathercode[index]);
    const tempMax = currentUnit === 'celsius' ? daily.temperature_2m_max[index] : celsiusToFahrenheit(daily.temperature_2m_max[index]);
    const tempMin = currentUnit === 'celsius' ? daily.temperature_2m_min[index] : celsiusToFahrenheit(daily.temperature_2m_min[index]);
    
    card.innerHTML = `
        <p class="forecast-date">${formatDayName(date)}</p>
        <i class="${weatherInfo.icon} forecast-icon"></i>
        <p class="forecast-temp">${Math.round(tempMax)}° / ${Math.round(tempMin)}°</p>
        <p class="forecast-description">${weatherInfo.description}</p>
    `;
    
    return card;
}

// ===== WEATHER ANIMATIONS =====
function updateWeatherAnimation(weatherCode) {
    // Clear existing animations
    elements.weatherAnimation.innerHTML = '';
    clearInterval(weatherAnimationInterval);
    
    const weatherType = getWeatherType(weatherCode);
    
    switch (weatherType) {
        case 'clear':
            createSunAnimation();
            break;
        case 'cloudy':
            createCloudAnimation();
            break;
        case 'rain':
            createRainAnimation();
            break;
        case 'snow':
            createSnowAnimation();
            break;
        case 'thunder':
            createThunderAnimation();
            break;
        case 'fog':
            createFogAnimation();
            break;
    }
}

function createSunAnimation() {
    const sunRays = document.createElement('div');
    sunRays.className = 'sun-rays';
    elements.weatherAnimation.appendChild(sunRays);
}

function createCloudAnimation() {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            
            const size = Math.random() * 80 + 60;
            const top = Math.random() * 40;
            const duration = Math.random() * 20 + 30;
            
            cloud.style.width = `${size}px`;
            cloud.style.height = `${size * 0.6}px`;
            cloud.style.top = `${top}%`;
            cloud.style.animationDuration = `${duration}s`;
            cloud.style.opacity = Math.random() * 0.3 + 0.2;
            
            // Cloud sub-parts
            cloud.style.setProperty('--before-width', `${size * 0.5}px`);
            cloud.style.setProperty('--before-height', `${size * 0.5}px`);
            cloud.style.setProperty('--after-width', `${size * 0.7}px`);
            cloud.style.setProperty('--after-height', `${size * 0.7}px`);
            
            elements.weatherAnimation.appendChild(cloud);
        }, i * 200);
    }
}

function createRainAnimation() {
    createCloudAnimation(); // Add clouds first
    
    const createRainDrop = () => {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.animationDuration = `${Math.random() * 0.5 + 0.5}s`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        
        elements.weatherAnimation.appendChild(drop);
        
        setTimeout(() => drop.remove(), 3000);
    };
    
    // Create initial rain drops
    for (let i = 0; i < 50; i++) {
        createRainDrop();
    }
    
    // Continuously create rain drops
    weatherAnimationInterval = setInterval(() => {
        for (let i = 0; i < 5; i++) {
            createRainDrop();
        }
    }, 300);
}

function createSnowAnimation() {
    const createSnowFlake = () => {
        const flake = document.createElement('div');
        flake.className = 'snow-flake';
        
        const size = Math.random() * 8 + 4;
        flake.style.width = `${size}px`;
        flake.style.height = `${size}px`;
        flake.style.left = `${Math.random() * 100}%`;
        flake.style.animationDuration = `${Math.random() * 5 + 5}s`;
        flake.style.animationDelay = `${Math.random() * 5}s`;
        
        elements.weatherAnimation.appendChild(flake);
        
        setTimeout(() => flake.remove(), 15000);
    };
    
    // Create initial snowflakes
    for (let i = 0; i < 30; i++) {
        createSnowFlake();
    }
    
    // Continuously create snowflakes
    weatherAnimationInterval = setInterval(() => {
        for (let i = 0; i < 3; i++) {
            createSnowFlake();
        }
    }, 500);
}

function createThunderAnimation() {
    createRainAnimation(); // Thunder comes with rain
    
    const createLightning = () => {
        const lightning = document.createElement('div');
        lightning.className = 'lightning';
        lightning.style.left = `${Math.random() * 100}%`;
        
        elements.weatherAnimation.appendChild(lightning);
        
        // Flash the background
        elements.backgroundContainer.style.filter = 'brightness(1.5)';
        
        setTimeout(() => {
            elements.backgroundContainer.style.filter = 'brightness(1)';
            lightning.remove();
        }, 200);
    };
    
    // Random lightning strikes
    const strikeInterval = setInterval(() => {
        if (Math.random() > 0.7) {
            createLightning();
        }
    }, 2000);
    
    // Clear on animation change
    setTimeout(() => clearInterval(strikeInterval), 60000);
}

function createFogAnimation() {
    for (let i = 0; i < 3; i++) {
        const fog = document.createElement('div');
        fog.className = 'cloud';
        fog.style.width = '150%';
        fog.style.height = '200px';
        fog.style.top = `${i * 30}%`;
        fog.style.opacity = '0.15';
        fog.style.filter = 'blur(30px)';
        fog.style.animationDuration = `${40 + i * 10}s`;
        
        elements.weatherAnimation.appendChild(fog);
    }
}

function createStarsAnimation() {
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 3}s`;
        
        elements.weatherAnimation.appendChild(star);
    }
}

// ===== THEME MANAGEMENT =====
function updateThemeBasedOnTime() {
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 18;
    
    document.body.className = isDay ? 'day-theme' : 'night-theme';
    
    if (!isDay) {
        createStarsAnimation();
    }
}

function updateThemeBasedOnSunTimes(sunrise, sunset) {
    const now = new Date();
    const sunriseTime = new Date(sunrise);
    const sunsetTime = new Date(sunset);
    
    const isDay = now >= sunriseTime && now < sunsetTime;
    
    document.body.className = isDay ? 'day-theme' : 'night-theme';
    
    if (!isDay && elements.weatherAnimation.children.length === 0) {
        createStarsAnimation();
    }
}

// ===== TEMPERATURE UNIT TOGGLE =====
function toggleTemperatureUnit(e) {
    const target = e.target.closest('.unit');
    if (!target) return;
    
    const newUnit = target.dataset.unit;
    if (newUnit === currentUnit) return;
    
    currentUnit = newUnit;
    
    // Update active state
    document.querySelectorAll('.unit').forEach(unit => {
        unit.classList.toggle('active', unit.dataset.unit === currentUnit);
    });
    
    // Refresh display if we have data
    if (currentWeatherData) {
        displayWeatherData(currentWeatherData);
    }
}

function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

// ===== WEATHER CODE MAPPING =====
function getWeatherInfo(code) {
    const weatherCodes = {
        0: { description: 'Clear sky', icon: 'fas fa-sun', type: 'clear' },
        1: { description: 'Mainly clear', icon: 'fas fa-sun', type: 'clear' },
        2: { description: 'Partly cloudy', icon: 'fas fa-cloud-sun', type: 'cloudy' },
        3: { description: 'Overcast', icon: 'fas fa-cloud', type: 'cloudy' },
        45: { description: 'Foggy', icon: 'fas fa-smog', type: 'fog' },
        48: { description: 'Rime fog', icon: 'fas fa-smog', type: 'fog' },
        51: { description: 'Light drizzle', icon: 'fas fa-cloud-rain', type: 'rain' },
        53: { description: 'Moderate drizzle', icon: 'fas fa-cloud-rain', type: 'rain' },
        55: { description: 'Dense drizzle', icon: 'fas fa-cloud-showers-heavy', type: 'rain' },
        61: { description: 'Slight rain', icon: 'fas fa-cloud-rain', type: 'rain' },
        63: { description: 'Moderate rain', icon: 'fas fa-cloud-showers-heavy', type: 'rain' },
        65: { description: 'Heavy rain', icon: 'fas fa-cloud-showers-heavy', type: 'rain' },
        71: { description: 'Slight snow', icon: 'fas fa-snowflake', type: 'snow' },
        73: { description: 'Moderate snow', icon: 'fas fa-snowflake', type: 'snow' },
        75: { description: 'Heavy snow', icon: 'fas fa-snowflake', type: 'snow' },
        77: { description: 'Snow grains', icon: 'fas fa-snowflake', type: 'snow' },
        80: { description: 'Slight showers', icon: 'fas fa-cloud-rain', type: 'rain' },
        81: { description: 'Moderate showers', icon: 'fas fa-cloud-showers-heavy', type: 'rain' },
        82: { description: 'Violent showers', icon: 'fas fa-cloud-showers-heavy', type: 'rain' },
        85: { description: 'Slight snow showers', icon: 'fas fa-snowflake', type: 'snow' },
        86: { description: 'Heavy snow showers', icon: 'fas fa-snowflake', type: 'snow' },
        95: { description: 'Thunderstorm', icon: 'fas fa-bolt', type: 'thunder' },
        96: { description: 'Thunderstorm with hail', icon: 'fas fa-bolt', type: 'thunder' },
        99: { description: 'Thunderstorm with heavy hail', icon: 'fas fa-bolt', type: 'thunder' }
    };
    
    return weatherCodes[code] || { description: 'Unknown', icon: 'fas fa-question', type: 'clear' };
}

function getWeatherType(code) {
    const info = getWeatherInfo(code);
    return info.type;
}

// ===== UTILITY FUNCTIONS =====
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatDayName(date) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function showLoading() {
    elements.loading.classList.remove('hidden');
    elements.mainWeather.classList.add('hidden');
}

function hideLoading() {
    elements.loading.classList.add('hidden');
    elements.mainWeather.classList.remove('hidden');
}

function showError(message) {
    elements.searchError.textContent = message;
    setTimeout(() => clearError(), 5000);
}

function clearError() {
    elements.searchError.textContent = '';
}
