async function test() {
    const vin = '1G1RC6E49BU100000';
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}
test();
