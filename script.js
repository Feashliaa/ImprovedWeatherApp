var map; // Declare map globally
var point; // Declare point globally

function InitMap() {
    let longitude;
    let latitude;


    // Check if the browser supports Geolocation
    if ("geolocation" in navigator) {
        // Get the user's current position
        navigator.geolocation.getCurrentPosition(
            function (position) {
                // Access the latitude and longitude from the position object
                longitude = position.coords.longitude;
                latitude = position.coords.latitude;
                // Initialize the map with the user's location
                initializeMap(latitude, longitude);
            },
            function (error) {
                // Handle any errors that occur during geolocation
                console.error("Error getting geolocation:", error);
                // Fallback coordinates if geolocation fails
                // [-76.10, 42.14]
                longitude = -76.10;
                latitude = 42.14;
                initializeMap(latitude, longitude);
            }
        );
    } else {
        // Geolocation is not supported by this browser
        console.log("Geolocation is not supported by this browser.");
        // Fallback coordinates if geolocation is not supported
        longitude = -76.0652;
        latitude = 42.1110;
        initializeMap(latitude, longitude);
    }

    function initializeMap(latitude, longitude) {
        // Make a request to the server to get the map options including the subscription key
        fetch(`/api/mapOptions?latitude=${latitude}&longitude=${longitude}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(mapOptions => {
                map = new atlas.Map('myMap', mapOptions);

                map.events.add('ready', function () {
                    var dataSource = new atlas.source.DataSource();
                    map.sources.add(dataSource);
                    point = new atlas.Shape(new atlas.data.Point([longitude, latitude]));
                    dataSource.add([point]);

                    map.events.add('click', function (e) {
                        point.setCoordinates(e.position);
                    });

                    map.layers.add(new atlas.layer.SymbolLayer(dataSource, null));
                });
            })
            .catch(error => {
                console.error('Error fetching map options:', error);
            });
    }
}

// Call the SendDataToBackend method
function grabCoords() {
    console.log('Grabbing coordinates...');
    if (point) {
        var coords = point.getCoordinates();
        console.log(coords);

        // send coordinates to weather.gov API
        SendDataToApi(coords[1], coords[0]);
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
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        let data = await response.json();
        console.log("Data" + data);

        // Extract the forecastHourlyUrl from the JSON response
        let forecastHourlyUrl = data.properties.forecastHourly;

        let hourlyForecastResponse = await fetch(forecastHourlyUrl);

        if (!hourlyForecastResponse.ok) {
            throw new Error(`HTTP error! Status: ${hourlyForecastResponse.status}`);
        }

        let hourlyForecastContent = await hourlyForecastResponse.json();
        console.log("Hourly Forecast Content" + hourlyForecastContent);

        // Extract temperature and weatherType from hourly forecast and store in local storage
        let temperature = hourlyForecastContent.properties.periods[0].temperature;
        let weatherType = hourlyForecastContent.properties.periods[0].shortForecast;
        let windSpeed = hourlyForecastContent.properties.periods[0].windSpeed;
        let windDirection = hourlyForecastContent.properties.periods[0].windDirection;
        let humidity = hourlyForecastContent.properties.periods[0].relativeHumidity.value;

        let windChill = calculateWindChill(temperature, windSpeed);
        console.log("Wind Chill: " + windChill);

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
        console.error('Error:', error);
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
    let iconPath = '';
    switch (true) {
        case weatherType.includes('Sunny'):
            iconPath = 'weather-icons/clear.png';
            break;
        case weatherType.includes('Thunderstorm'):
            iconPath = 'weather-icons/thunderstorms.png';
            break;
        case weatherType.includes('Rain'):
            iconPath = 'weather-icons/rain.png';
            break;
        case weatherType.includes('Snow'):
            iconPath = 'weather-icons/snow.png';
            break;
        case weatherType.includes('Cloudy'):
            iconPath = 'weather-icons/cloudy.png';
            break;
        case weatherType.includes('Fog'):
            iconPath = 'weather-icons/fog.png';
            break;
        case weatherType.includes('Partly Cloudy'):
            iconPath = 'weather-icons/partly-cloudy.png';
            break;
        case weatherType.includes('Haze'):
            iconPath = 'weather-icons/haze.png';
            break;
        case weatherType.includes('Windy'):
            iconPath = 'weather-icons/windy.png';
            break;
        default:
            iconPath = 'weather-icons/clear.png';
            break;
    }

    return iconPath;
}


function redirectToWeatherPage() {
    // Construct the URL with weather data as parameters
    let url = `weather.html?temperature=${localStorage.getItem('temperature')}
    &weatherType=${localStorage.getItem('weatherType')}
    &windSpeed=${localStorage.getItem('windSpeed')}
    &windDirection=${localStorage.getItem('windDirection')}
    &humidity=${localStorage.getItem('humidity')}
    &windChill=${localStorage.getItem('windChill')}`;

    // Redirect to the weather page with parameters
    window.location.href = url;
}