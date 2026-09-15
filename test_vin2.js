async function test() {
    const vin = '1G1RC6E49BU100000';
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    const data = await response.json();
    const getValue = (id) => {
        const item = data.Results.find(r => r.VariableId === id);
        return item && item.Value ? item.Value : "Unknown";
    };
    
    console.log("Make:", getValue(26));
    console.log("Model:", getValue(28));
    console.log("Year:", getValue(29));
}
test();
