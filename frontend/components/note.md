
Road Length Controls
1. MAIN ROAD (Nearest to disruption)
Location: Around line 340-350
    
    const maxMainDist = 300 * severityMultiplier;

300 = base distance in meters
Change this number to make the main road longer/shorter

2. CONNECTED ROADS (Middle distance)
Location: Around line 320-325

    baseMaxDist = road.impactLevel === 'high' ? 250 : 180;

250 = high impact roads (direct intersections)
180 = medium impact roads
Change these numbers to adjust connected road lengths

3. NEARBY ROADS (Farthest)
Location: Around line 305-310
    
    maxDist = 280 * severityMultiplier;

280 = base distance for nearby roads
Change this number to adjust how far nearby roads extend


the code for length based on delay calculations:

// ✅ Delay-based calculation: 1 minute delay = ~20m spread
const currentDelay = currentHourData?.delay_info?.additional_delay_min ?? simulationResults.summary.avg_delay_minutes ?? 5;
const severityMultiplier = Math.min(Math.max(0.6, 0.6 + (currentDelay / 25)), 2.0);
// Example: 5 min delay = 0.8x, 10 min = 1.0x, 20 min = 1.4x, 30 min = 1.8x
