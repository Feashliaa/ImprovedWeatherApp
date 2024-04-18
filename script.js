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

                        // Get the updated latitude and longitude from the click event
                        const clickLatitude = e.position[0];
                        const clickLongitude = e.position[1];

                        // Call reverseGeocode with the updated coordinates
                        reverseGeocode(clickLongitude, clickLatitude);
                    });


                    map.layers.add(new atlas.layer.SymbolLayer(dataSource, null));


                });
            })
            .catch(error => {
                console.error('Error fetching map options:', error);
            });
    }

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
    // show the "weatherContainer" div
    document.getElementById('weatherContainer').style.display = 'block';

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

    document.getElementById('WeatherIcon').innerHTML = `<img src="${weatherIcon}">`;

    /*
    // Construct the URL with weather data as parameters
    let url = `weather.html?temperature=${localStorage.getItem('temperature')}
    &weatherType=${localStorage.getItem('weatherType')}
    &windSpeed=${localStorage.getItem('windSpeed')}
    &windDirection=${localStorage.getItem('windDirection')}
    &humidity=${localStorage.getItem('humidity')}
    &windChill=${localStorage.getItem('windChill')}`;

    // Redirect to the weather page with parameters
    window.location.href = url;
    */
}