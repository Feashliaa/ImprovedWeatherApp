var map;
var point;
var isSatelliteView = false; // Initially set to false for road view

function toggleSatellite() {
    console.log('Toggling satellite view...');
    // if false, it's set to road, if true, it's set to satellite
    let updatedStyle = isSatelliteView ? 'road' : 'satellite';
    isSatelliteView = !isSatelliteView;
    map.setStyle({ style: updatedStyle });
}

async function initializeMap(latitude, longitude, style) {
    console.log('Initializing map with latitude:', latitude, 'and longitude:', longitude);
    console.log('Style:', style);

    try {
        const response = await fetch(`/api/mapOptions?latitude=${latitude}&longitude=${longitude}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const mapOptions = await response.json();
        console.log('Map Options:', mapOptions);
        map = new atlas.Map('myMap', {
            ...mapOptions,
            style: `atlas://styles/${style}`,
            center: [longitude, latitude],
            zoom: 12
        });

        // Add a point to the map at the user's location
        map.events.add('ready', function () {
            var dataSource = new atlas.source.DataSource();
            map.sources.add(dataSource);
            point = new atlas.Shape(new atlas.data.Point([longitude, latitude]));
            dataSource.add([point]);

            map.events.add('click', function (e) {
                point.setCoordinates(e.position);

                // Get the updated latitude and longitude from the click event
                const clickLatitude = e.position[0];
                const clickLongitude = e.position[1];

                // Call reverseGeocode with the updated coordinates
                reverseGeocode(clickLongitude, clickLatitude);
            });

            map.layers.add(new atlas.layer.SymbolLayer(dataSource, null));

            map.setTraffic({
                flow: 'relative',
                incidents: true,
                legend: true
            });
        });
    } catch (error) {
        console.error('Error fetching map options:', error);
    }
}

function InitMap() {
    let longitude;
    let latitude;

    // Check if the browser supports Geolocation
    if ("geolocation" in navigator) {
        // Get the user's current position
        navigator.geolocation.getCurrentPosition(
            async function (position) {
                // Access the latitude and longitude from the position object
                longitude = position.coords.longitude;
                latitude = position.coords.latitude;
                // Initialize the map with the user's location and default style
                await initializeMap(latitude, longitude, 'road');
            },
            function (error) {
                // Handle any errors that occur during geolocation
                console.error("Error getting geolocation:", error);
                // Fallback coordinates if geolocation fail
                longitude = -76.10;
                latitude = 42.14;
                // Initialize the map with fallback coordinates and default style
                initializeMap(latitude, longitude, 'road');
            }
        );
    } else {
        // Geolocation is not supported by this browser
        console.log("Geolocation is not supported by this browser.");
        // Fallback coordinates if geolocation is not supported
        longitude = -76.0652;
        latitude = 42.1110;
        // Initialize the map with fallback coordinates and default style
        initializeMap(latitude, longitude, 'road');
    }
    // Add event listener to the button after map initialization
    document.getElementById('toggleSatelliteBtn').addEventListener('click', toggleSatellite);
}


function reverseGeocode(latitude, longitude) {

    try {
        // fet subscription key from server.js
        fetch('/api/subscriptionKey')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                let subscriptionKey = data.subscriptionKey;
                const format = 'json'; // or any other format you prefer
                let query = `${latitude},${longitude}`;
                let url = `https://atlas.microsoft.com/search/address/reverse/${format}?api-version=1.0&query=${query}&subscription-key=${subscriptionKey}`;

                return fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Reverse geocoding request failed');
                        }
                        return response.json();
                    })
                    .then(data => {
                        let address = data.addresses[0];
                        let localName = address.address.localName + ', ' + address.address.countrySubdivisionName;
                        // set localName in local storage
                        localStorage.setItem('localName', localName);
                        console.log('Local Name: ', localStorage.getItem('localName'));
                    })
                    .catch(error => {
                        console.error('Error during reverse geocoding:', error);
                        return null;
                    });
            })
            .catch(error => {
                console.error('Error fetching subscription key:', error);
            });
    }
    catch (error) {
        console.error('Error during reverse geocoding:', error);
    }
}

// Call the SendDataToBackend method
function grabCoords() {
    console.log('Grabbing coordinates...');
    if (point) {
        var coords = point.getCoordinates();
        console.log(coords);

        // reverse geocode the coordinates
        reverseGeocode(coords[1], coords[0]);

        // wait for reverse geocoding to complete
        setTimeout(function () {
            SendDataToApi(coords[1], coords[0]);
        }, 2000);
    } else {
        console.error('Point not initialized.');
    }
}

async function SendDataToApi(lat, lon) {
    try {
        let WeatherApiURL = `https://api.weather.gov/points/${lat},${lon}`;

        let response = await fetch(WeatherApiURL, {
            method: 'GET',
            headers: new Headers({
                'User-Agent': 'AzureWeatherApp, rwdorrington@gmail.com'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}. URL: ${WeatherApiURL}`);
        }

        let data = await response.json();
        console.log("Weather API Data:", JSON.stringify(data));

        // Extract the forecastHourlyUrl from the JSON response
        let forecastHourlyUrl = data.properties.forecastHourly;

        let hourlyForecastResponse = await fetch(forecastHourlyUrl);

        if (!hourlyForecastResponse.ok) {
            alert("Error: Unable to fetch weather data. Please try again later.");
            throw new Error(`HTTP error! Status: ${hourlyForecastResponse.status}. URL: ${forecastHourlyUrl}`);
        }

        let hourlyForecastContent = await hourlyForecastResponse.json();
        console.log("Hourly Forecast Content:", JSON.stringify(hourlyForecastContent));

        // Extract temperature and weatherType from hourly forecast and store in local storage
        let temperature = hourlyForecastContent.properties.periods[0].temperature;
        let weatherType = hourlyForecastContent.properties.periods[0].shortForecast;
        let windSpeed = hourlyForecastContent.properties.periods[0].windSpeed;
        let windDirection = hourlyForecastContent.properties.periods[0].windDirection;
        let humidity = hourlyForecastContent.properties.periods[0].relativeHumidity.value;

        let windChill = calculateWindChill(temperature, windSpeed);
        console.log("Wind Chill:", windChill);

        let iconPath = setIcon(weatherType);

        localStorage.setItem('temperature', temperature);
        localStorage.setItem('weatherType', weatherType);
        localStorage.setItem('windSpeed', windSpeed);
        localStorage.setItem('windDirection', windDirection);
        localStorage.setItem('humidity', humidity);
        localStorage.setItem('windChill', windChill);
        localStorage.setItem('iconPath', iconPath);

        // Update UI or perform other actions with the data
        redirectToWeatherPage();
    } catch (error) {
        console.error('Error in SendDataToApi:', error);
        alert("Error: Unable to fetch weather data. Please try again later.");
    }
}

function calculateWindChill(temperature, windSpeed) {

    console.log("Temperature: " + temperature);
    console.log("Wind Speed: " + windSpeed);

    // extract the number from the wind speed string
    windSpeed = parseFloat(windSpeed.match(/\d+/)[0]);

    console.log("Wind Speed: " + windSpeed);

    let windChill = 35.74 + (0.6215 * temperature) -
        (35.75 * Math.pow(windSpeed, 0.16)) +
        (0.4275 * temperature * Math.pow(windSpeed, 0.16));

    windChill = Math.round(windChill);

    return windChill;
}

function setIcon(weatherType) {
    const weatherIcons = {
        'Sunny': 'weather-icons/clear.png',
        'Thunderstorm': 'weather-icons/thunderstorms.png',
        'Rain': 'weather-icons/rain.png',
        'Snow': 'weather-icons/snow.png',
        'Cloudy': 'weather-icons/cloudy.png',
        'Fog': 'weather-icons/fog.png',
        'Partly Cloudy': 'weather-icons/partly-cloudy.png',
        'Haze': 'weather-icons/haze.png',
        'Windy': 'weather-icons/windy.png',
        'default': 'weather-icons/clear.png'
    };

    const iconPath = weatherIcons[Object.keys(weatherIcons).find
        (key => weatherType.includes(key))] || weatherIcons['default'];
    return iconPath;
}



function redirectToWeatherPage() {
    // show the "weatherContainer" div
    document.getElementById('weatherContainer').style.display = 'flex';

    let location = localStorage.getItem('localName');

    // grab data from local storage
    let weatherIcon = localStorage.getItem('iconPath');
    let temperature = localStorage.getItem('temperature');
    let weatherType = localStorage.getItem('weatherType');
    let windSpeed = localStorage.getItem('windSpeed');
    let windDirection = localStorage.getItem('windDirection');
    let humidity = localStorage.getItem('humidity');
    let windChill = localStorage.getItem('windChill');

    // Update weather information on the page
    document.getElementById('Location').textContent = location;
    document.getElementById('Temperature').textContent = temperature + "°";
    document.getElementById('WindChill').textContent = windChill + "°";
    document.getElementById('WeatherType').textContent = weatherType;
    document.getElementById('WindSpeed').textContent = windSpeed;
    document.getElementById('WindDirection').textContent = windDirection;
    document.getElementById('Humidity').textContent = humidity + "%";

    console.log("Weather Icon " + weatherIcon);

    // set the weather icon on the page "background-image: url('iconPath');"
    document.getElementById('WeatherIcon').style.backgroundImage = `url('${weatherIcon}')`;
}